/**
 * /training/fast-start/binary — Module 3: The Binary as Two Legs.
 *
 * Source: Team Magnificent's "Power in Numbers" comp training
 * (devklg/team-magnificent-training/index.html), Kevin-authorized.
 *
 * The TEACHING MANDATE (TASK.md, the BIG ONE):
 *   Make the exponential REALIZABLE, not fantastical. The "$21K/week"
 *   number sounds impossible to a beginner. The job is to make it feel
 *   REACHABLE by showing it is built from ONE small repeated act:
 *   sponsor 2 (one left, one right) and TEACH them to do the same.
 *   Their 2 teach their 2. Fourteen rounds of that single behavior =
 *   16,384 people generating volume — and you never personally
 *   recruited more than 2.
 *
 *   "How do you eat an elephant? One bite at a time."
 *
 *   The BA is not asked to do something huge; they are asked to do
 *   ONE small thing and duplicate it. The exponential is what the
 *   SYSTEM does when each person does the small thing.
 *
 *   No-breakage (volume flows up from unlimited depth) and first-mover
 *   advantage (earlier position = more of the org's future growth flows
 *   through you) are the two STRUCTURAL FACTS that make the duplication
 *   real, not hype.
 *
 * The BA should leave Module 3 thinking: "I don't have to find
 * thousands of people. I have to find 2 and teach them what I just
 * learned. That I can do."
 *
 * Compliance scope: .team only. CV figures and the 14-level table
 * are legitimate inside this regulated training environment.
 */

import {
  ModuleScaffold,
  SectionLabel,
  SectionTitle,
  Prose,
  Callout,
} from './_scaffold';

