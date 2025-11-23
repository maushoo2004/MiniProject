/**
 * Content Moderation Service
 *
 * This service uses OpenAI's Moderation API for toxicity detection.
 *
 * Why OpenAI Moderation API?
 * - Simple setup: Just need an API key
 * - Supports multiple languages including Hindi and English
 * - Free tier available
 * - Easy to use: Single API call
 *
 * To get your API key:
 * 1. Go to https://platform.openai.com/
 * 2. Sign up or log in
 * 3. Go to API Keys section: https://platform.openai.com/api-keys
 * 4. Create a new API key
 * 5. Add it to your .env file as REACT_APP_OPENAI_API_KEY
 *
 * Free tier: $5 free credit when you sign up
 */

const OPENAI_MODERATION_URL = "https://api.openai.com/v1/moderations";

// Log API key status on module load (for debugging)
if (typeof window !== "undefined") {
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
  if (apiKey && apiKey !== "" && apiKey !== "sk-your-key-here") {
    console.log("✅ OpenAI API key is configured");
  } else {
    console.warn(
      "⚠️ OpenAI API key is NOT configured. Set REACT_APP_OPENAI_API_KEY in .env file"
    );
  }
}

/**
 * Moderates content using OpenAI Moderation API
 * Supports Hindi, English, and many other languages
 *
 * @param {string} text - The text to moderate (can be in Hindi, English, or mixed)
 * @returns {Promise<{isToxic: boolean, score: number, categories: object}>}
 */
export const moderateContent = async (text) => {
  // Check if API key is set
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;

  if (!apiKey || apiKey === "" || apiKey === "sk-your-key-here") {
    console.warn(
      "⚠️ OpenAI API key not set or using placeholder. Using fallback moderation."
    );
    console.warn("Please set REACT_APP_OPENAI_API_KEY in your .env file");
    return fallbackModeration(text);
  }

  console.log(
    "🔍 Calling OpenAI Moderation API for text:",
    text.substring(0, 50) + "..."
  );

  // Retry logic for rate limits
  const maxRetries = 2;
  let retryCount = 0;

  while (retryCount <= maxRetries) {
    try {
      const response = await fetch(OPENAI_MODERATION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          input: text,
        }),
      });

      // Handle rate limiting (429) with retry
      if (response.status === 429) {
        if (retryCount < maxRetries) {
          const retryAfter = response.headers.get("Retry-After");
          const waitTime = retryAfter 
            ? parseInt(retryAfter) * 1000 
            : Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
          
          console.warn(
            `⚠️ Rate limit hit (429). Retrying in ${waitTime / 1000} seconds... (Attempt ${retryCount + 1}/${maxRetries + 1})`
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          retryCount++;
          continue;
        } else {
          console.error("❌ Rate limit exceeded. Max retries reached. Using fallback moderation.");
          console.warn("💡 Tip: Wait a few minutes before trying again, or upgrade your OpenAI plan for higher rate limits.");
          return fallbackModeration(text);
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error?.message ||
          `HTTP ${response.status}: ${response.statusText}`;
        console.error("❌ OpenAI API Error:", errorMessage);
        console.error("Full error:", errorData);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log("✅ OpenAI API Response:", data);

      if (!data.results || data.results.length === 0) {
        console.warn("⚠️ No results from OpenAI API");
        return fallbackModeration(text);
      }

      const result = data.results[0];

      // Check if content is flagged
      const isToxic = result.flagged === true;

      // Get the highest category score as overall toxicity score
      const categoryScores = result.category_scores || {};
      const scores = Object.values(categoryScores);
      const maxScore = scores.length > 0 ? Math.max(...scores) : 0;

      console.log("📊 Moderation Result:", {
        flagged: isToxic,
        maxScore: maxScore,
        categories: result.categories,
      });

      return {
        isToxic,
        score: maxScore,
        categories: result.categories || {},
        categoryScores: categoryScores,
      };
    } catch (error) {
      // If it's not a rate limit error, or we've exhausted retries, use fallback
      if (!error.message.includes("Too Many Requests") || retryCount >= maxRetries) {
        console.error("❌ Error calling OpenAI Moderation API:", error);
        console.error("Error details:", {
          message: error.message,
        });
        
        if (error.message.includes("Too Many Requests") || error.message.includes("Rate limit")) {
          console.warn("⚠️ Rate limit exceeded. Using fallback moderation.");
          console.warn("💡 The fallback will catch common profanity, but may miss some edge cases.");
        } else {
          console.warn("⚠️ Falling back to keyword-based moderation");
        }
        
        return fallbackModeration(text);
      }
      
      // If it's a rate limit and we can retry, continue the loop
      retryCount++;
    }
  }

  // Should never reach here, but just in case
  return fallbackModeration(text);
};

/**
 * Fallback moderation using simple keyword detection
 * Works for both English and common Hindi toxic words
 */
const fallbackModeration = (text) => {
  const lowerText = text.toLowerCase();

  // English toxic keywords (expanded list)
  const englishToxicKeywords = [
    "hate",
    "stupid",
    "idiot",
    "dumb",
    "kill",
    "die",
    "fool",
    "moron",
    "retard",
    "loser",
    "worthless",
    "useless",
    "fuck",
    "fucking",
    "shit",
    "damn",
    "bitch",
    "asshole",
    "bastard",
    "crap",
    "hell",
    "piss",
    "crap",
    "screw",
    "suck",
    "sucks",
  ];

  // Hindi toxic keywords (transliterated)
  const hindiToxicKeywords = [
    "bewakoof",
    "chutiya",
    "gadha",
    "madharchod",
    "bhosdike",
    "harami",
    "kutta",
    "kamina",
  ];

  const allToxicKeywords = [...englishToxicKeywords, ...hindiToxicKeywords];

  const hasToxicKeywords = allToxicKeywords.some((keyword) =>
    lowerText.includes(keyword)
  );

  if (hasToxicKeywords) {
    return {
      isToxic: true,
      score: 0.8,
      categories: {},
      categoryScores: {},
    };
  }

  return {
    isToxic: false,
    score: 0.1,
    categories: {},
    categoryScores: {},
  };
};

/**
 * Quick setup instructions:
 *
 * 1. Get OpenAI API Key:
 *    - Visit: https://platform.openai.com/api-keys
 *    - Sign up/login (free $5 credit)
 *    - Create new API key
 *
 * 2. Add to .env file:
 *    REACT_APP_OPENAI_API_KEY=sk-your-key-here
 *
 * 3. Restart your dev server
 *
 * That's it! The API automatically detects and moderates content in
 * Hindi, English, and many other languages.
 */
