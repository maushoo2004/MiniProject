/**
 * Enhanced Content Moderation Service
 *
 * This service provides multi-tier moderation with:
 * - Severity levels: low, medium, high
 * - Categories: hate, threat, harassment, profanity, spam
 * - Multiple API fallbacks
 * - Comprehensive keyword-based moderation
 */

// Moderation categories
export const MODERATION_CATEGORIES = {
  HATE: "hate",
  THREAT: "threat",
  BULLYING: "bullying",
  DISCRIMINATION: "discrimination",
  HARASSMENT: "harassment",
  PROFANITY: "profanity",
  SPAM: "spam",
  SELF_HARM: "self_harm",
  SEXUAL: "sexual",
  VIOLENCE: "violence",
};

// Severity levels
export const SEVERITY_LEVELS = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
};

/**
 * Enhanced moderation with categories and severity
 * Priority: Hugging Face > OpenAI > Keyword Fallback
 */
export const moderateContentEnhanced = async (text) => {
  const hfApiKey = process.env.REACT_APP_HUGGINGFACE_API_KEY;
  const openAiKey = process.env.REACT_APP_OPENAI_API_KEY;

  // Try Hugging Face API first (best for toxicity detection)
  if (hfApiKey && hfApiKey !== "" && hfApiKey !== "hf-your-key-here") {
    try {
      const result = await tryHuggingFaceModeration(text, hfApiKey);
      if (result) return result;
    } catch (error) {
      console.warn(
        "Hugging Face API failed, trying alternatives:",
        error.message
      );
    }
  }

  // Try OpenAI API as fallback
  if (openAiKey && openAiKey !== "" && openAiKey !== "sk-your-key-here") {
    try {
      const result = await tryOpenAIModeration(text, openAiKey);
      if (result) return result;
    } catch (error) {
      console.warn(
        "OpenAI API failed, using enhanced keyword moderation:",
        error.message
      );
    }
  }

  // Use enhanced keyword-based moderation (always works)
  return enhancedKeywordModeration(text);
};

/**
 * Try Hugging Face Inference API for toxicity detection
 * Uses: unitary/toxic-bert model (free, no rate limits for reasonable use)
 * Uses backend proxy to avoid CORS issues
 */
