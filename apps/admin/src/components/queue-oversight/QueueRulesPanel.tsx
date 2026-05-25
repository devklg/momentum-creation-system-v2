/**
 * E.6 — Queue rule management.
 *
 * Today: flush window (resolved to 8 weeks per locked-spec J.5.2; surfaced
 * here so Kevin can audit-change it). Every change writes an append-only
 * audit entry through the Section J substrate (action='admin.queue.rule.changed').
 *
 * Note: changing the flush_weeks rule only affects FUTURE placements; the
 * 8-week TTL is stamped onto tokens at mint, so existing tokens keep their
 * original expiresAt. The UI calls this out so Kevin doesn't expect a
 * retroactive sweep.
 */

import { useCallback, useEffect, useState } from 'react';
import type { QueueRule, QueueRulesResponse } from '@momentum/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function QueueRulesPanel() {
  const [rules, setRules] = useState<QueueRule[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/admin/queue/rules', { credentials: 'include' });
      const data = (await res.json()) as QueueRulesResponse & { error?: string };
      if (!data.ok) {
        setErr(data.error ?? 'Could not load rules.');
        return;
      }
      setRules(data.rules);
    } catch (e) {
      setErr(e instanceof Error ? `Network error: ${e.message}` : 'Network error.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="mb-10">
      <header className="mb-3">
        <h2 className="font-display text-[22px] leading-none">
          E.6 · Queue rules
        </h2>
        <p className="text-[11px] font-mono tracking-label text-cream-faint uppercase mt-1">
          Managed values · every change append-only audited
        </p>
      </header>

      {err && (
        <p className="text-[13px] font-mono tracking-[0.04em] text-red-400 mb-3">{err}</p>
      )}

      {rules === null ? (
        <p className="text-[12px] font-mono tracking-label text-cream-faint uppercase">
          {loading ? 'Loading…' : 'No rules.'}
        </p>
      ) : (
        <div className="space-y-3">
          {rules.map((r) => (
            <RuleRow key={r.key} rule={r} onSaved={() => void load()} />
          ))}
        </div>
      )}
    </section>
  );
}

function RuleRow({ rule, onSaved }: { rule: QueueRule; onSaved: () => void }) {
  const [draft, setDraft] = useState<string>(String(rule.currentValue));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okFlash, setOkFlash] = useState<string | null>(null);

  const isNumber = typeof rule.currentValue === 'number';
  const dirty = draft.trim() !== String(rule.currentValue);

  async function onSave() {
    if (!dirty) return;
    if (!reason.trim()) {
      setErr('Reason is required for rule changes (audited).');
      return;
    }
    setSaving(true);
    setErr(null);
    setOkFlash(null);
    try {
      const value = isNumber ? Number(draft) : draft;
      if (isNumber && !Number.isFinite(value as number)) {
        setErr('Value must be a number.');
        return;
      }
      const res = await fetch(`/api/admin/queue/rules/${encodeURIComponent(rule.key)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value, reason: reason.trim() }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setErr(data.error ?? 'Update failed.');
        return;
      }
      setOkFlash(`Saved · ${rule.label} now ${draft}${rule.unit ? ' ' + rule.unit : ''}.`);
      setReason('');
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? `Network error: ${e.message}` : 'Network error.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-ink-2 border border-line rounded-md p-4">
      <div className="flex items-baseline justify-between mb-1">
        <p className="text-cream font-mono">
          {rule.label}{' '}
          <span className="text-cream-faint text-[11px] tracking-label uppercase">
            · {rule.key}
          </span>
        </p>
        <p className="font-display text-[20px] text-gold leading-none">
          {String(rule.currentValue)}
          {rule.unit ? <span className="text-cream-mute text-sm ml-1">{rule.unit}</span> : null}
        </p>
      </div>
      <p className="text-[12px] text-cream-mute mb-3">{rule.description}</p>

      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block">
            <span className="text-[10px] font-mono tracking-label text-cream-faint uppercase block mb-1">
              New value
            </span>
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              inputMode={isNumber ? 'numeric' : undefined}
              className="w-24"
            />
          </label>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block">
            <span className="text-[10px] font-mono tracking-label text-cream-faint uppercase block mb-1">
              Reason (required)
            </span>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="why this change · audited"
            />
          </label>
        </div>
        <Button onClick={() => void onSave()} disabled={!dirty || saving}>
          {saving ? 'Saving…' : 'Save change'}
        </Button>
      </div>

      <p className="text-[11px] font-mono text-cream-faint mt-3">
        default {String(rule.defaultValue)}
        {rule.unit ? ` ${rule.unit}` : ''} ·{' '}
        {rule.lastChangedAt
          ? `last changed ${new Date(rule.lastChangedAt).toLocaleString()} by ${rule.lastChangedBy ?? '—'}`
          : 'never changed'}
      </p>

      {err && (
        <p className="text-[13px] font-mono tracking-[0.04em] text-red-400 mt-2">{err}</p>
      )}
      {okFlash && (
        <p className="text-[13px] font-mono tracking-[0.04em] text-teal mt-2">{okFlash}</p>
      )}
    </div>
  );
}
