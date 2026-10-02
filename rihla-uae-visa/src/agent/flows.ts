import type { FileRef, Issue, Profile } from '@/domain/types';
import type { FlowCtx } from './engine';
import { FlowStop } from './engine';
import { useStore } from './store';
import { PRODUCTS, SLOTS } from '@/domain/visas';
import { byCode } from '@/domain/nationalities';
import { docFields } from '@/domain/docfields';
import { runChecks } from '@/domain/checks';
import { analysePhoto, lightenBackground, shrinkForPortal } from '@/domain/photo';
import { approveSponsor, payAmount } from '@/portal/logic';
import { TODAY, addDays, daysBetween, fmtDate, formatBytes } from '@/lib/utils';
import { pageList } from '@/portal/logic';

const store = () => useStore.getState();
const fullName = (p: Profile) => `${p.given} ${p.surname}`.trim();
const titleCase = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());
const RISK_ORDER = { high: 0, medium: 1, low: 2 } as const;

/* ------------------------------------------------------------------ documents */

async function docsPhase(ctx: FlowCtx) {
  ctx.phase('docs', 'running', 'Reading your documents');
  const { answers, files, profile } = ctx.app();
  const slots = PRODUCTS[answers.visa].slots;
  const sample = store().sampleId !== null;
  await ctx.say(`Thanks. I have all ${slots.length} documents. I will read them, then check them against the UAE rules and against each other.`);

  const docs = await ctx.tool(
    'read_documents',
    { files: slots.length },
    () =>
      slots.map((slot) => {
        const f = files[slot] as FileRef;
        return { slot, label: SLOTS[slot].label, name: f.name, bytes: f.bytes, sample: f.sample, fields: sample ? docFields(slot, profile, answers) : [] };
      }),
    { ms: 1300, summary: (d) => (sample ? `${d.reduce((n, x) => n + x.fields.length, 0)} fields read` : `${d.length} files received`) },
  );
  await ctx.render(
    'DocsRead',
    {
      docs,
      note: sample
        ? 'Every value keeps a link back to the page it was read from.'
        : 'These are your own files. This demo build cannot read them yet, so you type the key details next and I check them.',
    },
    { gen: 700 },
  );
  await ctx.say(sample ? 'That is everything read. Please check the key details before I go any further.' : 'Please type the key details from your documents. It takes a minute.');

  const out = await ctx.ask<{ profile: Partial<Profile>; answers: Record<string, unknown> }>({
    id: 'confirm',
    phase: 'docs',
    title: 'Check your details',
    component: 'ConfirmDetails',
    props: { sample },
    summarise: () => 'You confirmed your details',
  });
  store().setProfile(out.profile);
  store().patch(() => ({ answers: { ...store().answers, ...(out.answers as object) } }));
  ctx.audit('you', 'Confirmed details', fullName(store().profile));

  const photo = store().files.photo;
  if (photo?.blob && photo.url) {
    const rep = store().photoReport ?? (await ctx.tool('check_photo', { file: photo.name }, () => analysePhoto(photo.blob as Blob), { ms: 900, summary: (r) => `${r.checks.filter((c) => !c.ok).length} problems` }));
    store().setPhotoReport(rep);
    ctx.setData((d) => ({ ...d, photo: rep }));
    await ctx.render('PhotoReport', { title: 'Your photo', before: { url: photo.url, report: rep } }, { gen: 500 });
  }
  ctx.phase('docs', 'done');
}

/* ------------------------------------------------------------------ checks */

const STOP: Record<string, string> = {
  passport: 'Paused. Renew your passport, then start again. Your documents are not stored in this demo, so upload them once more. Nothing was submitted.',
  window: 'Paused. Start again closer to your trip. Nothing was submitted.',
  insurance: 'Paused. Get a policy that covers the whole stay, then start again. Nothing was submitted.',
  name: 'Paused. Ask for a corrected document, then start again. Nothing was submitted.',
  salary: 'Paused. A sponsor who meets the salary rule is needed. Nothing was submitted.',
  eid: 'Paused. Your sponsor needs a valid Emirates ID first. Nothing was submitted.',
  tenancy: 'Paused. Upload the renewed tenancy contract, then start again. Nothing was submitted.',
};

