import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import ToxiDemo from "./ToxiDemo";
import EmptyState from "./EmptyState";
import { HomeSkeleton } from "./Skeleton";
import "./Home.css";

const PIPELINE = [
  { icon: "⌨️", title: "You type", text: "A comment is sent to our server, never checked in the browser, so it can't be skipped." },
  { icon: "🔎", title: "Keyword engine + our ML model", text: "A multilingual keyword engine always runs; ToxiFilter ML, our own trained model, adds a second opinion." },
  { icon: "✨", title: "Warning + polite rewrite", text: "Toxic text isn't saved yet. The writer sees why, and gets a kinder rewrite that keeps their point." },
  { icon: "🚨", title: "Reports & blocking", text: "Posting it anyway hides it and files a report. Enough reports block the account." },
];

const FEATURES = [
  { icon: "🌐", title: "Four languages", text: "English, Hindi (Devanagari), Hinglish and Kannada." },
  { icon: "🕵️", title: "Disguise-proof", text: "Catches f*ck, sh1t, a$$hole and fuuuck, not just clean spellings." },
  { icon: "🔬", title: "Explainable", text: "Shows the category, severity, score and the exact words that triggered it." },
  { icon: "🎯", title: "Few false alarms", text: "Whole-word matching: Gandhi, skill and class are fine." },
  { icon: "💙", title: "Self-harm aware", text: "Distress isn't punished; the writer is shown a helpline instead." },
  { icon: "🔐", title: "Secure by design", text: "API keys stay on the server and the database rejects direct comment inserts." },
];

const initialOf = (name) => (name || "?").trim().charAt(0).toUpperCase() || "?";

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

const Home = ({ blogs, loading, user, onAuthClick }) => {
  const { isBlocked, userReportCount } = useAuth();
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState(null);

  // Live platform numbers from the ToxiFilter server (no made-up figures)
  useEffect(() => {
    api("/api/stats", { auth: false })
      .then(setStats)
      .catch(() => setStats(null));
  }, [blogs.length]);

  const query = search.trim().toLowerCase();
  const visibleBlogs = query
    ? blogs.filter((b) => [b.title, b.excerpt, b.author].some((f) => (f || "").toLowerCase().includes(query)))
    : blogs;

  const statItems = [
    { value: stats?.posts, label: "Posts" },
    { value: stats?.commentsScreened, label: "Comments screened" },
    { value: stats?.flagged, label: "Toxic comments stopped" },
    { value: stats ? `${stats.cleanRate}%` : undefined, label: "Clean rate" },
    { value: "4", label: "Languages" },
  ];

  const writeCta = (className, label) =>
    user ? (
      <Link to="/create" className={className}>
        {label}
      </Link>
    ) : (
      <button type="button" className={className} onClick={onAuthClick}>
        {label}
      </button>
    );

  return (
    <div className="home">
      {user && isBlocked && (
        <div className="blocked-alert">
          <div className="blocked-alert-content">
            <span className="blocked-icon">🚫</span>
            <div className="blocked-text">
              <strong>Account Restricted</strong>
              <p>Your account has been reported {userReportCount} times and is blocked from commenting on posts.</p>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- hero ---------------- */}
      <section className="hm-hero">
        <div className="hm-hero-text">
          <span className="hm-badge">🛡️ Protected by ToxiFilter AI</span>
          <h1 className="hm-title">
            Write freely.
            <br />
            <span className="hm-gradient">Discuss safely.</span>
          </h1>
          <p className="hm-lead">
            BlogX is a blogging platform where every comment is checked on our server before it's saved. ToxiFilter
            understands English, Hindi, Hinglish and Kannada, explains what it found, and offers a kinder way to say
            it.
          </p>
          <div className="hm-cta">
            {writeCta("btn btn-primary", "✏️ Start Writing")}
            <Link to="/lab" className="btn btn-ghost">
              Try ToxiFilter →
            </Link>
          </div>
        </div>

        <div className="hm-hero-demo">
          <ToxiDemo compact />
        </div>
      </section>

      {/* ---------------- stats ---------------- */}
      <section className="hm-stats" aria-label="Platform statistics">
        {statItems.map((s) => (
          <div key={s.label} className="hm-stat glass">
            <div className="hm-stat-value">{s.value ?? "—"}</div>
            <div className="hm-stat-label">{s.label}</div>
          </div>
        ))}
      </section>

      {/* ---------------- posts ---------------- */}
      <section className="hm-posts" id="posts">
        <div className="hm-section-head">
          <div>
            <h2>Latest posts</h2>
            <p>Thoughts and ideas from the community</p>
          </div>
          <div className="hm-tools">
            <input
              type="search"
              className="hm-search"
              placeholder="🔍 Search posts or authors…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search posts"
            />
            {writeCta("btn btn-primary btn-sm", "✏️ New post")}
          </div>
        </div>

        {loading ? (
          <HomeSkeleton />
        ) : visibleBlogs.length === 0 ? (
          blogs.length === 0 ? (
            <EmptyState icon="📝" title="No posts yet" action={writeCta("btn btn-primary btn-sm", "✏️ Write the first post")}>
              Be the first to share your thoughts. Every comment on your post is checked by ToxiFilter.
            </EmptyState>
          ) : (
            <EmptyState
              icon="🔍"
              title="No matching posts"
              action={
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSearch("")}>
                  Clear search
                </button>
              }
            >
              Nothing matches "{search}". Try a different word or an author's name.
            </EmptyState>
          )
        ) : (
          <div className="hm-grid">
            {visibleBlogs.map((blog) => (
              <Link to={`/post/${blog.id}`} key={blog.id} className="hm-card glass">
                <div className="hm-card-cover">
                  {blog.image_url ? (
                    <img src={blog.image_url} alt="" loading="lazy" />
                  ) : (
                    <div className="hm-card-placeholder" aria-hidden="true">
                      <span>{initialOf(blog.title)}</span>
                    </div>
                  )}
                </div>
                <div className="hm-card-body">
                  <h3>{blog.title}</h3>
                  <p className="hm-card-excerpt">{blog.excerpt}</p>
                  <div className="hm-card-meta">
                    <span className="hm-avatar" aria-hidden="true">
                      {initialOf(blog.author)}
                    </span>
                    <div className="hm-card-who">
                      <strong>{blog.author}</strong>
                      <span>
                        {formatDate(blog.created_at)} · {blog.readMinutes} min read
                      </span>
                    </div>
                    <span className="hm-card-comments" title="Comments">
                      💬 {blog.commentCount}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ---------------- how it works ---------------- */}
      <section className="hm-how">
        <div className="hm-section-head hm-center">
          <div>
            <h2>How ToxiFilter works</h2>
            <p>From keystroke to accountability in four steps</p>
          </div>
        </div>

        <ol className="hm-pipeline">
          {PIPELINE.map((step, i) => (
            <li key={step.title} className="hm-step glass">
              <span className="hm-step-num">{i + 1}</span>
              <div className="hm-step-icon" aria-hidden="true">
                {step.icon}
              </div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>

        <div className="hm-features">
          {FEATURES.map((f) => (
            <div key={f.title} className="hm-feature">
              <span className="hm-feature-icon" aria-hidden="true">
                {f.icon}
              </span>
              <div>
                <h4>{f.title}</h4>
                <p>{f.text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="hm-how-cta">
          <Link to="/lab" className="btn btn-ghost">
            Explore the ToxiFilter Lab →
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
