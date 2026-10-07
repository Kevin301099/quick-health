import { describe, expect, it } from 'vitest';
import { buildMrz, checkDigit, parseMrz } from '../src/mrz';
import { interpret } from '../src/extract';

describe('MRZ', () => {
  it('computes ICAO check digits', () => {
    // The ICAO 9303 specimen: passport number L898902C3 has check digit 6, date of birth 740812 has 2.
    expect(checkDigit('L898902C3')).toBe('6');
    expect(checkDigit('740812')).toBe('2');
    expect(checkDigit('120415')).toBe('9');
  });

  it('parses the ICAO specimen passport', () => {
    const r = parseMrz('P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', 'L898902C36UTO7408122F1204159ZE184226B<<<<<10', '2026-10-07');
    expect(r).not.toBeNull();
    expect(r!.valid).toBe(true);
    expect(r!.surname).toBe('ERIKSSON');
    expect(r!.givenNames).toBe('ANNA MARIA');
    expect(r!.passportNumber).toBe('L898902C3');
    expect(r!.dateOfBirth).toBe('1974-08-12');
    expect(r!.sex).toBe('F');
  });

  it('round-trips a built MRZ and catches a single wrong character', () => {
    const [l1, l2] = buildMrz({ surname: 'SHARMA', given: 'ANANYA RAVI', number: 'Z9100234', nationality: 'IND', dob: '1992-06-14', sex: 'F', expiry: '2029-02-28' });
    expect(l1).toHaveLength(44);
    expect(l2).toHaveLength(44);
    const ok = parseMrz(l1, l2, '2026-10-07')!;
    expect(ok.valid).toBe(true);
    expect(ok.dateOfExpiry).toBe('2029-02-28');
    const tampered = l2.slice(0, 3) + '8' + l2.slice(4);
    const bad = parseMrz(l1, tampered, '2026-10-07')!;
    expect(bad.valid).toBe(false);
    expect(bad.failed).toContain('passport number');
  });
});

describe('reading interpretation', () => {
  const [l1, l2] = buildMrz({ surname: 'SHARMA', given: 'ANANYA RAVI', number: 'Z9100234', nationality: 'IND', dob: '1992-06-14', sex: 'F', expiry: '2029-02-28' });
  const base = {
    is_passport_photo_page: true,
    legibility: 'clear' as const,
    surname: 'Sharma',
    given_names: 'Ananya Ravi',
    passport_number: 'Z9100234',
    nationality_code: 'IND',
    issuing_country_code: 'IND',
    date_of_birth: '1992-06-14',
    sex: 'F' as const,
    date_of_issue: '2019-03-01',
    date_of_expiry: '2029-02-28',
    place_of_birth: 'Pune',
    mrz_line_1: l1,
    mrz_line_2: l2,
  };

  it('trusts a reading whose check digits pass', () => {
    const r = interpret(base, '2026-10-07');
    expect(r.status).toBe('ok');
    expect(r.verified).toBe(true);
    expect(r.fields.passportNo).toBe('Z9100234');
    expect(r.fields.given).toBe('ANANYA RAVI');
  });

  it('prefers the proven MRZ over a misread printed number', () => {
    const r = interpret({ ...base, passport_number: 'Z91OO234' }, '2026-10-07');
    expect(r.fields.passportNo).toBe('Z9100234');
  });

  it('asks the person to check when the code lines do not add up', () => {
    const r = interpret({ ...base, mrz_line_2: l2.replace('920614', '920615') }, '2026-10-07');
    expect(r.status).toBe('check');
    expect(r.verified).toBe(false);
    expect(r.attention).toContain('dob');
  });

  it('rejects something that is not a passport', () => {
    expect(interpret({ ...base, is_passport_photo_page: false }).status).toBe('not_passport');
  });
});
