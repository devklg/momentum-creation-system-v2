import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '..');
const doc = readFileSync(path.join(repoRoot, 'engineering/sprints/platform-audit-p1/VM_RVM_LIFECYCLE_SCHEMAS.md'), 'utf8');

describe('P1 VM/RVM lifecycle schema reference', () => {
  it('covers every required lifecycle record family and runtime collection', () => {
    for (const heading of ['Campaign schema', 'Recipient schema', 'Queue job and attempt schema', 'Provider webhook schema', 'Delivery event / attempt schema', 'RVM token schema']) {
      expect(doc).toContain(`## ${heading}`);
    }
    for (const collection of ['tmag_vm_campaigns', 'tmag_vm_bulk_leads', 'tmag_vm_queue_jobs', 'tmag_vm_provider_webhook_events', 'tmag_vm_delivery_events', 'tmag_prospect_invite_tokens']) {
      expect(doc).toContain(collection);
    }
  });

  it('records the live runtime safety and integrity boundaries', () => {
    expect(doc).toContain('does not authorize live delivery');
    expect(doc).toContain('Only `video_complete` invokes placement');
    expect(doc).toContain('waiting does not burn an attempt');
    expect(doc).toContain('P1-80 owns that correction');
    expect(doc).toContain('documented findings, not permission to perform an unreviewed data migration');
  });

  it('stays anchored to the runtime status vocabularies', () => {
    const queueSource = readFileSync(path.join(repoRoot, 'server/src/domain/vmProviderQueue.ts'), 'utf8');
    const campaignSource = readFileSync(path.join(repoRoot, 'server/src/domain/vmCampaigns.ts'), 'utf8');
    for (const status of ['queued', 'processing', 'complete', 'dead_lettered', 'skipped']) {
      expect(queueSource).toContain(`'${status}'`);
      expect(doc).toContain(`\`${status}\``);
    }
    for (const action of ['ready', 'schedule', 'start', 'pause', 'resume', 'cancel']) {
      expect(campaignSource).toContain(`case '${action}'`);
      expect(doc).toContain(`\`${action}\``);
    }
  });
});