const tryHuggingFaceModeration = async (text, apiKey) => {
  try {
    console.log(
      "🔍 Calling Hugging Face Moderation API via backend proxy for:",
      text.substring(0, 50)
    );

    // Use backend proxy to avoid CORS issues
    const proxyUrl =
      process.env.REACT_APP_BACKEND_URL || "http://localhost:3001";
    const response = await fetch(`${proxyUrl}/api/moderation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text,
        apiKey: apiKey,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { error: errorText };
      }
      console.warn("❌ Backend proxy error:", response.status, errorData);
      throw new Error(`Backend proxy error: ${response.status}`);
    }

    const data = await response.json();
    console.log("✅ HF Moderation response received via proxy:", data);
    return processHuggingFaceResponse(data, text);
  } catch (error) {
    console.warn("❌ HF Moderation failed:", error.message);
    throw error;
  }
};

/**
 * Process Hugging Face API response
 * Handles different response formats from HF models
 */
const processHuggingFaceResponse = (data, text) => {
  // Handle different response formats
  let results = [];

  if (Array.isArray(data)) {
    // Format: [[{label: "toxic", score: 0.9}, ...]]
    if (Array.isArray(data[0])) {
      results = data[0];
    }
    // Format: [{label: "toxic", score: 0.9}, ...]
    else if (data[0] && typeof data[0] === "object" && "label" in data[0]) {
      results = data;
    }
  }
  // Format: {label: "toxic", score: 0.9} (single result)
  else if (data && typeof data === "object" && "label" in data) {
    results = [data];
  }

  if (results.length === 0) {
    return null;
  }

  // Map HF labels to our categories
  const categories = [];
  const categoryScores = {};
  let maxScore = 0;

  results.forEach((item) => {
    const label = (item.label || "").toLowerCase();
    const score = item.score || 0;

    if (score > maxScore) {
      maxScore = score;
    }

    categoryScores[label] = score;

    // Map HF toxic-bert labels to our categories
    // Labels: toxic, severe_toxic, obscene, threat, insult, identity_hate
    if (
      label === "toxic" ||
      label === "severe_toxic" ||
      label === "identity_hate"
    ) {
      if (!categories.includes(MODERATION_CATEGORIES.HATE)) {
        categories.push(MODERATION_CATEGORIES.HATE);
      }
    }
    if (label === "threat") {
      if (!categories.includes(MODERATION_CATEGORIES.THREAT)) {
        categories.push(MODERATION_CATEGORIES.THREAT);
      }
    }
    if (label === "insult") {
      if (!categories.includes(MODERATION_CATEGORIES.BULLYING)) {
        categories.push(MODERATION_CATEGORIES.BULLYING);
      }
    }
    if (label === "obscene") {
      if (!categories.includes(MODERATION_CATEGORIES.PROFANITY)) {
        categories.push(MODERATION_CATEGORIES.PROFANITY);
      }
    }
  });

  // If no specific categories but toxic, add profanity
  if (categories.length === 0 && maxScore > 0.5) {
    categories.push(MODERATION_CATEGORIES.PROFANITY);
  }

  const isToxic = maxScore > 0.5; // Threshold for toxicity
  const severity = calculateSeverityFromScore(maxScore);

  return {
    isToxic,
    score: maxScore,
    severity,
    categories: [...new Set(categories)],
    categoryScores,
    source: "huggingface",
  };
};

/**
 * Calculate severity from score
 */
const calculateSeverityFromScore = (score) => {
  if (score >= 0.8) return SEVERITY_LEVELS.HIGH;
  if (score >= 0.5) return SEVERITY_LEVELS.MEDIUM;
  return SEVERITY_LEVELS.LOW;
};

/**
 * Try OpenAI Moderation API
 */
const tryOpenAIModeration = async (text, apiKey) => {
  try {
    const response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input: text }),
    });

    if (response.status === 429) {
      throw new Error("Rate limit exceeded");
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const result = data.results[0];

    if (!result) return null;

    // Map OpenAI categories to our categories
    const categories = mapOpenAICategories(result.categories);
    const severity = calculateSeverity(result.category_scores);
    const maxScore = Math.max(...Object.values(result.category_scores || {}));

    return {
      isToxic: result.flagged,
      score: maxScore,
      severity: severity,
      categories: categories,
      categoryScores: result.category_scores,
      source: "openai",
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Map OpenAI categories to our categories
 */
const mapOpenAICategories = (openAICategories) => {
  const categories = [];

  if (openAICategories.hate) categories.push(MODERATION_CATEGORIES.HATE);
  if (openAICategories["hate/threatening"]) {
    categories.push(MODERATION_CATEGORIES.HATE);
    categories.push(MODERATION_CATEGORIES.THREAT);
  }
  if (openAICategories.harassment)
    categories.push(MODERATION_CATEGORIES.HARASSMENT);
  if (openAICategories["harassment/threatening"]) {
    categories.push(MODERATION_CATEGORIES.HARASSMENT);
    categories.push(MODERATION_CATEGORIES.THREAT);
  }
  if (openAICategories["self-harm"])
    categories.push(MODERATION_CATEGORIES.SELF_HARM);
  if (openAICategories["self-harm/intent"])
    categories.push(MODERATION_CATEGORIES.SELF_HARM);
  if (openAICategories["self-harm/instructions"])
    categories.push(MODERATION_CATEGORIES.SELF_HARM);
  if (openAICategories.sexual) categories.push(MODERATION_CATEGORIES.SEXUAL);
  if (openAICategories["sexual/minors"])
    categories.push(MODERATION_CATEGORIES.SEXUAL);
  if (openAICategories.violence)
    categories.push(MODERATION_CATEGORIES.VIOLENCE);
  if (openAICategories["violence/graphic"])
    categories.push(MODERATION_CATEGORIES.VIOLENCE);

  return [...new Set(categories)]; // Remove duplicates
};

/**
 * Calculate severity based on scores
 */
const calculateSeverity = (categoryScores) => {
  if (!categoryScores) return SEVERITY_LEVELS.LOW;

  const maxScore = Math.max(...Object.values(categoryScores));

  if (maxScore >= 0.8) return SEVERITY_LEVELS.HIGH;
  if (maxScore >= 0.5) return SEVERITY_LEVELS.MEDIUM;
  return SEVERITY_LEVELS.LOW;
};

/**
 * Calculate score based on keyword matches and context
 * Only returns high score if keywords actually match
 */
const calculateScore = (text, keywords, baseScore) => {
  const lowerText = text.toLowerCase();
  let matchCount = 0;
  let totalScore = 0; // Start at 0, only increase if matches found

  keywords.forEach((keyword) => {
    if (lowerText.includes(keyword)) {
      matchCount++;
      // First match sets base score, additional matches increase it
      if (totalScore === 0) {
        totalScore = baseScore;
      } else {
        totalScore += 0.1;
      }
    }
  });

  // No matches = return 0 (not toxic)
  if (matchCount === 0) {
    return 0;
  }

  // Longer text with matches = slightly higher score
  if (matchCount > 0 && text.length > 50) {
    totalScore += 0.05;
  }

  return Math.min(totalScore, 0.99); // Cap at 99%
};

/**
 * Enhanced keyword-based moderation with categories and severity
 */
const enhancedKeywordModeration = (text) => {
  const lowerText = text.toLowerCase();
  const categories = [];
  let maxSeverity = SEVERITY_LEVELS.LOW;
  let maxScore = 0.1;
  const categoryScores = {};

  // Hate speech keywords (HIGH severity)
  const hateKeywords = [
    "hate",
    "racist",
    "racism",
    "nazi",
    "kkk",
    "bigot",
    "bigotry",
    "hate you",
    "i hate",
    "we hate",
    "they hate",
  ];
  const hateScore = calculateScore(text, hateKeywords, 0.85);
  if (hateScore > 0.5) {
    categories.push(MODERATION_CATEGORIES.HATE);
    categoryScores[MODERATION_CATEGORIES.HATE] = hateScore;
    maxSeverity = SEVERITY_LEVELS.HIGH;
    maxScore = Math.max(maxScore, hateScore);
  }

  // Discrimination keywords (HIGH severity)
  const discriminationKeywords = [
    "discriminate",
    "discrimination",
    "prejudice",
    "slur",
    "racial",
    "sexist",
    "homophobic",
    "transphobic",
    "caste",
    "untouchable",
  ];
  const discriminationScore = calculateScore(
    text,
    discriminationKeywords,
    0.88
  );
  if (discriminationScore > 0.5) {
    categories.push(MODERATION_CATEGORIES.DISCRIMINATION);
    categoryScores[MODERATION_CATEGORIES.DISCRIMINATION] = discriminationScore;
    maxSeverity = SEVERITY_LEVELS.HIGH;
    maxScore = Math.max(maxScore, discriminationScore);
  }

  // Threat keywords (HIGH severity)
  const threatKeywords = [
    "kill",
    "murder",
    "die",
    "death",
    "threat",
    "threaten",
    "harm",
    "hurt",
    "attack",
    "weapon",
    "gun",
    "bomb",
    "bombing",
    "kill you",
    "kill yourself",
    "end your life",
    "i will kill",
    "i'll kill",
    "i will hurt",
    "i'll hurt",
    "going to kill",
    "gonna kill",
  ];
  const threatScore = calculateScore(text, threatKeywords, 0.92);
  if (threatScore > 0.5) {
    categories.push(MODERATION_CATEGORIES.THREAT);
    categoryScores[MODERATION_CATEGORIES.THREAT] = threatScore;
    maxSeverity = SEVERITY_LEVELS.HIGH;
    maxScore = Math.max(maxScore, threatScore);
  }

  // Self-harm keywords (HIGH severity)
  const selfHarmKeywords = [
    "kill myself",
    "end myself",
    "suicide",
    "self harm",
    "cut myself",
    "hurt myself",
    "end my life",
    "take my life",
    "kill myself",
    "i want to die",
    "i wish i was dead",
    "end it all",
  ];
  const selfHarmScore = calculateScore(text, selfHarmKeywords, 0.93);
  if (selfHarmScore > 0.5) {
    categories.push(MODERATION_CATEGORIES.SELF_HARM);
    categoryScores[MODERATION_CATEGORIES.SELF_HARM] = selfHarmScore;
    maxSeverity = SEVERITY_LEVELS.HIGH;
    maxScore = Math.max(maxScore, selfHarmScore);
  }

  // Bullying keywords (MEDIUM to HIGH severity)
  const bullyingKeywords = [
    "bully",
    "bullying",
    "intimidate",
    "intimidation",
    "pick on",
    "tease",
    "mock",
    "ridicule",
    "make fun of",
    "laugh at",
  ];
  const bullyingScore = calculateScore(text, bullyingKeywords, 0.75);
  if (bullyingScore > 0.5) {
    categories.push(MODERATION_CATEGORIES.BULLYING);
    categoryScores[MODERATION_CATEGORIES.BULLYING] = bullyingScore;
    if (maxSeverity === SEVERITY_LEVELS.LOW) {
      maxSeverity = SEVERITY_LEVELS.MEDIUM;
    }
    if (bullyingScore > 0.85) {
      maxSeverity = SEVERITY_LEVELS.HIGH;
    }
    maxScore = Math.max(maxScore, bullyingScore);
  }

  // Harassment keywords (MEDIUM to HIGH severity)
  const harassmentKeywords = [
    "harass",
    "harassment",
    "stalk",
    "stalking",
    "creep",
    "pervert",
    "predator",
    "molest",
    "abuse",
    "abusive",
  ];
  const harassmentScore = calculateScore(text, harassmentKeywords, 0.78);
  if (harassmentScore > 0.5) {
    categories.push(MODERATION_CATEGORIES.HARASSMENT);
    categoryScores[MODERATION_CATEGORIES.HARASSMENT] = harassmentScore;
    if (maxSeverity === SEVERITY_LEVELS.LOW) {
      maxSeverity = SEVERITY_LEVELS.MEDIUM;
    }
    if (harassmentScore > 0.85) {
      maxSeverity = SEVERITY_LEVELS.HIGH;
    }
    maxScore = Math.max(maxScore, harassmentScore);
  }

  // Profanity keywords (LOW to MEDIUM severity)
  const profanityKeywords = [
    "fuck",
    "fucking",
    "fucked",
    "shit",
    "shitting",
    "damn",
    "bitch",
    "asshole",
    "bastard",
    "crap",
    "hell",
    "piss",
    "screw",
    "suck",
    "sucks",
    "dumb",
    "stupid",
    "idiot",
    "moron",
    "retard",
    "loser",
    "worthless",
    "useless",
    "fool",
    "foolish",
  ];
  const profanityScore = calculateScore(text, profanityKeywords, 0.55);
  if (profanityScore > 0.5) {
    categories.push(MODERATION_CATEGORIES.PROFANITY);
    categoryScores[MODERATION_CATEGORIES.PROFANITY] = profanityScore;
    if (maxSeverity === SEVERITY_LEVELS.LOW) {
      maxSeverity = SEVERITY_LEVELS.MEDIUM;
    }
    maxScore = Math.max(maxScore, profanityScore);
  }

  // Sexual content keywords (MEDIUM to HIGH severity)
  const sexualKeywords = [
    "sex",
    "sexual",
    "porn",
    "pornography",
    "nude",
    "naked",
    "rape",
    "raping",
    "molest",
    "molesting",
    "pedophile",
    "pedo",
    "pornographic",
  ];
  const sexualScore = calculateScore(text, sexualKeywords, 0.8);
  if (sexualScore > 0.5) {
    categories.push(MODERATION_CATEGORIES.SEXUAL);
    categoryScores[MODERATION_CATEGORIES.SEXUAL] = sexualScore;
    if (maxSeverity !== SEVERITY_LEVELS.HIGH) {
      maxSeverity = SEVERITY_LEVELS.MEDIUM;
    }
    if (sexualScore > 0.88) {
      maxSeverity = SEVERITY_LEVELS.HIGH;
    }
    maxScore = Math.max(maxScore, sexualScore);
  }

  // Violence keywords (HIGH severity)
  const violenceKeywords = [
    "violence",
    "violent",
    "fight",
    "fighting",
    "beat",
    "beating",
    "punch",
    "hitting",
    "hit",
    "stab",
    "stabbing",
    "shoot",
    "shooting",
    "bomb",
    "bombing",
    "explode",
    "explosion",
    "torture",
    "torturing",
  ];
  const violenceScore = calculateScore(text, violenceKeywords, 0.9);
  if (violenceScore > 0.5) {
    categories.push(MODERATION_CATEGORIES.VIOLENCE);
    categoryScores[MODERATION_CATEGORIES.VIOLENCE] = violenceScore;
    maxSeverity = SEVERITY_LEVELS.HIGH;
    maxScore = Math.max(maxScore, violenceScore);
  }

  // Spam keywords (LOW severity)
  const spamKeywords = [
    "click here",
    "buy now",
    "free money",
    "make money fast",
    "guaranteed",
    "act now",
    "limited time",
    "spam",
  ];
  if (
    spamKeywords.some((kw) => lowerText.includes(kw)) &&
    categories.length === 0
  ) {
    categories.push(MODERATION_CATEGORIES.SPAM);
    maxSeverity = SEVERITY_LEVELS.LOW;
    maxScore = Math.max(maxScore, 0.4);
  }

  // Hindi toxic keywords (transliterated English)
  const hindiToxicKeywords = [
    "bewakoof",
    "chutiya",
    "chutia",
    "gadha",
    "madharchod",
    "madarchod",
    "bhosdike",
    "bhosdi",
    "harami",
    "kutta",
    "kamina",
    "randi",
    "chut",
    "lund",
    "loda",
    "gaand",
    "gand",
    "chodu",
    "bhenchod",
    "behenchod",
    "maa chod",
    "maa ki",
    "teri maa",
    "teri ma",
    "maa ka",
    "bhosda",
  ];
  const hindiScore = calculateScore(text, hindiToxicKeywords, 0.72);
  if (hindiScore > 0.5) {
    if (!categories.includes(MODERATION_CATEGORIES.PROFANITY)) {
      categories.push(MODERATION_CATEGORIES.PROFANITY);
    }
    categoryScores[MODERATION_CATEGORIES.PROFANITY] = Math.max(
      categoryScores[MODERATION_CATEGORIES.PROFANITY] || 0,
      hindiScore
    );
    if (maxSeverity === SEVERITY_LEVELS.LOW) {
      maxSeverity = SEVERITY_LEVELS.MEDIUM;
    }
    maxScore = Math.max(maxScore, hindiScore);
  }

  // Hindi Devanagari script keywords (actual Hindi)
  const hindiDevanagariKeywords = [
    "चूतिया",
    "गधा",
    "मादरचोद",
    "भोसडीके",
    "हरामी",
    "कुत्ता",
    "कमीना",
    "रंडी",
    "चूत",
    "लंड",
    "गांड",
    "चोदू",
    "भेंचोद",
    "माँ चोद",
    "माँ का",
    "तेरी माँ",
    "भोसड़ा",
  ];
  const devanagariScore = calculateScore(text, hindiDevanagariKeywords, 0.75);
  if (devanagariScore > 0.5) {
    if (!categories.includes(MODERATION_CATEGORIES.PROFANITY)) {
      categories.push(MODERATION_CATEGORIES.PROFANITY);
    }
    categoryScores[MODERATION_CATEGORIES.PROFANITY] = Math.max(
      categoryScores[MODERATION_CATEGORIES.PROFANITY] || 0,
      devanagariScore
    );
    if (maxSeverity === SEVERITY_LEVELS.LOW) {
      maxSeverity = SEVERITY_LEVELS.MEDIUM;
    }
    maxScore = Math.max(maxScore, devanagariScore);
  }

  // Only mark as toxic if we actually found categories or score is significant
  const isToxic = categories.length > 0 && maxScore > 0.3;

  // If no categories found, ensure score is low
  const finalScore = categories.length > 0 ? maxScore : Math.min(maxScore, 0.1);

  return {
    isToxic,
    score: finalScore,
    severity: isToxic ? maxSeverity : null,
    categories: [...new Set(categories)], // Remove duplicates
    categoryScores: categoryScores,
    source: "keyword",
  };
};

/**
 * Get AI suggestion for improving potentially toxic content
 * Uses Hugging Face for rephrasing (with CORS proxy) or fallback suggestion
 */
export const getAISuggestion = async (text) => {
  try {
    // First check if it's potentially toxic
    const moderationResult = await moderateContentEnhanced(text);

    // Lower threshold to catch potentially problematic content
    // Show suggestions for any content with score >= 0.25 or is flagged
    if (!moderationResult.isToxic || moderationResult.score < 0.25) {
      console.log("⚠️ Content not toxic enough for suggestion:", {
        isToxic: moderationResult.isToxic,
        score: moderationResult.score,
      });
      return null; // Not toxic enough to suggest
    }

    console.log("🔍 Getting AI suggestion for potentially toxic content:", {
      score: moderationResult.score,
      categories: moderationResult.categories,
      isToxic: moderationResult.isToxic,
    });

    // Try Groq AI for rephrasing (via backend proxy)
    const groqApiKey = process.env.REACT_APP_GROQ_API_KEY;
    if (groqApiKey && groqApiKey !== "" && groqApiKey !== "gsk-your-key-here") {
      try {
        const groqSuggestion = await getGroqRephrase(text, groqApiKey);
        if (groqSuggestion && groqSuggestion.trim().length > 0) {
          console.log("✅ Got Groq AI suggestion:", groqSuggestion);
          return groqSuggestion;
        }
      } catch (error) {
        console.warn("❌ Groq AI rephrasing failed:", error.message);
      }
    }

    // Fallback: Generate a simple suggestion based on categories (always works)
    const fallbackSuggestion = generateSimpleSuggestion(
      text,
      moderationResult.categories
    );
    if (fallbackSuggestion) {
      console.log("✅ Using fallback suggestion");
      return fallbackSuggestion;
    }

    return null;
  } catch (error) {
    console.warn("Could not get AI suggestion:", error.message);
    return null;
  }
};

/**
 * Get rephrasing suggestion from Groq AI
 * Uses Llama models for grammatically correct, polite alternatives
 */
const getGroqRephrase = async (text, apiKey) => {
  try {
    console.log("💡 Calling Groq AI API for:", text.substring(0, 50));

    // Detect if text is in Hindi
    const hasHindi = /[\u0900-\u097F]/.test(text);
    const hasTransliteratedHindi =
      /(bewakoof|chutiya|gadha|madharchod|bhosdike|harami|kutta|kamina|randi|chut|lund|gaand|chodu|bhenchod|behenchod|maa chod|teri maa|bhosda)/i.test(
        text
      );
    const isHindi = hasHindi || hasTransliteratedHindi;

    // Use backend proxy to avoid CORS issues
    const backendUrl =
      process.env.REACT_APP_BACKEND_URL || "http://localhost:3001";
    console.log("🌐 Using backend proxy for Groq AI API call");

    const response = await fetch(`${backendUrl}/api/rephrase`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text,
        apiKey: apiKey,
        isHindi: isHindi,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { error: errorText };
      }
      console.warn("❌ Backend proxy error:", response.status, errorData);
      return null;
    }

    const data = await response.json();
    console.log("✅ Groq AI response received via proxy:", data);

    // Extract rephrased text from Groq response format
    let rephrased = null;
    if (data.generated_text) {
      rephrased = data.generated_text.trim();
    } else if (data.choices && data.choices[0] && data.choices[0].message) {
      rephrased = data.choices[0].message.content.trim();
    }

    console.log("📝 Extracted rephrased text:", rephrased);

    if (rephrased && rephrased.trim().length > 0 && rephrased !== text) {
      console.log("✅ Using Groq AI rephrased suggestion");
      return rephrased;
    }

    // If Groq returned same text or empty, use fallback
    console.warn("⚠️ Groq AI returned invalid/empty response, using fallback");
    return null;
  } catch (error) {
    // If all methods fail, return null to use fallback
    console.warn("❌ Groq AI rephrasing error:", error.message);
    return null;
  }
};

/**
 * Generate a simple fallback suggestion when APIs are unavailable
 * Creates safe, natural-sounding alternatives that retain some meaning
 * Supports Hindi and English
 * Uses varied suggestions to avoid repetition
 */
const generateSimpleSuggestion = (text, categories) => {
  if (!categories || categories.length === 0) {
    return null;
  }

  // Check if text contains Hindi or transliterated Hindi
  const hasHindi = /[\u0900-\u097F]/.test(text); // Devanagari script
  const hasTransliteratedHindi =
    /(bewakoof|chutiya|gadha|madharchod|bhosdike|harami|kutta|kamina|randi|chut|lund|gaand|chodu|bhenchod|behenchod|maa chod|teri maa|bhosda)/i.test(
      text
    );
  const isHindi = hasHindi || hasTransliteratedHindi;

  const lowerText = text.toLowerCase();

  // Multiple varied suggestions for each pattern to avoid repetition
  const englishSuggestions = [
    "I have a different perspective on this.",
    "I see this differently.",
    "I respectfully disagree with this view.",
    "I'd like to offer an alternative perspective.",
    "I think we might have different views on this.",
    "I appreciate your input, but I see it differently.",
  ];

  const hindiSuggestions = [
    "मुझे यह उचित नहीं लगता।",
    "मैं इससे सहमत नहीं हूं।",
    "मुझे लगता है कि हमारे विचार अलग हैं।",
    "कृपया अपने विचारों को अधिक विनम्र तरीके से व्यक्त करें।",
  ];

  // Select a random suggestion to avoid repetition
  const randomIndex = Math.floor(
    Math.random() *
      (isHindi ? hindiSuggestions.length : englishSuggestions.length)
  );
  const baseSuggestion = isHindi
    ? hindiSuggestions[randomIndex]
    : englishSuggestions[randomIndex];

  // Pattern-based context-aware alternatives
  const patternMatches = {
    profanity:
      /(stupid|dumb|idiot|moron|retard|loser|ass|shit|fuck|fucking|damn|bitch)/i.test(
        text
      ),
    hate: /(hate|hate you|hate this|racist|bigot)/i.test(text),
    threat: /(kill|die|hurt|attack|threat)/i.test(text),
    content: /(post|article|blog|content|writing)/i.test(lowerText),
    personal: /(you|your|you're)/i.test(lowerText),
  };

  // Context-aware suggestions
  if (patternMatches.threat) {
    return isHindi
      ? "मुझे इस बारे में चिंता है।"
      : "I have concerns about this approach.";
  }

  if (patternMatches.hate) {
    return isHindi
      ? "मैं इससे सहमत नहीं हूं।"
      : "I don't agree with this viewpoint.";
  }

  if (patternMatches.profanity && patternMatches.content) {
    return isHindi
      ? "मुझे इस विषय पर एक अलग दृष्टिकोण है।"
      : "I have a different view on this topic.";
  }

  if (patternMatches.profanity && patternMatches.personal) {
    return isHindi
      ? "मैं आपसे विनम्रतापूर्वक असहमत हूं।"
      : "I respectfully have a different opinion.";
  }

  if (patternMatches.profanity) {
    return isHindi
      ? "मैं अपने विचार अधिक रचनात्मक तरीके से व्यक्त करना चाहूंगा।"
      : "I'd like to express my thoughts more constructively.";
  }

  // Default varied suggestions
  const words = text.split(/\s+/).filter((w) => w.length > 0);

  if (words.length <= 5) {
    if (patternMatches.content) {
      return isHindi
        ? "मुझे इस विषय पर एक अलग दृष्टिकोण है।"
        : "I have a different view on this topic.";
    }
    return baseSuggestion;
  }

  // For longer comments
  return isHindi
    ? "मैं चाहूंगा कि हम इस पर अधिक सम्मानजनक तरीके से चर्चा करें।"
    : "I'd appreciate it if we could discuss this more respectfully.";
};

/**
 * Get category display name
 */
export const getCategoryDisplayName = (category) => {
  const names = {
    [MODERATION_CATEGORIES.HATE]: "Hate",
    [MODERATION_CATEGORIES.THREAT]: "Threat",
    [MODERATION_CATEGORIES.BULLYING]: "Bullying",
    [MODERATION_CATEGORIES.DISCRIMINATION]: "Discrimination",
    [MODERATION_CATEGORIES.HARASSMENT]: "Harassment",
    [MODERATION_CATEGORIES.PROFANITY]: "Profanity",
    [MODERATION_CATEGORIES.SPAM]: "Spam",
    [MODERATION_CATEGORIES.SELF_HARM]: "Self-Harm",
    [MODERATION_CATEGORIES.SEXUAL]: "Sexual Content",
    [MODERATION_CATEGORIES.VIOLENCE]: "Violence",
  };
  return names[category] || category;
};

/**
 * Get severity color
 */
export const getSeverityColor = (severity) => {
  const colors = {
    [SEVERITY_LEVELS.LOW]: "#fbbf24", // yellow
    [SEVERITY_LEVELS.MEDIUM]: "#f97316", // orange
    [SEVERITY_LEVELS.HIGH]: "#ef4444", // red
  };
  return colors[severity] || "#6b7280";
};
