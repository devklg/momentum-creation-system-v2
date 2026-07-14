# Training Target Reconciliation

P2-111 reconciles three different truths that must not be collapsed:

1. `TRAINING_ARCHITECTURE.md` is the long-range curriculum target.
2. Kevin's Chat 96 decisions define Fast Start as one seven-day program with a
   four-day learning phase, Day 4 certification gate, and Days 5–7 action phase.
3. `packages/shared/src/training-catalog.ts` is the current implementation truth:
   five topical Fast Start modules with explicit progress and no calendar-day or
   certification state.

The machine-readable reconciliation is
`packages/shared/src/training-target-reconciliation.ts`.

## Count reconciliation

The architecture is commonly described as a 20-module target, but its headings
enumerate Module 0 plus Modules 1–20. The factual interpretation is therefore:

- one separate welcome prelude (Module 0);
- twenty post-welcome curriculum modules (Modules 1–20);
- twenty-one enumerated entries in total.

## Current implementation boundary

The app currently has five implemented Fast Start modules. None of the
architecture's Module 0–20 entries has its own target-module route and durable
target-module completion authority. Some current pages overlap a target topic,
but overlap does not create equivalence or completion evidence.

| Target | Architecture title | Current relationship |
|---:|---|---|
| 0 | Team Magnificent Welcome | Related `/welcome` surface only |
| 1 | Momentum Creation Fundamentals | No current module representation |
| 2 | Understanding Team Magnificent | Related `/welcome` and `/training/10-steps` content only |
| 3 | Fast Start Success | Related `/training/fast-start` hub only |
| 4 | Product Fundamentals | Related `/training/fast-start/product` content only |
| 5 | Customer Acquisition Foundations | Related `/training/fast-start/prospect-list` content only |
| 6 | Invitation Fundamentals | Related prospect-list and `/ivory` surfaces only |
| 7 | Prospect Momentum System | No current module representation |
| 8 | Follow-Up Mastery | No current module representation |
| 9 | Launch Center Mastery | Related `/launch` product surface only |
| 10 | Personal Productivity | No current module representation |
| 11 | Communication Excellence | No current module representation |
| 12 | Social Influence & Community Building | No current module representation |
| 13 | Duplication Fundamentals | Related binary and team Fast Start content only |
| 14 | Coaching Fundamentals | No current module representation |
| 15 | Leadership Foundations | No current module representation |
| 16 | Leadership Communication | No current module representation |
| 17 | Event Leadership | No current module representation |
| 18 | Mentorship Excellence | No current module representation |
| 19 | Advanced Team Development | No current module representation |
| 20 | Legacy Leadership | No current module representation |

## Seven-day Fast Start drift

Kevin's active decision record says Fast Start and the seven-day plan are the
same program. The current hub uses “The First Seven Days” language, but it does
not implement the decided schedule mechanics:

- no calendar-day state authority;
- no Days 1–4 learn-only enforcement;
- no 20-question Day 4 certification or 80% pass gate;
- no certification gate on the invitation generator;
- no Days 5–7 2-in-72 action-phase state.

Current completion remains five explicit module completions plus at least one
sent invitation. That is implementation truth, not evidence that the decided
seven-day arc has shipped.

## Constitutional boundary

The architecture's completion-level labels include Practitioner, Builder,
Leader, and Legacy Leader. They are not implemented as person labels. Any future
use of those labels to classify a BA requires constitutional review because the
ratified Constitution prohibits scoring, ranking, or classifying people.

P2-111 records these gaps; it does not silently design or build the missing
curriculum, certification, schedule, or completion model.
