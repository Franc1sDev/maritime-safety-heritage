/**
 * Unit tests of the business rules and helpers (master plan, Section 10.2): AI flag thresholds, the approval majority,
 * reserved usernames, sign-in codes, field encryption, file-type detection, spreadsheet reading and paging.
 * No database is used. Run with `npm test`.
 */
Object.assign(process.env, { NODE_ENV: 'test', DB_HOST: 'localhost', DB_USER: 'postgres', AI_PROVIDER: 'rules' });

import { Ai } from '../src/ai/ai.service';
import { Approvals } from '../src/approvals/approvals.service';
import { totp, verifyTotp, newTotpSecret, otpauthUrl } from '../src/auth/totp';
import { dateParam, decodeCursor, encodeCursor, intParam, pageSize } from '../src/common/db';
import { decryptField, encryptField, maskId, pseudonym } from '../src/common/field-crypto';
import { hasMessage, text } from '../src/common/messages';
import { parseCsv, toDate, yes } from '../src/common/spreadsheet';
import { detect } from '../src/media/file-type';
import { watermarkSvg } from '../src/media/media.service';
import { usernameProblem } from '../src/users/profile';

describe('AI flag thresholds (Section 5.2)', () => {
  const flag = (score: number, t = { yellowAbove: 20, redFrom: 70 }) => Ai.prototype.flagFor.call({}, score, t);
  it('GREEN up to 20%, YELLOW above 20% and below 70%, RED from 70%', () => {
    expect([0, 10, 20].map((s) => flag(s))).toEqual(['GREEN', 'GREEN', 'GREEN']);
    expect([20.5, 21, 45, 69, 69.9].map((s) => flag(s))).toEqual(['YELLOW', 'YELLOW', 'YELLOW', 'YELLOW', 'YELLOW']);
    expect([70, 85, 100].map((s) => flag(s))).toEqual(['RED', 'RED', 'RED']);
  });
  it('follows recalibrated thresholds', () => {
    const t = { yellowAbove: 30, redFrom: 80 };
    expect([30, 31, 79, 80].map((s) => flag(s, t))).toEqual(['GREEN', 'YELLOW', 'YELLOW', 'RED']);
  });
});

describe('Approval majority (Section 2.7, Appendix B)', () => {
  const needed = (eligible: number) => (Approvals.prototype as any).needed.call({}, eligible);
  it('needs two-thirds of the other active admins, rounded up, and never fewer than one', () => {
    expect([1, 2, 3, 4, 5, 6, 9].map(needed)).toEqual([1, 2, 2, 3, 4, 4, 6]);
    expect(needed(0)).toBe(1);
  });
});

describe('Reserved identity (Section 2.6)', () => {
  it('accepts ordinary usernames', () => {
    for (const ok of ['mama_atieno', 'Juma_254', 'abc', 'a'.repeat(30)]) expect(usernameProblem(ok)).toBeNull();
  });
  it('refuses names of the wrong shape', () => {
    for (const bad of ['ab', 'a'.repeat(31), 'has space', 'émile', 'semi;colon', '']) expect(usernameProblem(bad)).toBe('username_invalid');
  });
  it('refuses “Admin” and close variants, and the team’s own names', () => {
    for (const bad of ['admin', 'Admin', 'ADMIN_1', 'adm1n', 'a_d_m_i_n', '4dmin', 'the_admin_team', 'moderator', 'support', 'maritime', 'anonymous', 'Sup3rAdmin']) expect(usernameProblem(bad)).toBe('username_reserved');
  });
});

