# App State Audit And Printable Checklist

Date: 2026-06-23
Branch: `codex/app-state-audit-checklist`
Base audited: `origin/main` at `4a2b2df`

This audit covers the current repo state for:

1. `apps/com` / `teammagnificent.com`
2. `apps/team` / `teammagnificent.team`
3. `apps/admin` / `admin.teammagnificent.team`
4. Shared server, workers, and launch dependencies that affect all three surfaces

## Current State Summary

### 1. `.com` Prospect Surface

Routes currently wired:

1. `/p/login`
2. `/p/login/r/:linkToken`
3. `/p/:token`
4. `/rvm/:token`
5. wildcard fallback to `/p/invalid`

Built now:

1. [x] PMV token presentation route exists at `/p/:token`.
2. [x] RVM token presentation route exists at `/rvm/:token`.
3. [x] RVM activation happens on click before video presentation.
4. [x] PMV/RVM presentation copy is split through a shared copy layer.
5. [x] Video milestone tracking is wired through the presentation mechanics.
6. [x] Prospect dashboard is placed after `video_complete`, not before.
7. [x] Callback and webinar CTAs are present in the prospect dashboard flow.
8. [x] Prospect re-entry login and magic-link routes are present.
9. [x] Token edge states exist for invalid, expired, and enrolled states.
10. [x] Prospect-facing route copy has been kept away from income, placement promises, spillover, company branding, and AI prospecting language in recent VM/RVM work.

Partial, dormant, or missing:

1. [ ] There is no root `.com` homepage route at `/` yet.
2. [ ] Webinar confirmation email is wired through Resend but dormant until the `teammagnificent.com` sending domain is verified and configured.
3. [ ] PMV/RVM needs full browser smoke testing with live fixture tokens after the latest merge.
4. [ ] The older comments around some presentation/dashboard files still call pieces "placeholder" even where the real component now exists; these comments should be reconciled.
5. [ ] Dossier/testimonial style content is intentionally deferred for a later version and is not part of the current complete app.

### 2. `.team` BA Surface

Routes currently wired:

1. `/register`
2. `/login`
3. `/welcome`
4. `/michael/schedule`
5. `/michael/interview`
6. `/steve/discovery`
7. `/cockpit`
8. `/invitations`
9. `/video-library`
10. `/ivory`
11. `/ivory/momentum`
12. `/crm`
13. `/vm-campaigns`
14. `/profile`
15. `/leadership`
16. `/training/10-steps`
17. `/training/fast-start`
18. `/training/fast-start/product`
19. `/training/fast-start/comp-layer-1`
20. `/training/fast-start/binary`
21. `/training/fast-start/prospect-list`
22. `/training/fast-start/team`
23. `/onboarding/questionnaire`
24. `/sponsor/interview-workbook/:baId`
25. `/preview`

Built now:

1. [x] Registration and login routes are present.
2. [x] Welcome and Michael gate routes are present.
3. [x] Michael schedule and interview routes are present.
4. [x] Steve discovery route is present.
5. [x] Cockpit route is present with sponsor, invitation, CRM, orientation, and activity surfaces.
6. [x] Invitation route is present.
7. [x] Video library route is present.
8. [x] Ivory and Ivory momentum routes are present.
9. [x] CRM route is present.
10. [x] VM campaigns route is present.
11. [x] Profile route is present.
12. [x] Leadership route is present.
13. [x] Fast Start and training routes are present.
14. [x] Onboarding questionnaire and sponsor workbook routes are present.
15. [x] Preview sandbox route is present.

Partial, dormant, or needing acceptance:

1. [ ] VM campaign create/import/send flow needs final end-to-end fixture testing from `.team` through `.com`.
2. [ ] Michael and Steve agent flows need acceptance testing with the current local environment and worker configuration.
3. [ ] Some project-wireframe parent rows still show partial status even though their child leaves are checked; the document state needs reconciliation.
4. [ ] Preview/video placeholder behavior appears intentional, but should be confirmed against the desired complete-app experience.
5. [ ] Any Anthropic-backed surfaces depend on environment keys; dormant fallback behavior should be tested in production-like env.

### 3. `/admin` Kevin Surface

Routes currently wired:

1. `/dashboard`
2. `/access-codes`
3. `/bas`
4. `/prospects`
5. `/queue`
6. `/live-ops`
7. `/audit`
8. `/reports`
9. `/tenant`
10. `/orientation`
11. `/vm`
12. `/agents`
13. `/broadcast`

