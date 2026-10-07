/*
  Recognising form fields on websites we have never seen.

  Official visa forms differ between sites and change without notice, so nothing here depends on a site's
  layout. Each field is described by what a person would read next to it (its label, placeholder, name, the
  text just before it), in English and Arabic, and matched against a small vocabulary of passport and trip
  fields. Anything that is the traveller's alone (logins, one-time codes, captchas, card details, declarations)
  is recognised too, so it is never touched.
*/

export type Key =
  | 'given'
  | 'middle'
  | 'surname'
  | 'fullName'
  | 'passportNo'
  | 'passportType'
  | 'nationality'
  | 'issuingCountry'
  | 'dob'
  | 'birthplace'
  | 'sex'
  | 'passportIssued'
  | 'passportExpires'
  | 'email'
  | 'phone'
  | 'profession'
  | 'address'
  | 'arrival'
  | 'departure'
  | 'file:passport'
  | 'file:photo'
  | 'file:ticket'
  | 'file:hotel'
  | 'file:insurance'
  | 'file:bank';

export const LABELS: Record<Key, string> = {
  given: 'First name',
  middle: 'Middle name',
  surname: 'Last name',
  fullName: 'Full name',
  passportNo: 'Passport number',
  passportType: 'Passport type',
  nationality: 'Nationality',
  issuingCountry: 'Issuing country',
  dob: 'Date of birth',
  birthplace: 'Place of birth',
  sex: 'Sex',
  passportIssued: 'Passport issue date',
  passportExpires: 'Passport expiry date',
  email: 'Email',
  phone: 'Mobile number',
  profession: 'Profession',
  address: 'Home address',
  arrival: 'Arrival date',
  departure: 'Departure date',
  'file:passport': 'Passport copy',
  'file:photo': 'Photo',
  'file:ticket': 'Return ticket',
  'file:hotel': 'Hotel booking',
  'file:insurance': 'Health insurance',
  'file:bank': 'Bank statements',
};

export const DATE_KEYS = new Set<Key>(['dob', 'passportIssued', 'passportExpires', 'arrival', 'departure']);

interface Rule {
  key: Key;
  kinds: ('text' | 'date' | 'select' | 'radio' | 'file')[];
  any: RegExp[];
  not?: RegExp[];
}

/* Normalised text is lower case with punctuation turned into spaces. Order matters: specific before general. */
const PEOPLE_NOT_TRAVELLER = /\b(father|mother|spouse|husband|wife|sponsor|guardian|employer|company|hotel|emergency|contact person|host|inviter|beneficiary|card ?holder|account)\b|الأب|الام|الأم|الزوج|الكفيل|الشركة/;
const ARABIC_SCRIPT_FIELD = /\barabic\b|بالعربي|عربي| (ar|arb)$/;

