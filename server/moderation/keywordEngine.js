/**
 * Rule-based multilingual toxicity engine (always available, no API key needed).
 *
 * Improvements over the original substring matcher:
 *  - Whole-word matching with Unicode-aware boundaries (works for Devanagari/Kannada)
 *  - Leetspeak / masking tolerant: "f*ck", "sh1t", "a$$hole", "fuuuuck", "f.u.c.k"
 *  - Per-term weights + "targeted" boost (insult aimed at "you" is worse)
 *  - Noisy-OR scoring per category, severity levels, explainable matches
 *  - Self-harm is detected separately so the user can be shown support instead of punished
 */

const { CATEGORIES, LEXICON, SECOND_PERSON } = require("./lexicon");

const TOXIC_THRESHOLD = 0.5;

const LEET = {
  a: "a@4",
  b: "b8",
  e: "e3",
  g: "g9",
  i: "i1!",
  l: "l1",
  o: "o0",
  s: "s$5",
  t: "t7",
};
const VOWELS = new Set(["a", "e", "i", "o", "u"]);
const BOUNDARY_BEFORE = "(?<![\\p{L}\\p{M}\\p{N}])";
const BOUNDARY_AFTER = "(?![\\p{L}\\p{M}\\p{N}])";
const WORD_GAP = "[^\\p{L}\\p{M}\\p{N}]+";
const EN_SUFFIX = "(?:s|es|ed|ing|in|er|ers|y|ies)?";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isLatin = (s) => /^[a-z' ]+$/i.test(s);

function latinWordPattern(word, allowInnerSeparators) {
  const parts = [];
  for (const ch of word) {
    if (ch === "'") {
      parts.push("['’]?");
      continue;
    }
    let cls = LEET[ch] || ch;
    if (VOWELS.has(ch)) cls += "*";
    parts.push(`[${escapeRegex(cls)}]+`);
  }
  return parts.join(allowInnerSeparators ? "[._\\-]?" : "");
}

function buildPattern(entry) {
  const term = entry.term.toLowerCase().trim();
  const words = term.split(/\s+/);
  let body;

  if (isLatin(term)) {
    const single = words.length === 1;
    const suffixes = entry.suffixes ?? single;
    body = words
      .map((w) => latinWordPattern(w, single && w.length >= 4))
      .join(WORD_GAP);
    if (suffixes) body += EN_SUFFIX;
  } else {
    body = words.map(escapeRegex).join(WORD_GAP);
  }

  return new RegExp(`${BOUNDARY_BEFORE}${body}${BOUNDARY_AFTER}`, "giu");
}

// Compile once at startup
const COMPILED = LEXICON.map((entry) => ({ ...entry, regex: buildPattern(entry) }));
const SECOND_PERSON_REGEX = new RegExp(
  `${BOUNDARY_BEFORE}(?:${SECOND_PERSON.map(escapeRegex).join("|")})${BOUNDARY_AFTER}`,
  "iu"
);

function normalize(text) {
  return String(text || "")
    .normalize("NFKC")
    .replace(/[​-‍⁠﻿]/g, "") // zero-width chars used to dodge filters
    .toLowerCase();
}

function severityFor(score, categories) {
  if (categories.includes(CATEGORIES.THREAT)) return "high";
  if (score >= 0.8) return "high";
  if (score >= 0.6) return "medium";
  return "low";
}

/**
 * Analyse text. Returns:
 * { isToxic, score, severity, categories, categoryScores, matches, supportNeeded, source }
 */
function analyzeKeywords(rawText) {
  const text = normalize(rawText);
  const targeted = SECOND_PERSON_REGEX.test(text);
  const hits = {}; // category -> [weights]
  const raw = [];

  for (const entry of COMPILED) {
    entry.regex.lastIndex = 0;
    for (const m of text.matchAll(entry.regex)) {
      let weight = entry.weight;
      if (entry.targeted && targeted) weight = Math.min(weight + 0.2, 0.95);
      raw.push({
        term: entry.term,
        category: entry.category,
        weight,
        text: m[0],
        index: m.index,
        length: m[0].length,
      });
    }
  }

  // Overlapping matches ("i hate you" / "hate you" / "hate") count once:
  // keep the longest span, then the strongest.
  raw.sort((a, b) => b.length - a.length || b.weight - a.weight);
  const matches = [];
  for (const m of raw) {
    const overlaps = matches.some(
      (k) => m.index < k.index + k.length && k.index < m.index + m.length
    );
    if (overlaps) continue;
    matches.push(m);
    (hits[m.category] ||= []).push(m.weight);
  }
  matches.sort((a, b) => a.index - b.index);

  // Link spam heuristic
  const links = (text.match(/https?:\/\/|www\./g) || []).length;
  if (links >= 2) (hits[CATEGORIES.SPAM] ||= []).push(links >= 3 ? 0.7 : 0.5);

  const categoryScores = {};
  for (const [cat, weights] of Object.entries(hits)) {
    const noisyOr = 1 - weights.reduce((p, w) => p * (1 - w), 1);
    categoryScores[cat] = Math.round(Math.min(noisyOr, 0.99) * 1000) / 1000;
  }

  const flaggedCats = Object.entries(categoryScores)
    .filter(([, s]) => s >= TOXIC_THRESHOLD)
    .map(([c]) => c);
  const toxicCats = flaggedCats.filter((c) => c !== CATEGORIES.SELF_HARM);
  const toxicScores = Object.entries(categoryScores)
    .filter(([c]) => c !== CATEGORIES.SELF_HARM)
    .map(([, s]) => s);

  let score = toxicScores.length ? Math.max(...toxicScores) : 0;
  if (toxicCats.length > 1) score = Math.min(score + 0.05, 0.99);
  score = Math.round(score * 1000) / 1000;

  const isToxic = toxicCats.length > 0;

  return {
    isToxic,
    score,
    severity: isToxic ? severityFor(score, toxicCats) : null,
    categories: flaggedCats,
    categoryScores,
    matches,
    targeted,
    supportNeeded: (categoryScores[CATEGORIES.SELF_HARM] || 0) >= TOXIC_THRESHOLD,
    source: "keyword",
  };
}

/** Replace matched offensive spans with nothing (used by fallback suggestions). */
function stripMatches(rawText, matches) {
  const text = normalize(rawText);
  if (!matches || matches.length === 0) return text;
  const sorted = [...matches].sort((a, b) => b.index - a.index);
  let out = text;
  for (const m of sorted) out = out.slice(0, m.index) + " " + out.slice(m.index + m.length);
  return out.replace(/\s+([,.!?])/g, "$1").replace(/\s{2,}/g, " ").trim();
}

module.exports = { analyzeKeywords, stripMatches, normalize, TOXIC_THRESHOLD, CATEGORIES };
