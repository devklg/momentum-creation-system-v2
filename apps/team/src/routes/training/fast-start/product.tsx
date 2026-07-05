/**
 * /training/fast-start/product — Module 1: The Product.
 *
 * Sources (Kevin-authorized, this branch):
 *   - GLP-THREE fact sheet: assets/logos/2601_FactSheet-GLPTHREE_v1_ENG_FNL.pdf
 *   - Product line + CV: devklg/team-magnificent-training (Power in Numbers)
 *   - Six-pillar fact sheets folder: assets/logos/*.pdf
 *
 * Compliance discipline (THREE structure-function only):
 *   - Ingredients SUPPORT pathways. No "treats", "cures", "prevents".
 *   - The dossier cites GLP-1 RECEPTOR AGONIST drug studies (sleep
 *     apnea, mood) as CATEGORY context — never as studies on GLP-THREE
 *     itself. We do not import those into this module. That conflation
 *     is a drug claim.
 *   - CV/dollar figures are .team-only and never bleed to .com.
 *
 * Whitelisted pre-Steve in requireSteveComplete — a brand-new BA
 * can build belief in the product before completing discovery.
 */

import { Link } from 'react-router-dom';
import {
  ModuleScaffold,
  SectionLabel,
  SectionTitle,
  Prose,
  Callout,
  DataCard,
} from './_scaffold';

