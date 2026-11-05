const config = require("./config");
const { createApp } = require("./app");

const app = createApp();

app.listen(config.port, () => {
  const on = (b) => (b ? "✅" : "—");
  console.log(`\n🛡️  ToxiFilter API running on http://localhost:${config.port}`);
  console.log(`   Supabase (service role): ${on(config.supabaseUrl && config.supabaseServiceRoleKey)}`);
  console.log(`   Keyword engine: ✅ (always on)   ToxiFilter ML: ${on(config.mlServiceUrl)}   Groq rewrites: ${on(config.groqApiKey)}`);
  console.log(`   Block threshold: ${config.blockThreshold} reports\n`);
  if (!config.supabaseServiceRoleKey) {
    console.warn("⚠️  SUPABASE_SERVICE_ROLE_KEY missing — commenting/reporting endpoints will return 503.\n");
  }
});
