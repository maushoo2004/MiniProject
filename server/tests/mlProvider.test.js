// The "custom" ML provider (our own model behind ML_SERVICE_URL). fetch is mocked: no service needed.
process.env.ML_SERVICE_URL = "";
process.env.GROQ_API_KEY = "";

const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const config = require("../config");
const { moderate, publicResult } = require("../moderation");
const { PROVIDERS } = require("../moderation/providers");

// no keyword hits in this sentence, so only the ML model can flag it
const SUBTLE = "complete waste of space honestly";
const realFetch = global.fetch;
let calls;

const mockMl = (probability, label = probability >= 0.5 ? 1 : 0) => {
  global.fetch = async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body) });
    return { ok: true, status: 200, json: async () => ({ toxic_probability: probability, label }) };
  };
};

beforeEach(() => {
  calls = [];
  config.mlServiceUrl = "http://ml.test:8000";
  config.providerOrder = ["custom"];
  config.mlTimeoutMs = 1500;
});
afterEach(() => {
  global.fetch = realFetch;
  config.mlServiceUrl = "";
});

test("the ML probability is exposed to the Lab (and is null when ML is off)", async () => {
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ toxic_probability: 0.72, label: 1, threshold: 0.7 }),
  });
  const on = publicResult(await moderate("nobody wants to read your garbage"));
  assert.deepEqual(on.ml, { probability: 0.72, flagged: true, threshold: 0.7 });

  // below the service's threshold: probability still shown, flagged false
  global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ toxic_probability: 0.57, label: 0, threshold: 0.7 }) });
  const below = publicResult(await moderate("you are an idiot"));
  assert.deepEqual(below.ml, { probability: 0.57, flagged: false, threshold: 0.7 });

  config.mlServiceUrl = "";
  const off = publicResult(await moderate("you are an idiot"));
  assert.equal(off.ml, null);
});

test("the service's own label decides (its threshold may be above 0.5)", async () => {
  mockMl(0.55, 0); // service threshold 0.6: probability 0.55 is NOT toxic
  const r = await moderate(SUBTLE);
  assert.equal(r.isToxic, false);
  mockMl(0.65, 1);
  assert.equal((await moderate(SUBTLE)).isToxic, true);
});

test("a hanging ML service times out quickly and moderation falls back to the keyword engine", async () => {
  config.mlTimeoutMs = 60;
  // A real request holds the event loop open with its socket. The mock needs a (ref'd) timer for that,
  // because AbortSignal.timeout()'s own timer is unref'd. It is cleared the moment the abort fires.
  global.fetch = (url, opts) =>
    new Promise((_, reject) => {
      const keepAlive = setTimeout(() => reject(new Error("mock fetch was never aborted")), 5000);
      opts.signal.addEventListener("abort", () => {
        clearTimeout(keepAlive);
        reject(opts.signal.reason);
      });
    });
  const started = Date.now();
  const r = await moderate("you are an idiot");
  const elapsed = Date.now() - started;
  assert.equal(r.isToxic, true);
  assert.deepEqual(r.providers, ["keyword"]);
  assert.match(r.providerErrors[0], /^custom:/);
  assert.ok(elapsed < 1000, `fell back after ${elapsed} ms`);
});

test("the default ML timeout is short (about 1.5 s)", () => {
  assert.equal(require("../config").mlTimeoutMs, 1500);
});

test("custom provider is only enabled when ML_SERVICE_URL is set", () => {
  assert.equal(PROVIDERS.custom.enabled(), true);
  config.mlServiceUrl = "";
  assert.equal(PROVIDERS.custom.enabled(), false);
});

test("without ML_SERVICE_URL the keyword engine decides alone and nothing is called", async () => {
  config.mlServiceUrl = "";
  mockMl(0.99);
  const r = await moderate(SUBTLE);
  assert.equal(r.isToxic, false);
  assert.deepEqual(r.providers, ["keyword"]);
  assert.equal(calls.length, 0);
});

test("ML probability >= 0.5 flags what the keyword engine misses (source: custom)", async () => {
  mockMl(0.91);
  const r = await moderate(SUBTLE);
  assert.equal(r.isToxic, true);
  assert.equal(r.source, "custom");
  assert.ok(r.categories.includes("harassment"));
  assert.equal(r.score, 0.91);
  assert.deepEqual(r.providers, ["custom", "keyword"]);
  assert.equal(calls[0].url, "http://ml.test:8000/predict");
  assert.deepEqual(calls[0].body, { text: SUBTLE });
});

test("ML probability below 0.5 does not flag a clean comment", async () => {
  mockMl(0.42);
  const r = await moderate("Lovely article, thanks!");
  assert.equal(r.isToxic, false);
});

test("a low ML score never un-flags what the keyword engine caught", async () => {
  mockMl(0.05);
  const r = await moderate("you are an idiot");
  assert.equal(r.isToxic, true);
  assert.ok(r.categories.includes("bullying"));
});

test("if the ML service is down, moderation still works with the keyword engine", async () => {
  global.fetch = async () => {
    throw new Error("connect ECONNREFUSED");
  };
  const flagged = await moderate("you are an idiot");
  assert.equal(flagged.isToxic, true);
  assert.deepEqual(flagged.providers, ["keyword"]);
  assert.match(flagged.providerErrors[0], /custom: connect ECONNREFUSED/);

  const clean = await moderate("Lovely article, thanks!");
  assert.equal(clean.isToxic, false);
});

test("a malformed or failing ML response is treated as an error, not as 'clean'", async () => {
  global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ nope: true }) });
  const r1 = await moderate("you are an idiot");
  assert.equal(r1.isToxic, true);
  assert.match(r1.providerErrors[0], /no toxic_probability/);

  global.fetch = async () => ({ ok: false, status: 500, text: async () => "boom" });
  const r2 = await moderate("you are an idiot");
  assert.match(r2.providerErrors[0], /ML service 500/);
});
