/**
 * Suggests a polite rewrite of a toxic comment.
 * 1. Groq LLM (OpenAI-compatible API) — keeps the user's actual point, removes the abuse.
 * 2. Every suggestion is re-checked by the keyword engine; a still-toxic one is discarded.
 * 3. Offline fallback: strip the offensive words, or use a category template.
 */

const { analyzeKeywords, stripMatches, CATEGORIES } = require("./keywordEngine");
const { HINGLISH_TERMS } = require("./lexicon");
const config = require("../config");

const DEVANAGARI = /[ऀ-ॿ]/;
const KANNADA = /[ಀ-೿]/;

const SYSTEM_PROMPT = `You rewrite offensive blog comments into respectful ones.
Rules:
- Keep the commenter's real point (disagreement, criticism, a question) if there is one.
- Remove insults, slurs, profanity, threats and personal attacks.
- Reply in the same language and script as the original (English, Hindi, Hinglish, Kannada...).
- Keep it short: one or two sentences.
- Output ONLY the rewritten comment, no quotes, no explanation.`;

async function rephraseWithGroq(text) {
  let lastError;
  for (const model of config.groqModels) {
    try {
      const body = {
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
        temperature: 0.4,
        max_completion_tokens: 400,
      };
      // gpt-oss models are reasoning models — keep reasoning short and hidden
      if (model.startsWith("openai/gpt-oss")) {
        body.reasoning_effort = "low";
        body.include_reasoning = false;
      }
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.groqApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(config.providerTimeoutMs + 4000),
      });
      if (!res.ok) {
        lastError = new Error(`Groq ${model} ${res.status}: ${(await res.text()).slice(0, 120)}`);
        continue;
      }
      const data = await res.json();
      const out = data.choices?.[0]?.message?.content?.trim();
      if (out) return out.replace(/^["'“”]+|["'“”]+$/g, "").trim();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("No Groq model available");
}

function templateSuggestion(text, categories, matches = []) {
  const hindi = DEVANAGARI.test(text);
  const hinglish = matches.some((m) => HINGLISH_TERMS.has(m.term));
  const kannada = KANNADA.test(text);
  const has = (c) => categories.includes(c);

  if (kannada) return "ನನಗೆ ಈ ವಿಷಯದಲ್ಲಿ ಬೇರೆ ಅಭಿಪ್ರಾಯವಿದೆ.";
  if (hindi) {
    if (has(CATEGORIES.THREAT)) return "मुझे यह बात बिल्कुल पसंद नहीं आई।";
    return "मैं इस बात से सहमत नहीं हूँ, पर सम्मान से अपनी राय रखना चाहूँगा।";
  }
  if (hinglish) {
    if (has(CATEGORIES.THREAT)) return "Mujhe yeh baat bilkul pasand nahi aayi.";
    return "Mujhe yeh baat sahi nahi lagi, main respectfully disagree karta hoon.";
  }
  if (has(CATEGORIES.THREAT)) return "I'm really upset about this and strongly disagree.";
  if (has(CATEGORIES.HATE) || has(CATEGORIES.DISCRIMINATION))
    return "I don't agree with this viewpoint.";
  if (has(CATEGORIES.SPAM)) return "Thanks for the post!";
  return "I see this differently and would like to share my view respectfully.";
}

function fallbackSuggestion(text, keywordResult) {
  // Removing words only works when they are swear-word fillers:
  //   "this fucking post is badly researched" → "this post is badly researched"
  // When the insult IS the message ("tu bewakoof hai") stripping leaves broken text,
  // so we use a template instead.
  const matches = keywordResult.matches || [];
  const onlyFillers =
    matches.length > 0 && matches.every((m) => m.category === CATEGORIES.PROFANITY);
  if (onlyFillers) {
    const stripped = stripMatches(text, matches);
    const words = stripped.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
    if (words.length >= 4 && !analyzeKeywords(stripped).isToxic) {
      return stripped.charAt(0).toUpperCase() + stripped.slice(1);
    }
  }
  return templateSuggestion(text, keywordResult.categories, matches);
}

/**
 * @returns {Promise<{ text: string, source: "groq" | "fallback" }>}
 */
async function suggestRephrase(text, moderation) {
  const keyword = analyzeKeywords(text);
  const categories = moderation?.categories?.length ? moderation.categories : keyword.categories;

  if (config.groqApiKey) {
    try {
      const out = await rephraseWithGroq(text);
      if (out && out.toLowerCase() !== text.toLowerCase() && !analyzeKeywords(out).isToxic) {
        return { text: out, source: "groq" };
      }
    } catch (err) {
      console.warn("[rephrase] Groq failed → fallback.", err.message);
    }
  }
  return { text: fallbackSuggestion(text, { ...keyword, categories }), source: "fallback" };
}

module.exports = { suggestRephrase, fallbackSuggestion };
