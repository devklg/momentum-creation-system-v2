/**
 * Compiled Team Magnificent video library.
 *
 * Source of truth: devklg/team-magnificent-training/video-library.html
 * (main, SHA 9895369a6640491fd7ee0e85a5475429ca758cd3).
 *
 * Link verification on 2026-07-17 excluded the source page's private
 * `jGG1nSu9s94` upload so the live gallery does not reproduce a dead player.
 *
 * Keep this catalog available even when the editable admin collection has not
 * been seeded. The live page merges unique admin additions after these items.
 */

export type CompiledVideoAudience = 'member' | 'prospect' | 'both';

export interface CompiledVideo {
  contentVideoId: string;
  section: string;
  title: string;
  youtubeId: string | null;
  url: string | null;
  embedUrl?: string | null;
  description: string;
  sortOrder: number;
  audience: CompiledVideoAudience;
  active: true;
}

export interface CompiledVideoSection {
  section: string;
  videos: CompiledVideo[];
}

function youtube(
  section: string,
  sortOrder: number,
  youtubeId: string,
  title: string,
  description: string,
): CompiledVideo {
  return {
    contentVideoId: `compiled-${section.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${youtubeId}`,
    section,
    title,
    youtubeId,
    url: `https://www.youtube.com/watch?v=${youtubeId}`,
    description,
    sortOrder,
    audience: 'both',
    active: true,
  };
}

const glpThree = [
  youtube('GLP THREE', 1, '1IZiV7RXdCY', 'GLP THREE Launch Webinar with Dr. Dan Gubler', '16:18 · Dr. Dan Gubler · Foundation video'),
  youtube('GLP THREE', 3, 'LzvuaVb2E2M', 'This is Me and GLP THREE', '1:05 · Personal testimony · Share-ready'),
  youtube('GLP THREE', 4, 'kw2m-vrj_dI', 'Results Are In | GLP THREE', '0:53 · Results · Social-share ready'),
  youtube('GLP THREE', 5, 'SZlLcqPNvfA', 'When it comes to the science behind GLP THREE, we turn to the experts.', '0:58 · Expert perspective · Credibility'),
  youtube('GLP THREE', 6, 'RLcarL4lx80', "GLP support doesn't have to mean extremes. Introducing GLP THREE.", 'Official short'),
  youtube('GLP THREE', 7, 'LNceWqhzPdQ', 'GLP THREE is taking over the internet.', 'Official short'),
  youtube('GLP THREE', 8, 'xgHDXUTsIck', "THREE's innovative solution to the GLP-1 wave!", 'Official short'),
  youtube('GLP THREE', 9, 'Cv-TlyxPoew', "GLP-1 support without the drama. Now that's GLP THREE.", 'Official short'),
  youtube('GLP THREE', 10, '3WY01fGm0rw', 'The GLP-1 conversation is big. GLP THREE is even bigger.', 'Official short'),
  youtube('GLP THREE', 11, 'RU9Wf3Un4Eo', "Six months from now, you won't remember the excuses.", 'Official short'),
  youtube('GLP THREE', 12, 'W4Q7qJBHssM', 'The scale moving is one thing. Feeling in control again is another.', 'Official short'),
  youtube('GLP THREE', 13, 'R5LWvQd5WZQ', 'This is your sign to commit — not just try.', 'Official short'),
  youtube('GLP THREE', 14, 'fy6_izU1XZQ', 'You eat good all day and then it falls apart at night... sound familiar?', 'Official short'),
  youtube('GLP THREE', 15, 'waScw6Vav7s', 'If Holly DeMott loves GLP THREE, you know it MUST be good.', 'Official short'),
  youtube('GLP THREE', 16, 'sVgKyzjJxQg', "GLP THREE — This one's a win every time. ❤️", 'Official short'),
  youtube('GLP THREE', 17, 'iGyFEnb8D40', "@_taralake_ knows the secret (and it's GLP THREE)", 'Official short'),
  youtube('GLP THREE', 18, 'JzztYwQJR2g', "If you're going to support your metabolism, the ingredients should make sense.", 'Official short'),
];