describe('Authenticator codes (RFC 6238)', () => {
  // The RFC's test secret, the ASCII text 12345678901234567890, in base32.
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  it('matches the published test values', () => {
    expect(totp(secret, 59_000)).toBe('287082');
    expect(totp(secret, 1111111109_000)).toBe('081804');
    expect(totp(secret, 1234567890_000)).toBe('005924');
    expect(totp(secret, 2000000000_000)).toBe('279037');
  });
  it('accepts the current code, allows one step of clock drift, and refuses anything else', () => {
    const s = newTotpSecret();
    expect(verifyTotp(s, totp(s))).toBe(true);
    expect(verifyTotp(s, totp(s, Date.now() - 30_000))).toBe(true);
    expect(verifyTotp(s, totp(s, Date.now() + 30_000))).toBe(true);
    const far = totp(s, Date.now() + 10 * 60_000);
    if (![-1, 0, 1].some((w) => totp(s, Date.now() + w * 30_000) === far)) expect(verifyTotp(s, far)).toBe(false);
    expect(verifyTotp(s, 'abcdef')).toBe(false);
    expect(verifyTotp(s, '')).toBe(false);
  });
  it('builds a link an authenticator app can read', () => {
    expect(otpauthUrl('ABC', 'grace@demo.ke')).toMatch(/^otpauth:\/\/totp\/Remembering%20the%20Waters:grace%40demo\.ke\?secret=ABC&issuer=/);
  });
});

describe('Sensitive fields (Section 4.5)', () => {
  it('encrypts, decrypts, and never produces the same text twice', () => {
    const a = encryptField('A1234567'), b = encryptField('A1234567');
    expect(a).not.toContain('A1234567');
    expect(a).not.toBe(b);
    expect(decryptField(a)).toBe('A1234567');
    expect(decryptField(b)).toBe('A1234567');
    expect(decryptField(encryptField('Kitambulisho 12345678 – ñ'))).toBe('Kitambulisho 12345678 – ñ');
  });
  it('refuses a value that was tampered with, and treats empty or unknown values as empty', () => {
    const parts = encryptField('A1234567').split('.');
    parts[3] = Buffer.from('something else').toString('base64url');
    expect(() => decryptField(parts.join('.'))).toThrow();
    expect(decryptField(null)).toBe('');
    expect(decryptField('v0.a.b.c')).toBe('');
  });
  it('masks an ID number to its last four characters', () => {
    expect(maskId('A1234567')).toBe('••••4567');
    expect(maskId('1234')).toBe('••••');
  });
  it('gives each person a stable stand-in for analytics that does not contain their ID', () => {
    const id = '5cc21d89-8e3a-4b84-8af8-4bfac65b4201';
    expect(pseudonym(id)).toBe(pseudonym(id));
    expect(pseudonym(id)).not.toContain(id.slice(0, 8));
    expect(pseudonym(id)).not.toBe(pseudonym('6cc21d89-8e3a-4b84-8af8-4bfac65b4201'));
  });
});

