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

import type { ReactNode } from 'react';
import { MCS_PRODUCT_CATALOG } from '@momentum/shared';
import {
  ModuleScaffold,
  SectionLabel,
  SectionTitle,
  Prose,
  Callout,
  DataCard,
} from './_scaffold';

const PDR_FOUNDATION_RESOURCE_VERSION_ID =
  'knowledge:knowledge_source_e0951cff-eeb0-45d2-b6c4-e491342c05ac:v2';

const PDR_FOUNDATION_DOCUMENT_URL =
  `/api/resources/${encodeURIComponent(PDR_FOUNDATION_RESOURCE_VERSION_ID)}/document`;

export function ModuleProductPage() {
  return (
    <ModuleScaffold
      moduleId={1}
      heroPrelude={(
        <div className="mb-8 border-l-4 border-teal bg-teal/[0.05] px-5 py-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-teal">
            PDR · Physicians&apos; Desk Reference · Product foundation
          </div>
          <div className="mt-2 font-display text-[clamp(25px,4vw,38px)] tracking-[0.04em] text-cream">
            What is it? What is its significance? What does it mean to you?
          </div>
        </div>
      )}
    >
      {/* ── Required foundation — first for every member ─────────── */}
      <SectionLabel>Lesson 1 · begin here</SectionLabel>
      <SectionTitle>The most important product fact to learn first.</SectionTitle>
      <Prose>
        <p>
          You do not need any background in supplements, medicine, or network marketing to begin.
          Michael will guide you from the beginning. The first thing he wants you to understand is
          not an ingredient or a sales point. It is the quality and documentation standard behind
          the entire product line.
        </p>
        <p>
          Every product THREE International makes is published in the Physicians&apos; Desk Reference.
          Of the PDR&apos;s 3,904 listings, only 143 are nutritional supplements from roughly two dozen
          companies, and THREE is the only company with its complete product line there: all nine
          products, each with a full monograph.
        </p>
      </Prose>

      <SectionLabel>Your support team · no prior context required</SectionLabel>
      <SectionTitle>Three AI support agents. Three benefits to you.</SectionTitle>
      <Prose>
        <p>
          These are not people you were expected to know before opening the page. They are the
          Team Magnificent AI support team. An AI agent in this app is a specialized digital guide
          focused on one part of your member journey. Each one gives you direct, personal support
          when you need it. They support your decisions; they do not score you, qualify you, contact
          people for you, or take control away from you.
        </p>
        <p>
          <strong className="text-cream">These agents are created and provided by Team Magnificent.</strong>{' '}
          THREE International does not provide AI agents. THREE remains the authority for its
          products, policies, enrollment, and compensation plan; Team Magnificent provides this
          additional member training and support experience.
        </p>
        <p>
          <strong className="text-gold">
            Team Magnificent is the only team in THREE International currently providing this AI
            agent support to its members to help them learn, develop, train, and build their
            business.
          </strong>
        </p>
      </Prose>

      <div className="my-7 border border-gold/50 bg-gold/[0.05] p-6">
        <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-gold">
          The purpose of learning, development, and training
        </div>
        <h3 className="mt-2 font-display text-[30px] tracking-[0.04em] text-cream">
          Develop professional network marketers.
        </h3>
        <p className="mt-3 max-w-[720px] text-[14px] font-light leading-[1.7] text-cream-mute">
          <strong className="text-cream">Professional</strong> means developing the product
          knowledge, recruiting skill, daily discipline, and leadership ability to create and build
          a large organization in THREE International and pursue professional-level commission
          income paid by THREE International according to their compensation structure.
        </p>
        <div className="mt-4 border-l-4 border-teal bg-teal/[0.04] p-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-teal">
            The professional analogy
          </div>
          <p className="mt-2 text-[13px] font-light leading-[1.65] text-cream-mute">
            It is like becoming a professional chef who can also run the restaurant. Knowing the
            products is knowing the ingredients. Becoming a professional means you can also recruit
            and develop the team, create consistent operations and product volume, serve people
            well, and lead the larger organization.
          </p>
          <p className="mt-3 text-[13px] font-light leading-[1.65] text-cream-mute">
            A chef develops through real kitchen experience, experienced mentors, and formal
            education such as the Culinary Institute of America. A professional network marketer
            develops the same way: structured learning plus guided work inside a real organization
            with leaders who know how to build it.
          </p>
          <p className="mt-3 font-display text-[18px] tracking-[0.04em] text-cream">
            To become masterful, you apprentice or learn from other masters. That is what Team
            Magnificent brings to the table: experienced leadership, a real organization in which
            to practice, and Michael&apos;s structured learning, development, and training.
          </p>
        </div>
        <p className="mt-3 max-w-[720px] text-[12px] font-light leading-[1.65] text-cream-faint">
          A Brand Ambassador works under an independent, commission-based contractual relationship;
          this is not employment, a wage, or a salary. Commissions are determined and paid by THREE
          International according to their compensation structure, based on sales, product volume,
          and the organization the member builds. No commission amount or income result is
          guaranteed.
        </p>
        <p className="mt-4 max-w-[720px] border-t border-gold/20 pt-4 text-[13px] font-light leading-[1.65] text-cream-mute">
          This training is not theory. Team Magnificent leadership knows how to build this kind of
          commission-based network marketing organization from direct experience. Michael&apos;s
          learning, development, and training templates turn that experience into a clear path a
          member can learn and follow.
        </p>
      </div>

      <div className="my-7 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
        <AgentRoleCard
          name="Steve Success"
          stage="First · discovery"
          role="Steve is your AI Discovery and Success Agent. He listens to your goals, experience, learning preferences, questions, and support needs without scoring, ranking, or predicting you."
          handoff="Benefit to you: you begin as a known person, not an anonymous new account, and you do not have to keep explaining your starting point."
        />
        <FlowArrow />
        <AgentRoleCard
          name="Michael Magnificent"
          stage="Now · learning, development, and training"
          role="Michael is your AI Learning, Development, and Training Agent and Daily Success Coach. He teaches, answers questions, checks understanding, helps you develop confidence and skill, and turns a lesson into a manageable next step."
          handoff="Benefit to you: personal learning, development, and training support inside the app, at your pace, including questions you may not want to ask in a group. This module is one of his core training templates."
          active
        />
        <FlowArrow />
        <AgentRoleCard
          name="Ivory"
          stage="Later · Who Do You Know"
          role="Ivory is your AI Who Do You Know Coach. Ivory helps you remember and organize people already in your life, without qualifying them or contacting anyone for you."
          handoff="Benefit to you: fewer forgotten relationships and a calmer way to build your own names list. You choose every name and decide whether to share."
        />
      </div>

      <div className="my-7 border border-gold/35 bg-gold/[0.04] p-6">
        <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-gold">
          The benefit of AI-guided learning, development, and training
        </div>
        <h3 className="mt-2 font-display text-[28px] tracking-[0.04em] text-cream">
          A normal course gives everyone the same page. Michael supports the person who is learning and developing.
        </h3>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <AgenticBenefit title="Ask without embarrassment" body="A new member can ask the basic question, ask again, or say that something still does not make sense." />
          <AgenticBenefit title="Learn at your pace" body="Michael can slow down, reinforce the important point, and keep the member focused on one lesson at a time." />
          <AgenticBenefit title="Turn information into understanding" body="Michael does more than display content; he helps the member explain the significance in their own words." />
          <AgenticBenefit title="Keep the member in control" body="Michael teaches and recommends. The member decides, practices, and acts. He never prospects, sends, calls, scores, or ranks." />
        </div>
        <p className="mt-5 border-t border-gold/20 pt-4 text-[13px] font-light leading-[1.65] text-cream-mute">
          This is a cutting-edge member benefit that is not yet commonplace. Most training portals
          still stop at pages, videos, and PDFs. Team Magnificent adds an AI Learning, Development,
          and Training Agent who can support the person learning from those materials, while the
          member, sponsor, and leadership remain central to the experience.
        </p>
      </div>

      <section
        aria-label="Meet Michael, your Learning, Development, and Training Agent"
        className="my-7 border border-teal/40 bg-teal/[0.04] p-6"
      >
        <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-teal">
          Meet your guide
        </div>
        <h3 className="mt-2 font-display text-[30px] tracking-[0.04em] text-cream">
          Michael Magnificent · Your Learning, Development, and Training Agent
        </h3>
        <p className="mt-3 max-w-[690px] text-[14px] font-light leading-[1.7] text-cream-mute">
          Michael&apos;s job is to support your learning and development: teach the lesson, answer your
          questions, help you build confidence and skill, and make sure the words on this page
          connect to what you are building. He starts with three questions: What is the PDR? Why is
          THREE&apos;s position significant? What does that mean to you as a member?
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <GuideStep n="01" title="Understand it" body="Learn what the PDR is and what a monograph contains." />
          <GuideStep n="02" title="Recognize it" body="See why complete-catalog inclusion is different from one listed product." />
          <GuideStep n="03" title="Make it yours" body="Put the significance into your own words before moving forward." />
        </div>
      </section>

      <SectionLabel>What it is</SectionLabel>
      <SectionTitle>Not an advertisement. A clinical reference.</SectionTitle>
      <Prose>
        <p>
          PDR originally meant the <strong className="text-cream">Physicians&apos; Desk Reference</strong>,
          first published in 1947. The report explains that the reference now lives at PDR.net as
          the <strong className="text-cream">Prescribers&apos; Digital Reference</strong>, with monograph
          information used in the digital tools clinicians consult.
        </p>
        <p>
          A <strong className="text-cream">monograph</strong> is a structured disclosure of what a
          product contains and how it is used: its composition, directions, dosing, cautions, and
          supporting information. This is the first term to understand; it is the reason being
          listed is more meaningful than appearing in a marketing directory.
        </p>
      </Prose>

      <SourceCard title="FROM THE PDR POSITION REPORT · WHAT IT IS">
        “The Physicians&apos; Desk Reference is not a marketing directory, a wellness blog, or an
        industry award. It is the working reference of American clinical practice.”
        <br /><br />
        “A PDR listing is not an ad or a testimonial; it is a monograph — a structured,
        clinical-style disclosure of exactly what a product contains and how it is meant to be
        used.”
      </SourceCard>

      <SectionLabel>Why the complete catalog matters</SectionLabel>
      <SectionTitle>One listed product is different from a company-wide standard.</SectionTitle>
      <Prose>
        <p>
          Several nutritional companies list selected products. The significance of THREE&apos;s
          position is that it lists the entire line. Nothing is held outside that documentation
          standard. The report describes this as evidence that clinical-grade disclosure is the
          company&apos;s baseline rather than a showcase reserved for a flagship product.
        </p>
      </Prose>

      <SourceCard title="FROM THE PDR POSITION REPORT · THE STRUCTURAL POINT">
        “A single PDR listing is a product decision. A complete-catalog listing is a company
        decision — evidence of a documentation and quality standard applied universally, with no
        product exempted from clinical-grade disclosure.”
      </SourceCard>

      <SourceCard title="FROM THE PDR POSITION REPORT · WHAT IT SIGNIFIES">
        “The PDR position doesn&apos;t grant quality — it reveals it. It is the visible surface of
        formulation discipline, label integrity, and documentation rigor that had to exist
        underneath before the listing was possible.”
      </SourceCard>

      <div className="my-7 border border-gold/60 bg-gold/[0.06] p-6 md:flex md:items-center md:justify-between md:gap-8">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-gold">
            Foundational document · read first
          </div>
          <div className="mt-2 font-display text-[28px] tracking-[0.04em] text-cream">
            The PDR Position — Team Magnificent
          </div>
          <div className="mt-2 max-w-[560px] text-[13px] font-light leading-[1.65] text-cream-mute">
            Kevin-authorized research report. Opens the approved original PDF for reading or
            printing.
          </div>
        </div>
        <a
          href={PDR_FOUNDATION_DOCUMENT_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex flex-shrink-0 items-center justify-center border border-gold bg-gold px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink transition-colors hover:bg-gold-bright md:mt-0"
        >
          Open / Print PDF
        </a>
      </div>

      <Callout tone="teal" title="MICHAEL'S OPENING DISCUSSION">
        In your own words: what is the PDR, why is complete-catalog inclusion significant, and what
        does it mean to you to represent products built to that documentation standard? Do not move
        on until you can explain those three ideas simply.
      </Callout>

      {/* ── Product instruction begins only after the foundation ─── */}
      <SectionLabel>Next · meet the first product</SectionLabel>
      <SectionTitle>GLP&#8209;THREE™ — the first product to understand.</SectionTitle>
      <Prose>
        <p>
          You will hear several names in this section. Start with one:
          <strong className="text-cream"> GLP-THREE™ is a product made by THREE International</strong>.
          It is one of the nine products documented in the PDR report you just read. You are not
          expected to know the science or remember every ingredient yet; Michael will build that
          knowledge one layer at a time.
        </p>
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
      <SectionTitle>Use this as a map, not a memory test.</SectionTitle>
      <Prose>
        <p>
          This table introduces the names and categories you will learn over time. You do not need
          to memorize it today. <strong className="text-cream">Retail</strong> is the customer price.
          <strong className="text-cream"> CV</strong> means Commissionable Volume, the value THREE
          uses in its compensation records. Module 2 explains how CV works; here it is shown only so
          you recognize the term when you see it.
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
        <a
          href="#product-video-library"
          className="inline-flex mt-4 font-mono tracking-[0.16em] text-[10px] text-ink bg-gold hover:bg-gold-bright px-4 py-3 uppercase"
        >
          Open Product Gallery
        </a>
      </div>

      <ProductVideoLibrary />

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

function ProductVideoLibrary() {
  return (
    <section
      id="product-video-library"
      aria-labelledby="product-video-library-title"
      className="my-10 scroll-mt-8 border-t border-gold/30 pt-8"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-teal">
        Product Training · Video Library
      </div>
      <h2
        id="product-video-library-title"
        className="mt-2 font-display text-[clamp(32px,5vw,48px)] leading-none tracking-[0.04em] text-cream"
      >
        Watch the products. Build informed belief.
      </h2>
      <p className="mt-4 max-w-[720px] text-[14px] font-light leading-[1.7] text-cream-mute">
        This working library is now part of Product Training. Choose a product, open its video,
        and return here to continue the module. Every play button opens the authorized Team
        Magnificent source video in a new tab so your training page stays in place.
      </p>

      <div className="mt-7 space-y-8">
        {MCS_PRODUCT_CATALOG.map((product) => (
          <section key={product.productKey} aria-labelledby={`product-video-${product.productKey}`}>
            <div className="mb-3 flex items-baseline gap-3 border-b border-line pb-3">
              <span className="font-mono text-[10px] tracking-[0.14em] text-teal">
                {product.sectionNumber}
              </span>
              <h3
                id={`product-video-${product.productKey}`}
                className="font-display text-[24px] tracking-[0.04em] text-cream"
              >
                {product.productName}
              </h3>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {product.videos.map((video) => (
                <a
                  key={video.videoId}
                  href={`https://www.youtube.com/watch?v=${video.youtubeId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="group overflow-hidden border border-line bg-[#1A1A1A] transition-colors hover:border-gold"
                  aria-label={`Play ${video.title} on YouTube`}
                >
                  <div className="relative aspect-video overflow-hidden bg-ink">
                    <img
                      src={`https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover opacity-80 transition group-hover:scale-[1.02] group-hover:opacity-100"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-ink/20">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold text-[18px] text-ink transition group-hover:bg-gold-bright">
                        ▶
                      </span>
                    </div>
                    <span className="absolute bottom-2 right-2 bg-ink/90 px-2 py-1 font-mono text-[9px] tracking-[0.1em] text-cream">
                      {video.duration}
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="font-display text-[18px] tracking-[0.03em] text-cream">
                      {video.title}
                    </div>
                    <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-gold">
                      Play video ↗
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function GuideStep({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="border border-teal/20 bg-ink/30 p-4">
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-teal">{n}</div>
      <div className="mt-2 font-display text-[18px] tracking-[0.04em] text-cream">{title}</div>
      <p className="mt-2 text-[12px] font-light leading-[1.55] text-cream-mute">{body}</p>
    </div>
  );
}

function AgentRoleCard({
  name,
  stage,
  role,
  handoff,
  active = false,
}: {
  name: string;
  stage: string;
  role: string;
  handoff: string;
  active?: boolean;
}) {
  return (
    <div className={`border p-5 ${active ? 'border-teal/60 bg-teal/[0.05]' : 'border-line bg-[#1A1A1A]'}`}>
      <div className={`font-mono text-[9px] uppercase tracking-[0.18em] ${active ? 'text-teal' : 'text-gold'}`}>
        {stage}
      </div>
      <div className="mt-2 font-display text-[22px] tracking-[0.04em] text-cream">{name}</div>
      <p className="mt-3 text-[12px] font-light leading-[1.6] text-cream-mute">{role}</p>
      <p className="mt-3 border-t border-line/60 pt-3 text-[11px] leading-[1.55] text-cream-faint">{handoff}</p>
    </div>
  );
}

function FlowArrow() {
  return (
    <div aria-hidden="true" className="flex items-center justify-center font-display text-[26px] text-gold/60 max-md:rotate-90">
      →
    </div>
  );
}

function AgenticBenefit({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-l-2 border-gold/50 pl-4">
      <div className="font-display text-[18px] tracking-[0.04em] text-cream">{title}</div>
      <p className="mt-1 text-[12px] font-light leading-[1.6] text-cream-mute">{body}</p>
    </div>
  );
}

function SourceCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="my-6 border-l-4 border-gold bg-gold/[0.05] p-5 md:p-6">
      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-gold">{title}</div>
      <div className="mt-3 max-w-[720px] text-[15px] font-light leading-[1.75] text-cream">
        {children}
      </div>
    </div>
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