Built now:

1. [x] Admin route shell and navigation are present.
2. [x] Server-side admin gate is mounted for admin APIs.
3. [x] Dashboard route is present.
4. [x] Access codes route is present.
5. [x] BA oversight route is present.
6. [x] Prospect oversight route is present.
7. [x] Queue route is present.
8. [x] Live Ops route is present.
9. [x] Audit route is present.
10. [x] Reports route is present.
11. [x] Tenant route is present.
12. [x] Orientation route is present.
13. [x] VM admin route is present.
14. [x] Agents route is present.
15. [x] Broadcast route is present.

Partial, dormant, or stubbed:

1. [ ] Tenant Architecture has one explicit open item: add the read-only URL-structure panel.
2. [ ] Live Ops UI currently has mocks enabled in `apps/admin/src/routes/live-ops.tsx`; real-data replacement or acceptance is still needed.
3. [ ] VM provider mode can still resolve to a provider placeholder/stub path.
4. [ ] VM notification hooks currently report stubbed status.
5. [ ] VM ownership correction is logged as a requested stub and does not yet mutate ownership.
6. [ ] Broadcast SMS is live-path capable, but email remains dormant until Resend domain/key configuration is complete.
7. [ ] Admin VM/provider health should be tested with the real provider configuration before launch.
8. [ ] Admin agent/outbox surfaces should be tested against live memory and queue data, not just route presence.

### 4. Shared Server And Infrastructure

Built now:

1. [x] Express API is mounted with pre-gate prospect/admin routes and gated BA routes.
2. [x] `/api/p` prospect token routes are mounted pre-gate.
3. [x] `/api/rvm` routes are mounted pre-gate.
4. [x] `/api/vm/provider` webhook/provider route is mounted pre-gate.
5. [x] BA-facing routes are mounted behind auth and Michael completion where required.
6. [x] Admin route files are mounted behind admin authorization.
7. [x] VM import, delivery, webhook, and broadcast workers are started from server boot.
8. [x] Triple-stack persistence helpers exist and are the intended write path.

Partial, dormant, or operationally dependent:

1. [ ] Gateway/DB stack must be verified on current local port `2526`.
2. [ ] Resend domain verification is still a launch dependency for email delivery.
3. [ ] Telnyx credentials and webhook signing should be validated against current env.
4. [ ] Anthropic key presence should be checked for live agent-backed flows.
5. [ ] VM provider credentials and webhook loop should be tested with a real provider or approved manual provider mode.
6. [ ] Build registry appears stale compared with code and `project-wireframe.md`; update docs before using it as the final readiness source.

## Printable Tasklist

### Foundation Verification

1. [ ] Update all active worktrees to current `main` at or after `4a2b2df`.
2. [ ] Confirm no stale feature work remains outside the intended worktree.
3. [ ] Run `pnpm install` if dependencies are not current.
4. [ ] Run `pnpm typecheck`.
5. [ ] Run `pnpm build`.
6. [ ] Run `git diff --check`.
7. [ ] Start server and all apps with the intended dev command.
8. [ ] Confirm API health route responds.
9. [ ] Confirm `.com`, `.team`, and `/admin` apps load in browser.
10. [ ] Confirm Gateway access uses port `2526`.

### `.com` Prospect Surface

11. [ ] Smoke test `/p/:token` with a valid PMV token.
12. [ ] Smoke test `/p/:token` invalid token state.
13. [ ] Smoke test `/p/:token` expired token state.
14. [ ] Smoke test `/p/:token` enrolled token state.
15. [ ] Confirm PMV video start event writes correctly.
16. [ ] Confirm PMV quarter milestone writes correctly.
17. [ ] Confirm PMV half milestone writes correctly.
18. [ ] Confirm PMV three-quarter milestone writes correctly.
19. [ ] Confirm PMV `video_complete` writes correctly.
20. [ ] Confirm PMV dashboard appears only after `video_complete`.
21. [ ] Confirm PMV prospect is not placed into Holding Tank before `video_complete`.
22. [ ] Smoke test `/rvm/:token` with a valid RVM token.
23. [ ] Confirm RVM click activation writes correctly.
24. [ ] Confirm RVM video milestone writes correctly.
25. [ ] Confirm RVM dashboard appears only after `video_complete`.
26. [ ] Confirm RVM prospect is not placed into Holding Tank before `video_complete`.
27. [ ] Confirm callback request CTA writes the expected record and alert.
28. [ ] Confirm webinar reservation CTA writes the expected record and alert.
29. [ ] Confirm prospect re-entry login works.
30. [ ] Confirm magic-link re-entry route works.
31. [ ] Run a `.com` copy compliance scan for income claims, placement promises, spillover, company branding, AI prospecting language, and current team head count.
32. [ ] Browser-check `.com` presentation and dashboard on desktop.
33. [ ] Browser-check `.com` presentation and dashboard on mobile.
34. [ ] Add the root `.com` homepage route if it remains part of the desired complete app.
35. [ ] Enable and verify webinar confirmation email after Resend domain setup.

