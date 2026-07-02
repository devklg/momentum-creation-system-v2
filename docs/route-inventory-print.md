# Momentum Creation System Route Inventory

Print format: black-and-white friendly, plain text, numbered list.

Source checked: current React route files in `apps/*/src/App.tsx` and Express API route files under `server/src/routes`.

## Client App Routes

1. `teammagnificent.com /p/login` - Prospect phone login page for returning prospects.
2. `teammagnificent.com /p/login/r/:linkToken` - Prospect magic-link redemption page.
3. `teammagnificent.com /p/:token` - Prospect replicated page or dashboard for a specific invitation token.
4. `teammagnificent.com *` - Fallback route; redirects unknown prospect paths to `/p/invalid`.

5. `teammagnificent.team /` - Brand Ambassador app root; redirects to `/register`.
6. `teammagnificent.team /register` - Access code and account registration flow.
7. `teammagnificent.team /login` - Brand Ambassador login page.
8. `teammagnificent.team /welcome` - First-login welcome and orientation page.
9. `teammagnificent.team /michael/schedule` - Schedule the Michael interview call.
10. `teammagnificent.team /michael/interview` - Michael interview page and call status surface.
11. `teammagnificent.team /cockpit` - BA operational dashboard for invitations, follow-ups, and activity.
12. `teammagnificent.team /invitations` - Invitation creation and sending workflow.
13. `teammagnificent.team /video-library` - Training and presentation video library.
14. `teammagnificent.team /ivory` - Warm-market relationship engine and generator workspace.
15. `teammagnificent.team /profile` - BA profile, preferences, password, email, and phone settings.
16. `teammagnificent.team /training/10-steps` - Ten-step training reference for live call orientation.
17. `teammagnificent.team /training/fast-start` - Fast Start training hub.
18. `teammagnificent.team /training/fast-start/product` - Fast Start Module 1: product training.
19. `teammagnificent.team /training/fast-start/comp-layer-1` - Fast Start Module 2: compensation layer one.
20. `teammagnificent.team /training/fast-start/binary` - Fast Start Module 3: binary team structure.
21. `teammagnificent.team /training/fast-start/prospect-list` - Fast Start Module 4: prospect list building.
22. `teammagnificent.team /training/fast-start/team` - Fast Start Module 5: team-building mindset and action.
23. `teammagnificent.team /onboarding/questionnaire` - BA onboarding questionnaire.
24. `teammagnificent.team /sponsor/interview-workbook/:baId` - Sponsor-facing interview workbook for a BA.
25. `teammagnificent.team /preview` - BA preview of the replicated prospect-facing page.
26. `teammagnificent.team *` - BA app fallback route; shows a 404 not found state.

27. `admin.teammagnificent.team *` - When logged out, any admin path displays the admin login page.
28. `admin.teammagnificent.team /` - Admin root; redirects to `/dashboard`.
29. `admin.teammagnificent.team /dashboard` - Admin metrics dashboard and live event stream.
30. `admin.teammagnificent.team /access-codes` - Admin access code creation and review.
31. `admin.teammagnificent.team /bas` - Brand Ambassador directory and administrative controls.
32. `admin.teammagnificent.team /prospects` - Prospect oversight, detail, intervention, and admin CRUD.
33. `admin.teammagnificent.team /queue` - Holding tank and queue visibility controls.
34. `admin.teammagnificent.team /live-ops` - Live operations growth, funnel, grid, and usage panels.
35. `admin.teammagnificent.team /audit` - Audit log review.
36. `admin.teammagnificent.team /reports` - Admin reporting and export center.
37. `admin.teammagnificent.team /broadcast` - Kevin-only broadcast composer and status view.
38. `admin.teammagnificent.team *` - Authenticated admin fallback route; shows a 404 not found state.

## Shared API Routes

39. `GET /api/health` - Basic server health check.
40. `GET /api/health/persistence` - external MCP tooling connectivity health check.

41. `POST /api/auth/verify-code` - Validate an access code before registration.
42. `POST /api/auth/register` - Create a BA account.
43. `POST /api/auth/login` - Log a BA into the team app.
44. `POST /api/auth/logout` - Log out the current BA session.
45. `GET /api/auth/me` - Return the currently authenticated BA session.

46. `POST /api/welcome/load` - Load first-login welcome state for a BA.
47. `POST /api/welcome/accept` - Save the BA welcome or boundary acknowledgement.

48. `GET /api/onboarding/questionnaire/status` - Load questionnaire completion status.
49. `POST /api/onboarding/questionnaire/load` - Load saved questionnaire data.
50. `POST /api/onboarding/questionnaire/submit` - Submit onboarding questionnaire answers.

51. `GET /api/sponsor/workbook/:baId` - Load sponsor workbook for a specific BA.
52. `PUT /api/sponsor/workbook/:baId/draft` - Save a sponsor workbook draft.
53. `POST /api/sponsor/workbook/:baId/finalize` - Finalize the sponsor workbook.