export function ModuleBinaryPage() {
  return (
    <ModuleScaffold moduleId={3}>
      {/* ── Two legs ────────────────────────────────────────────── */}
      <SectionLabel>The shape of it</SectionLabel>
      <SectionTitle>You have two businesses, not one.</SectionTitle>
      <Prose>
        <p>
          The binary is just this: every Brand Ambassador holds two retail businesses — a Left Leg
          and a Right Leg. Volume accumulates on both legs. Cycles fire from the combination. One
          person alone can only do so much. Two teams multiply everything you do.
        </p>
      </Prose>

      <div className="grid md:grid-cols-2 gap-3 my-8">
        <LegCard
          tag="Outside leg · shared with your sponsor"
          name="POWER LEG"
          body="You share this leg with your sponsor. As your sponsor and upline build their organizations, new enrollees fill the next open spot moving down this leg. Their CV flows upward through your position automatically."
        />
        <LegCard
          tag="Inside leg · you initiated this one"
          name="PAY LEG"
          body="You initiated this leg by placing the first person at the top. As you and your team enroll people, each new person fills the next open position moving down. Everyone placed here has CV flowing upward through you."
        />
      </div>

      <Callout tone="gold" title="THE MOMENT IT BECOMES MONEY">
        300 CV on the lesser leg + 600 CV on the greater leg = 900 CV total ·{' '}
        <strong className="text-cream">900 CV → cycle fires → $35 paid weekly.</strong> Either leg
        can be the lesser or greater. Unused volume carries forward.
      </Callout>

      {/* ── No breakage ─────────────────────────────────────────── */}
      <SectionLabel>The structural fact #1</SectionLabel>
      <SectionTitle>No breakage. Volume flows up from unlimited depth.</SectionTitle>
      <Prose>
        <p>
          In many compensation structures, volume generated beyond a certain depth is "lost" — it
          never reaches you. <strong className="text-cream">THREE does not work that way.</strong>
        </p>
        <p>
          Every product purchased by every person in your organization — at{' '}
          <strong className="text-cream">any depth, on any level</strong> — generates CV that flows
          upward through the binary tree. Level 1, Level 7, Level 14. It all counts.
        </p>
        <p>
          This means you can build an organization of substantial — even extraordinary — size and
          every person in it supports your income through the volume they generate. Unlike a
          traditional job where your income is capped by what you personally produce, the binary
          allows{' '}
          <strong className="text-cream">
            your entire organization's productivity to count toward your compensation
          </strong>
          . This is why team building is the foundation. The team's volume never breaks away.
        </p>
      </Prose>

      {/* ── First-mover ─────────────────────────────────────────── */}
      <SectionLabel>The structural fact #2</SectionLabel>
      <SectionTitle>First-mover advantage. This is math, not motivation.</SectionTitle>
      <Prose>
        <p>
          In a binary plan, <strong className="text-cream">timing is a structural advantage</strong>
          . The sooner you enroll and the earlier your position is established in your sponsor's
          tree, the greater the compounding benefit you receive as the organization grows. This
          isn't a sales tactic. It is the geometry of the tree.
        </p>
      </Prose>

      <div className="grid md:grid-cols-2 gap-3 my-6">
        <CompareCard
          tone="early"
          tag="EARLY ENROLLEE"
          name="First-Mover Position"
          lines={[
            'Placed higher in the binary tree',
            'As your upline builds, new enrollees in the shared leg fill positions BELOW yours — CV flows up through you',
            'Every person enrolled after you in your sponsor’s tree builds volume below your position',
            'The shared leg fills from the bottom up; every placement below you stacks volume upward',
          ]}
        />
        <CompareCard
          tone="later"
          tag="LATER ENROLLEE"
          name="Building Under You"
          lines={[
            'Placed deeper in the tree, below early enrollees',
            'Their volume — and their team’s volume — flows upward, benefiting positions above',
            'They still earn. They are contributing to the cycles of those who came before them',
            'Their early enrollees benefit the same way. The advantage compounds with every generation',
          ]}
        />
      </div>

      <Callout tone="gold" title="THE BOTTOM LINE">
        The sooner you enroll and begin building, the more of the organization's future growth flows
        through your position.{' '}
        <strong className="text-cream">This is structural math.</strong> Every person who enrolls
        after you, at any depth below you, contributes volume that supports your cycles. The
        first-mover advantage is built into every binary plan — and Team Magnificent is six months
        into a launch curve. The window is exactly the kind that closes.
      </Callout>

      {/* ── The duplication rule ────────────────────────────────── */}
      <SectionLabel>The one behavior that drives everything</SectionLabel>
      <SectionTitle>You sponsor 2. They sponsor 2. They sponsor 2.</SectionTitle>
      <Prose>
        <p>
          Forget the $21K number for a second. Look at the behavior. Every Brand Ambassador sponsors{' '}
          <strong className="text-cream">exactly 2 quality people</strong> — one on the left, one on
          the right. Those 2 each sponsor 2. Those 4 each sponsor 2. Everyone does this. That single
          repeated behavior is what generates the entire doubling sequence.
        </p>
      </Prose>

      <DuplicationDiagram />

      <Callout tone="teal" title="THE RULE IS SIMPLE. THE RESULT IS EXPONENTIAL.">
        You don't need to find thousands of people. You need{' '}
        <strong className="text-cream">2 who believe in it and do the same thing</strong>. Their 2
        do the same. <em>This is duplication.</em> This is what fills the table below.
      </Callout>

      {/* ── The 14-level table ──────────────────────────────────── */}
      <SectionLabel>What that behavior produces</SectionLabel>
      <SectionTitle>14 rounds of duplication, one leg.</SectionTitle>
      <Prose>
        <p>
          Each row in the table is one full round of duplication — every BA at that level has
          sponsored their 2. Every person generates CV every month. The three CV columns show what
          your leg volume looks like if each person produces 100, 200, or 300 CV per month.
        </p>
        <p>
          Weekly cap is 500 cycles base / 600 qualified. <strong className="text-cream">"500+"</strong>{' '}
          means the cap is reached well before the math runs out.
        </p>
      </Prose>

      <DuplicationTable />

      {/* ── The closing belief ──────────────────────────────────── */}
      <SectionLabel>What you need to walk away believing</SectionLabel>
      <SectionTitle>Two. Then teach. That is the whole job.</SectionTitle>
      <Prose>
        <p>
          The $21,000/week number is real, and it sits at the top of the table. But the path there
          is not "find thousands of people." The path is{' '}
          <strong className="text-cream">sponsor 2 quality people and teach them to do the same
          thing you just learned</strong>. Their 2 do the same. Fourteen rounds of that single
          behavior is 16,384 people generating volume on one leg — and you never personally
          recruited more than 2.
        </p>
        <p>
          How do you eat an elephant? One bite at a time. You are not asked to do something huge.
          You are asked to do one small thing — twice — and duplicate it. The exponential is what
          the system does when each person does the small thing. No breakage carries it all the way
          up; first-mover advantage compounds it for you over time.
        </p>
        <p className="text-gold font-display tracking-[0.06em] text-[18px] mt-6">
          Module 4 is where you start. Build your prospect list. Then Module 5 — how to actually
          recruit the first two and teach them this exact thing.
        </p>
      </Prose>
    </ModuleScaffold>
  );
}