async function handleIssue(ctx: FlowCtx, issue: Issue) {
  const out = await ctx.ask<{ option: string }>({
    id: `issue-${issue.id}`,
    phase: 'checks',
    title: issue.title,
    component: 'FixIssue',
    props: { issue },
    summarise: (o) => issue.options.find((x) => x.id === o.option)?.label ?? o.option,
  });
  const o = out.option;
  ctx.setData((d) => ({ ...d, resolutions: { ...d.resolutions, [issue.id]: o } }));
  ctx.audit('you', issue.title, issue.options.find((x) => x.id === o)?.label);

  if (issue.id === 'dates') {
    store().setAnswers({ arrival: o });
    await ctx.say(`Using ${fmtDate(o)} as your arrival date everywhere.`);
    return;
  }
  if (issue.id === 'stay') {
    if (o === 'extend') {
      store().setAnswers({ days: 60 });
      await ctx.say(`Switched you to the 60-day visa. The government fee is now AED ${PRODUCTS[store().answers.visa].fees[60]} plus VAT.`);
    } else {
      await ctx.say('Kept as it is. Remember that staying past the visa costs AED 50 a day.');
    }
    return;
  }
  if (issue.id === 'name' && o === 'passport') {
    await ctx.say('I will use the passport spelling everywhere I type your name.');
    return;
  }
  if (['renew', 'other', 'new', 'fix'].includes(o)) throw new FlowStop(STOP[issue.id] ?? 'Paused. Nothing was submitted.');
  await ctx.say('Understood. I will carry on, and I have noted your choice in the file.');
}

async function photoIssue(ctx: FlowCtx, first: Issue) {
  let issue = first;
  for (let round = 0; round < 4; round++) {
    const cur = store().files.photo as FileRef;
    const choice = await ctx.ask<{ option: 'fix' | 'new'; file?: FileRef }>({
      id: `photo-${round}`,
      phase: 'checks',
      title: issue.title,
      component: 'PhotoFix',
      props: { issue, beforeUrl: cur.url },
      summarise: (o) => (o.option === 'fix' ? 'Asked Rihla to fix it' : 'Uploaded a new photo'),
    });

    let newFile: FileRef | undefined = choice.option === 'new' ? choice.file : undefined;
    if (choice.option === 'fix' && cur.blob) {
      const fixed = await ctx.tool('lighten_background', { file: cur.name }, () => lightenBackground(cur.blob as Blob), { ms: 1600, summary: () => 'Background lightened' });
      const rep = await analysePhoto(fixed);
      const url = URL.createObjectURL(fixed);
      const review = await ctx.ask<{ option: 'accept' | 'new'; file?: FileRef }>({
        id: `photo-review-${round}`,
        phase: 'checks',
        title: 'Check the fixed photo',
        component: 'PhotoReview',
        props: { beforeUrl: cur.url, afterUrl: url, report: rep },
        summarise: (o) => (o.option === 'accept' ? 'You approved the fixed photo' : 'You chose to upload a new one'),
      });
      if (review.option === 'accept') {
        const ref: FileRef = { ...cur, blob: fixed, url, bytes: fixed.size, name: cur.name.replace(/\.\w+$/, '_fixed.jpg'), width: rep.width, height: rep.height };
        store().setFile('photo', ref);
        store().setPhotoReport(rep);
        ctx.setData((d) => ({ ...d, photo: rep }));
        await ctx.render('PhotoReport', { title: 'Photo, before and after', before: { url: cur.url, report: ctx.data().photo ?? rep }, after: { url, report: rep } }, { gen: 400 });
        await ctx.say('The photo is ready.');
        return;
      }
      newFile = review.file;
    }
    if (newFile?.blob) {
      store().setFile('photo', newFile);
      const rep = await analysePhoto(newFile.blob);
      store().setPhotoReport(rep);
      ctx.setData((d) => ({ ...d, photo: rep }));
      const again = runChecks({ answers: store().answers, profile: store().profile, photo: rep, hasTicket: false }).issues.find((i) => i.id === 'photo');
      if (!again) {
        await ctx.render('PhotoReport', { title: 'Your new photo', before: { url: newFile.url ?? '', report: rep } }, { gen: 400 });
        await ctx.say('That photo works.');
        return;
      }
      issue = again;
    }
  }
  throw new FlowStop('I could not get a usable photo after several tries. Take a new one on a plain light wall and start again. Nothing was submitted.');
}

