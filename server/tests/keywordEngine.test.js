const { test } = require("node:test");
const assert = require("node:assert/strict");
const { analyzeKeywords } = require("../moderation/keywordEngine");
const { fallbackSuggestion } = require("../moderation/rephrase");

const toxic = (t) => analyzeKeywords(t).isToxic;

test("does not flag innocent words that contain bad substrings", () => {
  for (const t of [
    "hello there, nice skill",
    "Gandhi was a great leader",
    "whatever, the class was fun",
    "parachute jump this weekend",
    "I live in Essex, it has begun",
    "my therapist suggested an assessment",
    "Scunthorpe United won",
    "shell scripting tips",
    "cocktail recipes",
  ]) {
    assert.equal(toxic(t), false, t);
  }
});

test("does not flag discussion OF sensitive topics", () => {
  for (const t of [
    "We should talk about caste discrimination in schools",
    "This article on racism is important",
    "Suicide prevention helplines save lives",
    "I hate Mondays",
    "Let's kill some time before class",
    "this bug is stupid",
  ]) {
    assert.equal(toxic(t), false, t);
  }
});

test("flags English insults, profanity and threats", () => {
  assert.equal(toxic("you are an idiot"), true);
  assert.equal(toxic("you are stupid"), true);
  assert.equal(toxic("what a piece of shit post"), true);
  assert.equal(toxic("I hate you"), true);
  const threat = analyzeKeywords("I will kill you");
  assert.equal(threat.isToxic, true);
  assert.ok(threat.categories.includes("threat"));
  assert.equal(threat.severity, "high");
});

test("catches disguised spellings", () => {
  for (const t of ["f*ck you", "sh1t", "a$$hole", "fuuuuuck", "f.u.c.k off", "you m0r0n"]) {
    assert.equal(toxic(t), true, t);
  }
});

test("catches Hinglish, Devanagari and Kannada abuse", () => {
  assert.equal(toxic("tu chutiya hai"), true);
  assert.equal(toxic("bhenchod kya bakwas hai"), true);
  assert.equal(toxic("तू चूतिया है"), true);
  assert.equal(toxic("तुझे जान से मार दूंगा"), true);
  assert.equal(toxic("ನೀನು ಸೂಳೆಮಗ"), true);
  assert.equal(toxic("tujhe maar dunga"), true);
});

test("mild insults only count when aimed at someone", () => {
  assert.equal(toxic("bewakoof"), false);
  assert.equal(toxic("tu bewakoof hai"), true);
});

test("Kannada / Kanglish 'fool' (ಮೂರ್ಖ, moorkha) only flags when aimed at someone", () => {
  assert.equal(toxic("ನೀನು ಮೂರ್ಖ"), true);
  assert.equal(toxic("neenu moorkha"), true);
  assert.equal(toxic("ninna kelasa moorkha"), true);
  // mentioning the word is not an insult
  assert.equal(toxic("ಮೂರ್ಖ ಎಂಬ ಪದದ ಅರ್ಥ"), false);
  assert.equal(toxic("moorkha"), false);
  // score bands: below the 0.5 threshold alone, above it when aimed (weight 0.45 + 0.2 boost)
  assert.equal(analyzeKeywords("moorkha").categoryScores.bullying, 0.45);
  assert.equal(analyzeKeywords("neenu moorkha").categoryScores.bullying, 0.65);
});

test("'garbage' / 'trash' only flag when aimed at someone", () => {
  for (const t of ["you are garbage", "your writing is trash", "this is trash and so are you", "u r tr4sh"]) {
    assert.equal(toxic(t), true, t);
  }
  for (const t of [
    "take out the trash",
    "garbage collection in Java",
    "The trash truck comes on Monday",
    "Recycling garbage reduces landfill",
    "That movie is trash",
  ]) {
    assert.equal(toxic(t), false, t);
  }
  // 0.35 alone (clean), 0.55 when aimed (flagged)
  assert.equal(analyzeKeywords("take out the trash").categoryScores.bullying, 0.35);
  assert.equal(analyzeKeywords("you are garbage").categoryScores.bullying, 0.55);
});

test("self-harm is marked for support, not as toxic", () => {
  const r = analyzeKeywords("sometimes I want to die");
  assert.equal(r.isToxic, false);
  assert.equal(r.supportNeeded, true);
});

test("overlapping phrases are counted once", () => {
  const r = analyzeKeywords("I hate you");
  assert.equal(r.matches.length, 1);
  assert.ok(r.score <= 0.8);
});

test("link spam is detected", () => {
  assert.equal(toxic("visit http://a.com http://b.com http://c.com now"), true);
});

test("fallback rephrase removes offensive words but keeps the point", () => {
  const text = "this fucking post is so badly researched";
  const out = fallbackSuggestion(text, analyzeKeywords(text));
  assert.equal(toxic(out), false);
  assert.match(out.toLowerCase(), /badly researched/);
});

test("fallback never returns broken half-sentences for insults", () => {
  const text = "tu bewakoof hai, this post is useless";
  const out = fallbackSuggestion(text, analyzeKeywords(text));
  assert.equal(out, "Mujhe yeh baat sahi nahi lagi, main respectfully disagree karta hoon.");
});
