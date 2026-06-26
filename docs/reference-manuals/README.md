# Reference Manuals — BUILD ARTIFACTS (NON-AUTHORITATIVE)

**Everything compiled into this folder is a build artifact. None of it is constitutional authority. Do not cite anything here as governance.**

These reference manuals are produced by the **Documentation Compilers** in `.build-tools/` (`generate-momentum-ai-constitution.mjs`, `generate-momentum-knowledge-core.mjs`, `generate-mission-control-center.mjs`). Per **ACR-001**, those scripts were reclassified from document *generators* into Documentation *Compilers*:

```
Living Documents  →  Documentation Compiler  →  Generated Reference Manuals
  (source of truth)        (.build-tools)            (this folder)
```

**Source of truth lives in `constitution/`** (and the architecture docs). The compilers read those living documents and expand them into manuals — executive manuals, printable handbooks, training binders, developer reference guides, and AI reference manuals. Page-count depth that would be slop in a constitution is appropriate here, in a binder.

The compilers are guarded: they refuse to write into `constitution/`. Regenerating these manuals is safe and repeatable — they are outputs, not sources. To change their content, edit the living documents in `constitution/`, then recompile.

Governed by: `../../constitution/MOMENTUM_ACR_SYSTEM.md` and `../../constitution/acr/ACR-001-documentation-compilers.md`.