async function checksPhase(ctx: FlowCtx) {
  ctx.phase('checks', 'running', 'Checking against UAE rules');
  await ctx.say('Now I check your answers against the UAE rules, and against each other.');
  const { answers, profile } = ctx.app();
  const photo = store().photoReport;
  const result = await ctx.tool(
    'run_checks',
    { rules: ['passport validity', 'photo', 'dates', 'stay length', 'insurance', 'names', ...(answers.visa === 'family' ? ['sponsor salary', 'sponsor documents'] : [])] },
    () => runChecks({ answers, profile, photo, hasTicket: true }),
    { ms: 1500, summary: (r) => `${r.issues.length} to decide · ${r.passes.length} passed` },
  );
  ctx.setData((d) => ({ ...d, issues: result.issues }));
  await ctx.render('ChecksReport', { passes: result.passes, issues: result.issues.map((i) => ({ title: i.title, risk: i.risk })) }, { gen: 600 });

  if (result.issues.length === 0) {
    await ctx.say('Nothing needs your attention. Everything agrees.');
  } else {
    await ctx.say(`${result.issues.length} thing${result.issues.length === 1 ? '' : 's'} need${result.issues.length === 1 ? 's' : ''} a decision from you. I will take them one at a time, and I will wait for you each time.`);
    const sorted = [...result.issues].sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk]);
    for (const issue of sorted) {
      if (issue.kind === 'photo') await photoIssue(ctx, issue);
      else await handleIssue(ctx, issue);
    }
  }
  ctx.phase('checks', 'done');
}

/* ------------------------------------------------------------------ portal */

type Entry = [aid: string, value: string, kind: 'text' | 'select'];

async function fillPage(ctx: FlowCtx, title: string, entries: Entry[], nextAid: string, expect: Record<string, string>) {
  const b = ctx.browser;
  b.narrate(`Filling in ${title.toLowerCase()}`);
  await ctx.tool(
    'fill_form',
    { page: title, fields: entries.length },
    async () => {
      for (const [aid, value, kind] of entries) {
        if (kind === 'select') await b.select(aid, value);
        else await b.type(aid, value);
        expect[aid] = value;
      }
      const from = store().portal.page;
      await b.click(nextAid);
      const list = pageList();
      await b.waitForPage(list[list.indexOf(from) + 1]);
      return entries.length;
    },
    { ms: 250, summary: (n) => `${n} fields filled` },
  );
}

