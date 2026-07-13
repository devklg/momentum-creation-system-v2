# Launch Center Route and Data Catalog

The executable catalog is `packages/shared/src/launch-center-catalog.ts`.

| Concern | Canonical value |
| --- | --- |
| Team route | `/cockpit` |
| API projection | `GET /api/cockpit/launch` |
| Access | Authenticated BA; available before Steve completion |
| UI | `LaunchCenter` inside `CockpitPage` |
| Server projection | `getTeamLaunchCenter(tmagId)` |
| Transition | First-run Launch Center matures into operational cockpit/PMV |

The projection composes welcome commitment, Steve Success Interview state, Michael status, training progress, Ivory names, invitation activity, and sponsor identity. Those domains remain authoritative; Launch Center is read-only composition and stores no parallel launch record.

No `/launch-center` route is permitted. Launch status cannot score, rank, classify, or predict a person.
