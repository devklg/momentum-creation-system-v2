/**
 * Broadcast delivery worker (Chat #144 G.5 fan-out).
 *
 * In-process queue worker that tails `broadcast_recipients` for rows in
 * status='queued', marks them 'sending', dispatches via Telnyx (SMS) and
 * Resend (email), then advances per-row status to 'sent' or 'failed'.
 * After each row resolves it reconciles the parent broadcast's top-level
 * status so the BroadcastStatus UI can poll one document instead of
 * recomputing from rows.
 *
 * Why an in-memory worker and not a cron / external queue:
 *   - Single-process server today (locked-spec deployment posture: one
 *     Express container behind the proxy)
 *   - Resend / Telnyx already retry transient errors internally
 *   - At v1 team size (~41 BAs growing) a full-team broadcast is ≤ a
 *     few dozen sends — order seconds at 1 tick/s with concurrency 10
 *
 * Failure handling:
 *   - Each row carries `attempts` (incremented on each mark-sending).
 *   - Telnyx / Resend success → status='sent', message ids stamped.
 *   - Transient failure (5xx, network, config) → status='queued' again
 *     until MAX_ATTEMPTS, then 'failed' with the last reason.
 *   - Hard failure (4xx response that won't change on retry) → 'failed'
 *     immediately.
 *   - ResendConfigError (the dormant-email case) → 'failed' with reason
 *     'email_skipped_dormant' so Kevin sees the email leg explicitly
 *     skipped rather than mysteriously hanging.
 *
 * Boot discipline:
 *   - `resetStuckSendingRows()` runs once at start so a server restart
 *     mid-broadcast doesn't strand 'sending' rows.
 *   - The tick interval is 1s; pulls up to BATCH rows per tick and runs
 *     them concurrently (best-effort).
 */

import { sendSms, TelnyxError, TelnyxConfigError } from './telnyx.js';
import { sendEmail, ResendError, ResendConfigError } from './resend.js';
import {
  claimQueuedRows,
  markRecipientResult,
  markRecipientSending,
  reconcileBroadcastStatus,
  resetStuckSendingRows,
} from '../domain/broadcast.js';
import type {
  McsBroadcastRecipientRow,
  McsBroadcastRecipientStatus,
} from '@momentum/shared';

const TICK_MS = 1000;
const BATCH = 10;
const MAX_ATTEMPTS = 3;

let workerStarted = false;

export function getBroadcastWorkerStatus() {
  return { started: workerStarted };
}
let timer: NodeJS.Timeout | null = null;
let tickInFlight = false;

/**
 * Idempotent. Safe to call from app boot.
 */
export async function startBroadcastWorker(): Promise<void> {
  if (workerStarted) return;
  workerStarted = true;

  try {
    const resetCount = await resetStuckSendingRows();
    if (resetCount > 0) {
      // eslint-disable-next-line no-console
      console.log(`[broadcastQueue] boot reset ${resetCount} stuck 'sending' rows back to 'queued'`);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[broadcastQueue] boot reset failed (continuing)', err);
  }

  timer = setInterval(() => {
    void tick();
  }, TICK_MS);
  // eslint-disable-next-line no-console
  console.log(`[broadcastQueue] worker started — tick=${TICK_MS}ms, batch=${BATCH}, maxAttempts=${MAX_ATTEMPTS}`);
}

export function stopBroadcastWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  workerStarted = false;
}

