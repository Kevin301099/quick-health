/* Copy and numbers for the landing page. Replace the placeholders marked PLACEHOLDER before sharing publicly. */

export const CONTACT = {
  // PLACEHOLDER: replace with the real pilot contact details.
  email: 'pilots@rihla.example',
  whatsapp: '+971 50 000 0000',
  hours: 'Sun to Thu, 9:00 to 18:00 GST',
};

export const ROUTES = [
  {
    id: 'uk-eta',
    short: 'UK ETA',
    code: 'LHR',
    place: 'United Kingdom',
    kind: 'Online authorisation',
    level: 'End to end',
    pct: 1,
    fee: '£20 per traveller',
    decision: 'Usually within 3 working days',
    line: 'Not a visa. Linked to the passport, so children need their own.',
    agent: ['Reads passports and Emirates IDs', 'Fills every field and checks the photo', 'Submits after your approval', 'Tracks the decision and messages the client'],
    person: ['Live selfie in the official app', 'Eligibility declarations'],
  },
  {
    id: 'ca-eta',
    short: 'Canada eTA',
    code: 'YYZ',
    place: 'Canada',
    kind: 'Online authorisation',
    level: 'End to end',
    pct: 1,
    fee: 'CA$7 per traveller',
    decision: 'Often within minutes',
    line: 'Air travel only, tied to a valid electronic passport.',
    agent: ['Reads the e-passport and employment details', 'Fills the form', 'Submits after your approval', 'Tracks and notifies'],
    person: ['Background questions', 'Card payment'],
  },
  {
    id: 'us-b1b2',
    short: 'US B1/B2',
    code: 'JFK',
    place: 'United States',
    kind: 'Visa',
    level: 'Up to the signature',
    pct: 0.68,
    fee: 'US$185 per traveller, plus a reported integrity fee',
    decision: 'After a consular interview',
    line: 'A real visa. The applicant signs the DS-160 and attends the interview.',
    agent: ['Drafts every DS-160 section', 'Checks funds against the trip and flags date clashes', 'Stages the interview file', 'Watches the official advisory page'],
    person: ['Security questions and signature', 'Interview in person'],
  },
  {
    id: 'etias',
    short: 'ETIAS',
    code: 'CDG',
    place: 'Schengen Area',
    kind: 'Coming authorisation',
    level: 'Prepare and watch',
    pct: 0.42,
    fee: '€20, as reported',
    decision: 'Portal expected in Q4 2026',
    line: 'Visa-free today. A pre-travel authorisation is on the way.',
    agent: ['Pre-fills and checks the profile now', 'Watches official announcements', 'Alerts you the day the portal opens'],
    person: ['Security questions when it opens'],
  },
] as const;

export const TRUST = [
  {
    title: 'The applicant signs',
    body: 'Declarations, selfies and signatures stay with the applicant. The agent prepares everything around them and sends a secure link in English and Arabic.',
  },
  {
    title: 'No tricks with portals',
    body: 'Rihla does not run slot bots or work around bot protection. Where a portal lets an agent act for the applicant, it acts after your approval. Elsewhere it hands over a finished file.',
  },
  {
    title: 'Every value has a source',
    body: 'Each field links to the document it came from and shows a confidence score. Something unknown stays unknown until a person confirms it.',
  },
  {
    title: 'Everything is on the record',
    body: 'Every tool call, edit and decision lands in an audit trail with the actor and the rule behind it. You can see who settled what, and why.',
  },
];

export const TIERS = [
  {
    name: 'Pilot',
    price: 'AED 1,500',
    unit: 'a month',
    line: 'One route, one team, a paid trial with a clear accuracy target.',
    points: ['1 route of your choice', 'Up to 60 cases a month', '2 seats', 'Onboarding and rule-pack setup', 'English and Arabic client messages'],
    cta: 'Start a pilot',
    featured: false,
  },
  {
    name: 'Desk',
    price: 'AED 3,500',
    unit: 'a month',
    line: 'The whole visa desk, all four Emirati routes.',
    points: ['UK ETA, Canada eTA, US B1/B2 and ETIAS', 'Up to 250 cases a month', '6 seats and an audit export', 'Autonomy levels per route', 'AED 15 for each extra case'],
    cta: 'Book a pilot',
    featured: true,
  },
  {
    name: 'Group',
    price: 'Custom',
    unit: 'for several branches',
    line: 'For agencies with more than one desk or an existing case system.',
    points: ['Branch-level roles and reporting', 'Connect to your case system', 'UAE hosting, confirmed with you', 'Dedicated rule-pack reviewer'],
    cta: 'Talk to us',
    featured: false,
  },
];

export const FAQ = [
  {
    q: 'Does Rihla submit to government portals by itself?',
    a: 'Where a portal lets an agent act for the applicant, Rihla fills and submits after your approval. Where it does not, Rihla prepares the file and hands over a guided step. Inside this demo, every submission goes to a sandbox and nothing reaches a government.',
  },
  {
    q: 'What about VFS Global and visits to a centre?',
    a: 'Rihla prepares the application and the document pack so the visit is short. It does not book slots with scripts and it does not work around any provider’s bot protection. Biometrics and in-person steps stay with the applicant.',
  },
  {
    q: 'Can the agent give immigration advice?',
    a: 'It applies versioned rules and shows the source and review date for each. Your licensed team stays responsible for advice and decisions. We recommend a legal review of each route before you go live.',
  },
  {
    q: 'How accurate is the document reading?',
    a: 'Each field shows a confidence score and where it was read. Low-confidence fields are re-read or sent to your team. Accuracy targets are agreed per route during the pilot and measured against your own files.',
  },
  {
    q: 'Where does client data live?',
    a: 'The production design uses encrypted storage, separate workspaces per agency, role-based access, short retention and no training on client documents. UAE hosting is a pilot requirement we confirm with you before any real data is loaded.',
  },
  {
    q: 'Is the demo real?',
    a: 'The demo is a working agent on fictional people, with sandbox submissions and demo rule packs reviewed on 2 October 2026. A pilot connects your own intake channels and the rule packs for the routes you choose.',
  },
];
