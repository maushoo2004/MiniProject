/**
 * ToxiFilter multilingual lexicon.
 *
 * Each entry: { term, category, weight, suffixes?, targeted? }
 *  - term      : word or phrase (Latin, Devanagari or Kannada script)
 *  - category  : one of CATEGORIES
 *  - weight    : 0..1 how strongly this term alone signals toxicity
 *  - suffixes  : allow English inflections (idiots, fucking, ...). Default true for
 *                single Latin words, false otherwise.
 *  - targeted  : if true, weight gets a boost when the text is aimed at a person
 *                ("you", "tu", "tera", "ninna" ...). Used for insults that are
 *                mild on their own ("stupid bug") but harsh at someone ("you are stupid").
 *
 * Matching is done on whole words only (see keywordEngine.js), so "hell" never
 * matches "hello", "chut" never matches "parachute", "gand" never matches "Gandhi".
 *
 * Neutral words used when DISCUSSING abuse (racism, caste, discrimination, suicide
 * prevention ...) are deliberately NOT in this list.
 */

const CATEGORIES = {
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

const C = CATEGORIES;

const ENGLISH = [
  // --- Profanity -----------------------------------------------------------
  { term: "fuck", category: C.PROFANITY, weight: 0.7 },
  { term: "fuk", category: C.PROFANITY, weight: 0.65 },
  { term: "motherfucker", category: C.PROFANITY, weight: 0.85 },
  { term: "wtf", category: C.PROFANITY, weight: 0.3 },
  { term: "stfu", category: C.PROFANITY, weight: 0.6 },
  { term: "shit", category: C.PROFANITY, weight: 0.5 },
  { term: "bullshit", category: C.PROFANITY, weight: 0.5 },
  { term: "crap", category: C.PROFANITY, weight: 0.25 },
  { term: "damn", category: C.PROFANITY, weight: 0.15 },
  { term: "piss off", category: C.PROFANITY, weight: 0.55 },
  { term: "bitch", category: C.PROFANITY, weight: 0.75 },
  { term: "asshole", category: C.PROFANITY, weight: 0.8 },
  { term: "bastard", category: C.PROFANITY, weight: 0.7 },
  { term: "dickhead", category: C.PROFANITY, weight: 0.75 },
  { term: "slut", category: C.PROFANITY, weight: 0.8 },
  { term: "whore", category: C.PROFANITY, weight: 0.8 },
  { term: "cunt", category: C.PROFANITY, weight: 0.9 },

  // --- Insults / bullying (targeted gets a boost) ----------------------------
  { term: "idiot", category: C.BULLYING, weight: 0.55, targeted: true },
  { term: "stupid", category: C.BULLYING, weight: 0.4, targeted: true },
  { term: "dumb", category: C.BULLYING, weight: 0.4, targeted: true },
  { term: "moron", category: C.BULLYING, weight: 0.6, targeted: true },
  { term: "imbecile", category: C.BULLYING, weight: 0.6, targeted: true },
  { term: "loser", category: C.BULLYING, weight: 0.45, targeted: true },
  { term: "worthless", category: C.BULLYING, weight: 0.45, targeted: true },
  { term: "pathetic", category: C.BULLYING, weight: 0.4, targeted: true },
  { term: "useless", category: C.BULLYING, weight: 0.3, targeted: true },
  { term: "fool", category: C.BULLYING, weight: 0.35, targeted: true },
  { term: "clown", category: C.BULLYING, weight: 0.3, targeted: true },
  { term: "ugly", category: C.BULLYING, weight: 0.35, targeted: true },
  { term: "fatso", category: C.BULLYING, weight: 0.6 },
  { term: "nobody likes you", category: C.BULLYING, weight: 0.7 },
  { term: "shut up", category: C.BULLYING, weight: 0.4 },
  { term: "go to hell", category: C.BULLYING, weight: 0.6 },
  { term: "get lost", category: C.BULLYING, weight: 0.35, targeted: true },
  // Below the 0.5 threshold on their own ("take out the trash"); only flag when aimed at someone
  { term: "garbage", category: C.BULLYING, weight: 0.35, targeted: true },
  { term: "trash", category: C.BULLYING, weight: 0.35, targeted: true },

  // --- Hate / discrimination (slurs & hostile phrases, not neutral topics) ---
  { term: "i hate you", category: C.HATE, weight: 0.75 },
  { term: "hate you", category: C.HATE, weight: 0.7 },
  { term: "hate", category: C.HATE, weight: 0.25 },
  { term: "retard", category: C.DISCRIMINATION, weight: 0.8 },
  { term: "faggot", category: C.DISCRIMINATION, weight: 0.95 },
  { term: "fag", category: C.DISCRIMINATION, weight: 0.85, suffixes: false },
  { term: "nigger", category: C.DISCRIMINATION, weight: 0.98 },
  { term: "nigga", category: C.DISCRIMINATION, weight: 0.8 },
  { term: "tranny", category: C.DISCRIMINATION, weight: 0.85 },
  { term: "go back to your country", category: C.DISCRIMINATION, weight: 0.8 },
  { term: "your kind", category: C.DISCRIMINATION, weight: 0.4 },

  // --- Threats (phrases aimed at a person) -----------------------------------
  { term: "kill you", category: C.THREAT, weight: 0.9 },
  { term: "kill u", category: C.THREAT, weight: 0.9 },
  { term: "i will kill", category: C.THREAT, weight: 0.9 },
  { term: "i'll kill", category: C.THREAT, weight: 0.9 },
  { term: "gonna kill", category: C.THREAT, weight: 0.85 },
  { term: "going to kill", category: C.THREAT, weight: 0.85 },
  { term: "kill yourself", category: C.THREAT, weight: 0.95 },
  { term: "kys", category: C.THREAT, weight: 0.85, suffixes: false },
  { term: "hope you die", category: C.THREAT, weight: 0.9 },
  { term: "you should die", category: C.THREAT, weight: 0.9 },
  { term: "go die", category: C.THREAT, weight: 0.85 },
  { term: "i will hurt you", category: C.THREAT, weight: 0.85 },
  { term: "beat you up", category: C.THREAT, weight: 0.8 },
  { term: "shoot you", category: C.THREAT, weight: 0.9 },
  { term: "stab you", category: C.THREAT, weight: 0.9 },
  { term: "find where you live", category: C.THREAT, weight: 0.85 },
  { term: "watch your back", category: C.THREAT, weight: 0.6 },

  // --- Violence (single words are weak on purpose: "kill time", "fight bugs") -
  { term: "kill", category: C.VIOLENCE, weight: 0.2 },
  { term: "murder", category: C.VIOLENCE, weight: 0.35 },
  { term: "stab", category: C.VIOLENCE, weight: 0.3 },
  { term: "torture", category: C.VIOLENCE, weight: 0.35 },
  { term: "bomb", category: C.VIOLENCE, weight: 0.25 },

  // --- Harassment ------------------------------------------------------------
  { term: "pervert", category: C.HARASSMENT, weight: 0.65, targeted: true },
  { term: "creep", category: C.HARASSMENT, weight: 0.4, targeted: true },
  { term: "stalk you", category: C.HARASSMENT, weight: 0.8 },
  { term: "send nudes", category: C.HARASSMENT, weight: 0.85 },

  // --- Sexual ----------------------------------------------------------------
  { term: "porn", category: C.SEXUAL, weight: 0.55 },
  { term: "nude", category: C.SEXUAL, weight: 0.35 },
  { term: "rape", category: C.SEXUAL, weight: 0.8 },
  { term: "pedo", category: C.SEXUAL, weight: 0.75 },
  { term: "pedophile", category: C.SEXUAL, weight: 0.75 },
  { term: "dick", category: C.SEXUAL, weight: 0.5, suffixes: false },
  { term: "pussy", category: C.SEXUAL, weight: 0.6 },
  { term: "horny", category: C.SEXUAL, weight: 0.45 },

  // --- Self-harm (handled with care: user is shown support, not punished) ----
  { term: "kill myself", category: C.SELF_HARM, weight: 0.9 },
  { term: "end my life", category: C.SELF_HARM, weight: 0.9 },
  { term: "want to die", category: C.SELF_HARM, weight: 0.85 },
  { term: "wish i was dead", category: C.SELF_HARM, weight: 0.85 },
  { term: "hurt myself", category: C.SELF_HARM, weight: 0.8 },
  { term: "cut myself", category: C.SELF_HARM, weight: 0.85 },

  // --- Spam ------------------------------------------------------------------
  { term: "click here", category: C.SPAM, weight: 0.45 },
  { term: "buy now", category: C.SPAM, weight: 0.45 },
  { term: "free money", category: C.SPAM, weight: 0.6 },
  { term: "make money fast", category: C.SPAM, weight: 0.65 },
  { term: "earn from home", category: C.SPAM, weight: 0.55 },
  { term: "work from home and earn", category: C.SPAM, weight: 0.6 },
  { term: "dm me for", category: C.SPAM, weight: 0.45 },
  { term: "whatsapp me", category: C.SPAM, weight: 0.5 },
  { term: "limited offer", category: C.SPAM, weight: 0.45 },
  { term: "crypto giveaway", category: C.SPAM, weight: 0.7 },
];

// Hindi written in Latin letters (Hinglish)
const HINGLISH = [
  { term: "chutiya", category: C.PROFANITY, weight: 0.85 },
  { term: "chutiye", category: C.PROFANITY, weight: 0.85 },
  { term: "chutia", category: C.PROFANITY, weight: 0.85 },
  { term: "chut", category: C.SEXUAL, weight: 0.75 },
  { term: "madarchod", category: C.PROFANITY, weight: 0.95 },
  { term: "madharchod", category: C.PROFANITY, weight: 0.95 },
  { term: "maderchod", category: C.PROFANITY, weight: 0.95 },
  { term: "behenchod", category: C.PROFANITY, weight: 0.95 },
  { term: "bhenchod", category: C.PROFANITY, weight: 0.95 },
  { term: "bhencho", category: C.PROFANITY, weight: 0.9 },
  { term: "bhosdike", category: C.PROFANITY, weight: 0.9 },
  { term: "bhosadike", category: C.PROFANITY, weight: 0.9 },
  { term: "bhosdi", category: C.PROFANITY, weight: 0.85 },
  { term: "bhosda", category: C.PROFANITY, weight: 0.85 },
  { term: "bsdk", category: C.PROFANITY, weight: 0.85 },
  { term: "randi", category: C.PROFANITY, weight: 0.85 },
  { term: "lund", category: C.SEXUAL, weight: 0.8 },
  { term: "loda", category: C.SEXUAL, weight: 0.75 },
  { term: "lauda", category: C.SEXUAL, weight: 0.8 },
  { term: "lavda", category: C.SEXUAL, weight: 0.8 },
  { term: "gaand", category: C.PROFANITY, weight: 0.7 },
  { term: "gandu", category: C.PROFANITY, weight: 0.8 },
  { term: "jhant", category: C.PROFANITY, weight: 0.6 },
  { term: "harami", category: C.PROFANITY, weight: 0.7 },
  { term: "haramkhor", category: C.PROFANITY, weight: 0.75 },
  { term: "kamina", category: C.BULLYING, weight: 0.55, targeted: true },
  { term: "kamine", category: C.BULLYING, weight: 0.55, targeted: true },
  { term: "kameena", category: C.BULLYING, weight: 0.55, targeted: true },
  { term: "kutta", category: C.BULLYING, weight: 0.4, targeted: true },
  { term: "kutte", category: C.BULLYING, weight: 0.5, targeted: true },
  { term: "kutiya", category: C.BULLYING, weight: 0.7 },
  { term: "bewakoof", category: C.BULLYING, weight: 0.4, targeted: true },
  { term: "bevkoof", category: C.BULLYING, weight: 0.4, targeted: true },
  { term: "gadha", category: C.BULLYING, weight: 0.4, targeted: true },
  { term: "gadhe", category: C.BULLYING, weight: 0.4, targeted: true },
  { term: "ullu ka pattha", category: C.BULLYING, weight: 0.55 },
  { term: "nalayak", category: C.BULLYING, weight: 0.4, targeted: true },
  { term: "saala", category: C.BULLYING, weight: 0.3, targeted: true },
  { term: "kaminey", category: C.BULLYING, weight: 0.55, targeted: true },
  { term: "teri maa ki", category: C.PROFANITY, weight: 0.85 },
  { term: "teri maa", category: C.PROFANITY, weight: 0.6 },
  { term: "teri behen", category: C.PROFANITY, weight: 0.65 },
  { term: "maar dunga", category: C.THREAT, weight: 0.85 },
  { term: "maar doonga", category: C.THREAT, weight: 0.85 },
  { term: "jaan se maar", category: C.THREAT, weight: 0.95 },
  { term: "tujhe maar", category: C.THREAT, weight: 0.85 },
  { term: "khatam kar dunga", category: C.THREAT, weight: 0.85 },
  { term: "mar ja", category: C.THREAT, weight: 0.75 },
];

// Hindi in Devanagari script
const DEVANAGARI = [
  { term: "चूतिया", category: C.PROFANITY, weight: 0.85 },
  { term: "चुतिया", category: C.PROFANITY, weight: 0.85 },
  { term: "मादरचोद", category: C.PROFANITY, weight: 0.95 },
  { term: "बहनचोद", category: C.PROFANITY, weight: 0.95 },
  { term: "भेनचोद", category: C.PROFANITY, weight: 0.95 },
  { term: "भोसडीके", category: C.PROFANITY, weight: 0.9 },
  { term: "भोसड़ीके", category: C.PROFANITY, weight: 0.9 },
  { term: "भोसड़ा", category: C.PROFANITY, weight: 0.85 },
  { term: "रंडी", category: C.PROFANITY, weight: 0.85 },
  { term: "लंड", category: C.SEXUAL, weight: 0.8 },
  { term: "लौड़ा", category: C.SEXUAL, weight: 0.8 },
  { term: "गांड", category: C.PROFANITY, weight: 0.7 },
  { term: "गांडू", category: C.PROFANITY, weight: 0.8 },
  { term: "हरामी", category: C.PROFANITY, weight: 0.7 },
  { term: "हरामखोर", category: C.PROFANITY, weight: 0.75 },
  { term: "कमीना", category: C.BULLYING, weight: 0.55, targeted: true },
  { term: "कमीने", category: C.BULLYING, weight: 0.55, targeted: true },
  { term: "कुत्ते", category: C.BULLYING, weight: 0.5, targeted: true },
  { term: "कुतिया", category: C.BULLYING, weight: 0.7 },
  { term: "गधा", category: C.BULLYING, weight: 0.4, targeted: true },
  { term: "गधे", category: C.BULLYING, weight: 0.4, targeted: true },
  { term: "बेवकूफ", category: C.BULLYING, weight: 0.4, targeted: true },
  { term: "बेवकूफ़", category: C.BULLYING, weight: 0.4, targeted: true },
  { term: "नालायक", category: C.BULLYING, weight: 0.4, targeted: true },
  { term: "तेरी माँ की", category: C.PROFANITY, weight: 0.85 },
  { term: "तेरी मां की", category: C.PROFANITY, weight: 0.85 },
  { term: "मार दूंगा", category: C.THREAT, weight: 0.85 },
  { term: "मार दूँगा", category: C.THREAT, weight: 0.85 },
  { term: "जान से मार", category: C.THREAT, weight: 0.95 },
  { term: "मर जा", category: C.THREAT, weight: 0.75 },
];

// Kannada (script + Kanglish). Small starter set — extend as needed.
const KANNADA = [
  { term: "ಸೂಳೆ", category: C.PROFANITY, weight: 0.85 },
  { term: "ಸೂಳೆಮಗ", category: C.PROFANITY, weight: 0.9 },
  { term: "ಬೋಳಿಮಗ", category: C.PROFANITY, weight: 0.85 },
  { term: "ಬೋಳಿ ಮಗ", category: C.PROFANITY, weight: 0.85 },
  { term: "sule", category: C.PROFANITY, weight: 0.6, suffixes: false },
  { term: "sulemaga", category: C.PROFANITY, weight: 0.9 },
  { term: "sule maga", category: C.PROFANITY, weight: 0.9 },
  { term: "bolimaga", category: C.PROFANITY, weight: 0.85 },
  { term: "boli maga", category: C.PROFANITY, weight: 0.85 },
  { term: "nin amman", category: C.PROFANITY, weight: 0.75 },
  { term: "ninn amman", category: C.PROFANITY, weight: 0.75 },
  // "fool": mild alone (0.45), flagged when aimed at someone ("ನೀನು ಮೂರ್ಖ", "neenu moorkha")
  { term: "ಮೂರ್ಖ", category: C.BULLYING, weight: 0.45, targeted: true },
  { term: "moorkha", category: C.BULLYING, weight: 0.45, targeted: true },
];

// Words that make an insult "targeted" at a person
const SECOND_PERSON = [
  "you", "your", "you're", "youre", "u", "ur", "yourself",
  "tu", "tum", "tera", "teri", "tere", "tujhe", "tumhara", "aap",
  "तू", "तुम", "तेरा", "तेरी", "तेरे", "तुझे", "आप",
  "ninna", "neenu", "nin", "ನೀನು", "ನಿನ್ನ",
];

const LEXICON = [...ENGLISH, ...HINGLISH, ...DEVANAGARI, ...KANNADA];

const HINGLISH_TERMS = new Set(HINGLISH.map((e) => e.term));

module.exports = { CATEGORIES, LEXICON, SECOND_PERSON, HINGLISH_TERMS };
