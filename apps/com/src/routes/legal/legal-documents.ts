export type LegalSection =
  | {
      kind: 'content';
      heading?: string;
      paragraphs?: string[];
      items?: string[];
    }
  | {
      kind: 'address';
      heading: string;
      organization: string;
      email: string;
      streetAddress: string;
    };

export interface LegalDocument {
  title: string;
  effectiveDate: string;
  sections: LegalSection[];
}

export const PRIVACY_DOCUMENT: LegalDocument = {
  title: 'Privacy Policy — Team Magnificent',
  effectiveDate: 'July 17, 2026 · teammagnificent.com',
  sections: [
    {
      kind: 'content',
      paragraphs: [
        'Team Magnificent ("we," "us") operates teammagnificent.com and related services, including video presentations, live team activity displays, and call/text coordination (the "Service"). This policy explains what we collect, how we use it, and the choices you have.',
      ],
    },
    {
      kind: 'content',
      heading: 'Information We Collect',
      items: [
        'Information you or the team member who invited you provide: first and last name, phone number, email address, and city/state.',
        'Service activity: video viewing progress, page visits, position and activity in the live team display, and callback requests you submit.',
        'Technical basics: device, browser, and log information used to operate and secure the Service.',
      ],
    },
    {
      kind: 'content',
      heading: 'How We Use Information',
      items: [
        'To deliver what you asked for: the presentation video link, your personal dashboard, and scheduling of requested conversations.',
        "To operate the live team display. Only your FIRST NAME and general location (city/state) appear in activity visible to others; your contact information is never displayed.",
        'To send text messages you have consented to receive (see Text Messaging below).',
        'To operate, secure, and improve the Service and meet legal obligations.',
      ],
    },
    {
      kind: 'content',
      heading: 'Text Messaging (SMS)',
      paragraphs: [
        'By submitting your phone number and checking the consent box, or by texting or calling us first, you agree to receive text messages from Team Magnificent related to your request. Message frequency varies. Message and data rates may apply. Reply STOP to end messages, HELP for help. Consent is not a condition of any purchase.',
      ],
    },
    {
      kind: 'content',
      heading: 'We Do Not Sell or Share Your Information',
      paragraphs: [
        'Your mobile information will not be sold or shared with third parties for promotional or marketing purposes.',
        'More broadly, we do not sell your personal information, and we do not share it with third parties for their own marketing. Information is shared only with:',
      ],
      items: [
        'the Team Magnificent member who invited you (so they can follow up on your request);',
        'service providers who operate the platform for us (hosting, database, telecommunications), bound to use it only on our behalf; and',
        'authorities when required by law.',
      ],
    },
    {
      kind: 'content',
      heading: 'Retention & Your Choices',
      paragraphs: [
        'We keep information only as long as needed for the purposes above. You may request access to or deletion of your information, or withdraw consent, at any time by emailing support@teammagnificent.com. Opting out of texts (STOP) is honored immediately.',
      ],
    },
    {
      kind: 'content',
      heading: 'Children',
      paragraphs: ['The Service is intended for adults and is not directed to anyone under 18.'],
    },
    {
      kind: 'content',
      heading: 'Security',
      paragraphs: ['We use reasonable technical and administrative safeguards to protect your information.'],
    },
    {
      kind: 'content',
      heading: 'Changes',
      paragraphs: ['We will post any changes to this policy on this page with a new effective date.'],
    },
    {
      kind: 'address',
      heading: 'Contact',
      organization: 'Team Magnificent',
      email: 'support@teammagnificent.com',
      streetAddress: '1770 Litchfield Dr, Banning, CA 92220',
    },
  ],
};

export const TERMS_DOCUMENT: LegalDocument = {
  title: 'Terms of Service — Team Magnificent',
  effectiveDate: 'July 17, 2026 · teammagnificent.com',
  sections: [
    {
      kind: 'content',
      paragraphs: ['By using teammagnificent.com (the "Service"), you agree to these Terms.'],
    },
    {
      kind: 'content',
      heading: 'The Service',
      paragraphs: [
        'Team Magnificent provides informational presentations about the GLP-THREE product and the Team Magnificent business-building system, a personal dashboard including a live team activity display, and tools to request a conversation with the team member who invited you.',
      ],
    },
    {
      kind: 'content',
      heading: 'Eligibility',
      paragraphs: ['You must be 18 or older to use the Service.'],
    },
    {
      kind: 'content',
      heading: 'No Guarantees',
      paragraphs: [
        'Building a business takes consistent effort. No result or outcome is guaranteed or implied. Any decision to join is yours, made after your own review and conversations.',
        'Product information on the Service stays within approved product materials; statements about dietary supplements have not been evaluated by the Food and Drug Administration, and the product is not intended to diagnose, treat, cure, or prevent any disease.',
      ],
    },
    {
      kind: 'content',
      heading: 'Text Messaging Program (Team Magnificent Updates)',
      items: [
        'Consent: you agree to receive texts by submitting your number with the consent box checked, or by texting or calling us first. Consent is not a condition of purchase.',
        'Message frequency varies. Message and data rates may apply.',
        'Reply STOP to cancel at any time (one final confirmation message will be sent). Reply HELP or email support@teammagnificent.com for help.',
        'Carriers are not liable for delayed or undelivered messages.',
      ],
    },
    {
      kind: 'content',
      heading: 'Acceptable Use',
      paragraphs: [
        "Do not misuse the Service: no unlawful use, no attempting to access other users' information, no interfering with the Service's operation, and no copying or scraping content or data.",
      ],
    },
    {
      kind: 'content',
      heading: 'Live Team Display',
      paragraphs: [
        'Activity shown on the Service (names, cities, placements, joins) reflects real events from real people. Your first name and city/state may appear in this display; your contact information never does.',
      ],
    },
    {
      kind: 'content',
      heading: 'Intellectual Property',
      paragraphs: [
        'The Service, its design, and its content are owned by Team Magnificent or its licensors. You may not reproduce them without permission.',
      ],
    },
    {
      kind: 'content',
      heading: 'Disclaimers & Limitation of Liability',
      paragraphs: [
        'The Service is provided "as is" without warranties of any kind. To the fullest extent permitted by law, Team Magnificent is not liable for indirect, incidental, or consequential damages arising from use of the Service.',
      ],
    },
    {
      kind: 'content',
      heading: 'Changes',
      paragraphs: ['We may update these Terms; continued use after changes means acceptance. The current version is always posted here.'],
    },
    {
      kind: 'content',
      heading: 'Governing Law',
      paragraphs: ['These Terms are governed by the laws of the State of California.'],
    },
    {
      kind: 'address',
      heading: 'Contact',
      organization: 'Team Magnificent',
      email: 'support@teammagnificent.com',
      streetAddress: '1770 Litchfield Dr, Banning, CA 92220',
    },
  ],
};
