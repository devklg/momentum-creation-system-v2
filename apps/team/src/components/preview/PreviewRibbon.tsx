/**
 * PREVIEW MODE ribbon (Chat #134, wireframe 3.7 leaf wf_0070).
 *
 * Persistent top-of-viewport bar that overlays the preview surface. The
 * ribbon's job is unambiguous: tell the BA "you are looking at what your
 * prospect would see, but nothing here writes." Sticky so the BA can't
 * scroll past it; the gold accent + "PREVIEW MODE" wordmark match the
 * brand vocabulary (locked-spec brand tokens — gold #C9A84C, cream).
 */

import { Link } from 'react-router-dom';

export function PreviewRibbon() {
  return (
    <div className="sticky top-0 z-50 w-full border-b border-gold/40 bg-ink/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-full bg-gold"
          />
          <span className="font-mono text-[11px] uppercase tracking-eyebrow text-gold">
            Preview Mode
          </span>
          <span className="hidden font-body text-xs text-cream-mute md:inline">
            Personalized to you. No writes. Sample prospect.
          </span>
        </div>
        <Link
          to="/cockpit"
          className="font-mono text-[11px] uppercase tracking-eyebrow text-cream-mute transition-colors hover:text-cream"
        >
          ← Back to cockpit
        </Link>
      </div>
    </div>
  );
}

export default PreviewRibbon;
