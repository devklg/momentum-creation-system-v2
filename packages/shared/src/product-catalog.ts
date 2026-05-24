/**
 * Product catalog — the share-worthy product videos a BA anchors an
 * invitation to (Chat #131, wireframe §3.4).
 *
 * This is a NEW shared module so the Generator surface and the existing
 * video-library surface can converge on one source of truth. To avoid
 * collision with parallel worktrees, the data is duplicated from today's
 * apps/team/src/routes/video-library.tsx — that file is intentionally not
 * touched in this branch. A future cleanup pass can switch video-library
 * to import from here.
 *
 * Compliance: only product/testimonial videos appear here. The comp-plan
 * video is BA training and is NOT in this catalog (locked-spec 3.10/3.11
 * — a prospect invitation must never carry comp/income framing).
 *
 * productKey is the stable Generator identifier ('glp-three', 'visage',
 * etc.). productName is the human-facing label that ScriptMaker / the
 * spine echo back to the BA and the prospect. videos[] are the YouTube
 * embeds the BA may have just watched; Generator uses the first 'full'
 * video as the default anchor when one is required.
 */

export type ProductVideoKind = 'full' | 'short' | 'deep_dive';

export interface ProductVideo {
  videoId: string;
  youtubeId: string;
  title: string;
  blurb: string;
  duration: string;
  kind: ProductVideoKind;
  featured: boolean;
}

export interface CatalogProduct {
  /** Stable key for Generator runs. Lowercase, kebab. */
  productKey: string;
  /** Section number for display (matches video-library.tsx ordering). */
  sectionNumber: string;
  /** Display label — the noun the BA and prospect see. */
  productName: string;
  /** Short marketing blurb shown on the gallery card. */
  blurb: string;
  videos: ProductVideo[];
}

export const PRODUCT_CATALOG: CatalogProduct[] = [
  {
    productKey: 'glp-three',
    sectionNumber: '01',
    productName: 'GLP-THREE',
    blurb:
      'The flagship — natural GLP-1 replacement. Full presentations and testimonials.',
    videos: [
      {
        videoId: 'glp3-launch',
        youtubeId: '1IZiV7RXdCY',
        title: 'GLP THREE Launch Webinar with Dr. Dan Gubler',
        blurb: 'Foundation video — the full launch presentation.',
        duration: '16:18',
        kind: 'full',
        featured: true,
      },
      {
        videoId: 'glp3-all-things',
        youtubeId: 'jGG1nSu9s94',
        title: 'All Things GLP THREE',
        blurb: 'Complete overview — the science and the results in one.',
        duration: '17:56',
        kind: 'full',
        featured: true,
      },
      {
        videoId: 'glp3-this-is-me',
        youtubeId: 'LzvuaVb2E2M',
        title: 'This is Me and GLP THREE',
        blurb: 'A personal testimony — short and very shareable.',
        duration: '1:05',
        kind: 'short',
        featured: false,
      },
      {
        videoId: 'glp3-results',
        youtubeId: 'kw2m-vrj_dI',
        title: 'Results Are In | GLP THREE',
        blurb: 'Real results, social-share ready.',
        duration: '0:53',
        kind: 'short',
        featured: false,
      },
    ],
  },
  {
    productKey: 'product-line',
    sectionNumber: '02a',
    productName: 'the THREE product line',
    blurb:
      'The full catalogue — broad introduction when you are not sure which product fits.',
    videos: [
      {
        videoId: 'prod-all-three',
        youtubeId: 'dEO_A-Q5pTE',
        title: 'All THREE Products — with Dr. Dan',
        blurb: 'The entire product line — great for a broad introduction.',
        duration: '16:56',
        kind: 'full',
        featured: true,
      },
    ],
  },
  {
    productKey: 'visage',
    sectionNumber: '02b',
    productName: 'VISAGE',
    blurb: 'The skin collection — science breakdown.',
    videos: [
      {
        videoId: 'prod-visage',
        youtubeId: 'VlK-Jr9a9aI',
        title: 'Dr. Dan on VISAGE',
        blurb: 'The skin collection — science breakdown.',
        duration: '5:20',
        kind: 'deep_dive',
        featured: false,
      },
    ],
  },
  {
    productKey: 'vitalite',
    sectionNumber: '02c',
    productName: 'Vitalité',
    blurb: 'Energy and vitality.',
    videos: [
      {
        videoId: 'prod-vitalite',
        youtubeId: 'c5HHW-cwbyo',
        title: 'Dr. Dan on Vitalité',
        blurb: 'Energy and vitality.',
        duration: '3:15',
        kind: 'deep_dive',
        featured: false,
      },
    ],
  },
  {
    productKey: 'revive',
    sectionNumber: '02d',
    productName: 'Revíve',
    blurb: 'Recovery and renewal.',
    videos: [
      {
        videoId: 'prod-revive',
        youtubeId: '21TspVJ98ic',
        title: 'Dr. Dan on Revíve',
        blurb: 'Recovery and renewal.',
        duration: '2:26',
        kind: 'deep_dive',
        featured: false,
      },
    ],
  },
  {
    productKey: 'collagene',
    sectionNumber: '02e',
    productName: 'Collagène',
    blurb: 'Collagen and skin health.',
    videos: [
      {
        videoId: 'prod-collagene',
        youtubeId: 'z-gf-uGGdJw',
        title: 'Dr. Dan on Collagène',
        blurb: 'Collagen and skin health.',
        duration: '2:51',
        kind: 'deep_dive',
        featured: false,
      },
    ],
  },
  {
    productKey: 'imune',
    sectionNumber: '02f',
    productName: 'Imúne',
    blurb: 'Immune support.',
    videos: [
      {
        videoId: 'prod-imune',
        youtubeId: 'QaCFdqb09rk',
        title: 'Dr. Dan on Imúne',
        blurb: 'Immune support.',
        duration: '3:22',
        kind: 'deep_dive',
        featured: false,
      },
    ],
  },
  {
    productKey: 'purifi',
    sectionNumber: '02g',
    productName: 'Purifí',
    blurb: 'Detox and cleanse.',
    videos: [
      {
        videoId: 'prod-purifi',
        youtubeId: 'Ir5sybkR950',
        title: 'Dr. Dan on Purifí',
        blurb: 'Detox and cleanse.',
        duration: '2:31',
        kind: 'deep_dive',
        featured: false,
      },
    ],
  },
  {
    productKey: 'eternel',
    sectionNumber: '02h',
    productName: 'Éternel',
    blurb: 'Anti-aging and longevity.',
    videos: [
      {
        videoId: 'prod-eternel',
        youtubeId: '7kwgxsFDkQ8',
        title: 'Dr. Dan on Éternel',
        blurb: 'Anti-aging and longevity.',
        duration: '2:36',
        kind: 'deep_dive',
        featured: false,
      },
    ],
  },
];

/** Lookup by stable key. Returns null when the key is unknown. */
export function findProductByKey(productKey: string): CatalogProduct | null {
  return PRODUCT_CATALOG.find((p) => p.productKey === productKey) ?? null;
}

/** Quick set of valid product keys — handy for validation at route layer. */
export const PRODUCT_KEYS: ReadonlySet<string> = new Set(
  PRODUCT_CATALOG.map((p) => p.productKey),
);