54. `GET /api/michael/slots` - Return available Michael interview slots.
55. `POST /api/michael/book` - Book a Michael interview slot.
56. `GET /api/michael/status` - Return Michael scheduling and interview status.
57. `GET /api/michael/interview/state` - Load current Michael interview state.
58. `POST /api/michael/interview/wrong-number` - Record that the Michael call reached the wrong number.
59. `GET /api/michael/interview/transcript/stream` - Stream Michael interview transcript events.
60. `POST /api/michael/interview/transcript/chunk` - Save a Michael transcript chunk.
61. `POST /api/michael/interview/scoring` - Legacy route name; saves Michael Training Agent + Daily Success Coach artifact and ignores scoring fields.
62. `POST /api/michael/interview/stt-fail` - Record a speech-to-text failure during the interview.
63. `GET /api/michael/interview/cockpit/:downlineBaId` - Admin or sponsor cockpit view of a downline Michael interview.

64. `POST /api/telnyx/webhook` - Receive Telnyx webhook events.

65. `POST /api/p/login/start` - Start prospect re-entry login by phone.
66. `POST /api/p/login/redeem` - Redeem a prospect magic-link token.
67. `GET /api/p/:token` - Resolve a prospect invitation token.
68. `POST /api/p/:token/video-event` - Record prospect video engagement.
69. `POST /api/p/:token/callback-request` - Save a prospect callback request.
70. `GET /api/p/:token/stream` - Stream prospect placement or page events.
71. `POST /api/p/:token/webinar-reserve` - Reserve a prospect for a webinar event.
72. `GET /api/p/:token/team-stats` - Return public team statistics for a prospect page.

73. `POST /api/invitations` - Create or mint an invitation.
74. `POST /api/invitations/:prospectId/sent` - Mark an invitation as sent.
75. `POST /api/invitations/log` - Log invitation activity.

76. `GET /api/cockpit/invites` - Load BA invitation pipeline rows.
77. `GET /api/cockpit/summary` - Load BA cockpit summary metrics.
78. `GET /api/cockpit/todays-actions` - Load the BA's Today's Actions card.
79. `GET /api/cockpit/invites/print.pdf` - Generate a printable cockpit invite report.

80. `GET /api/crm/today` - Load BA CRM follow-ups due today.
81. `GET /api/crm/:prospectId` - Load one BA-owned prospect record.
82. `POST /api/crm/:prospectId/notes` - Add a note to a BA-owned prospect.
83. `POST /api/crm/:prospectId/followup` - Set a follow-up reminder.
84. `DELETE /api/crm/:prospectId/followup` - Clear a follow-up reminder.
85. `POST /api/crm/:prospectId/disposition` - Update prospect disposition.
86. `POST /api/crm/:prospectId/reinvite` - Re-invite a prospect.
87. `POST /api/crm` - Create a manual CRM prospect.
88. `PUT /api/crm/:prospectId` - Update a BA-owned prospect.
89. `DELETE /api/crm/:prospectId` - Delete a BA-owned prospect.

90. `POST /api/scriptmaker/draft` - Draft a product-anchored invitation message.

91. `GET /api/ivory` - Load BA Ivory relationship list.
92. `POST /api/ivory` - Add a person to Ivory.
93. `PATCH /api/ivory/:ivoryId` - Update an Ivory person.
94. `PATCH /api/ivory/:ivoryId/status` - Update Ivory relationship status.
95. `DELETE /api/ivory/:ivoryId` - Delete an Ivory person.
96. `POST /api/ivory/coach` - Run the Ivory WDYK coaching prompt.
97. `POST /api/ivory/generator/run` - Start an Ivory generator run.
98. `GET /api/ivory/generator/run/:runId` - Load generator run results.
99. `POST /api/ivory/generator/run/:runId/invite` - Convert a generator result into an invitation.

100. `GET /api/training/fast-start/progress` - Load Fast Start training progress.
101. `POST /api/training/fast-start/modules/:id/state` - Save Fast Start module state.

102. `GET /api/profile` - Load BA profile and settings.
103. `PATCH /api/profile` - Update BA profile and settings.
104. `POST /api/profile/password` - Change the BA password.
105. `POST /api/profile/email/start` - Start an email change verification.
106. `POST /api/profile/email/verify` - Verify an email change.
107. `POST /api/profile/phone/start` - Start a phone change verification.
108. `POST /api/profile/phone/verify` - Verify a phone change.

109. `GET /api/preview` - Load BA sandbox preview data for the replicated page.

110. `GET /api/admin/access-codes` - List admin access codes.
111. `POST /api/admin/access-codes` - Create an admin access code.

