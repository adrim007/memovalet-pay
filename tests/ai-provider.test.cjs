const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function loadProvider(env, fetchImpl) {
  const calls = { anthropic: 0 };
  class Anthropic {
    messages = {
      create: async options => {
        calls.anthropic++;
        return { stop_reason: 'end_turn', content: [{ type: 'text', text: `claude:${options.messages[0].content}` }] };
      },
    };
  }
  const module = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync('lib/ai/provider.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(js, {
    exports: module.exports,
    require: name => name === '@anthropic-ai/sdk' ? { default: Anthropic, __esModule: true } : require(name),
    process: { env }, fetch: fetchImpl, AbortController, setTimeout, clearTimeout, console,
  });
  return { provider: module.exports, calls };
}

test('Gemini is the default when its server key is configured', async () => {
  let request;
  const { provider, calls } = loadProvider(
    { GEMINI_API_KEY: 'test-gemini-key' },
    async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"ok":true}' }] } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  );
  const output = await provider.generateAIText({ prompt: 'summarise', maxTokens: 200, json: true });
  assert.equal(output, '{"ok":true}');
  assert.match(request.url, /gemini-3\.1-flash-lite:generateContent$/);
  assert.equal(request.options.headers['x-goog-api-key'], 'test-gemini-key');
  const body = JSON.parse(request.options.body);
  assert.equal(body.contents[0].parts[0].text, 'summarise');
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, 'minimal');
  assert.equal(calls.anthropic, 0);
});

test('Gemini 2.x overrides keep the compatible thinking budget setting', async () => {
  let request;
  const { provider } = loadProvider(
    { GEMINI_API_KEY: 'test-gemini-key', GEMINI_MODEL: 'gemini-2.5-flash' },
    async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'ok' }] } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  );
  assert.equal(await provider.generateAIText({ prompt: 'hello', maxTokens: 20 }), 'ok');
  const body = JSON.parse(request.options.body);
  assert.equal(body.generationConfig.thinkingConfig.thinkingBudget, 0);
});

test('Claude remains selectable without changing application code', async () => {
  const { provider, calls } = loadProvider({
    GEMINI_API_KEY: 'test-gemini-key',
    ANTHROPIC_API_KEY: 'test-anthropic-key',
    MEMOVALET_AI_PROVIDER: 'anthropic',
  });
  assert.equal(await provider.generateAIText({ prompt: 'hello', maxTokens: 20 }), 'claude:hello');
  assert.equal(calls.anthropic, 1);
});

test('Gemini provider failures expose only a safe category and status', async () => {
  const { provider } = loadProvider(
    { GEMINI_API_KEY: 'test-gemini-key' },
    async () => new Response(JSON.stringify({ error: { message: 'API key invalid' } }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  );
  let caught;
  try {
    await provider.generateAIText({ prompt: 'hello', maxTokens: 20 });
  } catch (error) {
    caught = provider.getAIErrorDetails(error);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(caught)), {
    provider: 'gemini', category: 'provider_authentication', status: 403,
  });
});

test('an explicit provider never silently uses another provider key', async () => {
  const { provider, calls } = loadProvider({
    GEMINI_API_KEY: 'test-gemini-key',
    MEMOVALET_AI_PROVIDER: 'anthropic',
  });
  await assert.rejects(() => provider.generateAIText({ prompt: 'hello', maxTokens: 20 }));
  assert.equal(calls.anthropic, 0);
});
