export const MCS_LAUNCH_CENTER_CATALOG = {
  surface: 'launch_center',
  productBoundary: 'named_first_run_surface_within_cockpit',
  teamRoute: '/cockpit',
  apiRoute: '/api/cockpit/launch',
  access: 'ba_authenticated_pre_steve',
  component: 'apps/team/src/components/launch/LaunchCenter.tsx',
  projection: 'server/src/domain/cockpit.ts#getTeamLaunchCenter',
  lifecycle: 'first_run_then_operational_pmv',
  dataDomains: [
    'welcome_commitment', 'steve_success_interview', 'michael_status',
    'training_progress', 'ivory_names', 'invitations', 'sponsor_identity',
  ],
  sourceCollections: [
    'team_magnificent_members', 'tmag_commitments', 'tmag_steve_success_interview',
    'tmag_fast_start_progress', 'michael_interviews', 'tmag_ivory_prospect_names',
    'tmag_prospects', 'tmag_prospect_invite_tokens',
  ],
  knownCaveats: [
    'drafted_and_minted_counts_share_current_invitation_evidence',
    'michael_completion_timestamp_not_available',
    'sponsor_confirmation_not_separately_tracked',
    'profile_and_crm_readiness_deferred_to_p2_97',
  ],
  prohibited: ['separate_launch_center_route', 'person_score', 'person_rank', 'person_classification', 'outcome_prediction'],
} as const;
