/**
 * VM notification and team-news hook registry.
 *
 * Agent 6 owns the hook points, not live delivery. These rows document the
 * triggers the VM/import/provider agents will call after their persistence
 * lands. No hook sends to prospects and no hook exposes another BA's private
 * lead ownership.
 */

import type {
  McsAdminVmNotificationHook,
  McsAdminVmTeamNewsHook,
} from '@momentum/shared';

export function listVmNotificationHooks(): McsAdminVmNotificationHook[] {
  return [
    {
      hookId: 'vm.lead_activated.owner_ba',
      trigger: 'vm_lead_activated',
      audience: 'owning_ba',
      channel: 'in_app',
      status: 'stubbed',
      privacyBoundary: 'Only the owning BA sees lead identity and callback context.',
    },
    {
      hookId: 'vm.token_clicked.owner_ba',
      trigger: 'prospect_clicked_token',
      audience: 'owning_ba',
      channel: 'in_app',
      status: 'stubbed',
      privacyBoundary: 'Click alerts route by ownerTmagId stamped on the token.',
    },
    {
      hookId: 'vm.presentation_started.owner_ba',
      trigger: 'presentation_started',
      audience: 'owning_ba',
      channel: 'in_app',
      status: 'stubbed',
      privacyBoundary: 'Presentation activity is BA-scoped to the lead owner.',
    },
    {
      hookId: 'vm.presentation_completed.owner_ba',
      trigger: 'presentation_completed',
      audience: 'owning_ba',
      channel: 'sms',
      status: 'stubbed',
      privacyBoundary: 'Mirrors existing PMV completion alert; never changes ownership.',
    },
    {
      hookId: 'vm.callback_requested.owner_ba',
      trigger: 'callback_requested',
      audience: 'owning_ba',
      channel: 'sms',
      status: 'stubbed',
      privacyBoundary: 'Callback routing resolves from ownerTmagId, not request body.',
    },
    {
      hookId: 'vm.info_requested.owner_ba',
      trigger: 'info_requested',
      audience: 'owning_ba',
      channel: 'in_app',
      status: 'stubbed',
      privacyBoundary: 'Info-request visibility stays with the owning BA.',
    },
    {
      hookId: 'vm.follow_up_due.owner_ba',
      trigger: 'follow_up_due',
      audience: 'owning_ba',
      channel: 'in_app',
      status: 'stubbed',
      privacyBoundary: 'Follow-up reminders read only the BA-owned CRM record.',
    },
    {
      hookId: 'vm.campaign_completed.admin',
      trigger: 'campaign_completed',
      audience: 'admin',
      channel: 'in_app',
      status: 'stubbed',
      privacyBoundary: 'Admin sees aggregate campaign status and audited drill-in.',
    },
    {
      hookId: 'vm.import_completed.admin',
      trigger: 'import_completed',
      audience: 'admin',
      channel: 'in_app',
      status: 'stubbed',
      privacyBoundary: 'Import completion reports aggregate health and suppression counts.',
    },
    {
      hookId: 'vm.event_starting_soon.team',
      trigger: 'event_starting_soon',
      audience: 'team',
      channel: 'team_news',
      status: 'stubbed',
      privacyBoundary: 'Team-wide event nudges contain no private lead data.',
    },
  ];
}

export function listVmTeamNewsHooks(): McsAdminVmTeamNewsHook[] {
  return [
    {
      hookId: 'team_news.vm_campaign_milestone',
      source: 'campaign_milestone',
      status: 'stubbed',
      reviewRequired: true,
      note: 'Candidate milestones queue for admin review before becoming team news.',
    },
    {
      hookId: 'team_news.training_update',
      source: 'training_update',
      status: 'stubbed',
      reviewRequired: true,
      note: 'Training updates can be published without touching prospect records.',
    },
    {
      hookId: 'team_news.event_update',
      source: 'event_update',
      status: 'stubbed',
      reviewRequired: true,
      note: 'Event hooks reuse group orientation and webinar records.',
    },
    {
      hookId: 'team_news.success_story',
      source: 'success_story',
      status: 'stubbed',
      reviewRequired: true,
      note: 'Success stories require consent and compliance review before publication.',
    },
    {
      hookId: 'team_news.momentum_update',
      source: 'team_momentum',
      status: 'stubbed',
      reviewRequired: true,
      note: 'Momentum updates stay aggregate; no current head count appears on .com.',
    },
  ];
}