const RULES: Rule[] = [
  { key: 'file:photo', kinds: ['file'], any: [/\b(personal|recent|colou?r|passport[ -]size|applicant('s)?) (photo|photograph|picture)\b/, /\bphoto(graph)?\b/, /\bpicture\b/, /صورة شخصية|الصورة الشخصية|صورة/], not: [/passport (copy|page|first|bio|data|scan)|photo page|data page|copy of (the )?passport|نسخة/] },
  { key: 'file:passport', kinds: ['file'], any: [/\bpassport\b/, /travel document/, /جواز/] },
  { key: 'file:ticket', kinds: ['file'], any: [/\b(ticket|flight|itinerary|e ?ticket)\b/, /تذكرة|التذكرة/] },
  { key: 'file:hotel', kinds: ['file'], any: [/\b(hotel|accommodation)\b/, /فندق|الفندق|السكن/] },
  { key: 'file:insurance', kinds: ['file'], any: [/\binsurance\b/, /تأمين|التأمين/] },
  { key: 'file:bank', kinds: ['file'], any: [/\bbank\b/, /\b(account )?statements?\b/, /\bfinancial\b/, /كشف حساب|بنك|البنك/] },

  { key: 'passportExpires', kinds: ['text', 'date', 'select'], any: [/\b(passport|document|travel document)\b.*\b(expir\w*|valid (until|till|to)|validity)\b/, /\bexpir(y|ation|es|ing)? ?(date|on)?\b/, /\bdate of expiry\b/, /\bvalid (until|till|to)\b/, /انتهاء|تاريخ الانتهاء/], not: [/\b(visa|card|insurance|policy|license|licence)\b/] },
  { key: 'passportIssued', kinds: ['text', 'date', 'select'], any: [/\b(issue|issuance|issuing) date\b/, /\bdate of (issue|issuance)\b/, /\bissued (on|date)\b/, /تاريخ (ال)?[اإ]صدار/], not: [/\b(place|country|authority|by|visa|card|insurance)\b/] },
  { key: 'issuingCountry', kinds: ['text', 'select'], any: [/\b(issuing|issue) (country|state|authority)\b/, /\bcountry of issue\b/, /\bissued by\b/, /\bplace of issue\b/, /جهة الإصدار|جهة الاصدار|بلد الإصدار|مكان الإصدار|مكان الاصدار/] },
  { key: 'passportType', kinds: ['select', 'radio', 'text'], any: [/\b(passport|document|travel document) type\b/, /\btype of (passport|document|travel document)\b/, /نوع (الجواز|جواز السفر|الوثيقة)/] },
  { key: 'passportNo', kinds: ['text'], any: [/\bpassport (no|number|num|nbr|#)\b/, /\bpassport ?no\b/, /^passport$/, /\b(travel )?document (no|number)\b/, /رقم (جواز السفر|الجواز|الوثيقة)/], not: [/\b(type|date|place|country|issu\w*|expir\w*|copy|upload|scan|file|photo)\b/] },

  { key: 'dob', kinds: ['text', 'date', 'select'], any: [/\bdate of birth\b/, /\bbirth ?date\b/, /\bdob\b/, /\bborn on\b/, /تاريخ الميلاد/], not: [/\b(place|country|city|town)\b/] },
  { key: 'birthplace', kinds: ['text'], any: [/\bplace of birth\b/, /\bbirth ?place\b/, /\b(city|town) of birth\b/, /مكان الميلاد|محل الميلاد/], not: [/\bcountry\b/] },
  { key: 'arrival', kinds: ['text', 'date', 'select'], any: [/\b(expected |planned )?(date of )?arrival( date)?\b/, /\bdate of entry\b/, /\bentry date\b/, /\btravel date\b/, /\barriving on\b/, /تاريخ الوصول|تاريخ الدخول/], not: [/\b(flight|time|port|airport|city)\b/] },
  { key: 'departure', kinds: ['text', 'date', 'select'], any: [/\b(date of )?(departure|return|exit)( date)?\b/, /\bleaving (on|date)\b/, /تاريخ المغادرة|تاريخ العودة|تاريخ الخروج/], not: [/\b(flight|time|port|airport|city|ticket)\b/] },

  { key: 'nationality', kinds: ['select', 'text'], any: [/\b(current |present )?nationality\b/, /\bcitizenship\b/, /\bcitizen of\b/, /الجنسية/], not: [/\b(previous|former|prev|other|second|dual|birth)\b/, /السابقة/, PEOPLE_NOT_TRAVELLER] },
  { key: 'sex', kinds: ['select', 'radio', 'text'], any: [/^(gender|sex)$/, /\bgender\b/, /\bsex\b/, /الجنس/] },

  { key: 'middle', kinds: ['text'], any: [/\bmiddle name\b/, /الاسم الأوسط|الاسم الاوسط/], not: [PEOPLE_NOT_TRAVELLER, ARABIC_SCRIPT_FIELD] },
  { key: 'given', kinds: ['text'], any: [/\bfirst name\b/, /\bgiven names?\b/, /\bfore ?names?\b/, /الاسم الأول|الاسم الاول/], not: [PEOPLE_NOT_TRAVELLER, ARABIC_SCRIPT_FIELD] },
  { key: 'surname', kinds: ['text'], any: [/\blast name\b/, /\bsur ?name\b/, /\bfamily name\b/, /اسم العائلة|اللقب/], not: [PEOPLE_NOT_TRAVELLER, ARABIC_SCRIPT_FIELD] },
  { key: 'fullName', kinds: ['text'], any: [/\bfull name\b/, /\bname (as )?(in|per|on) (your )?passport\b/, /\b(applicant|traveller|traveler|passenger)('?s)? name\b/, /^name$/, /\bname in english\b/, /\benglish name\b/, /الاسم الكامل|الاسم بالكامل/], not: [PEOPLE_NOT_TRAVELLER, ARABIC_SCRIPT_FIELD, /\b(first|last|middle|given|family|user ?name|login|bank)\b/] },

  { key: 'email', kinds: ['text'], any: [/\be ?mail\b/, /البريد الإلكتروني|البريد الالكتروني/], not: [PEOPLE_NOT_TRAVELLER] },
  { key: 'phone', kinds: ['text'], any: [/\b(mobile|cell|phone|telephone|whatsapp)\b/, /\btel\b/, /\bcontact (no|number)\b/, /الهاتف|الجوال|المتحرك|رقم الهاتف/], not: [PEOPLE_NOT_TRAVELLER, /\b(country )?code\b/, /\b(ext|extension|landline|office|work|fax)\b/] },
  { key: 'profession', kinds: ['text', 'select'], any: [/\b(profession|occupation|designation)\b/, /\bjob( title)?\b/, /المهنة|الوظيفة/], not: [PEOPLE_NOT_TRAVELLER] },
  { key: 'address', kinds: ['text'], any: [/\b(home|residential|permanent|residence|current) address\b/, /^address( line 1| 1)?$/, /\baddress (outside|abroad|in (your )?home country)\b/, /\bstreet address\b/, /العنوان/], not: [PEOPLE_NOT_TRAVELLER, /\b(e ?mail|local|line 2|city|zip|postal|post code|state|province|web|ip)\b/, /\b(in|inside) (the )?uae\b|\buae address\b/, /البريد|داخل الدولة/] },
];

/** Fields that belong to the traveller alone, never touched however they are labelled. */
export const TRAVELLER_ONLY =
  /\b(password|passcode|pass code|otp|one time|verification code|security code|captcha|cvv|cvc|card (no|number)|cardholder|card holder|name on card|expiry month|expiry year|iban|pin|username|user name|login)\b|كلمة المرور|رمز التحقق|الرمز|بطاقة/;
export const PAYMENT_CONTEXT = /\b(card|payment|billing|cvv|cvc)\b|الدفع|بطاقة/;

/** Field names and ids often carry framework prefixes ("ctl00_ContentPlaceHolder1_txtFirstName"). */
const ID_NOISE = /^(ctl\d*|txt|ddl|rbl|rb|chk|fu|cmb|tb|inp|input|fld|frm|cph\d*|uc\d*|ctrl|\d+)$/;
export const normaliseId = (s: string) =>
  normalise(s)
    .replace(/\bcontent place ?holder\d*\b/g, ' ')
    .split(' ')
    .filter((t) => t && !ID_NOISE.test(t))
    .join(' ');

export function normalise(s: string) {
  return s
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[_\-:.*()[\]/\\|,;"'?!]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface Described {
  /** What sits right on the field, each normalised on its own: label, aria label, placeholder, title, name, id. */
  own: string[];
  /** Text just before the field, for forms whose labels are not connected to their inputs. */
  near: string;
}

export function classify(kind: Rule['kinds'][number], d: Described): { key: Key; sure: boolean } | null {
  const ownAll = d.own.join(' ');
  const sources: [string, boolean][] = [...d.own.map((t): [string, boolean] => [t, true]), [d.near, false]];
  for (const r of RULES) {
    if (!r.kinds.includes(kind)) continue;
    for (const [text, sure] of sources) {
      if (!text || !r.any.some((re) => re.test(text))) continue;
      // Exclusions look at everything we know about the field, so "Father's first name" never becomes "First name".
      // Leaving a field for the traveller is always the safe mistake.
      const all = `${ownAll} ${d.near}`;
      if (r.not?.some((re) => re.test(all))) continue;
      return { key: r.key, sure: sure || d.own.every((o) => !o) };
    }
  }
  return null;
}

export const isTravellerOnly = (d: Described) => d.own.some((t) => TRAVELLER_ONLY.test(t)) || (!d.own.some(Boolean) && TRAVELLER_ONLY.test(d.near));

/* ------------------------------------------------------------------ choosing an option */

const COUNTRY_NAMES: Record<string, string[]> = {
  IND: ['india', 'indian', 'الهند', 'هندي', 'هندية'],
  PAK: ['pakistan', 'pakistani', 'باكستان', 'باكستاني'],
  BGD: ['bangladesh', 'bangladeshi', 'بنغلاديش', 'بنجلاديش', 'بنغلاديشي'],
  NGA: ['nigeria', 'nigerian', 'نيجيريا', 'نيجيري'],
  PHL: ['philippines', 'philippine', 'filipino', 'the philippines', 'الفلبين', 'فلبيني'],
  IDN: ['indonesia', 'indonesian', 'إندونيسيا', 'اندونيسيا', 'إندونيسي'],
  VNM: ['vietnam', 'viet nam', 'vietnamese', 'فيتنام', 'فيتنامي'],
  THA: ['thailand', 'thai', 'تايلاند', 'تايلندي'],
  KEN: ['kenya', 'kenyan', 'كينيا', 'كيني'],
  ZAF: ['south africa', 'south african', 'جنوب أفريقيا', 'جنوب افريقيا'],
  RUS: ['russia', 'russian federation', 'russian', 'روسيا', 'روسي'],
  CHN: ['china', 'chinese', "people's republic of china", 'الصين', 'صيني'],
  EGY: ['egypt', 'egyptian', 'مصر', 'مصري'],
  LKA: ['sri lanka', 'sri lankan', 'سريلانكا', 'سري لانكا'],
  NPL: ['nepal', 'nepalese', 'nepali', 'نيبال', 'نيبالي'],
  GBR: ['united kingdom', 'british', 'great britain', 'uk', 'المملكة المتحدة', 'بريطاني'],
  USA: ['united states', 'united states of america', 'american', 'usa', 'الولايات المتحدة', 'أمريكي'],
  DEU: ['germany', 'german', 'ألمانيا', 'ألماني'],
  FRA: ['france', 'french', 'فرنسا', 'فرنسي'],
  ITA: ['italy', 'italian', 'إيطاليا', 'إيطالي'],
  ESP: ['spain', 'spanish', 'إسبانيا', 'إسباني'],
  NLD: ['netherlands', 'dutch', 'the netherlands', 'هولندا', 'هولندي'],
  CHE: ['switzerland', 'swiss', 'سويسرا', 'سويسري'],
};

export function countryCandidates(n: { iso2: string; iso3: string; name: string }) {
  return { words: [...new Set([n.name.toLowerCase(), ...(COUNTRY_NAMES[n.iso3] ?? [])].filter(Boolean))], codes: [n.iso3.toLowerCase(), n.iso2.toLowerCase()] };
}

export const SEX_WORDS: Record<'M' | 'F', { words: string[]; codes: string[] }> = {
  M: { words: ['male', 'man', 'ذكر'], codes: ['m', '1'] },
  F: { words: ['female', 'woman', 'أنثى', 'انثى'], codes: ['f', '2'] },
};
export const NORMAL_PASSPORT = { words: ['normal', 'ordinary', 'regular', 'standard', 'normal passport', 'ordinary passport', 'عادي', 'عادية'], codes: ['n', 'p'] };

/** Picks the option that names the value, or null. Exact names win over codes, codes over partial names. */
export function bestOption(options: { text: string; value: string }[], want: { words: string[]; codes: string[] }): number | null {
  let best = -1;
  let score = 0;
  options.forEach((o, i) => {
    const t = normalise(o.text);
    const v = normalise(o.value);
    let s = 0;
    for (const w of want.words) {
      const n = normalise(w);
      if (!n) continue;
      if (t === n || v === n) s = Math.max(s, 100);
      else if (t.startsWith(`${n} `) || t.endsWith(` ${n}`)) s = Math.max(s, 75);
      else if (new RegExp(`(^|\\s)${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(t)) s = Math.max(s, 60);
    }
    for (const c of want.codes) if (v === c || t === c) s = Math.max(s, 90);
    if (s > score) {
      score = s;
      best = i;
    }
  });
  return score >= 60 ? best : null;
}

/* ------------------------------------------------------------------ dates */

export type DateFormat = { order: 'dmy' | 'mdy' | 'ymd'; sep: string; month: 'num' | 'short' };
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Reads a date format from hints like "DD/MM/YYYY". Defaults to day first, as UAE sites use. */
export function dateFormatFrom(hint: string): DateFormat {
  const h = hint.toLowerCase();
  const m = h.match(/(dd|mm|yyyy|mmm)[\s./-](dd|mm|mmm)[\s./-](dd|mm|yyyy|yy)/) ?? h.match(/(yyyy)[\s./-](mm)[\s./-](dd)/);
  if (m) {
    const sep = h.slice((m.index ?? 0) + m[1].length, (m.index ?? 0) + m[1].length + 1);
    const month = /mmm/.test(m[0]) ? 'short' : 'num';
    const order = m[1] === 'yyyy' ? 'ymd' : m[1].startsWith('m') && m[2] === 'dd' ? 'mdy' : 'dmy';
    return { order, sep, month };
  }
  return { order: 'dmy', sep: '/', month: 'num' };
}

export function formatDate(iso: string, f: DateFormat) {
  const [y, m, d] = iso.split('-');
  const mon = f.month === 'short' ? MONTHS[Number(m) - 1].replace(/^./, (c) => c.toUpperCase()) : m;
  return f.order === 'ymd' ? [y, mon, d].join(f.sep) : f.order === 'mdy' ? [mon, d, y].join(f.sep) : [d, mon, y].join(f.sep);
}

/** For a date split into three selects or boxes: which part this one holds, judged by its options or hint. */
export function datePart(hint: string, options: { text: string; value: string }[]): 'day' | 'month' | 'year' | null {
  const h = normalise(hint);
  if (/^(dd|day|يوم|اليوم)$/.test(h) || /\bday\b/.test(h)) return 'day';
  if (/^(mm|month|شهر|الشهر)$/.test(h) || /\bmonth\b/.test(h)) return 'month';
  if (/^(yyyy|yy|year|سنة|السنة)$/.test(h) || /\byear\b/.test(h)) return 'year';
  if (!options.length) return null;
  const texts = options.map((o) => normalise(o.text)).filter(Boolean);
  if (texts.some((t) => /^(19|20)\d\d$/.test(t))) return 'year';
  if (texts.some((t) => MONTHS.some((mn) => t.startsWith(mn)))) return 'month';
  const nums = texts.filter((t) => /^\d{1,2}$/.test(t)).map(Number);
  if (nums.length >= 28 && Math.max(...nums) >= 28) return 'day';
  if (nums.length === 12 && Math.max(...nums) === 12) return 'month';
  return null;
}

export function datePartValue(iso: string, part: 'day' | 'month' | 'year') {
  const [y, m, d] = iso.split('-');
  const n = part === 'year' ? y : part === 'month' ? m : d;
  const words = part === 'month' ? [MONTHS[Number(m) - 1], new Date(`${iso}T00:00:00Z`).toLocaleString('en', { month: 'long', timeZone: 'UTC' }).toLowerCase()] : [];
  return { words: [n, String(Number(n)), ...words], codes: [n, String(Number(n))] };
}
