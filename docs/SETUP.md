# Setup Guide

About 15 minutes from zero to running.

## 0. Requirements

- Node.js 18 or newer (`node -v`)
- A free [Supabase](https://supabase.com) account

## 1. Install

```bash
npm install
cp .env.example .env
```

## 2. Create the Supabase project

1. Supabase dashboard → **New project** (free plan is fine). Wait ~2 min.
2. **Project Settings → API**. Copy into `.env`:
   - Project URL → `REACT_APP_SUPABASE_URL`
   - `anon` `public` key → `REACT_APP_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`. **This one is secret.** It only goes to the server; never give it a `REACT_APP_` prefix.

## 3. Create the database

1. Supabase → **SQL Editor → New query**
2. Paste the whole of `supabase/schema.sql` → **Run**. You should see "Success. No rows returned".

This creates the tables (`profiles`, `posts`, `comments`, `reports`), the security rules, the report-count trigger, the `blog-images` storage bucket and the realtime setup. It is safe to run again, and it also upgrades a database built with the old v1 guide.

## 4. (Optional) Turn off email confirmation for development

Supabase → **Authentication → Sign In / Providers → Email** → turn off "Confirm email". Keep it on in production.

## 5. (Optional) Extras

Everything works without these (the multilingual keyword engine is always on), but they make it smarter:

| Setting | Where | Used for |
|---|---|---|
| `ML_SERVICE_URL` | `http://127.0.0.1:8000`, the URL of our own ML service (train it first, see `ml/README.md`) | ToxiFilter ML scoring next to the keyword engine. `npm run dev` starts the service for you once it is trained |
| `GROQ_API_KEY` | console.groq.com/keys | Polite rewrite suggestions (without it a simple offline rewrite is used) |

### Train the ML model (optional, about 5 minutes)

Needs Python 3.10+. Full details and the dataset licences are in [../ml/README.md](../ml/README.md) and
[EVALUATION.md](EVALUATION.md).

```powershell
cd ml
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements-data.txt
python prepare_data.py     # downloads the public datasets, writes data/combined.csv
python train.py            # about a minute; writes model.joblib, metrics.json and two charts
cd ..
```

Then add `ML_SERVICE_URL=http://127.0.0.1:8000` to `.env`. From now on `npm run dev` starts the ML service together with
the API and the web app. (If Python or the trained model is missing, it prints a message and the rest keeps running.)

## 6. Run

```bash
npm run dev
```

- React: http://localhost:3000
- API: http://localhost:3001/api/health shows which providers are active (`keyword`, `custom` = our ML model, `groq`)
- ML service (if enabled): http://127.0.0.1:8000/health

The server prints a status table on startup. If you see `SUPABASE_SERVICE_ROLE_KEY missing`, fix `.env` and restart.

## 7. Make yourself admin

Sign up in the app, then run in the SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

Refresh the app and a **🛡️ Admin** button appears in the header.

## 8. Demo script (for the viva)

Before you start: run `npm run dev` and check that `http://localhost:3001/api/health` shows
`"custom": true` (the ML model is on). About 12 minutes in total. (Probabilities below are from the current
model; after you retrain they may differ by a few points.)

### Part A: the ToxiFilter Lab and the ML model (no login needed)

1. Open **ToxiFilter Lab** in the navbar (`/lab`). Under **Active providers**, point out the three green dots:
   the keyword engine, **ToxiFilter ML (our own trained model)** and the Groq rewrites.
2. Type `you are an idiot`. It is flagged: show the per-category bars, the highlighted word, the severity, and the
   line **"🧠 ToxiFilter ML: 57% toxic"**. Open the details: ML is *below* its 70% flag threshold here, so the
   **keyword engine** made the call. Two engines, one decision.
3. Type `nobody wants to read your garbage`. Now **ML: 72% toxic**, above the threshold, and "Detected by 🧠 ToxiFilter
   ML". Point out the latency (a few milliseconds).
4. **Languages** section: click `tu bewakoof hai` (Hinglish), `तू चूतिया है` (Hindi), `ನೀನು ಸೂಳೆಮಗ` (Kannada) and
   `f*ck this` (disguised). Then click a green example (`Gandhi had great skill`): **not** flagged.
5. Be upfront about the limits: type `complete waste of space honestly`. Nothing flags it (ML 22%). Explain that a bag of
   n-grams cannot read context or sarcasm, and that this is listed under "Honest limits" and in the evaluation.
6. Scroll to **Model performance**. Every number here is read from `ml/metrics.json`, not typed in:
   - held-out **F1 0.766** (precision 0.890, recall 0.671), 5-fold cross-validation **0.785 ± 0.013**;
   - the **F1-per-language chart**: English 0.92, Hinglish 0.69, Kannada 0.57, Hindi 0.48. The pink bars are the
     independent set; say that it only has 4 to 42 comments per language, so only English is meaningful there;
   - the table **keyword engine vs ML vs both** on 2,132 held-out comments: keyword alone F1 **57.5%**, ML alone
     **76.6%**, combined **77.1%**. The keyword engine scores 100% on its own development file, which is exactly why an
     independent split matters.
7. Click **Read the full evaluation** (datasets, licences, model comparison, thresholds, limitations).

### Part B: moderation in the blog

8. **User A** writes a post (try the cover image upload).
9. **User B** (another browser or incognito) comments `Great post!`. While typing, the live meter under the box
   shows **"Looks respectful ✓"**. Posted.
10. User B types `you are an idiot`: the meter turns red ("Likely to be flagged"). Submit → ToxiFilter warning with
    category, severity, problem words and an AI rewrite.
11. Click **Use This Suggestion** → posts cleanly.
12. Try `tu chutiya hai` / `तू चूतिया है` / `f*ck this` → caught (multilingual + disguised).
13. Try `Gandhi's skill was amazing` → *not* flagged (v1 used to flag this).
14. User B clicks **Post Original Anyway** → comment hidden from others, auto-report filed (1/3).
15. User A → avatar menu → **My Analytics** → sees the flagged comment and breakdown charts → **Report User** (2/3).
16. Repeat until 3 → User B is blocked from commenting.
17. Admin → avatar menu → **Admin** → reported users → **Reset & Unblock**.

### Part C: the evidence

18. Terminal: `npm run test:server` (35 passing), `npm run eval` (v1 vs v2 table) and `npm run eval:heldout`
    (keyword vs ML vs both on real held-out data).
19. Optional: show `ml/confusion_matrix.png`, `ml/per_language_f1.png` and `docs/EVALUATION.md`.

## Deploying (one service)

```bash
npm run build
NODE_ENV=production node server/index.js
```

The Node server serves the React build and the API from the same URL. This works on Render, Railway or any VPS. Set the same env variables in the host's dashboard, and add your site URL to `CORS_ORIGINS` and to Supabase → Authentication → URL Configuration.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Almost there — the app isn't connected" screen | `REACT_APP_SUPABASE_*` missing; restart `npm run dev` after editing `.env` |
| "Can't reach the ToxiFilter server" | API not running: use `npm run dev`, not `npm start` |
| Comments return 503 | `SUPABASE_SERVICE_ROLE_KEY` missing on the server |
| `permission denied for column email` | Old code selecting `email`; profiles hide email by design |
| Image upload fails | Re-run `schema.sql` (creates the `blog-images` bucket + policies) |
| Live updates not working | Re-run `schema.sql` (adds tables to the realtime publication) |
| Rewrite always generic | `GROQ_API_KEY` not set, or the Groq models changed (set `GROQ_MODELS`) |
| ToxiFilter ML never shows as active | `ML_SERVICE_URL` not set, or the Python service isn't running (`/api/health` shows `custom: false`) |
