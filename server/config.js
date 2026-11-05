/**
 * Server configuration. Loaded from the project-root .env file.
 * Secret keys here must NEVER be prefixed with REACT_APP_ (that would ship them to the browser).
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const clean = (v) => {
  const s = (v || "").trim();
  // ignore the placeholder values from .env.example
  if (!s || /your[-_]|xxxx|placeholder/i.test(s)) return "";
  return s;
};

const list = (v, fallback) =>
  (v || fallback)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

module.exports = {
  port: Number(process.env.API_PORT || (process.env.NODE_ENV === "production" && process.env.PORT) || 3001),
  nodeEnv: process.env.NODE_ENV || "development",

  supabaseUrl: clean(process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL),
  supabaseServiceRoleKey: clean(process.env.SUPABASE_SERVICE_ROLE_KEY),

  // Our own trained ML model (ml/serve.py). Optional: without it only the keyword engine runs.
  mlServiceUrl: clean(process.env.ML_SERVICE_URL).replace(/\/+$/, ""),
  // The ML call is optional, so it must never slow comments down: give up quickly and use the keyword engine
  mlTimeoutMs: Number(process.env.ML_TIMEOUT_MS || 1500),

  // Groq LLM, used only to write polite rewrites
  groqApiKey: clean(process.env.GROQ_API_KEY),
  groqModels: list(process.env.GROQ_MODELS, "openai/gpt-oss-20b,openai/gpt-oss-120b"),

  // Order in which ML providers are tried. The keyword engine always runs too.
  providerOrder: list(process.env.MODERATION_PROVIDERS, "custom"),
  providerTimeoutMs: Number(process.env.PROVIDER_TIMEOUT_MS || 8000),

  // A user is blocked from commenting once report_count reaches this number
  blockThreshold: Number(process.env.BLOCK_THRESHOLD || process.env.REACT_APP_BLOCK_THRESHOLD || 3),
  maxCommentLength: 2000,

  corsOrigins: list(process.env.CORS_ORIGINS, "http://localhost:3000"),
};
