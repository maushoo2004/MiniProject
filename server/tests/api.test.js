// API tests using an in-memory fake of the Supabase client. No network or keys needed.
for (const k of ["ML_SERVICE_URL", "GROQ_API_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
  process.env[k] = "";
}
process.env.BLOCK_THRESHOLD = "3";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../app");

/* ------------------------- tiny fake Supabase -------------------------- */
function fakeSupabase() {
  const state = {
    profiles: [
      { id: "author", name: "Asha", email: "a@x.com", report_count: 0, role: "user" },
      { id: "troll", name: "Troll", email: "t@x.com", report_count: 0, role: "user" },
      { id: "admin", name: "Admin", email: "ad@x.com", report_count: 0, role: "admin" },
    ],
    posts: [{ id: 1, title: "Hello", author_id: "author" }],
    comments: [],
    reports: [],
  };
  let nextId = 1;

  class Q {
    constructor(table) {
      this.table = table;
      this.filters = [];
      this.op = "select";
    }
    select() {
      return this;
    }
    insert(p) {
      this.op = "insert";
      this.payload = Array.isArray(p) ? p : [p];
      return this;
    }
    update(p) {
      this.op = "update";
      this.payload = p;
      return this;
    }
    delete() {
      this.op = "delete";
      return this;
    }
    eq(c, v) {
      this.filters.push((r) => r[c] === v);
      return this;
    }
    gt(c, v) {
      this.filters.push((r) => r[c] > v);
      return this;
    }
    gte(c, v) {
      this.filters.push((r) => r[c] >= v);
      return this;
    }
    order() {
      return this;
    }
    limit() {
      return this;
    }
    single() {
      this.mode = "single";
      return this.exec();
    }
    maybeSingle() {
      this.mode = "maybe";
      return this.exec();
    }
    then(a, b) {
      return this.exec().then(a, b);
    }
    async exec() {
      const rows = state[this.table];
      if (this.op === "insert") {
        const out = [];
        for (const p of this.payload) {
          const row = { id: nextId++, ...p };
          if (this.table === "reports" && p.reporter_id) {
            const dup = rows.some((r) => r.reporter_id === p.reporter_id && r.comment_id === p.comment_id);
            if (dup) return { data: null, error: { code: "23505", message: "duplicate" } };
          }
          rows.push(row);
          if (this.table === "reports") {
            // simulates the bump_report_count trigger
            state.profiles.find((u) => u.id === p.reported_user_id).report_count += 1;
          }
          out.push(row);
        }
        return { data: this.mode ? out[0] : out, error: null };
      }
      let matched = rows.filter((r) => this.filters.every((f) => f(r)));
      if (this.op === "update") {
        matched.forEach((r) => Object.assign(r, this.payload));
        return { data: matched, error: null };
      }
      if (this.op === "delete") {
        state[this.table] = rows.filter((r) => !matched.includes(r));
        return { data: null, error: null };
      }
      if (this.table === "comments") {
        matched = matched.map((c) => ({ ...c, posts: state.posts.find((p) => p.id === c.post_id) }));
      }
      if (this.mode === "single") {
        return matched[0] ? { data: matched[0], error: null } : { data: null, error: { message: "not found" } };
      }
      if (this.mode === "maybe") return { data: matched[0] || null, error: null };
      return { data: matched, error: null, count: matched.length };
    }
  }

  return {
    state,
    auth: {
      getUser: async (token) =>
        state.profiles.some((p) => p.id === token)
          ? { data: { user: { id: token } }, error: null }
          : { data: { user: null }, error: { message: "invalid" } },
    },
    from: (table) => new Q(table),
  };
}

/* ------------------------------ harness -------------------------------- */
let server;
let base;
let db;

before(async () => {
  db = fakeSupabase();
  server = createApp({ db }).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const call = async (path, { method = "GET", body, token } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
};

/* -------------------------------- tests -------------------------------- */
test("health reports providers", async () => {
  const { status, data } = await call("/api/health");
  assert.equal(status, 200);
  assert.deepEqual(data.providers, { keyword: true, custom: false, groq: false });
  assert.equal(data.blockThreshold, 3);
});

test("ML performance endpoint serves the real numbers from ml/metrics.json", async () => {
  const file = require("node:path").join(__dirname, "..", "..", "ml", "metrics.json");
  const { status, data } = await call("/api/ml/performance");
  assert.equal(status, 200);
  if (!require("node:fs").existsSync(file)) {
    assert.equal(data.available, false);
    return;
  }
  const m = JSON.parse(require("node:fs").readFileSync(file, "utf8"));
  assert.equal(data.available, true);
  assert.equal(data.threshold, m.threshold);
  assert.equal(data.test.f1, m.test.f1);
  assert.equal(data.crossValidation.f1_mean, m.cross_validation[m.selected_model].f1_mean);
  assert.deepEqual(Object.keys(data.perLanguageTest).sort(), Object.keys(m.per_language_test).sort());
  // only whitelisted fields: no file paths or raw candidates
  assert.equal("candidates" in data, false);
  assert.equal("data_files" in data, false);
});

test("evaluation document is served as plain text", async () => {
  const res = await fetch(`${base}/api/docs/evaluation`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/plain/);
  assert.match(await res.text(), /Evaluation of the ToxiFilter ML model/);
});

test("moderate endpoint classifies and suggests", async () => {
  const clean = await call("/api/moderate", { method: "POST", body: { text: "Lovely article, thanks!" } });
  assert.equal(clean.data.moderation.isToxic, false);

  const bad = await call("/api/moderate", { method: "POST", body: { text: "you are a moron", suggest: true } });
  assert.equal(bad.data.moderation.isToxic, true);
  assert.ok(bad.data.suggestion.text.length > 0);
  assert.equal(bad.data.suggestion.source, "fallback");
});

test("commenting requires login", async () => {
  const r = await call("/api/comments", { method: "POST", body: { postId: 1, content: "hi" } });
  assert.equal(r.status, 401);
});

test("clean comment is saved and visible", async () => {
  const r = await call("/api/comments", {
    method: "POST",
    token: "troll",
    body: { postId: 1, content: "Great post, learned a lot" },
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.comment.is_flagged, false);
  assert.equal(r.data.reported, false);
});

test("toxic comment is held for review, then flagged + auto-reported if posted anyway", async () => {
  const first = await call("/api/comments", {
    method: "POST",
    token: "troll",
    body: { postId: 1, content: "you are an idiot" },
  });
  assert.equal(first.status, 422);
  assert.equal(first.data.code, "needs_review");
  assert.ok(first.data.suggestion.text);
  assert.equal(db.state.comments.length, 1, "nothing saved yet");

  const anyway = await call("/api/comments", {
    method: "POST",
    token: "troll",
    body: { postId: 1, content: "you are an idiot", acknowledgeWarning: true },
  });
  assert.equal(anyway.status, 201);
  assert.equal(anyway.data.comment.is_flagged, true);
  assert.equal(anyway.data.reported, true);
  assert.equal(anyway.data.reportCount, 1);
});

test("only the post author (or admin) can report, once per comment", async () => {
  const flagged = db.state.comments.find((c) => c.is_flagged);

  const stranger = await call("/api/reports", { method: "POST", token: "admin", body: { commentId: flagged.id } });
  assert.equal(stranger.status, 201, "admin may report");

  const self = await call("/api/reports", { method: "POST", token: "troll", body: { commentId: flagged.id } });
  assert.equal(self.status, 400);

  const author = await call("/api/reports", { method: "POST", token: "author", body: { commentId: flagged.id } });
  assert.equal(author.status, 201);
  assert.equal(author.data.reportCount, 3);
  assert.equal(author.data.blocked, true);

  const again = await call("/api/reports", { method: "POST", token: "author", body: { commentId: flagged.id } });
  assert.equal(again.status, 409);
});

test("blocked users cannot comment", async () => {
  const r = await call("/api/comments", { method: "POST", token: "troll", body: { postId: 1, content: "hello again" } });
  assert.equal(r.status, 403);
  assert.equal(r.data.code, "blocked");
});

test("admin endpoints are admin-only, and admin can unblock", async () => {
  const denied = await call("/api/admin/overview", { token: "author" });
  assert.equal(denied.status, 403);

  const ok = await call("/api/admin/overview", { token: "admin" });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.totals.blocked, 1);

  const reset = await call("/api/admin/users/troll/reset", { method: "POST", token: "admin" });
  assert.equal(reset.status, 200);
  assert.equal(db.state.profiles.find((p) => p.id === "troll").report_count, 0);
});

test("self-harm comment is posted with a support message, not punished", async () => {
  const r = await call("/api/comments", {
    method: "POST",
    token: "author",
    body: { postId: 1, content: "honestly some days I want to die" },
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.reported, false);
  assert.ok(r.data.supportMessage.includes("14416"));
});