describe('File types are read from the file’s contents (Section 4.6)', () => {
  const pad = (head: number[] | string) => Buffer.concat([typeof head === 'string' ? Buffer.from(head, 'latin1') : Buffer.from(head), Buffer.alloc(64)]);
  it('recognises photographs and PDF documents', () => {
    expect(detect(pad([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe('image/jpeg');
    expect(detect(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.mime).toBe('image/png');
    expect(detect(pad('%PDF-1.7\n'))?.mime).toBe('application/pdf');
  });
  it('refuses a program, whatever it is called', () => {
    expect(detect(pad('MZ\x90\x00'), 'holiday-photo.jpg')).toBeNull();
    expect(detect(pad('\x7fELF'), 'story.pdf')).toBeNull();
    expect(detect(pad('#!/bin/sh\nrm -rf /'), 'notes.mp3')).toBeNull();
    expect(detect(Buffer.from([1, 2]))).toBeNull();
  });
});

describe('Metadata spreadsheet (Section 11.4)', () => {
  it('reads quoted cells, commas and line breaks inside cells, and skips empty rows', () => {
    const rows = parseCsv('title,text,tags\r\n"Likoni, 1987","She said ""hold on""\nand we did",ferry;crew\r\n,,\r\nSecond,,\r\n');
    expect(rows).toEqual([['title', 'text', 'tags'], ['Likoni, 1987', 'She said "hold on"\nand we did', 'ferry;crew'], ['Second', '', '']]);
  });
  it('reads dates as a year, a full date, day-first dates and Excel day numbers', () => {
    expect(toDate('1987')).toBe('1987-01-01');
    expect(toDate('1994-04-29')).toBe('1994-04-29');
    expect(toDate('29/04/1994')).toBe('1994-04-29');
    expect(toDate('1994-04')).toBe('1994-04-01');
    expect(toDate('45000')).toBe('2023-03-15');
    expect(toDate('long ago')).toBeNull();
    expect(toDate('')).toBeNull();
  });
  it('reads yes and no in English and Kiswahili', () => {
    for (const v of ['yes', 'Yes', 'Y', 'true', '1', 'ndiyo', ' NDIO ']) expect(yes(v)).toBe(true);
    for (const v of ['no', 'hapana', '', '0', 'maybe']) expect(yes(v)).toBe(false);
  });
});

describe('Paging and messages', () => {
  it('keeps page sizes within limits', () => {
    expect([pageSize(undefined), pageSize('25'), pageSize('0'), pageSize('-4'), pageSize('9999'), pageSize('abc'), pageSize('5', 10, 3)]).toEqual([10, 25, 10, 1, 50, 10, 3]);
  });
  it('accepts only real calendar dates from a request', () => {
    expect(dateParam('1994-04-29')).toBe('1994-04-29');
    expect(dateParam(' 2024-02-29 ')).toBe('2024-02-29');
    for (const bad of ['2023-02-29', '2026-13-01', '2026-00-10', '2026-04-31', 'notadate', '1994', '29/04/1994', '', undefined, null, "2026-01-01'; DROP TABLE stories;--"]) expect(dateParam(bad)).toBeNull();
  });
  it('accepts only whole numbers within range from a request', () => {
    expect([intParam('1994', 1, 9999), intParam(' 12 '), intParam('0'), intParam(7)]).toEqual([1994, 12, 0, 7]);
    for (const bad of ['abc', '19.5', '1e3', '', undefined, 'NaN', '99999999999', '12 OR 1=1']) expect(intParam(bad)).toBeNull();
    expect(intParam('99999', 1, 9999)).toBeNull();
    expect(intParam('-5')).toBeNull();
  });
  it('round-trips a cursor and ignores a damaged one', () => {
    const c = encodeCursor([12.5, '5cc21d89']);
    expect(decodeCursor(c)).toEqual([12.5, '5cc21d89']);
    expect(decodeCursor('not-a-cursor')).toBeNull();
    expect(decodeCursor(Buffer.from('{"a":1}').toString('base64url'))).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
  });
  it('gives each message in the reader’s language, and English when there is no translation', () => {
    expect(text('not_emergency', 'sw')).toBe('Hii si huduma ya dharura.');
    expect(text('not_emergency', 'fr')).toBe('This is not an emergency service.');
    expect(hasMessage('translation_unavailable')).toBe(true);
    expect(text('no_such_code')).toBe('no_such_code');
  });
});

describe('Photo credit (Section 4.11)', () => {
  const box = (svg: Buffer) => svg.toString().match(/width="(\d+)" height="(\d+)"/)!.slice(1).map(Number);
  it('always fits inside the photo, however small', () => {
    for (const [w, h] of [[2400, 1600], [960, 640], [300, 500], [160, 120], [40, 30]]) {
      const [bw, bh] = box(watermarkSvg(w, h, 'Remembering the Waters'));
      expect(bw).toBeLessThanOrEqual(w);
      expect(bh).toBeLessThanOrEqual(h);
    }
  });
  it('writes the label safely, so a changed setting cannot break the picture', () => {
    const svg = watermarkSvg(960, 640, 'A & B <script>"x"</script>').toString();
    expect(svg).toContain('A &amp; B &lt;script&gt;&quot;x&quot;&lt;/script&gt;');
    expect(svg).not.toContain('<script>');
  });
});
