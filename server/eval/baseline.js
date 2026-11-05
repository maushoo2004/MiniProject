/**
 * BASELINE: the ORIGINAL v1 keyword moderator (substring matching), copied verbatim
 * from the old src/services/enhancedModerationService.js. Used only by evaluate.js
 * to compare old vs new accuracy. Do not use in the app.
 */
const MODERATION_CATEGORIES = {
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
const SEVERITY_LEVELS = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
};

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


module.exports = { enhancedKeywordModeration };
