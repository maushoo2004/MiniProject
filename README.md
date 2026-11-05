# BlogX × ToxiFilter

**A blogging platform protected by ToxiFilter: a multilingual, AI-assisted comment moderation system that warns, suggests a polite rewrite, and holds repeat offenders accountable.**

Built with React, Node.js/Express, Supabase (PostgreSQL + Auth + Storage + Realtime), our own trained ML model (Python / scikit-learn) and a Groq-hosted LLM for polite rewrites.

---

## What it does

| | |
|---|---|
| ✍️ **Blogging** | Sign up, write posts with cover images, edit/delete your posts, search, live updates |
| 🛡️ **ToxiFilter moderation** | Every comment is checked on the server before it's saved |
| 🌐 **Multilingual** | English, Hindi (Devanagari), Hinglish and Kannada, including disguised spellings (`f*ck`, `sh1t`, `a$$hole`, `fuuuck`) |
| ✨ **AI rewrite** | Flagged comments get a polite rewrite (Groq LLM) that keeps the user's actual point |
| 🔎 **Explainable** | Users see the category, severity, score and which words triggered the flag |
| 🧠 **Our own ML model** | A classifier we trained (TF-IDF + logistic regression) on 10,660 public English, Hinglish, Hindi and Kannada comments, served by a small Python service next to the keyword engine |
| 🧪 **ToxiFilter Lab** | A public page to try any text: per-category scores, highlighted words, the ML model's probability, which provider decided, plus the measured **model performance** (F1, cross-validation, per-language chart, keyword-vs-ML table) read from the real training results |
| ⌨️ **Live typing meter** | While you type a comment, a thin bar shows whether it looks respectful or likely to be flagged |
| 🚨 **Accountability** | Posting a flagged comment anyway hides it and files an automatic report; authors can report commenters; at N reports a user is blocked |
| 💙 **Self-harm aware** | Self-harm messages are not punished; the user is shown a helpline (Tele-MANAS 14416) |
| 📊 **Author analytics** | Comments, flagged content, category and severity breakdowns, report from dashboard |
| 🧑‍⚖️ **Admin dashboard** | Platform totals, reported/blocked users, report history, delete flagged comments, unblock users |
| 🔐 **Secure by design** | API keys only on the server; DB rules stop clients from inserting comments, editing report counts or reading emails |

## Architecture

```
 Browser (React SPA)                    Node.js / Express  (server/)                 External
 ───────────────────                    ───────────────────────────                  ────────
 Read posts/comments ─── Supabase JS ──►  Supabase (Postgres + RLS) ◄── service role ──┐
                                                                                        │
 POST /api/comments ───────────────────► verify JWT → check block status               │
                                          → moderate():                                │
                                              1. keyword engine (always, offline)      │
                                              2. ToxiFilter ML (optional) ─────────────┼─► ml/serve.py  (FastAPI :8000,
                                                 POST /predict                         │   our own scikit-learn model)
                                              3. merge scores & categories             │
                                          → toxic & not confirmed? 422 + rewrite ──────┼─► Groq LLM (rewrites only)
                                          → save comment (flagged or not) ─────────────┘
                                          → flagged? insert report → DB trigger bumps report_count
```

Why the server matters: in v1 the moderation ran in the browser and the API keys were bundled into the JavaScript, so anyone could read the keys or insert comments directly. Now the database only accepts comment and report inserts from the server.

### Moderation pipeline

1. **Keyword engine** (`server/moderation/keywordEngine.js`) runs on every comment: whole-word, Unicode-aware matching over a weighted lexicon (`lexicon.js`) with leetspeak/masking tolerance, a "targeted at you" boost for insults, noisy-OR scoring per category, and severity levels.
2. **ToxiFilter ML** (optional): our own classifier trained in `ml/` (character + word n-grams, logistic regression), served over HTTP and enabled by setting `ML_SERVICE_URL`. If the service is down, moderation carries on with the keyword engine alone.
3. **Merge**: the stronger signal wins. The keyword engine knows Hindi, Hinglish and Kannada words the model may never have seen; the model can catch abuse that isn't on the word list.
4. **Rewrite**: Groq LLM, re-checked by the keyword engine. Offline fallback strips the offensive words or uses a template.

Categories: hate, threat, bullying, discrimination, harassment, profanity, sexual, violence, spam, self-harm.

## Quick start

```bash
npm install
cp .env.example .env        # fill in Supabase keys (see docs/SETUP.md)
# run supabase/schema.sql in the Supabase SQL editor
npm run dev                 # starts API on :3001, React on :3000 and (if trained) the ML service on :8000
```

Full step-by-step guide: **[docs/SETUP.md](docs/SETUP.md)**

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | API + React + ML service together (the ML service is skipped with a clear message if Python or the trained model is missing) |
| `npm run server` | API server only |
| `npm run ml` | ML service only (`ml/serve.py`); see [ml/README.md](ml/README.md) |
| `npm start` | React dev server only |
| `npm run build` | Production build of the frontend |
| `npm run serve` | Build, then serve the whole app from the Node server (one process, for deployment) |
| `npm run test:server` | 35 automated tests (keyword engine, API flow, ML provider) |
| `npm run eval` | Accuracy report: v1 vs v2 engine on a labelled dataset (`-- --full` adds the ML model and the full pipeline) |
| `npm run eval:heldout` | Keyword engine vs ML vs both on the held-out split of the real training data |