### `.team` BA Surface

36. [ ] Register a fixture BA with an access code.
37. [ ] Confirm login works for the fixture BA.
38. [ ] Confirm Michael gate behavior for an incomplete BA.
39. [ ] Confirm welcome route loads correctly.
40. [ ] Confirm Michael schedule route loads correctly.
41. [ ] Confirm Michael interview route loads correctly.
42. [ ] Confirm Michael interview transcript/event behavior.
43. [ ] Confirm Steve discovery route loads correctly.
44. [ ] Confirm Steve discovery flow persists the expected data.
45. [ ] Confirm Cockpit loads with real BA data.
46. [ ] Confirm Cockpit sponsor card data.
47. [ ] Confirm Cockpit invitation card data.
48. [ ] Confirm Cockpit CRM summary data.
49. [ ] Confirm Cockpit orientation/training card data.
50. [ ] Confirm invitation generator mints PMV tokens.
51. [ ] Confirm invitation-generated tokens open on `.com`.
52. [ ] Confirm ScriptMaker/Ivory fallback behavior when keys are missing.
53. [ ] Confirm ScriptMaker/Ivory live behavior when keys are present.
54. [ ] Confirm CRM list/search/filter behavior.
55. [ ] Confirm CRM prospect detail behavior.
56. [ ] Confirm VM campaign create flow.
57. [ ] Confirm VM import flow.
58. [ ] Confirm VM campaign list/status flow.
59. [ ] Confirm VM campaign tokens open on `.com`.
60. [ ] Confirm profile contact settings update.
61. [ ] Confirm profile password/security settings update.
62. [ ] Confirm profile timezone and notification settings update.
63. [ ] Confirm leadership route content and data.
64. [ ] Confirm Fast Start hub loads.
65. [ ] Confirm Fast Start product module loads.
66. [ ] Confirm Fast Start compensation layer module loads.
67. [ ] Confirm Fast Start binary module loads.
68. [ ] Confirm Fast Start prospect-list module loads.
69. [ ] Confirm Fast Start team module loads.
70. [ ] Confirm training progress persists.
71. [ ] Confirm onboarding questionnaire persists.
72. [ ] Confirm sponsor workbook route loads for authorized viewer.
73. [ ] Confirm preview sandbox does not write persistent prospect state.
74. [ ] Browser-check `.team` on desktop.
75. [ ] Browser-check `.team` on mobile.

### `/admin` Kevin Surface

