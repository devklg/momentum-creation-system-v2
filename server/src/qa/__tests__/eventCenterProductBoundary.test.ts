import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MCS_EVENT_CENTER_CATALOG as catalog } from '@momentum/shared';

const root = path.resolve(process.cwd(), '..');

describe('P2-106 Event Center attendance and CRM connection', () => {
  it('builds one named surface over the unified read API', () => {
    expect(catalog).toMatchObject({
      productBoundary: 'named_event_discovery_and_coordination_surface_over_source_owned_events',
      currentState: 'attendance_to_human_crm_live',
      teamRoute: '/events',
      adminRoute: '/events',
    });
    const teamApp = readFileSync(path.join(root, 'apps/team/src/App.tsx'), 'utf8');
    const adminApp = readFileSync(path.join(root, 'apps/admin/src/App.tsx'), 'utf8');
    expect(teamApp).toContain('path="/events"');
    expect(adminApp).toContain('path="/events"');
    expect(catalog.deferred).not.toHaveProperty('p2_104');
    const server = readFileSync(path.join(root, 'server/src/index.ts'), 'utf8');
    expect(server).toContain("app.use('/api/events', eventRoutes)");
    expect(server).toContain("app.use('/api/admin/events', adminEventRoutes)");
  });

  it('keeps orientation, webinar, materials, and CRM truth with their owners', () => {
    expect(catalog.sourceDomains).toEqual(expect.arrayContaining([
      expect.objectContaining({ domain: 'new_member_orientation', owner: 'orientation' }),
      expect.objectContaining({ domain: 'prospect_webinars', owner: 'prospect_webinar' }),
      expect.objectContaining({ domain: 'event_materials', inference: 'forbidden' }),
    ]));
    expect(catalog.lifecycleRules).toMatchObject({
      reservationDoesNotProveAttendance: true,
      elapsedTimeDoesNotProveAttendance: true,
      sponsorIdentityRemainsTokenDerived: true,
      crmFollowUpRemainsHumanOwned: true,
      attendanceRequiresExplicitAdminAction: true,
      attendanceCreatesNoAutomatedContact: true,
      existingCrmReminderIsPreserved: true,
    });
    expect(catalog.exclusions).toEqual(expect.arrayContaining([
      'automatic_attendance_inference', 'automatic_prospect_follow_up',
      'resource_approval_or_publishing', 'duplicate_orientation_or_webinar_records',
    ]));
  });

  it('defines the additive P2-106 model with explicit attendance only', () => {
    expect(catalog).toMatchObject({
      currentState: 'attendance_to_human_crm_live',
      normalizedModel: {
        schemaVersion: 'event_center.v1.2',
        persistence: 'source_owned_attendance_plus_read_projection',
        acr: 'ACR-0016',
      },
    });
    expect(catalog.normalizedModel.fields).toEqual(expect.arrayContaining([
      'eventType', 'visibility', 'capacity', 'registration', 'reminders', 'attendance', 'followUp',
    ]));
    expect(catalog.deferred).not.toHaveProperty('p2_105');
    expect(catalog.deferred).not.toHaveProperty('p2_106');
  });

  it('records the audit as the implementation authority', () => {
    const tasklist = readFileSync(path.join(root, 'PLATFORM_AUDIT_PRIORITY_TASKLIST.md'), 'utf8');
    const boundary = readFileSync(path.join(root, 'docs/event-center-product-boundary.md'), 'utf8');
    expect(tasklist).toMatch(/\[x\] 103\. \*\*Event Center:\*\*/);
    expect(tasklist).toMatch(/\[x\] 104\. \*\*Event Center:\*\*/);
    expect(tasklist).toMatch(/\[x\] 105\. \*\*Event Center:\*\*/);
    expect(tasklist).toMatch(/\[x\] 106\. \*\*Event Center:\*\*/);
    expect(boundary).toContain('A reservation proves only that a seat was reserved.');
  });
});
