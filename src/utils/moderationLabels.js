// Display helpers for moderation results (the actual moderation runs on the server).

export const CATEGORY_INFO = {
  hate: { label: "Hate", color: "#dc2626" },
  threat: { label: "Threat", color: "#b91c1c" },
  bullying: { label: "Bullying / Insult", color: "#ea580c" },
  discrimination: { label: "Discrimination", color: "#c2410c" },
  harassment: { label: "Harassment", color: "#d97706" },
  profanity: { label: "Profanity", color: "#f59e0b" },
  spam: { label: "Spam", color: "#84cc16" },
  self_harm: { label: "Self-harm", color: "#6366f1" },
  sexual: { label: "Sexual", color: "#ec4899" },
  violence: { label: "Violence", color: "#991b1b" },
};

export const getCategoryDisplayName = (c) => CATEGORY_INFO[c]?.label || c;
export const getCategoryColor = (c) => CATEGORY_INFO[c]?.color || "#6b7280";

export const SEVERITY_COLORS = { low: "#84cc16", medium: "#f59e0b", high: "#dc2626" };
export const getSeverityColor = (s) => SEVERITY_COLORS[s] || "#6b7280";

export const SOURCE_LABELS = {
  keyword: "🔍 Multilingual keyword engine",
  custom: "🧠 ToxiFilter ML (our model)",
  // Old comments stored before v2.1 may still carry these sources; they are no longer produced.
  huggingface: "AI model (legacy)",
  openai: "AI model (legacy)",
};
export const getSourceLabel = (s) => SOURCE_LABELS[s] || s || "—";

export const formatScore = (s) => (s == null ? "—" : `${(Number(s) * 100).toFixed(1)}%`);

// Meter colours: green below 30%, amber below 60%, red from 60% up
export const SCORE_COLORS = { low: "#10b981", mid: "#f59e0b", high: "#ef4444" };
export const getScoreLevel = (score) => {
  const s = Number(score) || 0;
  if (s < 0.3) return "low";
  if (s < 0.6) return "mid";
  return "high";
};
export const getScoreColor = (score) => SCORE_COLORS[getScoreLevel(score)];
