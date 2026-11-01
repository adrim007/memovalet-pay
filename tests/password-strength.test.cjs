// Telling someone whether the password they are typing is any good.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const loaded = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/password-strength.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: loaded.exports, module: loaded, Set, Math, RegExp });
const { passwordStrength, MIN_PASSWORD } = loaded.exports;

test('too short is said as too short, counting down the characters left', () => {
  assert.equal(passwordStrength('').level, 'short');
  const almost = passwordStrength('abcdefg');
  assert.equal(almost.level, 'short');
  assert.equal(almost.unsafe, true);
  assert.match(almost.hint, /1 more character to go/);
  assert.match(passwordStrength('abcde').hint, /3 more characters to go/);
});

test('the passwords every break-in tries first are refused, however they are dressed up', () => {
  for (const password of ['password', 'PASSWORD', 'P@ssw0rd', 'letmein1', 'qwertyuiop', '12345678', 'memovalet']) {
    const strength = passwordStrength(password);
    assert.equal(strength.label, 'Weak', password);
    assert.equal(strength.unsafe, true, password);
  }
});

test('a password built from your own email or name is refused', () => {
  const email = passwordStrength('adrian12345', { email: 'adrian@example.com' });
  assert.equal(email.unsafe, true);
  assert.match(email.hint, /email/);
  const name = passwordStrength('Kulatunga99', { email: 'a@b.com', name: 'Adrian Kulatunga' });
  assert.equal(name.unsafe, true);
  assert.match(name.hint, /name/);
  // A short name fragment inside an ordinary word must not condemn it.
  assert.equal(passwordStrength('rainy harbour lantern', { name: 'Al Ng' }).unsafe, false);
});

test('one character over and over, or a run across the keyboard, is refused', () => {
  assert.equal(passwordStrength('aaaaaaaaaa').unsafe, true);
  assert.equal(passwordStrength('ababababab').unsafe, true);
  assert.equal(passwordStrength('asdfghjkl').unsafe, true);
  assert.equal(passwordStrength('0987654321').unsafe, true);
});

test('length carries the most weight, the way password guidance now says', () => {
  const short = passwordStrength('Tr0ub4dr');           // 8, mixed
  const long = passwordStrength('correct horse battery staple'); // 28, all letters
  assert.ok(long.score > short.score, `${long.score} should beat ${short.score}`);
  assert.equal(long.label, 'Strong');
  assert.equal(long.unsafe, false);
});

test('the everyday passwords land in between, and say what would help', () => {
  const fair = passwordStrength('Melbourne7');
  assert.equal(fair.label, 'Fair');
  assert.equal(fair.unsafe, false);
  assert.match(fair.hint, /unrelated words/, 'says what would actually help');
  const good = passwordStrength('Melbourne-tram-72');
  assert.ok(['Good', 'Strong'].includes(good.label), good.label);
});

test('a long password of one kind of character is not called strong', () => {
  const plain = passwordStrength('abcdefghijklmno');
  assert.ok(plain.score <= 3);
  assert.match(plain.hint, /capital|number|symbol|Longer/);
});

test('the score always fits the bar, and every answer has something to read', () => {
  for (const password of ['', 'a', 'abcdefg', 'password', 'Melbourne7', 'correct horse battery staple', '🔒🔒🔒🔒🔒🔒🔒🔒🔒']) {
    const strength = passwordStrength(password, { email: 'adrian@example.com' });
    assert.ok(strength.score >= 0 && strength.score <= 4, password);
    assert.ok(strength.hint.length > 0, password);
    assert.equal(typeof strength.unsafe, 'boolean');
  }
  assert.equal(MIN_PASSWORD, 8);
});