export function ModuleProductPage() {
  return (
    <ModuleScaffold moduleId={1}>
      {/* ── Hero pitch ───────────────────────────────────────────── */}
      <SectionLabel>What it is</SectionLabel>
      <SectionTitle>GLP&#8209;THREE™ — Little Bottle, Big Results.</SectionTitle>
      <Prose>
        <p>
          GLP-THREE™ is the first all-natural support for the body's own GLP-1 pathway. No injection. No
          prescription. A liquid taken from a dropper, 30 minutes before a meal. Powered by
          MBC&#8209;267™ — a proprietary peptide complex from Norwegian Sea salmon and mushrooms,
          paired with Panax ginseng, saffron, and hops.
        </p>
        <p>
          The category is exploding because the synthetic GLP-1 drugs work — but they come with cost,
          access barriers, and side effects. GLP-THREE™ is the natural side of the same conversation.
          That conversation is the doorway to every other product in the catalog. Learn the product
          first, and the rest of this training is just the road map for what to do with people who
          want it.
        </p>
      </Prose>

      <div className="grid grid-cols-3 gap-2 my-8">
        <DataCard num="320mg" label="GLP-THREE Complex per serving" />
        <DataCard num="10ml" label="≈ 12 servings per bottle" />
        <DataCard num="0" label="Injections / prescriptions" highlight />
      </div>

      {/* ── What's in it ─────────────────────────────────────────── */}
      <SectionLabel>What's in it</SectionLabel>
      <SectionTitle>MBC&#8209;267™ + four supporting ingredients.</SectionTitle>
      <Prose>
        <p>
          <strong className="text-cream">MBC-267™</strong> stands for Metabolic Boost Complex-267 — a
          proprietary peptide complex (Salmon Protein Hydrolysate + Mushroom Glycolipids) that binds to
          the body's GLP-1 receptor. THREE's cellular absorption technology coats the complex with
          polyphenols so it travels through the GI tract intact and an adjuvant helps the peptides
          diffuse through the cellular membrane to do their work.
        </p>
      </Prose>

      <div className="border border-line bg-[#1A1A1A] my-6">
        <IngredientRow
          name="Panax Ginseng Extract"
          molecule="ginsenosides"
          role="Supports GLP-1 secretion."
        />
        <IngredientRow
          name="Saffron Extract"
          molecule="safranal, crocin"
          role="Supports the GPR40/120 pathway."
        />
        <IngredientRow
          name="Humulus Lupulus (Hops) Extract"
          molecule="bitter acids"
          role="Supports the GLP-1 / ghrelin balance."
        />
        <IngredientRow
          name="Reb M, Peppermint Extract, Natural Flavors"
          molecule="formulation"
          role="Taste + delivery."
          last
        />
      </div>

      <Prose>
        <p>
          Certifications on the bottle: <strong className="text-cream">GMO-Free · Gluten-Free · Third-Party Tested · Bioavailable.</strong>{' '}
          Contains fish (salmon source). Not for individuals under 12. Standard supplement warnings
          for pregnancy / nursing / interacting medications — defer to a healthcare provider.
        </p>
      </Prose>

      {/* ── Who's behind it ──────────────────────────────────────── */}
      <SectionLabel>Who's behind it</SectionLabel>
      <SectionTitle>Dr. Dan Gubler.</SectionTitle>
      <Prose>
        <p>
          THREE's Chief Scientific Officer is the formulator and the video presenter your prospects
          will meet at <span className="font-mono text-[13px] text-gold">/p/{'{token}'}</span>. The
          credibility stack:
        </p>
      </Prose>
      <ul className="text-cream-mute text-[14px] leading-[1.8] font-light list-none mt-4 mb-6 grid md:grid-cols-2 gap-x-8 max-w-[680px]">
        <li>• Ph.D. in Organic Chemistry · Caltech-trained</li>
        <li>• 16 patents granted or pending</li>
        <li>• 15+ years cellular absorption formulation</li>
        <li>• Formulated 70+ nutritional supplements</li>
        <li>• Widely published, peer-reviewed</li>
        <li>• 1.3M+ followers · Top 50 podcast</li>
      </ul>

      {/* ── The three benefits ───────────────────────────────────── */}
      <SectionLabel>What it supports</SectionLabel>
      <SectionTitle>Three things, said carefully.</SectionTitle>
      <Prose>
        <p>
          THREE's claims on GLP-THREE™ are compliance-disciplined. Speak the same way when you share.
          Ingredients <em>support</em> pathways. No "treats". No "cures". No "prevents". The product
          does not work alone — it works with what the person already does.
        </p>
      </Prose>
      <div className="grid md:grid-cols-3 gap-4 my-6">
        <BenefitCard
          n="01"
          title="Curbs food cravings"
          body="Designed to help you feel fuller longer, leading to more mindful eating choices."
        />
        <BenefitCard
          n="02"
          title="Supports healthy weight management"
          body="Not a fad diet. A way to support weight management goals without extreme dieting."
        />
        <BenefitCard
          n="03"
          title="Supports healthy muscle mass"
          body="When combined with exercise, helps support body fat reduction, muscle tone, and fat metabolism."
        />
      </div>

      <Callout tone="gold" title="THE COMPLIANCE LINE">
        Anything beyond "supports" is a drug claim and a violation. The dossier cites studies on
        GLP-1 receptor agonist <em>drugs</em> for context. Those studies are NOT studies on
        GLP-THREE™ itself. Do not import those claims into your conversations. Structure-function
        language only. The FDA disclaimer on every bottle is the line you stay above.
      </Callout>

      {/* ── The six-pillar product line ──────────────────────────── */}
      <SectionLabel>The product line</SectionLabel>
      <SectionTitle>One conversation. Many products.</SectionTitle>
      <Prose>
        <p>
          GLP-THREE™ opens the door, but every product in the THREE catalog generates Commissionable
          Volume on the same backbone. Every order from any person in your organization — on either
          leg, at any depth — contributes to your cycle totals. The product table is the rest of the
          conversation.
        </p>
      </Prose>

      <div className="border border-line bg-[#1A1A1A] my-6 overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line">
              <th className="text-left font-mono tracking-[0.18em] text-[9px] text-gold uppercase p-3">
                Product
              </th>
              <th className="text-left font-mono tracking-[0.18em] text-[9px] text-gold uppercase p-3 max-md:hidden">
                Category
              </th>
              <th className="text-right font-mono tracking-[0.18em] text-[9px] text-gold uppercase p-3">
                Retail
              </th>
              <th className="text-right font-mono tracking-[0.18em] text-[9px] text-gold uppercase p-3">
                CV
              </th>
            </tr>
          </thead>
          <tbody className="text-cream-mute font-light">
            <ProductRow name="Éternel" category="Premium wellness" retail="$130" cv="60" />
            <ProductRow name="Vitalité  ·  GLP-THREE™" category="Weight management" retail="$85" cv="35" highlight />
            <ProductRow name="Collagène" category="Skin / joints / hair" retail="$70" cv="30" />
            <ProductRow name="Purifí" category="Detox / cleanse" retail="$70" cv="30" />
            <ProductRow name="Revíve" category="Recovery / energy" retail="$72" cv="30" />
            <ProductRow name="Imúne" category="Immune support" retail="$70" cv="30" />
            <ProductRow name="KYNETIK" category="Performance" retail="$85" cv="35" />
            <ProductRow name="Visage Pure Cleanse" category="Visage Skincare" retail="$75" cv="30" />
            <ProductRow name="Visage Radiant Toner" category="Visage Skincare" retail="$54" cv="20" />
            <ProductRow name="Visage Super Serum" category="Visage Skincare" retail="$159" cv="70" />
            <ProductRow name="Visage Crème Caviar" category="Visage Skincare" retail="$140" cv="60" />
            <ProductRow name="Visage Collection (full set)" category="Visage Skincare" retail="$380" cv="170" />
          </tbody>
        </table>
      </div>

      <Callout tone="teal" title="THE ENROLLMENT PACKS DO THE HEAVY LIFTING ON DAY ONE">
        Simple Six packs are CV concentrators — they bundle the line so one purchase plants
        meaningful volume on day one. Simple Six Ultimate (6 of each) is{' '}
        <strong className="text-cream">900 CV · a full cycle by itself</strong>; Elite (3 of each){' '}
        is 500 CV; Boost is 350 CV; Starter is 200 CV. The GLP-THREE Complete Pack is 500 CV. You
        will see this play out in Module 2 — for now, just know enrollment packs are the lever new
        people pull on day one.
      </Callout>

      <div className="my-8 border border-gold/35 bg-gold/[0.05] p-5 md:p-6">
        <div className="font-mono tracking-[0.22em] text-[10px] text-gold uppercase mb-2">
          Product Knowledge
        </div>
        <div className="font-display tracking-[0.05em] text-[24px] text-cream leading-none mb-2">
          Watch the Product Gallery next.
        </div>
        <p className="text-cream-mute text-[14px] leading-[1.65] max-w-[620px]">
          The Product Gallery holds Kevin's editable video library. Use it to
          deepen your product belief and find the video that fits the person
          you are thinking about.
        </p>
        <Link
          to="/video-library"
          className="inline-flex mt-4 font-mono tracking-[0.16em] text-[10px] text-ink bg-gold hover:bg-gold-bright px-4 py-3 uppercase"
        >
          Open Product Gallery
        </Link>
      </div>

      <SectionLabel>Why this matters before Module 2</SectionLabel>
      <SectionTitle>You can't share what you don't take.</SectionTitle>
      <Prose>
        <p>
          The single most useful thing you can do this week is take the product yourself for thirty
          days and notice what changes. That is the story you will tell. The science is in the
          dossier — your conviction is what makes the share land. Belief is the work. The rest of
          this Fast Start teaches you what to <em>do</em> with that belief.
        </p>
        <p className="text-gold font-display tracking-[0.06em] text-[18px] mt-6">
          You take it. You share it. That is the whole job.
        </p>
      </Prose>
    </ModuleScaffold>
  );
}