## Evaluation

`npm run eval` scores the original v1 matcher against the new engine on `server/eval/dataset.json` (64 comments; English, Hinglish, Hindi, Kannada; including "trap" sentences like *"Gandhi"*, *"skill"*, *"I hate Mondays"*, *"caste discrimination awareness"*).

| Engine | Accuracy | Precision | Recall | F1 | False alarms |
|---|---|---|---|---|---|
| v1 substring matcher | 53.1% | 55.0% | 64.7% | 59.5% | 18 |
| v2 keyword engine | 100%* | 100%* | 100%* | 100%* | 0 |

\* The v2 lexicon was tuned on this set, so these numbers are optimistic (see below for honest numbers).

### On real data (ToxiFilter ML)

The ML model is trained on 10,660 public comments in English, Hinglish, Hindi and Kannada (see [docs/EVALUATION.md](docs/EVALUATION.md) for sources, licences and limits). On the 2,132 held-out comments that neither the model nor the lexicon was tuned on:

| System | Precision | Recall | F1 |
|---|---|---|---|
| Keyword engine alone | 94.3% | 41.4% | 57.5% |
| ToxiFilter ML alone | 89.0% | 67.1% | 76.6% |
| Keyword OR ML (the pipeline) | 86.9% | 69.3% | **77.1%** |

F1 per language for the ML model: English 0.92, Hinglish 0.69, Kannada 0.57, Hindi 0.48. So the keyword engine's 100% above is a development-set score, not accuracy; the ML model is what covers real-world Hinglish, Hindi and Kannada.

## API

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | – | Which providers are configured |
| GET | `/api/stats` | – | Public platform numbers (home page) |
| GET | `/api/ml/performance` | – | The ML model's measured results (from `ml/metrics.json`), for the Lab |
| GET | `/api/docs/evaluation` | – | `docs/EVALUATION.md` as plain text |
| POST | `/api/moderate` | – | `{ text, suggest? }` → moderation result (+ rewrite) |
| POST | `/api/comments` | user | `{ postId, content, acknowledgeWarning? }` → 201 saved / 422 needs review / 403 blocked |
| POST | `/api/reports` | post author / admin | `{ commentId, reason? }` |
| GET | `/api/admin/overview` | admin | Dashboard data |
| POST | `/api/admin/users/:id/reset` | admin | Clear reports & unblock |
| DELETE | `/api/admin/comments/:id` | admin | Delete a comment |

## Project structure

```
server/
  index.js, app.js, config.js     Express API
  moderation/
    lexicon.js                    multilingual weighted word list
    keywordEngine.js              rule engine (always on)
    providers.js                  ML provider registry (our "custom" model service)
    index.js                      pipeline + merge
    rephrase.js                   Groq rewrite + fallback
  tests/                          node:test suites (keyword engine, API flow, ML provider)
  eval/                           dataset, v1 baseline, evaluate.js, heldout.js
ml/                               our own ML model (Python): prepare_data.py, train.py, serve.py,
                                  textnorm.py, train_transformer.py, README.md, data/
scripts/start-ml.js               starts the ML service for `npm run dev` (skips politely if not set up)
docs/                             SETUP.md, CHANGELOG.md, EVALUATION.md (the report chapter)
supabase/schema.sql               tables, RLS, triggers, storage, realtime
src/
  components/                     Navbar, Footer, Home, Lab, ToxiDemo, ModelPerformance, BlogPost,
                                  CreateBlogPost (create+edit), Comments, CommentForm, LiveMeter,
                                  Analytics, Admin, Auth, Toast, Skeleton, EmptyState, NotFound, ...
  contexts/AuthContext.js         session, profile, block status, admin role
  lib/supabase.js, lib/api.js     DB client + authenticated API client
  utils/moderationLabels.js       category/severity/source display helpers
```

## Limitations / future work

- The ML model reads one comment as a bag of n-grams: no context, no sarcasm, and insults without abusive vocabulary are often missed. Recall is low for Kannada and Hindi (0.44 and 0.39), and the Hinglish and Hindi sets are small. See [docs/EVALUATION.md](docs/EVALUATION.md) for the numbers and caveats.
- Fine-tuning a multilingual transformer such as MuRIL (`ml/train_transformer.py`, on a Colab GPU) is the next step; it has not been run yet.
- Blog *posts* are checked in the browser before publishing (comments are enforced server-side).
- An appeal flow for blocked users is not built yet.

## License

The code is MIT. **The ML model is trained on public datasets with their own licences, and one of them (the HASOC 2021 re-upload) is non-commercial**, so treat the trained model as for academic use. Details and citations: [docs/EVALUATION.md](docs/EVALUATION.md).
