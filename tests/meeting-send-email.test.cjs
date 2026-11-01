// Emailing a meeting summary. This route used to go out through the sender's
// own Gmail, so it only worked for someone who had connected Google — everyone
// else got "Couldn't send that. Try again." forever.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, modules) {
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, {
    exports: module.exports, module, require: (name) => modules[name] ?? require(name),
    Response, Request, URL, Buffer, console: { error() {} },
  });
  return module.exports;
}

const MEETING = {
  id: 'm1',
  title: 'Kitchen walkthrough',
  summary: 'Agreed the tile order goes in Friday.',
  decisions: ['Order tiles Friday'],
  action_items: [{ task: 'Call Marco', owner: 'Adrian', due_date: '2026-09-20' }],
  follow_up_email: null,
  metadata: null,
  transcript: '',
};

function world({ user = { id: 'me' }, meeting = MEETING, sent = true, pdfWorks = true } = {}) {
  const calls = { emails: [] };
  return {
    calls,
    modules: {
      'next/server': { NextResponse: Response },
      '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) },
      '@/lib/database': { getMeeting: async () => meeting },
      '@/lib/types': { toMeetingResult: (m) => ({ meeting_summary: m.summary, key_decisions: m.decisions, action_items: m.action_items }) },
      '@/lib/pdf/meetingPdf': {
        buildMeetingPdf: async () => {
          if (!pdfWorks) throw new Error('no font for that script');
          return Buffer.from('%PDF-1.4 pretend');
        },
      },
      '@/lib/email/send': {
        sendAppEmail: async (input) => {
          calls.emails.push(input);
          return sent ? { sent: true, via: 'resend' } : { sent: false, via: 'none', error: 'Email provider rejected the message' };
        },
      },
    },
  };
}

const post = (body) =>
  new Request('https://memovalet.com/api/meetings/m1/send-email', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
const params = { params: Promise.resolve({ id: 'm1' }) };
const route = (w) => load('app/api/meetings/[id]/send-email/route.ts', w.modules).POST;

test('the summary goes out with the PDF attached, through the app sender', async () => {
  const w = world();
  const res = await route(w)(post({ email: 'dan@example.com' }), params);

  assert.equal(res.status, 200);
  assert.equal((await res.json()).withPdf, true);
  assert.equal(w.calls.emails.length, 1);
  const email = w.calls.emails[0];
  assert.equal(email.to, 'dan@example.com');
  assert.match(email.subject, /Kitchen walkthrough/);
  assert.equal(email.attachments[0].filename, 'Kitchen_walkthrough.pdf');
  // Not everyone has connected Gmail; the body has to stand on its own.
  assert.match(email.text, /Agreed the tile order goes in Friday/);
  assert.match(email.text, /Call Marco/);
});

test('a PDF that cannot be built still sends the summary as text', async () => {
  const w = world({ pdfWorks: false });
  const res = await route(w)(post({ email: 'dan@example.com' }), params);

  assert.equal(res.status, 200);
  assert.equal((await res.json()).withPdf, false, 'the page can say it went as text');
  assert.equal(w.calls.emails[0].attachments, undefined);
  assert.match(w.calls.emails[0].text, /Agreed the tile order goes in Friday/);
});

test('a send that fails says so instead of claiming success', async () => {
  const w = world({ sent: false });
  const res = await route(w)(post({ email: 'dan@example.com' }), params);

  assert.equal(res.status, 502);
  assert.match((await res.json()).error, /rejected/);
});

test('a bad address is refused before anything is built or sent', async () => {
  const w = world();
  for (const email of ['', 'dan', 'dan@example', 'dan @example.com']) {
    const res = await route(w)(post({ email }), params);
    assert.equal(res.status, 400, JSON.stringify(email));
  }
  assert.equal(w.calls.emails.length, 0);
});

test('signing in is required, and a missing meeting is a 404', async () => {
  const signedOut = world({ user: null });
  assert.equal((await route(signedOut)(post({ email: 'dan@example.com' }), params)).status, 401);

  const missing = world({ meeting: null });
  assert.equal((await route(missing)(post({ email: 'dan@example.com' }), params)).status, 404);
  assert.equal(signedOut.calls.emails.length + missing.calls.emails.length, 0);
});
