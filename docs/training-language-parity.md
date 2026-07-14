# Training Language Parity

P2-114 establishes `packages/shared/src/training-language-parity.ts` as the
machine-readable English/Spanish parity contract for current training content.
The contract covers the Fast Start hub, all five implemented Fast Start module
pages, and the ten-step orientation page.

## Current result

| Measure | Result |
| --- | ---: |
| Current training surfaces checked | 7 |
| English variants available | 7 |
| Spanish variants available | 0 |
| Surfaces with complete EN/ES parity | 0 |

The current product is English-only. No Spanish source file or approved Spanish
copy exists in the repository, so this leaf does not invent or machine-translate
training language. Each missing Spanish variant is an explicit finding rather
than a silent fallback or a false parity claim.

## What the gate checks

The server QA suite now verifies that:

1. every current Fast Start module, the hub, and orientation are cataloged once;
2. every available language variant names a source file that exists;
3. every cataloged training route exists in the Team app;
4. an available variant implements the surface's full structural block set;
5. the known English-only baseline remains explicit until approved Spanish
   content is added.

When Spanish content is approved, its source path and implemented block keys
must be declared beside the English variant. The parity report becomes complete
only when both locales exist and satisfy the same structural contract. Copy
quality and translation approval remain human content-governance decisions;
structural parity does not certify translation quality.
