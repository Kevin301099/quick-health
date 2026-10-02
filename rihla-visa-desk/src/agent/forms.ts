import type { Applicant, CaseData, Corridor, DocSpec, FormDraftData, FormField, FormSection, Trip } from './types';
import { passportDate } from './fixtures/docs';
import { fmtDate } from '@/lib/utils';

function field(key: string, label: string, value: string, source: string, confidence?: number, extra?: Partial<FormField>): FormField {
  return { key, label, value, source, by: 'agent', confidence, ...extra };
}

function docField(docs: DocSpec[], docId: string, key: string) {
  return docs.find((d) => d.id === docId)?.fields.find((f) => f.key === key);
}

function titleCase(s: string) {
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function buildForm(
  corridor: Corridor,
  applicants: Applicant[],
  docs: DocSpec[],
  trip: Trip,
  resolutions: CaseData['resolutions'],
): FormDraftData {
  const travellers = applicants.map((a) => {
    const nameChoice = resolutions[`name-${a.id}`]?.option;
    const surname = nameChoice === 'eid' ? a.eidEnglishName.split(' ').slice(-2).join(' ').toUpperCase() : a.surname;
    const pob = docField(docs, `passport-${a.id}`, 'pob');
    const pobConf = pob && pob.confidence < 0.8 ? 0.99 : pob?.confidence;
    const passport = docs.find((d) => d.id === `passport-${a.id}`);

    const personal: FormSection = {
      id: 'personal',
      title: 'Personal details',
      fields: [
        field('surname', 'Surname', surname, nameChoice === 'eid' ? 'Emirates ID' : 'Passport · MRZ', 0.99),
        field('given', 'Given names', a.given, 'Passport · MRZ', 0.99),
        field('dob', 'Date of birth', passportDate(a.dob), 'Passport · MRZ', 0.98),
        field('sex', 'Sex', a.sex === 'M' ? 'Male' : 'Female', 'Passport', 0.99),
        field('pob', 'Place of birth', a.birthplace, pob && pob.confidence < 0.8 ? 'Passport · re-read' : 'Passport', pobConf),
        field('nationality', 'Nationality', 'United Arab Emirates', 'Passport', 0.99),
      ],
    };
    const passportSec: FormSection = {
      id: 'passport',
      title: 'Passport',
      fields: [
        field('pno', 'Passport number', a.passportNo, 'Passport · MRZ', 0.99),
        field('issued', 'Issue date', passportDate(a.passportIssued), 'Passport', 0.98),
        field('expires', 'Expiry date', passportDate(a.passportExpires), 'Passport · MRZ', 0.99),
        field('issuer', 'Issuing country', 'United Arab Emirates', 'Passport', 0.99),
      ],
    };
    const contact: FormSection = {
      id: 'contact',
      title: 'Contact',
      fields: [
        field('email', 'Email', a.email, 'Client message', 0.95),
        field('phone', 'Mobile', a.phone, 'Client message', 0.95),
      ],
    };
    const work: FormSection = {
      id: 'work',
      title: 'Work',
      fields: [
        field('occ', 'Occupation', a.occupation, 'Emirates ID · letter', 0.93),
        field('emp', 'Employer', a.employer, 'Employment letter', 0.93),
      ],
    };
    const photo: FormSection = {
      id: 'photo',
      title: 'Photo',
      fields: [
        field('photo', 'Facial photo', 'Accepted · 900 × 900 px', 'Photo check', 0.96),
        ...(corridor.id === 'uk-eta'
          ? [field('selfie', 'Live selfie in the app', 'Taken by the applicant', 'Applicant only', undefined, { by: 'applicant', locked: true })]
          : []),
      ],
    };

    const sections: FormSection[] = [personal, passportSec, contact, work];

    if (corridor.id === 'uk-eta') {
      sections.push(photo);
      sections.push({
        id: 'declarations',
        title: 'Eligibility declarations',
        applicantOnly: true,
        fields: [field('decl', 'Criminal and immigration history', 'Answered by the applicant', 'Applicant only', undefined, { by: 'applicant', locked: true })],
      });
    } else if (corridor.id === 'ca-eta') {
      sections.push({
        id: 'background',
        title: 'Background questions',
        applicantOnly: true,
        fields: [field('bg', 'Eligibility and background', 'Answered by the applicant', 'Applicant only', undefined, { by: 'applicant', locked: true })],
      });
    } else if (corridor.id === 'us-b1b2') {
      const funds = docs.find((d) => d.kind === 'bank_statement');
      const hotelOut = docs.find((d) => d.kind === 'itinerary')?.fields.find((f) => f.key === 'checkout')?.value;
      const dateChoice = resolutions['dates']?.option;
      const stayEnd = dateChoice === 'hotel' && hotelOut ? hotelOut : fmtDate(trip.to);
      sections.splice(2, 0, {
        id: 'travel',
        title: 'Travel',
        fields: [
          field('purpose', 'Purpose of trip', 'B1/B2 · Tourism', 'Client message', 0.95),
          field('arrive', 'Intended arrival', fmtDate(trip.from), 'Itinerary', 0.98),
          field('leave', 'Intended departure', stayEnd, dateChoice ? `Itinerary · ${dateChoice === 'hotel' ? 'hotel' : 'flight'} dates` : 'Itinerary', 0.97),
          field('city', 'City', trip.city, 'Itinerary', 0.99),
          field('payer', 'Who pays for the trip', 'Self', 'Intake', 0.9),
        ],
      });
      sections.push({
        id: 'funds',
        title: 'Funds',
        fields: [field('bal', 'Closing balance', funds?.fields.find((f) => f.key === 'closing')?.value ?? '', 'Bank statement', 0.98)],
      });
      sections.push(photo);
      sections.push({
        id: 'security',
        title: 'Security and prior travel',
        applicantOnly: true,
        fields: [
          field('sec', 'Security questions', 'Answered by the applicant', 'Applicant only', undefined, { by: 'applicant', locked: true }),
          field('sign', 'Electronic signature', 'Signed by the applicant', 'Applicant only', undefined, { by: 'applicant', locked: true }),
        ],
      });
    } else {
      sections.splice(3, 0, {
        id: 'plans',
        title: 'Travel plans',
        fields: [
          field('first', 'First country of entry', 'France', 'Itinerary', 0.97),
          field('from', 'Arrival', fmtDate(trip.from), 'Client message', 0.95),
          field('to', 'Departure', fmtDate(trip.to), 'Client message', 0.95),
        ],
      });
      sections.push({
        id: 'security',
        title: 'Security and health questions',
        applicantOnly: true,
        fields: [field('sec', 'Security questions', 'Answered by the applicant', 'Applicant only', undefined, { by: 'applicant', locked: true })],
      });
    }

    void passport;
    return { id: a.id, name: titleCase(`${a.given} ${a.surname}`), sections };
  });

  return { portal: corridor.portal, travellers };
}

export function formProgress(form: FormDraftData) {
  let agent = 0;
  let applicant = 0;
  let human = 0;
  for (const t of form.travellers) {
    for (const s of t.sections) {
      for (const f of s.fields) {
        if (f.by === 'agent') agent += 1;
        else if (f.by === 'applicant') applicant += 1;
        else human += 1;
      }
    }
  }
  return { agent, applicant, human, total: agent + applicant + human };
}