const products: CompiledVideo[] = [
  {
    contentVideoId: 'compiled-products-full-playlist',
    section: 'PRODUCTS',
    title: 'Open Full Products Playlist',
    youtubeId: null,
    url: 'https://www.youtube.com/playlist?list=PLbYmyx2Gv3LRQJO7rGbCy6Lj0JzJkRTiI',
    description: 'Official complete product playlist · 28 videos',
    sortOrder: 1,
    audience: 'both',
    active: true,
  },
  youtube('PRODUCTS', 2, 'dEO_A-Q5pTE', 'All THREE Products — with Dr. Dan', '16:56 · Entire product line · Complete overview'),
  youtube('PRODUCTS', 3, 'VlK-Jr9a9aI', 'Dr. Dan on VISAGE', '5:20 · Skin collection · Science breakdown'),
  youtube('PRODUCTS', 4, 'c5HHW-cwbyo', 'Dr. Dan on Vitalité', '3:15 · Energy and vitality'),
  youtube('PRODUCTS', 5, '21TspVJ98ic', 'Dr. Dan on Revíve', '2:26 · Recovery and renewal'),
  youtube('PRODUCTS', 6, 'z-gf-uGGdJw', 'Dr. Dan on Collagène', '2:51 · Collagen and skin health'),
  youtube('PRODUCTS', 7, 'QaCFdqb09rk', 'Dr. Dan on Imúne', '3:22 · Immune support'),
  youtube('PRODUCTS', 8, 'Ir5sybkR950', 'Dr. Dan on Purifí', '2:31 · Detox and cleanse'),
  youtube('PRODUCTS', 9, '7kwgxsFDkQ8', 'Dr. Dan on Éternel', '2:36 · Anti-aging and longevity'),
  youtube('PRODUCTS', 10, 'X7YHvuQUtw0', 'Dr. Dan — THREE Epigenetics', '1:00 · The science foundation'),
  youtube('PRODUCTS', 11, 'yapp26qb-cM', 'The Visage Collection with Dr Dan', '4:09 · Full skincare system'),
  youtube('PRODUCTS', 12, 'zRWv79pYP3U', 'Meet Kynetik. Clean caffeine, supercharged.', '1:56 · Energy drink · Product spotlight'),
  youtube('PRODUCTS', 13, 'yoCClLmrDbk', 'Imúne — Product Spotlight', '15-second product spotlight'),
  youtube('PRODUCTS', 14, 'vpkRbtEQzF8', 'Collagène — Product Spotlight', '15-second product spotlight'),
  youtube('PRODUCTS', 15, 'h_CRh1pdE2E', 'Vitalité — Product Spotlight', '15-second product spotlight'),
  youtube('PRODUCTS', 16, 'yapFVEAm1Pw', 'Purifí — Product Spotlight', '15-second product spotlight'),
  youtube('PRODUCTS', 17, 'o_C7SFdi1yI', 'Éternel — Product Spotlight', '15-second product spotlight'),
  youtube('PRODUCTS', 18, 'jRVm4m_QQEw', 'Did You Know? Collagène has serious benefits.', 'Key-benefits short'),
  youtube('PRODUCTS', 19, '2iTO2JS1m9E', 'Did You Know? Key Benefits of Vitalité', 'Key-benefits short'),
  youtube('PRODUCTS', 20, 'rEQHGSes6yo', 'Did You Know? Key Benefits of Revíve', 'Key-benefits short'),
  youtube('PRODUCTS', 21, 'GU3jbDkBSxI', 'Did You Know? Key Benefits of Purifí', 'Key-benefits short'),
  youtube('PRODUCTS', 22, 'uXEfV1AmDxg', 'Did You Know? Key benefits of Imúne', 'Key-benefits short'),
  youtube('PRODUCTS', 23, 'v7mYtUI_CI8', 'Did You Know? Key benefits of Éternel', 'Key-benefits short'),
  youtube('PRODUCTS', 24, 'EJIOcJsgcOk', 'Did You Know? Key benefits of Collagène', 'Key-benefits short'),
  youtube('PRODUCTS', 25, 'UcRBPkIHMTM', 'Did You Know? Visage Super Serum benefits', 'Key-benefits short'),
];

const compensationPlan: CompiledVideo[] = [
  {
    contentVideoId: 'compiled-compensation-glp-three-explanation',
    section: 'COMPENSATION PLAN',
    title: 'GLP THREE Comp Plan Explanation',
    youtubeId: null,
    url: 'https://vimeo.com/1157693865',
    embedUrl: 'https://player.vimeo.com/video/1157693865?h=7f8b1862e9&autoplay=0&title=0&byline=0&portrait=0',
    description: 'Compensation-plan explanation · Binary system · Fast Start',
    sortOrder: 1,
    audience: 'member',
    active: true,
  },
  {
    contentVideoId: 'compiled-compensation-team-legacy-presentation',
    section: 'COMPENSATION PLAN',
    title: 'Lance & Tracey Smith — GLP THREE Business Opportunity Presentation',
    youtubeId: null,
    url: 'https://www.team-legacy.com/library-glpthree/mar-06-2026.html',
    description: 'Team Legacy · March 6, 2026 · Upline leadership presentation',
    sortOrder: 2,
    audience: 'member',
    active: true,
  },
];

export const COMPILED_VIDEO_LIBRARY_SECTIONS: CompiledVideoSection[] = [
  { section: 'GLP THREE', videos: glpThree },
  { section: 'PRODUCTS', videos: products },
  { section: 'COMPENSATION PLAN', videos: compensationPlan },
];

export const COMPILED_VIDEO_COUNT = COMPILED_VIDEO_LIBRARY_SECTIONS.reduce(
  (total, section) => total + section.videos.length,
  0,
);
