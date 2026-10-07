import type Anthropic from '@anthropic-ai/sdk';
import type { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { Config } from './config';
import { parseMrz } from './mrz';

/*
  Reads a passport photo page. One model call per unique file (results are cached by the file's hash),
  then the machine-readable zone's check digits decide whether the reading can be trusted.
  A reading that fails the checks is never used silently: the person confirms the fields themselves.

  Cost: every billed call is returned with its token counts and price so the caller can record it,
  enforce budgets and show spend. With EXTRACT_FAST_MODEL set, a cheaper model reads first and its
  answer is kept only when the check digits prove it; anything else goes to EXTRACT_MODEL.
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

/** One billed model call. */
export interface AiCall {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  outcome: Extraction['status'];
}

export interface Extractor {
  /** `calls` lists every billed model call made for this file (empty when nothing was billed). */
  passport(file: Uint8Array, mime: string): Promise<{ extraction: Extraction; calls: AiCall[] }>;
}

/** US$ per million tokens, [input, output]. Unknown models are priced as the most expensive, so budgets err safe. */
const PRICES: [model: string, input: number, output: number][] = [
  ['claude-opus-5-5', 4, 20],
  ['claude-sonnet-5-5', 2, 10],
  ['claude-haiku-5-5', 0.1, 0.5],
  ['claude-haiku-4-5', 1, 5],
];

export function priceOf(model: string, u: { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null }) {
  const row = PRICES.find(([m]) => model.startsWith(m)) ?? PRICES.reduce((a, b) => (b[2] > a[2] ? b : a));
  const [, inp, out] = row;
  const input = u.input_tokens + (u.cache_creation_input_tokens ?? 0) * 1.25 + (u.cache_read_input_tokens ?? 0) * 0.1;
  return Math.round(((input * inp + u.output_tokens * out) / 1e6) * 1e6) / 1e6;
}

const INSTRUCTIONS = `Read the passport photo page in this file and fill in the schema.

Rules:
- Copy values exactly as printed. Do not guess or complete partly hidden characters; leave a field empty when you cannot read it.
- Dates as YYYY-MM-DD. Country codes as the three-letter ICAO codes printed on the page.
- Copy the two machine-readable lines at the bottom character for character, including every '<'. Each line has 44 characters.
- If the file is not a passport photo page, set is_passport_photo_page to false and leave the other fields empty.`;

export const unavailable = (note = 'Automatic reading is off. Please type your passport details.'): Extraction => ({ status: 'unavailable', verified: false, fields: {}, attention: [], note });

export function createExtractor(c: Config): Extractor {
  if (!c.ANTHROPIC_API_KEY) return { passport: async () => ({ extraction: unavailable(), calls: [] }) };

  // The SDK loads on the first passport, so cold starts for every other request stay small.
  type Sdk = { client: Anthropic; APIError: typeof Anthropic.APIError; format: ReturnType<typeof betaZodOutputFormat<typeof PassportReading>> };
  let loading: Promise<Sdk> | null = null;
  const sdk = () =>
    (loading ??= Promise.all([import('@anthropic-ai/sdk'), import('@anthropic-ai/sdk/helpers/beta/zod')]).then(([a, h]) => ({
      client: new a.default({ apiKey: c.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 45_000 }),
      APIError: a.APIError,
      format: h.betaZodOutputFormat(PassportReading),
    })));

  const busy: Extraction = { status: 'failed', verified: false, fields: {}, attention: [], note: 'Automatic reading is busy right now. Please type your details.' };

  async function readWith(model: string, file: Uint8Array, mime: string): Promise<{ extraction: Extraction; call: AiCall | null }> {
    const { client, APIError, format } = await sdk();
    const data = Buffer.from(file).toString('base64');
    const source =
      mime === 'application/pdf'
        ? ({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } } as const)
        : ({ type: 'image', source: { type: 'base64', media_type: mime as 'image/jpeg' | 'image/png' | 'image/webp', data } } as const);
    try {
      const res = await client.beta.messages.parse({
        model,
        max_tokens: 8000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: c.EXTRACT_EFFORT, format },
        messages: [{ role: 'user', content: [source, { type: 'text', text: INSTRUCTIONS }] }],
      });
      const extraction: Extraction =
        res.stop_reason === 'refusal' || !res.parsed_output
          ? { status: 'failed', verified: false, fields: {}, attention: [], note: 'We could not read this file automatically. Please type your details.', model: res.model }
          : { ...interpret(res.parsed_output), model: res.model };
      const call: AiCall = { model: res.model, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens, costUsd: priceOf(res.model, res.usage), outcome: extraction.status };
      return { extraction, call };
    } catch (e) {
      const msg = e instanceof APIError ? `${e.status} ${e.message}` : String(e);
      console.error(`[extract] ${model} could not read the passport:`, msg);
      return { extraction: busy, call: null };
    }
  }

  return {
    async passport(file, mime) {
      const models = c.EXTRACT_FAST_MODEL && c.EXTRACT_FAST_MODEL !== c.EXTRACT_MODEL ? [c.EXTRACT_FAST_MODEL, c.EXTRACT_MODEL] : [c.EXTRACT_MODEL];
      const calls: AiCall[] = [];
      let extraction = busy;
      for (const model of models) {
        const r = await readWith(model, file, mime);
        if (r.call) calls.push(r.call);
        extraction = r.extraction;
        // A first pass is kept only when the passport's own check digits prove it right.
        if (extraction.verified) break;
      }
      return { extraction, calls };
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