async function portalPhase(ctx: FlowCtx) {
  ctx.phase('portal', 'running', 'Opening the portal');
  const b = ctx.browser;
  const { answers, profile, files } = ctx.app();
  const product = PRODUCTS[answers.visa];
  const expect: Record<string, string> = {};

  await ctx.say('Opening the sandbox portal on the right. You can watch every click, and you can take over whenever you like.');
  await ctx.tool('open_portal', { url: store().portal.url }, () => true, { ms: 700, summary: () => 'Portal loaded' });
  b.narrate('Starting a new application');
  await b.click('home:start');
  await b.waitForPage('register');

  // Account and one-time code
  b.narrate('Creating the application account');
  await ctx.tool(
    'fill_form',
    { page: 'Account', fields: 2 },
    async () => {
      await b.type('register:email', profile.email);
      await b.type('register:phone', profile.phone);
      expect['register:email'] = profile.email;
      await b.click('register:send');
      await b.waitForPage('verify');
      return 2;
    },
    { ms: 250, summary: () => 'Code requested' },
  );
  await ctx.say(`The portal just emailed a 6-digit code to ${profile.email}. Open your inbox, top right, and type it below. I cannot see your inbox.`);
  let verified = false;
  for (let attempt = 0; attempt < 3 && !verified; attempt++) {
    const out = await ctx.ask<{ code: string }>({
      id: `otp-${attempt}`,
      phase: 'portal',
      title: 'Enter the code from your email',
      component: 'EnterCode',
      props: { purpose: 'email', sentTo: profile.email, attempt },
      summarise: () => 'You entered the email code',
    });
    await b.type('verify:otp', out.code);
    await b.click('verify:submit');
    await ctx.wait(500);
    verified = store().portal.page !== 'verify';
    if (!verified) await ctx.say('The portal did not accept that code. Let us try again.');
  }
  if (!verified) throw new FlowStop('Too many wrong codes, so I stopped. Start again to get a new one. Nothing was submitted.');
  await ctx.say('Verified. Now the application itself.');

  // Forms
  await fillPage(
    ctx,
    'Personal details',
    [
      ['personal:given', profile.given, 'text'],
      ['personal:surname', profile.surname, 'text'],
      ['personal:dob', profile.dob, 'text'],
      ['personal:sex', profile.sex === 'F' ? 'Female' : 'Male', 'select'],
      ['personal:birthplace', profile.birthplace, 'text'],
      ['personal:nationality', byCode(answers.nationality)?.name ?? '', 'select'],
      ['personal:marital', profile.marital || 'Single', 'select'],
      ['personal:profession', profile.profession, 'text'],
    ],
    'personal:next',
    expect,
  );
  await fillPage(
    ctx,
    'Passport details',
    [
      ['passport:number', profile.passportNo, 'text'],
      ['passport:issued', profile.passportIssued, 'text'],
      ['passport:expires', profile.passportExpires, 'text'],
      ['passport:place', profile.passportPlace, 'text'],
    ],
    'passport:next',
    expect,
  );
  await fillPage(
    ctx,
    'Travel details',
    [
      ['travel:purpose', answers.visa === 'family' ? 'Visiting family or friends' : 'Tourism', 'select'],
      ['travel:arrival', answers.arrival, 'text'],
      ['travel:departure', answers.departure, 'text'],
      ['travel:emirate', answers.emirate, 'select'],
      ['travel:accommodation', answers.visa === 'family' ? (profile.sponsor?.address ?? '') : profile.hotelName, 'text'],
      ['travel:flight', profile.flightNo, 'text'],
    ],
    'travel:next',
    expect,
  );
  if (answers.visa === 'family' && profile.sponsor) {
    const sp = profile.sponsor;
    await fillPage(
      ctx,
      "Sponsor's details",
      [
        ['sponsor:name', sp.name, 'text'],
        ['sponsor:eid', sp.emiratesId, 'text'],
        ['sponsor:phone', sp.phone, 'text'],
        ['sponsor:relationship', titleCase(answers.relationship), 'select'],
        ['sponsor:salary', String(sp.salaryAED), 'text'],
      ],
      'sponsor:next',
      expect,
    );
  }
  await fillPage(
    ctx,
    'Contact details',
    [
      ['contact:phone', profile.phone, 'text'],
      ['contact:address', profile.address, 'text'],
    ],
    'contact:next',
    expect,
  );

  // Uploads
  b.narrate('Uploading your documents');
  await ctx.say('Now your documents. The portal has strict size limits, so I will tell you if I have to adjust anything.');
  for (const slot of product.slots) {
    const f = store().files[slot] as FileRef;
    let res = await ctx.tool('upload_file', { slot, file: f.name, size: formatBytes(f.bytes) }, () => b.upload(slot, f), {
      ms: 200,
      summary: (r) => (r?.status === 'ok' ? 'Accepted' : (r?.error ?? 'Rejected')),
    });
    if (res?.status === 'error' && slot === 'photo' && f.blob) {
      await ctx.say(`The portal rejected the photo. ${res.error} I will shrink it and send it again.`);
      const small = await ctx.tool('resize_photo', { maxKB: 600 }, () => shrinkForPortal(f.blob as Blob), { ms: 1100, summary: (bl) => `${formatBytes(f.bytes)} to ${formatBytes(bl.size)}` });
      const smallRep = await analysePhoto(small);
      res = await ctx.tool('upload_file', { slot, file: 'photo (resized)', size: formatBytes(small.size) }, () => b.upload(slot, { name: f.name.replace(/\.\w+$/, '_web.jpg'), bytes: small.size }), {
        ms: 200,
        summary: (r) => (r?.status === 'ok' ? 'Accepted' : (r?.error ?? 'Rejected')),
      });
      await ctx.render('PhotoReport', { title: 'Photo resized for the portal', before: { url: f.url ?? '', report: store().photoReport ?? smallRep }, after: { url: URL.createObjectURL(small), report: smallRep } }, { gen: 400 });
    }
    if (res?.status !== 'ok') throw new FlowStop(`The portal rejected your ${SLOTS[slot].label.toLowerCase()}: ${res?.error ?? 'unknown problem'} Fix the file and start again. Nothing was submitted.`);
  }
  await ctx.tool('continue', { page: 'Documents' }, async () => {
    await b.click('uploads:next');
    await b.waitForPage('declarations');
    return true;
  }, { ms: 200, summary: () => 'Documents accepted' });

  // Declarations: the applicant answers, never the agent
  await ctx.say('These are the declarations. They are your answers to give, so I will not touch them until you have answered.');
  const dec = await ctx.ask<{ answers: Record<string, 'yes' | 'no'> }>({
    id: 'declarations',
    phase: 'portal',
    title: 'Answer the declarations',
    component: 'Declarations',
    props: {},
    summarise: () => 'You answered the declarations',
  });
  b.narrate('Entering your declarations');
  for (const id of ['refused', 'overstay', 'criminal', 'work']) await b.radio(`decl:${id}`, dec.answers[id]);
  await b.click('declarations:next');
  await b.waitForPage('review');

  // Read the review page back and compare
  b.narrate('Reading the review page back');
  const diff = await ctx.tool(
    'verify_page',
    { page: 'Review' },
    () => {
      const portal = store().portal;
      const diffs = Object.entries(expect)
        .filter(([aid, v]) => (portal.fields[aid] ?? '') !== v)
        .map(([aid, v]) => ({ label: aid.split(':')[1], expected: v, actual: portal.fields[aid] ?? '' }));
      return { total: Object.keys(expect).length, matched: Object.keys(expect).length - diffs.length, diffs };
    },
    { ms: 900, summary: (d) => `${d.matched} of ${d.total} match` },
  );
  await ctx.render('FieldsDiff', diff, { gen: 500 });
  ctx.phase('portal', 'done');
}