76. [ ] Confirm admin login and server-side admin gate.
77. [ ] Confirm non-admin user is rejected.
78. [ ] Confirm dashboard metrics load from real data.
79. [ ] Confirm dashboard drilldowns load from real data.
80. [ ] Confirm access code list loads.
81. [ ] Confirm access code creation works.
82. [ ] Confirm BA oversight list loads.
83. [ ] Confirm BA detail route/actions work.
84. [ ] Confirm sponsor override remains audited and restricted.
85. [ ] Confirm leader tag action works.
86. [ ] Confirm prospect oversight list loads.
87. [ ] Confirm prospect interventions write audit entries.
88. [ ] Confirm prospect notes write audit entries.
89. [ ] Confirm queue route loads real queue state.
90. [ ] Confirm queue ticker/window behavior.
91. [ ] Confirm queue rules are visible and accurate.
92. [ ] Replace or explicitly approve Live Ops mock data.
93. [ ] Confirm Live Ops real growth data.
94. [ ] Confirm Live Ops real grid data.
95. [ ] Confirm Live Ops real funnel data.
96. [ ] Confirm Live Ops SSE/fallback behavior.
97. [ ] Confirm audit route loads real audit records.
98. [ ] Confirm reports route loads.
99. [ ] Confirm CSV exports.
100. [ ] Confirm PDF exports.
101. [ ] Confirm report redaction rules.
102. [ ] Add Tenant Architecture read-only URL-structure panel.
103. [ ] Confirm tenant route displays current tenant configuration.
104. [ ] Confirm orientation sessions route loads.
105. [ ] Confirm orientation session create/list behavior.
106. [ ] Confirm broadcast SMS path.
107. [ ] Confirm broadcast email dormant behavior before Resend setup.
108. [ ] Confirm broadcast email live behavior after Resend setup.
109. [ ] Confirm VM admin overview loads.
110. [ ] Confirm VM provider health displays real provider state.
111. [ ] Replace or explicitly approve VM provider placeholder mode.
112. [ ] Implement or explicitly defer VM ownership correction mutation.
113. [ ] Replace or explicitly approve VM notification hook stubs.
114. [ ] Confirm agents overview loads real records.
115. [ ] Confirm projection/outbox records are real and current.
116. [ ] Browser-check `/admin` on desktop.
117. [ ] Browser-check `/admin` on mobile or minimum supported admin viewport.

### VM/RVM End-To-End Readiness

118. [ ] Import a fixture VM/RVM prospect batch.
119. [ ] Confirm imported prospects are tokenized but not placed before `video_complete`.
120. [ ] Send a manual/provider RVM test.
121. [ ] Confirm provider delivery status updates.
122. [ ] Confirm click webhook or click activation updates token status.
123. [ ] Confirm video milestones update token status.
124. [ ] Confirm `video_complete` places the prospect into the correct post-video state.
125. [ ] Confirm callback request creates the expected BA-facing alert.
126. [ ] Confirm webinar reservation creates the expected BA-facing alert.
127. [ ] Confirm suppression and duplicate handling.
128. [ ] Confirm provider failure/retry behavior.
129. [ ] Confirm admin can audit the entire RVM path.

### Compliance And Copy

130. [ ] Scan all `.com` rendered copy for income claims.
131. [ ] Scan all `.com` rendered copy for placement promises.
132. [ ] Scan all `.com` rendered copy for spillover language.
133. [ ] Scan all `.com` rendered copy for company branding or logo usage.
134. [ ] Scan all `.com` rendered copy for AI prospecting language.
135. [ ] Scan all `.com` rendered copy for current team head count.
136. [ ] Scan outbound SMS/email copy for the same compliance rules.
137. [ ] Confirm alerts say the correct BA will reach out, not a hard-coded person.
138. [ ] Confirm PMV wording remains People, Momentum, Volume, Checks.

### Docs And Source Of Truth

139. [ ] Reconcile `docs/project-wireframe.md` parent rows that are stale partials.
140. [ ] Update `docs/build-registry.md` to match current shipped state.
141. [ ] Regenerate the printable build checklist if required.
142. [ ] Regenerate any route/page inventory docs if required.
143. [ ] Record remaining launch decisions in the decision ledger.
144. [ ] Keep this audit checklist updated after each closing pass.

### Launch Operations

145. [ ] Verify production `.env` values for server.
146. [ ] Verify production `.env` values for `.com`.
147. [ ] Verify production `.env` values for `.team`.
148. [ ] Verify production `.env` values for `/admin`.
149. [ ] Verify cookie domain and CORS settings.
150. [ ] Verify `ADMIN_BA_IDS` allowlist.
151. [ ] Verify MongoDB connectivity.
152. [ ] Verify Neo4j connectivity.
153. [ ] Verify ChromaDB connectivity.
154. [ ] Verify Gateway connectivity on port `2526`.
155. [ ] Verify Telnyx credentials and signatures.
156. [ ] Verify Resend domain and sender.
157. [ ] Verify Anthropic key if live agent surfaces are enabled.
158. [ ] Verify VM provider credentials.
159. [ ] Run final desktop smoke across `.com`, `.team`, and `/admin`.
160. [ ] Run final mobile smoke across `.com` and `.team`.
161. [ ] Run final admin smoke at the minimum supported admin viewport.
162. [ ] Confirm no uncommitted production code changes remain.
163. [ ] Confirm branch, commit, and deployment tags are recorded.