function IngredientRow({
  name,
  molecule,
  role,
  last,
}: {
  name: string;
  molecule: string;
  role: string;
  last?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[1fr_auto] gap-4 p-4 ${last ? '' : 'border-b border-line'}`}
    >
      <div>
        <div className="font-display tracking-[0.04em] text-[15px] text-cream">{name}</div>
        <div className="font-mono tracking-[0.12em] text-[10px] text-cream-mute uppercase mt-1">
          {molecule}
        </div>
      </div>
      <div className="text-cream-mute text-[13px] leading-[1.6] font-light text-right max-w-[260px]">
        {role}
      </div>
    </div>
  );
}

function BenefitCard({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="bg-[#1A1A1A] border border-line p-5">
      <div className="font-display text-[42px] text-gold/25 leading-none mb-2">{n}</div>
      <div className="font-display tracking-[0.04em] text-[16px] text-cream mb-2">{title}</div>
      <div className="text-cream-mute text-[13px] leading-[1.6] font-light">{body}</div>
    </div>
  );
}

function ProductRow({
  name,
  category,
  retail,
  cv,
  highlight,
}: {
  name: string;
  category: string;
  retail: string;
  cv: string;
  highlight?: boolean;
}) {
  return (
    <tr className={`border-b border-line/40 ${highlight ? 'bg-gold/[0.05]' : ''}`}>
      <td className="p-3 text-cream">{name}</td>
      <td className="p-3 max-md:hidden font-mono text-[11px] tracking-[0.08em] text-cream-mute">
        {category}
      </td>
      <td className="p-3 text-right font-mono text-[12px]">{retail}</td>
      <td className={`p-3 text-right font-mono text-[12px] font-semibold ${highlight ? 'text-gold' : 'text-teal'}`}>
        {cv} CV
      </td>
    </tr>
  );
}
