# v2.0: what changed from the mini project (v1)

## Security fixes
- **API keys moved to the server.** v1 put its moderation and rewrite API keys in `REACT_APP_*` variables, which CRA bundles into the public JavaScript. Secrets are now server-only.
- **Moderation can't be skipped.** v1 moderated in the browser and then inserted the comment directly into Supabase, so anyone could call Supabase with `is_flagged: false`. Now only the server can insert comments (no INSERT policy for clients).
- **Report counts are tamper-proof.** v1's `FIX_REPORT_COUNT.sql` added a policy letting *any* logged-in user update *any* profile, including resetting their own `report_count`. Counts are now changed only by a DB trigger on new reports.
- **Emails are private.** v1 exposed every user's email to anyone (`profiles` readable with all columns). Column privileges now hide `email`.
- Rate limiting on the moderation and write endpoints.

## Bug fixes
- Click-to-browse cover image upload was broken (`onChange` received the event, not the file).
- Cover images never showed on the home page (`image_url` dropped when mapping posts).
- `posts.image_url` column and the `blog-images` bucket were missing from the setup SQL.
- The auto-report inserted a `reason` column that didn't exist, so it silently failed. It was also a self-report.
- "Report User" could never appear: flagged comments were filtered out before the button's condition could be true.
- Analytics read `comment.source` instead of `moderation_source`.
- The block threshold was inconsistent (`> 3` in one place, `>= 3` and "limit 3" in others).
- All three Groq models in v1 had been shut down, so rewrites always fell back.
- Post content lost its line breaks.
- The app showed a white screen if `.env` was missing; it now shows a setup screen.
- The AI suggestion re-ran moderation, doubling the API calls.

## Moderation engine (rewritten)
- Whole-word Unicode matching. v1's substring matching flagged *hello, skill, Gandhi, whatever, class, Essex, shell, parachute*.
- Topic words (*caste, racism, discrimination, suicide prevention*) are no longer flagged.
- Leetspeak and masking: `f*ck`, `sh1t`, `a$$hole`, `fuuuck`, `f.u.c.k`.
- Weighted lexicon with an "aimed at you" boost (*"this bug is stupid"* ✓, *"you are stupid"* ✗).
- Hindi (Devanagari), Hinglish and **Kannada** support.
- Keyword engine + ML score merged, so one signal can't hide what the other catches. v1 trusted a single English-only model.
- Explainable output: matched words, category, severity, score.
- Self-harm → support message (Tele-MANAS 14416) instead of a penalty.
- LLM rewrites keep the user's point and are re-checked before being shown.

## New features
- Edit and delete posts; delete comments (own, post author, admin).
- Admin dashboard: totals, category/severity charts, reported users, report history, unblock, delete.
- Analytics: category and severity breakdowns, report from the dashboard.
- Post search; live platform stats replace the hard-coded "99.2% accuracy / <50ms" claims.
- Posts are checked by ToxiFilter before publishing.
- One-command production deploy (Node serves the React build).

## Engineering
- One idempotent `supabase/schema.sql` (also upgrades v1 databases). Tested on PostgreSQL 16.
- 20 automated tests (`npm run test:server`).
- Evaluation script comparing v1 and v2 (`npm run eval`).
- `.env.example`, setup guide, demo script.

# After v2.0

- **Redesign.** New design tokens (dark, purple and pink), Inter and Space Grotesk fonts, a slim sticky navbar with an account menu, a footer, and a new home page with a live ToxiFilter demo, platform stats and a "how it works" section.
- **ToxiFilter Lab** (`/lab`). A public page to try any text, with per-category scores, the ML model's probability, which provider decided, language examples, and a **Model performance** section that reads the real training results (`GET /api/ml/performance`).
- **Our own ML model** (`ml/`). Trained on 10,660 public English, Hinglish, Hindi and Kannada comments (TF-IDF + logistic regression), served over HTTP, merged with the keyword engine, and evaluated in `docs/EVALUATION.md`. `npm run dev` starts it with the API and the web app.
- **Live typing meter** under the comment box, and a higher rate limit on `/api/moderate` (60 per minute).
- **Polish.** Loading skeletons (home, post, analytics, admin), empty states with a call to action, a proper 404 page, and themed toasts that slide in from the bottom-right.
- **Keyword lexicon.** Added Kannada "ಮೂರ್ಖ" / "moorkha" and English "garbage" / "trash" as insults that only count when aimed at someone.
- **Third-party moderation models removed.** Hugging Face and OpenAI are no longer used. Moderation is now the multilingual keyword engine plus our own trained ML model (optional, via `ML_SERVICE_URL`); Groq is used only for polite rewrites. Comments already stored with the old `huggingface` / `openai` source are shown as "AI model (legacy)".