/* ------------------------------------------------------------------ sign-off and payment */

async function signoffPhase(ctx: FlowCtx) {
  ctx.phase('signoff', 'running');
  const b = ctx.browser;
  const { answers, profile } = ctx.app();
  await ctx.say('Everything in the portal matches what you gave me. Before I submit, I need your sign-off.');
  const out = await ctx.ask<{ signature: string }>({
    id: 'signoff',
    phase: 'signoff',
    title: 'Approve and sign',
    component: 'SignOff',
    props: { name: fullName(profile) },
    summarise: (o) => `You signed as ${o.signature}`,
  });
  b.narrate('Adding your signature');
  await b.type('review:signature', out.signature);
  await b.click('review:confirm');
  await b.click('review:next');
  if (answers.visa === 'family' && profile.sponsor) {
    await b.waitForPage('sponsor_wait');
    await ctx.say(`${profile.sponsor.name.split(' ')[0]} has to approve this in the UAE Pass app. I cannot do that for them.`);
    await ctx.ask<{ approved: true }>({
      id: 'sponsor',
      phase: 'signoff',
      title: `Wait for ${profile.sponsor.name.split(' ')[0]} to approve`,
      component: 'SponsorApproval',
      props: { sponsor: profile.sponsor.name, phone: profile.sponsor.phone, visitor: profile.given.split(' ')[0] },
      summarise: () => 'Your sponsor approved',
    });
    approveSponsor();
    await b.click('sponsor_wait:continue');
  }
  await b.waitForPage('payment');
  ctx.phase('signoff', 'done');
}

