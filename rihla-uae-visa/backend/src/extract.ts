import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { Config } from './config';
import { parseMrz } from './mrz';

/*
  Reads a passport photo page. One model call per unique file (results are cached by the file's hash),
  then the machine-readable zone's check digits decide whether the reading can be trusted.
  A reading that fails the checks is never used silently: the person confirms the fields themselves.
*/

const PassportReading = z.object({
  is_passport_photo_page: z.boolean(),
  legibility: z.enum(['clear', 'partly_unclear', 'unreadable']),
  surname: z.string(),
  given_names: z.string(),
  passport_number: z.string(),
  nationality_code: z.string(),
  issuing_country_code: z.string(),
  date_of_birth: z.string(),
  sex: z.enum(['M', 'F', 'X', '']),
  date_of_issue: z.string(),
  date_of_expiry: z.string(),
  place_of_birth: z.string(),
  mrz_line_1: z.string(),
  mrz_line_2: z.string(),
});
type Reading = z.infer<typeof PassportReading>;

export interface PassportFields {
  given: string;
  surname: string;
  passportNo: string;
  nationality: string;
  dob: string;
  sex: 'M' | 'F' | '';
  passportIssued: string;
  passportExpires: string;
  birthplace: string;
}

export interface Extraction {
  status: 'ok' | 'check' | 'not_passport' | 'unreadable' | 'unavailable' | 'failed';
  /** True when the MRZ check digits all pass. */
  verified: boolean;
  fields: Partial<PassportFields>;
  /** Fields the person should look at before continuing. */
  attention: string[];
  note: string;
  model?: string;
}

export interface Extractor {
  passport(file: Uint8Array, mime: string): Promise<Extraction>;
}

const INSTRUCTIONS = `Read the passport photo page in this file and fill in the schema.

Rules:
- Copy values exactly as printed. Do not guess or complete partly hidden characters; leave a field empty when you cannot read it.
- Dates as YYYY-MM-DD. Country codes as the three-letter ICAO codes printed on the page.
- Copy the two machine-readable lines at the bottom character for character, including every '<'. Each line has 44 characters.
- If the file is not a passport photo page, set is_passport_photo_page to false and leave the other fields empty.`;

export function createExtractor(c: Config): Extractor {
  if (!c.ANTHROPIC_API_KEY) {
    return {
      async passport() {
        return { status: 'unavailable', verified: false, fields: {}, attention: [], note: 'Automatic reading is off. Please type your passport details.' };
      },
    };
  }
  const client = new Anthropic({ apiKey: c.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 90_000 });
  return {
    async passport(file, mime) {
      const data = Buffer.from(file).toString('base64');
      const source =
        mime === 'application/pdf'
          ? ({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } } as const)
          : ({ type: 'image', source: { type: 'base64', media_type: mime as 'image/jpeg' | 'image/png' | 'image/webp', data } } as const);
      try {
        const res = await client.beta.messages.parse({
          model: c.EXTRACT_MODEL,
          max_tokens: 8000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: c.EXTRACT_EFFORT, format: betaZodOutputFormat(PassportReading) },
          messages: [{ role: 'user', content: [source, { type: 'text', text: INSTRUCTIONS }] }],
        });
        if (res.stop_reason === 'refusal' || !res.parsed_output) {
          return { status: 'failed', verified: false, fields: {}, attention: [], note: 'We could not read this file automatically. Please type your details.', model: res.model };
        }
        return { ...interpret(res.parsed_output), model: res.model };
      } catch (e) {
        const msg = e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : String(e);
        console.error('[extract] passport reading failed:', msg);
        return { status: 'failed', verified: false, fields: {}, attention: [], note: 'Automatic reading is busy right now. Please type your details.' };
      }
    },
  };
}

/** Turns a raw reading into fields we can use, trusting the MRZ only when its check digits pass. */
export function interpret(r: Reading, today = new Date().toISOString().slice(0, 10)): Extraction {
  if (!r.is_passport_photo_page) return { status: 'not_passport', verified: false, fields: {}, attention: [], note: 'This does not look like a passport photo page.' };
  if (r.legibility === 'unreadable') return { status: 'unreadable', verified: false, fields: {}, attention: [], note: 'The photo is too blurry or dark to read. A sharper photo of the page works best.' };

  const visual: Partial<PassportFields> = {
    given: r.given_names.toUpperCase(),
    surname: r.surname.toUpperCase(),
    passportNo: r.passport_number.toUpperCase().replace(/\s/g, ''),
    nationality: r.nationality_code.toUpperCase(),
    dob: r.date_of_birth,
    sex: r.sex === 'M' || r.sex === 'F' ? r.sex : '',
    passportIssued: r.date_of_issue,
    passportExpires: r.date_of_expiry,
    birthplace: r.place_of_birth.toUpperCase(),
  };
  const mrz = parseMrz(r.mrz_line_1, r.mrz_line_2, today);
  if (!mrz) {
    return { status: 'check', verified: false, fields: visual, attention: ['given', 'surname', 'passportNo', 'dob', 'passportExpires'], note: 'We read the page but not the code lines at the bottom. Please check every field.' };
  }
  if (!mrz.valid) {
    const map: Record<string, keyof PassportFields> = { 'passport number': 'passportNo', 'date of birth': 'dob', 'expiry date': 'passportExpires' };
    const attention = mrz.failed.map((f) => map[f]).filter(Boolean) as string[];
    return { status: 'check', verified: false, fields: visual, attention: attention.length ? attention : ['passportNo', 'dob', 'passportExpires'], note: 'Some characters were hard to read. Please check the highlighted fields.' };
  }
  // The MRZ is proven correct, so it wins for the fields it carries. Names keep the printed spelling,
  // which can include characters the MRZ cannot (it transliterates).
  const fields: Partial<PassportFields> = {
    ...visual,
    passportNo: mrz.passportNumber,
    nationality: mrz.nationality,
    dob: mrz.dateOfBirth,
    sex: mrz.sex,
    passportExpires: mrz.dateOfExpiry,
    surname: visual.surname || mrz.surname,
    given: visual.given || mrz.givenNames,
  };
  const attention: string[] = [];
  const squash = (s = '') => s.replace(/[^A-Z]/g, '');
  if (squash(visual.surname) !== squash(mrz.surname) || squash(visual.given) !== squash(mrz.givenNames)) attention.push('given', 'surname');
  if (!visual.passportIssued) attention.push('passportIssued');
  return {
    status: attention.length ? 'check' : 'ok',
    verified: true,
    fields,
    attention,
    note: attention.length ? 'We read your passport. Please check the highlighted fields.' : 'We read your passport and the code lines check out.',
  };
}
