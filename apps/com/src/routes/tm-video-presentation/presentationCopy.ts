export type PresentationEntryKind = 'pmv' | 'rvm';

export interface PresentationCopy {
  hero: {
    eyebrow: string;
    headlineSuffix: string;
    subline: string;
    instruction: string;
  };
  invitation: {
    opener: (args: { prospectFirstName: string; baFullName: string }) => string;
    paragraphs: string[];
    pulseText: (args: { baFirstName: string }) => string;
  };
  whatsNext: {
    headline: string;
    body: string[];
    cta: string;
    ask: (args: { baLabel: string }) => string;
  };
}

export const PRESENTATION_COPY: Record<PresentationEntryKind, PresentationCopy> = {
  pmv: {
    hero: {
      eyebrow: 'A Personal Invitation · Team Magnificent',
      headlineSuffix: 'thinks highly of you.',
      subline: 'And has information that is timely and powerful to share with you.',
      instruction: 'You were not chosen randomly. You were chosen deliberately.',
    },
    invitation: {
      opener: ({ prospectFirstName, baFullName }) =>
        `${prospectFirstName}, you were personally invited by ${baFullName}.`,
      paragraphs: [
        "What you are about to see is three things happening at the same time. A category-defining product. A team that is forming in this exact window. A moment in the market that won't come around again.",
        'That is what the invitation is about. Not a sales call - a briefing on all three. Read it the way you would read a memo from a friend who has done the homework.',
      ],
      pulseText: ({ baFirstName }) => `${baFirstName} personally invited you`,
    },
    whatsNext: {
      headline: "Now that you've seen the video - what's next?",
      body: [
        "Here is something you may not have noticed. While you were watching, you were placed into our team's line. Not enrolled, not signed up - placed, so we could show you something real.",
        'The team you are about to see is being built right now, in real time. This is the mechanism we are so excited about - how our teams are actually built, and why the opportunity in front of you is real. We wanted you to see it for yourself.',
      ],
      cta: 'See the team forming around you →',
      ask: ({ baLabel }) =>
        `We are not asking you to buy anything or do anything today. The one next step is a real conversation with ${baLabel} - the person who can walk you through exactly what is going on, and the advantage that has been created for you here. You will find the way to start that conversation on the next screen.`,
    },
  },
  rvm: {
    hero: {
      eyebrow: 'A Team Magnificent Message · Team Magnificent',
      headlineSuffix: 'has information for you.',
      subline:
        'You may have heard a brief message first. This page gives you the fuller context: the product, the timing, and why it was worth sending.',
      instruction: 'No pressure, no obligation - just clear information to consider.',
    },
    invitation: {
      opener: ({ prospectFirstName, baFullName }) =>
        `${prospectFirstName}, this page was prepared for you by ${baFullName}.`,
      paragraphs: [
        'A short message can only point to the door. The page in front of you gives the full picture: the product, the timing, and the team activity behind this moment.',
        'Start with the video, then use the rest of the page as a reference. It is information you can consider privately and talk through if it makes sense.',
      ],
      pulseText: ({ baFirstName }) => `${baFirstName} prepared this page for you`,
    },
    whatsNext: {
      headline: 'Now that you have seen the video - here is the next view.',
      body: [
        'Once the video is complete, this page opens a private team view so you can see the momentum this message is connected to.',
        'That next screen shows the team activity, the simple next steps, and how to start a real conversation if what you saw raised questions.',
      ],
      cta: 'See your team view →',
      ask: ({ baLabel }) =>
        `No purchase or decision is being asked for here. If this information is relevant to you, ${baLabel} can walk you through the context and answer your questions in a real conversation.`,
    },
  },
};

export function getPresentationCopy(entryKind: PresentationEntryKind): PresentationCopy {
  return PRESENTATION_COPY[entryKind];
}
