/**
 * ToxiFilter API server (Express).
 *
 * Why a backend?
 *  - Secrets (Groq key, Supabase service role) and the ML service URL never reach the browser.
 *  - Comments are moderated AND saved here, so nobody can skip moderation by calling
 *    Supabase directly (the database only accepts comment inserts from this server).
 *  - Reports and report counts are written with checks (only the post author or an admin
 *    can report; users can't reset their own count).
 */

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const { rateLimit } = require("express-rate-limit");
const { createClient } = require("@supabase/supabase-js");

const config = require("./config");
const { moderate, publicResult } = require("./moderation");
const { suggestRephrase } = require("./moderation/rephrase");

const SUPPORT_MESSAGE =
  "It sounds like you might be going through something hard. You don't have to handle it alone — " +
  "in India you can call Tele-MANAS on 14416 (free, 24×7), or talk to someone you trust.";

function createApp({ db } = {}) {
  const supabase =
    db ||
    (config.supabaseUrl && config.supabaseServiceRoleKey
      ? createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null);

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(
    cors({
      origin: (origin, cb) =>
        cb(null, !origin || config.corsOrigins.includes("*") || config.corsOrigins.includes(origin)),
    })
  );
  app.use(express.json({ limit: "100kb" }));

  const moderateLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many requests, slow down a bit." },
  });
  const writeLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 15,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many comments in a short time. Please wait a minute." },
  });

  /* ------------------------------ helpers -------------------------------- */

  const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  const requireDb = (req, res, next) => {
    if (!supabase) {
      return res.status(503).json({
        error:
          "Server is not connected to Supabase. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env and restart the server.",
      });
    }
    next();
  };

  const requireUser = asyncRoute(async (req, res, next) => {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "Please log in first." });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: "Session expired. Please log in again." });

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("id, name, email, report_count, role")
      .eq("id", data.user.id)
      .single();
    if (pErr || !profile) return res.status(403).json({ error: "Profile not found for this account." });

    req.user = data.user;
    req.profile = profile;
    next();
  });

  const requireAdmin = (req, res, next) => {
    if (req.profile?.role !== "admin") return res.status(403).json({ error: "Admins only." });
    next();
  };

  const isBlocked = (profile) => (profile?.report_count || 0) >= config.blockThreshold;

  const reportCountOf = async (userId) => {
    const { data } = await supabase.from("profiles").select("report_count").eq("id", userId).single();
    return data?.report_count || 0;
  };

  /* ------------------------------ public --------------------------------- */

  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      database: Boolean(supabase),
      providers: {
        keyword: true,
        custom: Boolean(config.mlServiceUrl),
        groq: Boolean(config.groqApiKey),
      },
      blockThreshold: config.blockThreshold,
    });
  });

  let statsCache = { at: 0, data: null };
  app.get(
    "/api/stats",
    requireDb,
    asyncRoute(async (req, res) => {
      if (Date.now() - statsCache.at < 30_000 && statsCache.data) return res.json(statsCache.data);
      const count = async (table, filter) => {
        let q = supabase.from(table).select("id", { count: "exact", head: true });
        if (filter) q = filter(q);
        const { count: c } = await q;
        return c || 0;
      };
      const [posts, comments, flagged, users] = await Promise.all([
        count("posts"),
        count("comments"),
        count("comments", (q) => q.eq("is_flagged", true)),
        count("profiles"),
      ]);
      const data = {
        posts,
        commentsScreened: comments,
        flagged,
        users,
        cleanRate: comments ? Math.round(((comments - flagged) / comments) * 1000) / 10 : 100,
      };
      statsCache = { at: Date.now(), data };
      res.json(data);
    })
  );

  // Real numbers from the last `python ml/train.py` run (ml/metrics.json) for the Lab's "Model performance"
  // section. Whitelisted fields only; nothing secret lives in these files.
  const readJson = (file) => {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return null;
    }
  };
  let perfCache = { at: 0, data: null };
  app.get("/api/ml/performance", moderateLimiter, (req, res) => {
    if (Date.now() - perfCache.at < 30_000 && perfCache.data) return res.json(perfCache.data);

    const m = readJson(path.join(__dirname, "..", "ml", "metrics.json"));
    let data = { available: false };
    if (m) {
      const heldout = readJson(path.join(__dirname, "..", "ml", "pipeline_on_heldout.json"));
      const ind = m.independent_set || null;
      data = {
        available: true,
        trainedAt: m.trained_at,
        model: m.model,
        selectedModel: m.selected_model,
        threshold: m.threshold,
        nSamples: m.n_samples,
        nTrain: m.n_train,
        nTest: m.n_test,
        byLanguage: m.by_language,
        tinyDatasetWarning: Boolean(m.tiny_dataset_warning),
        test: m.test && {
          precision: m.test.precision,
          recall: m.test.recall,
          f1: m.test.f1,
          accuracy: m.test.accuracy,
          confusionMatrix: m.test.confusion_matrix,
        },
        perLanguageTest: m.per_language_test || null,
        crossValidation: m.cross_validation?.[m.selected_model] || null,
        independentSet: ind && {
          file: ind.file,
          n: ind.n,
          precision: ind.precision,
          recall: ind.recall,
          f1: ind.f1,
          falseAlarms: ind.false_alarms,
          cleanRows: ind.clean_rows,
          perLanguage: ind.per_language,
        },
        pipelineOnHeldout: heldout && {
          threshold: heldout.threshold,
          n: heldout.n,
          overall: heldout.overall,
          perLanguage: heldout.per_language,
        },
      };
    }
    perfCache = { at: Date.now(), data };
    res.json(data);
  });

  // The written evaluation (served as plain text so the Lab can link to it)
  app.get("/api/docs/evaluation", (req, res) => {
    fs.readFile(path.join(__dirname, "..", "docs", "EVALUATION.md"), "utf8", (err, text) => {
      if (err) return res.status(404).json({ error: "Evaluation document not found." });
      res.type("text/plain").send(text);
    });
  });

  // Check text without saving it (used for live preview + blog post checks)
  app.post(
    "/api/moderate",
    moderateLimiter,
    asyncRoute(async (req, res) => {
      const text = String(req.body?.text || "").trim();
      if (!text) return res.status(400).json({ error: "Text is required." });
      if (text.length > 20000) return res.status(413).json({ error: "Text is too long." });

      const result = await moderate(text);
      const payload = { moderation: publicResult(result) };
      if (req.body?.suggest && result.isToxic) payload.suggestion = await suggestRephrase(text, result);
      res.json(payload);
    })
  );

  /* ------------------------------ comments ------------------------------- */

  app.post(
    "/api/comments",
    writeLimiter,
    requireDb,
    requireUser,
    asyncRoute(async (req, res) => {
      const postId = Number(req.body?.postId);
      const content = String(req.body?.content || "").trim();
      const acknowledged = Boolean(req.body?.acknowledgeWarning);

      if (!Number.isInteger(postId) || postId <= 0) return res.status(400).json({ error: "Invalid post." });
      if (!content) return res.status(400).json({ error: "Comment cannot be empty." });
      if (content.length > config.maxCommentLength)
        return res.status(413).json({ error: `Comments are limited to ${config.maxCommentLength} characters.` });

      if (isBlocked(req.profile)) {
        return res.status(403).json({
          code: "blocked",
          error: `Your account has been reported ${req.profile.report_count} times and can no longer comment.`,
        });
      }

      const { data: post } = await supabase.from("posts").select("id").eq("id", postId).maybeSingle();
      if (!post) return res.status(404).json({ error: "Post not found." });

      const result = await moderate(content);

      // Toxic and not yet confirmed → warn the user and offer a rewrite. Nothing is saved.
      if (result.isToxic && !acknowledged) {
        const suggestion = await suggestRephrase(content, result);
        return res.status(422).json({
          code: "needs_review",
          moderation: publicResult(result),
          suggestion,
        });
      }

      const { data: comment, error } = await supabase
        .from("comments")
        .insert({
          post_id: postId,
          user_id: req.user.id,
          content,
          is_flagged: result.isToxic,
          toxicity_score: result.score,
          severity: result.severity,
          categories: result.categories,
          moderation_source: result.source,
        })
        .select()
        .single();
      if (error) throw error;

      let reported = false;
      if (result.isToxic) {
        const { error: rErr } = await supabase.from("reports").insert({
          reported_user_id: req.user.id,
          reporter_id: null,
          comment_id: comment.id,
          post_id: postId,
          source: "system",
          reason: `Posted ${result.severity}-severity content (${result.categories.join(", ")}) after a warning`,
        });
        if (rErr) console.error("[comments] auto-report failed", rErr.message);
        else reported = true;
      }

      const reportCount = await reportCountOf(req.user.id);
      res.status(201).json({
        comment,
        moderation: publicResult(result),
        reported,
        reportCount,
        blocked: reportCount >= config.blockThreshold,
        supportMessage: result.supportNeeded ? SUPPORT_MESSAGE : null,
      });
    })
  );

  /* ------------------------------ reports -------------------------------- */

  app.post(
    "/api/reports",
    writeLimiter,
    requireDb,
    requireUser,
    asyncRoute(async (req, res) => {
      const commentId = Number(req.body?.commentId);
      const reason = String(req.body?.reason || "").trim().slice(0, 300) || null;
      if (!Number.isInteger(commentId)) return res.status(400).json({ error: "Invalid comment." });

      const { data: comment } = await supabase
        .from("comments")
        .select("id, user_id, post_id, posts(author_id)")
        .eq("id", commentId)
        .maybeSingle();
      if (!comment) return res.status(404).json({ error: "Comment not found." });
      if (comment.user_id === req.user.id) return res.status(400).json({ error: "You can't report yourself." });

      const isAdmin = req.profile.role === "admin";
      if (comment.posts?.author_id !== req.user.id && !isAdmin) {
        return res.status(403).json({ error: "Only the post author can report comments on this post." });
      }

      const { error } = await supabase.from("reports").insert({
        reported_user_id: comment.user_id,
        reporter_id: req.user.id,
        comment_id: comment.id,
        post_id: comment.post_id,
        source: isAdmin ? "admin" : "author",
        reason,
      });
      if (error) {
        if (error.code === "23505") return res.status(409).json({ error: "You already reported this comment." });
        throw error;
      }

      const reportCount = await reportCountOf(comment.user_id);
      res.status(201).json({ reportCount, blocked: reportCount >= config.blockThreshold });
    })
  );

  /* ------------------------------- admin --------------------------------- */

  app.get(
    "/api/admin/overview",
    requireDb,
    requireUser,
    requireAdmin,
    asyncRoute(async (req, res) => {
      const count = async (table, filter) => {
        let q = supabase.from(table).select("id", { count: "exact", head: true });
        if (filter) q = filter(q);
        const { count: c } = await q;
        return c || 0;
      };

      const [users, posts, comments, flagged, reports, blocked] = await Promise.all([
        count("profiles"),
        count("posts"),
        count("comments"),
        count("comments", (q) => q.eq("is_flagged", true)),
        count("reports"),
        count("profiles", (q) => q.gte("report_count", config.blockThreshold)),
      ]);

      const [{ data: reportedUsers }, { data: recentReports }, { data: flaggedComments }, { data: allFlagged }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, name, email, report_count, role, created_at")
            .gt("report_count", 0)
            .order("report_count", { ascending: false })
            .limit(50),
          supabase
            .from("reports")
            .select(
              "id, reason, source, resolved, created_at, comment_id, post_id, reported:profiles!reported_user_id(id, name), reporter:profiles!reporter_id(id, name), comment:comments(content)"
            )
            .order("created_at", { ascending: false })
            .limit(30),
          supabase
            .from("comments")
            .select(
              "id, content, toxicity_score, severity, categories, moderation_source, created_at, post_id, user:profiles!user_id(id, name, report_count), post:posts(title)"
            )
            .eq("is_flagged", true)
            .order("created_at", { ascending: false })
            .limit(50),
          supabase.from("comments").select("categories, severity").eq("is_flagged", true).limit(5000),
        ]);

      const byCategory = {};
      const bySeverity = { low: 0, medium: 0, high: 0 };
      for (const c of allFlagged || []) {
        for (const cat of c.categories || []) byCategory[cat] = (byCategory[cat] || 0) + 1;
        if (c.severity && c.severity in bySeverity) bySeverity[c.severity] += 1;
      }

      res.json({
        totals: { users, posts, comments, flagged, reports, blocked },
        blockThreshold: config.blockThreshold,
        byCategory,
        bySeverity,
        reportedUsers: reportedUsers || [],
        recentReports: recentReports || [],
        flaggedComments: flaggedComments || [],
      });
    })
  );

  app.post(
    "/api/admin/users/:id/reset",
    requireDb,
    requireUser,
    requireAdmin,
    asyncRoute(async (req, res) => {
      const { id } = req.params;
      const { error } = await supabase.from("profiles").update({ report_count: 0 }).eq("id", id);
      if (error) throw error;
      await supabase.from("reports").update({ resolved: true }).eq("reported_user_id", id);
      res.json({ ok: true });
    })
  );

  app.delete(
    "/api/admin/comments/:id",
    requireDb,
    requireUser,
    requireAdmin,
    asyncRoute(async (req, res) => {
      const { error } = await supabase.from("comments").delete().eq("id", Number(req.params.id));
      if (error) throw error;
      res.json({ ok: true });
    })
  );

  app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

  /* --------------------- serve React build in production ------------------ */

  const buildDir = path.join(__dirname, "..", "build");
  if (fs.existsSync(path.join(buildDir, "index.html"))) {
    app.use(express.static(buildDir));
    app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(buildDir, "index.html")));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error("[server error]", err);
    res.status(500).json({ error: "Something went wrong on the server." });
  });

  return app;
}

module.exports = { createApp, SUPPORT_MESSAGE };