function LegCard({ tag, name, body }: { tag: string; name: string; body: string }) {
  return (
    <div className="bg-[#1A1A1A] border border-line p-6">
      <div className="font-mono tracking-[0.2em] text-[10px] text-gold uppercase mb-2">{tag}</div>
      <div className="font-display tracking-[0.06em] text-[28px] text-cream mb-3 leading-none">
        {name}
      </div>
      <div className="text-cream-mute text-[13px] leading-[1.65] font-light">{body}</div>
    </div>
  );
}

function CompareCard({
  tone,
  tag,
  name,
  lines,
}: {
  tone: 'early' | 'later';
  tag: string;
  name: string;
  lines: string[];
}) {
  return (
    <div className="bg-[#1A1A1A] border border-line">
      <div
        className={`px-5 py-3 ${tone === 'early' ? 'bg-teal/15 border-b border-teal/40' : 'bg-line/40 border-b border-line'}`}
      >
        <div
          className={`font-mono tracking-[0.22em] text-[10px] uppercase mb-1 ${tone === 'early' ? 'text-teal' : 'text-cream-mute'}`}
        >
          {tag}
        </div>
        <div className="font-display tracking-[0.05em] text-[20px] text-cream">{name}</div>
      </div>
      <div className="divide-y divide-line/60">
        {lines.map((l, i) => (
          <div
            key={i}
            className="flex items-start gap-3 px-5 py-3 text-cream-mute text-[13px] font-light leading-[1.55]"
          >
            <span
              className={`flex-shrink-0 mt-0.5 ${tone === 'early' ? 'text-teal' : 'text-cream-faint'}`}
            >
              {tone === 'early' ? '✓' : '•'}
            </span>
            <span>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DuplicationDiagram() {
  // The "you → 2 → 4 → 8 → ..." visualization, simplified.
  const rows: { label: string; nodes: number; nodeClass: string; arrow?: string }[] = [
    { label: 'You sponsor 2 — one left, one right', nodes: 2, nodeClass: 'border-teal/60 text-teal', arrow: 'each sponsors 2' },
    { label: '', nodes: 4, nodeClass: 'border-blue-400/40 text-blue-300', arrow: 'each sponsors 2' },
    { label: '', nodes: 8, nodeClass: 'border-gold/40 text-gold-bright', arrow: 'each sponsors 2' },
  ];
  const summaryNodes = ['16', '32', '64', '128', '256', '512', '1,024 …', '16,384'];
  return (
    <div className="border-t-4 border-teal bg-[#1A1A1A] border border-line p-5 my-6">
      <div className="mb-5">
        <div className="inline-block bg-gold text-ink font-display tracking-[0.06em] text-[14px] px-4 py-1 mb-3">
          YOU
        </div>
        <div className="font-mono tracking-[0.15em] text-[10px] text-cream-mute uppercase">
          You sponsor 2 — one left, one right
        </div>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="mb-4">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {Array.from({ length: r.nodes }).map((_, j) => (
              <span
                key={j}
                className={`bg-[#242424] border ${r.nodeClass} rounded-sm font-mono text-[10px] tracking-[0.08em] px-2 py-1`}
              >
                BA
              </span>
            ))}
            {r.arrow && (
              <span className="font-mono text-[10px] text-cream-faint tracking-[0.1em] ml-2">
                → {r.arrow}
              </span>
            )}
          </div>
        </div>
      ))}
      <div className="border-t border-line pt-4 mt-2">
        <div className="font-mono tracking-[0.15em] text-[10px] text-cream-mute uppercase mb-2">
          The rest of the rounds
        </div>
        <div className="flex flex-wrap gap-2">
          {summaryNodes.map((n) => (
            <span
              key={n}
              className="border border-dashed border-line text-cream-mute font-mono text-[10px] tracking-[0.08em] px-2 py-1 rounded-sm"
            >
              → {n}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

interface LevelRow {
  level: string;
  people: string;
  v100: string;
  c100: string;
  v200: string;
  c200: string;
  v300: string;
  c300: string;
  highlight?: boolean;
  final?: boolean;
}

const LEVELS: readonly LevelRow[] = [
  { level: '1', people: '2', v100: '200', c100: '<1', v200: '400', c200: '<1', v300: '600', c300: '<1' },
  { level: '2', people: '4', v100: '400', c100: '<1', v200: '800', c200: '<1', v300: '1,200', c300: '1' },
  { level: '3', people: '8', v100: '800', c100: '<1', v200: '1,600', c200: '1', v300: '2,400', c300: '2' },
  { level: '4', people: '16', v100: '1,600', c100: '1', v200: '3,200', c200: '3', v300: '4,800', c300: '5' },
  { level: '5', people: '32', v100: '3,200', c100: '3', v200: '6,400', c200: '7', v300: '9,600', c300: '10' },
  { level: '6', people: '64', v100: '6,400', c100: '7', v200: '12,800', c200: '14', v300: '19,200', c300: '21', highlight: true },
  { level: '7', people: '128', v100: '12,800', c100: '14', v200: '25,600', c200: '28', v300: '38,400', c300: '42' },
  { level: '8', people: '256', v100: '25,600', c100: '28', v200: '51,200', c200: '56', v300: '76,800', c300: '85' },
  { level: '9', people: '512', v100: '51,200', c100: '56', v200: '102,400', c200: '113', v300: '153,600', c300: '170', highlight: true },
  { level: '10', people: '1,024', v100: '102,400', c100: '113', v200: '204,800', c200: '227', v300: '307,200', c300: '341' },
  { level: '11', people: '2,048', v100: '204,800', c100: '227', v200: '409,600', c200: '455', v300: '614,400', c300: '500+' },
  { level: '12', people: '4,096', v100: '409,600', c100: '455', v200: '819,200', c200: '500+', v300: '1.23M', c300: '500+', highlight: true },
  { level: '13', people: '8,192', v100: '819,200', c100: '500+', v200: '1.64M', c200: '500+', v300: '2.46M', c300: '500+' },
  { level: '14 ★', people: '16,384', v100: '1.44M', c100: '500+', v200: '2.88M', c200: '500+', v300: '4.32M', c300: '500+', final: true },
];

function DuplicationTable() {
  return (
    <div className="border border-line bg-[#1A1A1A] my-6 overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-line">
            <Th>Lvl</Th>
            <Th>BAs in one leg</Th>
            <Th right tone="blue">Vol @100</Th>
            <Th right tone="dim">÷900</Th>
            <Th right tone="gold">Vol @200</Th>
            <Th right tone="dim">÷900</Th>
            <Th right tone="teal">Vol @300</Th>
            <Th right tone="dim">÷900</Th>
          </tr>
        </thead>
        <tbody className="font-light">
          {LEVELS.map((r) => (
            <tr
              key={r.level}
              className={`border-b border-line/40 ${
                r.final ? 'bg-teal/[0.08]' : r.highlight ? 'bg-gold/[0.04]' : ''
              }`}
            >
              <Td plv={r.final}>{r.level}</Td>
              <Td>{r.people} people</Td>
              <Td right tone="blue">{r.v100}</Td>
              <Td right tone="dim">{r.c100}</Td>
              <Td right tone="gold">{r.v200}</Td>
              <Td right tone="dim">{r.c200}</Td>
              <Td right tone="teal">{r.v300}</Td>
              <Td right tone="dim">{r.c300}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  right,
  tone,
}: {
  children: React.ReactNode;
  right?: boolean;
  tone?: 'blue' | 'gold' | 'teal' | 'dim';
}) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-300',
    gold: 'text-gold',
    teal: 'text-teal',
    dim: 'text-cream-faint',
  };
  return (
    <th
      className={`font-mono tracking-[0.16em] text-[9px] uppercase p-3 ${
        right ? 'text-right' : 'text-left'
      } ${tone ? colorMap[tone] : 'text-gold'}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  right,
  tone,
  plv,
}: {
  children: React.ReactNode;
  right?: boolean;
  tone?: 'blue' | 'gold' | 'teal' | 'dim';
  plv?: boolean;
}) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-300',
    gold: 'text-gold-bright',
    teal: 'text-teal',
    dim: 'text-cream-faint',
  };
  const color = tone ? colorMap[tone] : 'text-cream-mute';
  const fontClass = right ? 'font-mono text-[11px]' : '';
  const lvlClass = plv ? 'text-teal font-semibold' : 'text-cream-faint';
  if (!right && plv === undefined) {
    return <td className="p-3 text-cream font-mono text-[11px]">{children}</td>;
  }
  if (plv !== undefined) {
    return <td className={`p-3 font-mono text-[11px] ${lvlClass}`}>{children}</td>;
  }
  return <td className={`p-3 ${right ? 'text-right' : ''} ${fontClass} ${color}`}>{children}</td>;
}
