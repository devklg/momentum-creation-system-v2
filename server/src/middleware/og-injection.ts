/**
 * og-injection.ts
 *
 * Express middleware that intercepts /p/:token requests before the
 * .com SPA is served, resolves the token's prospect and BA, and
 * injects token-personalized Open Graph meta tags into the served
 * HTML's <head>.
 *
 * Locked source: Chat #107 — Kevin's call:
 *   "Express middleware for token-resolved og:url
 *    (recommended; matches THREE's kevinlg.three-app.com pattern)"
 *
 * Why this exists:
 *   The .com SPA is built with Vite and ships index.html. Without
 *   SSR, every social-card preview would render generic OG tags.
 *   This middleware reads index.html on each /p/:token request,
 *   resolves the token, and rewrites the OG meta block before the
 *   HTML lands in the browser.
 *
 * Wiring (in the .com server entry):
 *
 *   import express from "express";
 *   import { ogInjectionMiddleware } from "./middleware/og-injection";
 *
 *   const app = express();
 *   app.get("/p/:token", ogInjectionMiddleware({
 *     indexHtmlPath: path.join(__dirname, "../../dist/index.html"),
 *     resolveTokenForOg,  // your resolver — see contract below
 *     publicOrigin: process.env.PUBLIC_ORIGIN ?? "https://teammagnificent.com",
 *   }));
 *   // ... static + SPA fallback below this
 *
 * Resolver contract:
 *   resolveTokenForOg(token: string): Promise<{
 *     prospectFirstName: string;
 *     baFullName: string;
 *   } | null>
 *
 * If the resolver returns null (invalid token / expired / enrolled),
 * the middleware falls through to the next handler — the SPA renders
 * its own error view client-side via the existing resolveToken flow.
 */

import { promises as fs } from "fs";
import type { NextFunction, Request, Response } from "express";

// ---------------------------------------------------------------
// Public types
// ---------------------------------------------------------------

export interface OgInjectionResolverResult {
  prospectFirstName: string;
  baFullName: string;
}

export type OgInjectionResolver = (
  token: string
) => Promise<OgInjectionResolverResult | null>;

export interface OgInjectionOptions {
  /** Absolute path to the built SPA's index.html */
  indexHtmlPath: string;
  /** Function that resolves a token to the names we need for OG copy. */
  resolveTokenForOg: OgInjectionResolver;
  /** e.g. "https://teammagnificent.com" — no trailing slash. */
  publicOrigin: string;
  /**
   * Override the og:image path. Defaults to /og/all-things-glp-three.png
   * which is the asset generated in Chat #106 per locked-spec Part 4.6.
   */
  ogImagePath?: string;
}

// ---------------------------------------------------------------
// Middleware factory
// ---------------------------------------------------------------

export function ogInjectionMiddleware(opts: OgInjectionOptions) {
  const {
    indexHtmlPath,
    resolveTokenForOg,
    publicOrigin,
    ogImagePath = "/og/all-things-glp-three.png",
  } = opts;

  // In production you'd want a small LRU cache for the file body and
  // for resolved tokens. Skipping for the v1 wire — see TODO below.
  return async function ogInjection(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const token = req.params.token;
      if (!token || typeof token !== "string") return next();

      const resolved = await resolveTokenForOg(token);
      if (!resolved) {
        // Token invalid / expired / enrolled. Let the SPA show its
        // own client-side error view; no need for personal OG here.
        return next();
      }

      const html = await fs.readFile(indexHtmlPath, "utf-8");
      const og = buildOgBlock({
        token,
        resolved,
        publicOrigin,
        ogImagePath,
      });
      const out = injectOgIntoHead(html, og);

      res.set("Content-Type", "text/html; charset=utf-8");
      // The OG block is per-token so caches must vary by URL. We
      // also set short-cache to avoid CDN poisoning across tokens.
      res.set("Cache-Control", "private, max-age=60");
      res.send(out);
    } catch (err) {
      // If anything explodes, fall through to the static SPA so the
      // page still loads — OG personalization is a nice-to-have, not
      // a hard requirement for the render.
      // eslint-disable-next-line no-console
      console.warn("[og-injection] failed, falling through:", err);
      next();
    }
  };
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

interface BuildOgBlockArgs {
  token: string;
  resolved: OgInjectionResolverResult;
  publicOrigin: string;
  ogImagePath: string;
}

function buildOgBlock(args: BuildOgBlockArgs): string {
  const { token, resolved, publicOrigin, ogImagePath } = args;
  const url = `${publicOrigin}/p/${encodeURIComponent(token)}`;
  const imageUrl = ogImagePath.startsWith("http")
    ? ogImagePath
    : `${publicOrigin}${ogImagePath}`;

  // COPY: per locked-spec Part 4.6 — Kevin to finalize.
  const title = escapeHtml(
    `${resolved.baFullName} personally invited ${resolved.prospectFirstName} — ALL THINGS GLP-THREE`
  );
  const description = escapeHtml(
    `Dr. Dan Gubler explains the science behind GLP-THREE.`
  );
  const safeUrl = escapeHtml(url);
  const safeImage = escapeHtml(imageUrl);

  return [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${safeUrl}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:image" content="${safeImage}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:url" content="${safeUrl}" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${safeImage}" />`,
  ].join("\n    ");
}

const OG_MARKER_START = "<!-- tm:og:start -->";
const OG_MARKER_END = "<!-- tm:og:end -->";

/**
 * Inject the OG block into the served HTML's <head>.
 *
 * Strategy:
 *   1. If the index.html contains a pair of <!-- tm:og:start --> ...
 *      <!-- tm:og:end --> markers (we recommend adding them to the
 *      Vite template), replace the contents between them.
 *   2. Otherwise, insert just before </head>.
 *
 * Static index.html should also keep generic fallback OG tags
 * OUTSIDE the marker pair (so social previews of the root or any
 * non-/p route still get reasonable defaults). The middleware
 * only swaps in personalized tags for /p/:token.
 */
function injectOgIntoHead(html: string, ogBlock: string): string {
  const wrapped = `${OG_MARKER_START}\n    ${ogBlock}\n    ${OG_MARKER_END}`;

  if (html.includes(OG_MARKER_START) && html.includes(OG_MARKER_END)) {
    return html.replace(
      new RegExp(
        `${escapeRegex(OG_MARKER_START)}[\\s\\S]*?${escapeRegex(OG_MARKER_END)}`
      ),
      wrapped
    );
  }
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `    ${wrapped}\n  </head>`);
  }
  // No </head>? Unusual. Append at the start of the document so the
  // tags at least exist somewhere — better than dropping them.
  return `${wrapped}\n${html}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// TODO(chat-108-followup):
//   • LRU cache for indexHtml read (re-read on file mtime change).
//   • LRU cache for resolveTokenForOg results (60s TTL is plenty).
//   • Consider eager prefetch of the OG image during the social
//     crawler hit to avoid first-paint flash for the human prospect.