async function tick(): Promise<void> {
  if (tickInFlight) return;
  tickInFlight = true;
  try {
    const rows = await claimQueuedRows(BATCH);
    if (rows.length === 0) return;

    // Process rows concurrently — the upstream APIs handle rate-limiting
    // internally. Group broadcastIds for one reconciliation per affected
    // broadcast at the end.
    const affectedBroadcasts = new Set<string>();
    await Promise.all(
      rows.map(async (row) => {
        affectedBroadcasts.add(row.broadcastId);
        await dispatchOne(row);
      }),
    );
    for (const id of affectedBroadcasts) {
      try {
        await reconcileBroadcastStatus(id);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[broadcastQueue] reconcile failed for ${id}`, err);
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[broadcastQueue] tick failed', err);
  } finally {
    tickInFlight = false;
  }
}

/**
 * Dispatch one row. Marks 'sending', calls transport(s), records result.
 * Public so the send-test route can run a row inline without going
 * through the queue.
 */
export async function dispatchOne(row: McsBroadcastRecipientRow): Promise<McsBroadcastRecipientRow> {
  await markRecipientSending(row.rowId);
  const attempt = row.attempts + 1;

  const wantsSms = row.channel === 'sms' || row.channel === 'both';
  const wantsEmail = row.channel === 'email' || row.channel === 'both';

  let smsMessageId: string | null = null;
  let emailMessageId: string | null = null;
  const failures: string[] = [];
  let smsHardFail = false;
  let emailHardFail = false;

  if (wantsSms) {
    if (!row.recipientPhone || !row.smsRendered) {
      failures.push('sms_no_address');
      smsHardFail = true;
    } else {
      try {
        const r = await sendSms({ to: row.recipientPhone, text: row.smsRendered });
        smsMessageId = r.messageId;
      } catch (err) {
        const { reason, hard } = classifyError(err);
        failures.push(`sms_${reason}`);
        smsHardFail = hard;
      }
    }
  }

  if (wantsEmail) {
    if (!row.recipientEmail || !row.emailSubjectRendered || !row.emailTextRendered) {
      failures.push('email_no_address');
      emailHardFail = true;
    } else {
      try {
        const r = await sendEmail({
          to: row.recipientEmail,
          subject: row.emailSubjectRendered,
          text: row.emailTextRendered,
        });
        emailMessageId = r.messageId;
      } catch (err) {
        const { reason, hard } = classifyError(err);
        failures.push(`email_${reason}`);
        emailHardFail = hard;
      }
    }
  }

  const anySuccess = smsMessageId !== null || emailMessageId !== null;

  // Sent if at least one leg succeeded. "Both legs but one failed" still
  // delivered the message on the other channel — the audit captures the
  // partial failure via failureReason.
  if (anySuccess) {
    const status: McsBroadcastRecipientStatus = 'sent';
    await markRecipientResult(row.rowId, {
      status,
      smsMessageId,
      emailMessageId,
      failureReason: failures.length > 0 ? `partial:${failures.join(',')}` : null,
    });
    return { ...row, status, smsMessageId, emailMessageId };
  }

  // No success. Decide retry vs. fail.
  const allHard = smsHardFail && (wantsEmail ? emailHardFail : true);
  const exhausted = attempt >= MAX_ATTEMPTS;
  if (allHard || exhausted) {
    const status: McsBroadcastRecipientStatus = 'failed';
    await markRecipientResult(row.rowId, {
      status,
      failureReason: failures.length > 0 ? failures.join(',') : 'unknown',
    });
    return { ...row, status, failureReason: failures.join(',') };
  }

  // Retry — drop back to 'queued', clear startedAt so the next tick
  // picks it up. attempts already incremented by markRecipientSending.
  await markRecipientResult(row.rowId, {
    status: 'queued',
    failureReason: failures.join(','),
  });
  return { ...row, status: 'queued' };
}

interface ClassifiedError {
  reason: string;
  /** True when retrying is pointless (config error / 4xx that won't change). */
  hard: boolean;
}

function classifyError(err: unknown): ClassifiedError {
  if (err instanceof ResendConfigError) return { reason: 'skipped_dormant', hard: true };
  if (err instanceof TelnyxConfigError) return { reason: 'config_error', hard: true };
  if (err instanceof TelnyxError) {
    return {
      reason: `telnyx_${err.status}`,
      hard: err.status >= 400 && err.status < 500 && err.status !== 429,
    };
  }
  if (err instanceof ResendError) {
    return {
      reason: `resend_${err.status}`,
      hard: err.status >= 400 && err.status < 500 && err.status !== 429,
    };
  }
  const msg = err instanceof Error ? err.message.slice(0, 120) : 'unknown';
  return { reason: msg, hard: false };
}