112. `GET /api/admin/bas` - List Brand Ambassadors.
113. `POST /api/admin/bas` - Create a Brand Ambassador administratively.
114. `GET /api/admin/bas/:baId` - Load one Brand Ambassador.
115. `PATCH /api/admin/bas/:baId` - Update a Brand Ambassador.
116. `DELETE /api/admin/bas/:baId` - Delete or deactivate a Brand Ambassador.
117. `POST /api/admin/bas/:baId/restore` - Restore a Brand Ambassador.
118. `POST /api/admin/bas/:baId/sponsor-override` - Change sponsor assignment.
119. `POST /api/admin/bas/:baId/leader-tag` - Update leader tagging.
120. `POST /api/admin/bas/:baId/notes` - Add an admin note to a BA.
121. `POST /api/admin/bas/:baId/dial-michael` - Trigger or log a Michael call for a BA.

122. `GET /api/admin/prospects` - List prospects for admin oversight.
123. `POST /api/admin/prospects` - Create a prospect administratively.
124. `GET /api/admin/prospects/filters` - Load prospect filter values.
125. `GET /api/admin/prospects/alerts/aged` - Load aged prospect alerts.
126. `POST /api/admin/prospects/flush-expired` - Flush expired prospects.
127. `GET /api/admin/prospects/:prospectId` - Load one prospect.
128. `PATCH /api/admin/prospects/:prospectId` - Update one prospect.
129. `DELETE /api/admin/prospects/:prospectId` - Delete one prospect.
130. `POST /api/admin/prospects/:prospectId/restore` - Restore one prospect.
131. `GET /api/admin/prospects/:prospectId/sandbox-preview` - Load sandbox preview for a prospect.
132. `POST /api/admin/prospects/:prospectId/notes` - Add an admin note to a prospect.
133. `POST /api/admin/prospects/:prospectId/move` - Move a prospect in the holding tank.
134. `POST /api/admin/prospects/:prospectId/reassign-sponsor` - Reassign a prospect sponsor.
135. `POST /api/admin/prospects/:prospectId/manual-flush` - Manually flush a prospect.
136. `POST /api/admin/prospects/:prospectId/force-enroll` - Force-enroll a prospect.

137. `GET /api/admin/queue/summary` - Load holding tank queue summary.
138. `GET /api/admin/queue/lookup` - Look up queue entries.
139. `GET /api/admin/queue/visible-window` - Load visible queue window settings.
140. `PUT /api/admin/queue/visible-window` - Update visible queue window settings.
141. `GET /api/admin/queue/ticker` - Load public ticker data.
142. `GET /api/admin/queue/ticker/stream` - Stream ticker updates.
143. `GET /api/admin/queue/rules` - Load queue rules.
144. `PUT /api/admin/queue/rules/:key` - Update one queue rule.

145. `GET /api/admin/audit` - List audit log entries.
146. `GET /api/admin/audit/:entryId` - Load one audit log entry.

147. `GET /api/admin/dashboard/metrics` - Load admin dashboard metrics.
148. `GET /api/admin/dashboard/filters` - Load admin dashboard filters.
149. `GET /api/admin/dashboard/drilldown` - Load dashboard drilldown data.
150. `GET /api/admin/dashboard/stream` - Stream admin dashboard events.

151. `GET /api/admin/live-ops/growth` - Load live operations growth metrics.
152. `GET /api/admin/live-ops/grid` - Load live holding tank grid.
153. `GET /api/admin/live-ops/funnel` - Load live conversion funnel.
154. `GET /api/admin/live-ops/usage/stream` - Stream live usage events.

155. `GET /api/admin/reporting/master-report.pdf` - Generate the admin master report PDF.
156. `GET /api/admin/reporting/activation` - Load activation report data.
157. `GET /api/admin/reporting/training` - Load training report data.
158. `GET /api/admin/reporting/invite-funnel` - Load invitation funnel report data.
159. `GET /api/admin/reporting/queue-velocity` - Load queue velocity report data.
160. `GET /api/admin/reporting/enrollment-completion` - Load enrollment completion report data.
161. `GET /api/admin/reporting/follow-up-aging` - Load follow-up aging report data.
162. `GET /api/admin/reporting/leader-scorecards` - Load leader scorecard report data.
163. `GET /api/admin/reporting/activation/export` - Export activation report data.
164. `GET /api/admin/reporting/training/export` - Export training report data.
165. `GET /api/admin/reporting/invite-funnel/export` - Export invitation funnel report data.
166. `GET /api/admin/reporting/queue-velocity/export` - Export queue velocity report data.
167. `GET /api/admin/reporting/enrollment-completion/export` - Export enrollment completion report data.
168. `GET /api/admin/reporting/follow-up-aging/export` - Export follow-up aging report data.
169. `GET /api/admin/reporting/leader-scorecards/export` - Export leader scorecard report data.

170. `GET /api/admin/broadcast/audience` - Resolve broadcast audience counts and recipients.
171. `GET /api/admin/broadcast/list` - List broadcasts.
172. `GET /api/admin/broadcast/:broadcastId` - Load one broadcast and its status.
173. `POST /api/admin/broadcast/test` - Send a test broadcast.
174. `POST /api/admin/broadcast` - Create or queue a broadcast.

175. `*` - Shared API fallback route; returns JSON `not_found`.
