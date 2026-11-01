const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const moduleExports = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/meeting-chat.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: moduleExports.exports, module: moduleExports, URL, TextDecoder });
const { parseChatPacket, safeGifUrl, appendChat } = moduleExports.exports;
const bytes = value => new TextEncoder().encode(JSON.stringify(value));
test('chat preserves multilingual text and derives sender from transport', () => {
  const message = parseChatPacket(bytes({ id: 'msg-1', text: 'Hello العربية 日本語 👍', senderId: 'spoof', senderName: 'Spoof' }), 'actual', 'Actual');
  assert.equal(message.senderId, 'actual');
  assert.equal(message.senderName, 'Actual');
  assert.equal(message.text, 'Hello العربية 日本語 👍');
});
test('reject malformed, empty and oversized messages', () => {
  for (const packet of [bytes(null), bytes({}), bytes({ id: '1', text: ' ' }), bytes({ id: '1', text: 'a'.repeat(2001) }), new Uint8Array(12001), new TextEncoder().encode('{')]) {
    assert.equal(parseChatPacket(packet, 'sender', 'Name'), null);
  }
});
test('GIFs are restricted to HTTPS media links without credentials', () => {
  assert.equal(safeGifUrl('https://media.giphy.com/media/example/giphy.gif'), 'https://media.giphy.com/media/example/giphy.gif');
  for (const url of ['javascript:alert(1)', 'https://evil.test/a.gif', 'https://media.giphy.com.evil.test/a.gif', 'http://media.giphy.com/a.gif', 'https://user:pass@media.giphy.com/a.gif', 'https://media.giphy.com/a.svg', 'https://media.giphy.com:444/a.gif']) assert.equal(safeGifUrl(url), undefined);
  assert.equal(parseChatPacket(bytes({ id: '1', text: '', gifUrl: 'https://evil.test/a.gif' }), 's', 'N'), null);
  assert.ok(parseChatPacket(bytes({ id: '1', text: '', gifUrl: 'https://media.tenor.com/test.gif' }), 's', 'N'));
});
test('duplicates are scoped to sender and chat history stays bounded', () => {
  const item = { id: '1', senderId: 'a', text: 'Hi', senderName: 'A', sentAt: 1 };
  const once = appendChat([], item);
  assert.equal(appendChat(once, item), once);
  assert.equal(appendChat(once, { ...item, senderId: 'b' }).length, 2);
  let list = [];
  for (let i = 0; i < 250; i++) list = appendChat(list, { ...item, id: String(i) });
  assert.equal(list.length, 200);
  assert.equal(list[0].id, '50');
});