async function paymentPhase(ctx: FlowCtx) {
  ctx.phase('payment', 'running');
  const b = ctx.browser;
  const amount = payAmount();
  await ctx.say(`Payment is next: AED ${amount.toFixed(2)}, paid to the government. This part is yours. I never see or store your card details.`);
  b.handOver({ highlight: 'payment:card', note: 'Your turn: pay in the portal' });
  await ctx.ask<{ done: true }>({
    id: 'pay',
    phase: 'payment',
    title: 'Pay in the portal',
    component: 'PayHandover',
    props: { amount },
    summarise: () => 'You paid the fee',
    until: (s) => (s.portal.page === 'done' ? { done: true as const } : null),
  });
  b.takeBack();
  const ref = store().portal.reference;
  await ctx.say(`Payment received. The portal issued reference ${ref}.`);
  ctx.phase('payment', 'done');
}

/* ------------------------------------------------------------------ visa */

async function visaPhase(ctx: FlowCtx) {
  ctx.phase('visa', 'running', 'Waiting for the decision');
  const b = ctx.browser;
  const { answers, profile } = ctx.app();
  const ref = store().portal.reference as string;
  await b.click('done:status');
  await b.waitForPage('status');
  b.narrate('Watching the application status');
  await ctx.say('Your application is in. I will keep watching the status page and tell you the moment it changes.');
  const steps = (stage: 0 | 1 | 2) => [
    { label: 'Submitted', detail: `Reference ${ref}`, status: 'done' as const, at: 'Day 0' },
    { label: 'Under review', detail: 'Listed at up to 48 hours', status: stage === 0 ? ('active' as const) : ('done' as const), at: stage > 0 ? 'Day 1' : undefined },
    { label: 'Decision', detail: stage === 2 ? 'Approved' : 'Waiting', status: stage === 2 ? ('done' as const) : stage === 1 ? ('active' as const) : ('pending' as const), at: stage === 2 ? 'Day 2' : undefined },
  ];
  const id = await ctx.render('StatusTimeline', { steps: steps(0), reference: ref, clock: 'Simulated clock. Two days pass in a few seconds.' }, { gen: 500 });
  await ctx.wait(2200);
  store().patchPortal({ status: 'under_review' });
  ctx.patchItem(id, { steps: steps(1) });
  await ctx.wait(2400);
  store().patchPortal({ status: 'approved' });
  store().addInbox({ from: 'Entry Permit Sandbox', subject: 'Your entry permit is approved', body: `Application ${ref} was approved. The permit is attached. This is a sandbox message.` });
  ctx.patchItem(id, { steps: steps(2) });
  await ctx.say('Approved. Downloading the permit.');
  await b.click('status:download');

  const issued = addDays(TODAY, 2);
  const permit = {
    number: `ENT-26-${ref.slice(-6)}`,
    holder: fullName(profile),
    passportNo: profile.passportNo,
    type: answers.visa === 'family' ? 'Family and friends visit' : 'Tourist visa',
    days: answers.days,
    enterBy: addDays(issued, 60),
    emirate: answers.emirate,
  };
  ctx.setData((d) => ({ ...d, permit }));
  await ctx.tool('download_permit', { file: 'entry-permit.pdf' }, () => true, { ms: 600, summary: () => 'Saved' });
  await ctx.render('PermitReady', { permit, name: fullName(profile) }, { gen: 700 });
  const stay = daysBetween(answers.arrival, answers.departure);
  await ctx.render(
    'Checklist',
    {
      title: 'Before you fly',
      items: [
        { label: 'Carry a printed or saved copy of the permit', note: 'Airlines and border officers may ask for it' },
        { label: `Enter the UAE by ${fmtDate(permit.enterBy)}`, note: 'The visa must be used within 60 days of issue' },
        { label: `Leave within ${answers.days} days of arriving`, note: `You plan ${stay} days. Overstaying costs AED 50 a day, with no grace period since April 2026` },
        { label: 'Keep your insurance certificate with you', note: `${store().profile.insurer || 'Your insurer'}, valid to ${fmtDate(profile.insuranceTo || answers.departure)}` },
      ],
    },
    { gen: 400 },
  );
  b.narrate(null);
  await ctx.say('You are done. I emailed the permit to you as well. Have a good trip.');
  ctx.phase('visa', 'done');
}

export async function runFlow(ctx: FlowCtx) {
  await docsPhase(ctx);
  await checksPhase(ctx);
  await portalPhase(ctx);
  await signoffPhase(ctx);
  await paymentPhase(ctx);
  await visaPhase(ctx);
}
