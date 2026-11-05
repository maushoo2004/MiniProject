import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import EmptyState from "./EmptyState";
import { AnalyticsSkeleton } from "./Skeleton";
import {
  getCategoryColor,
  getCategoryDisplayName,
  getSeverityColor,
  getSourceLabel,
  formatScore,
} from "../utils/moderationLabels";
import "./Analytics.css";
import "./Admin.css";

const SOURCE_TAG = { system: "🤖 Auto", author: "✍️ Author", admin: "🛡️ Admin" };

const Admin = ({ showToast }) => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("users");

  const load = useCallback(async () => {
    try {
      setData(await api("/api/admin/overview"));
    } catch (err) {
      showToast(err.message, "error", 6000);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const resetUser = async (u) => {
    if (!window.confirm(`Clear all reports for ${u.name} and let them comment again?`)) return;
    try {
      await api(`/api/admin/users/${u.id}/reset`, { method: "POST" });
      showToast(`${u.name} has been unblocked.`, "success");
      load();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const deleteComment = async (c) => {
    if (!window.confirm("Permanently delete this comment?")) return;
    try {
      await api(`/api/admin/comments/${c.id}`, { method: "DELETE" });
      showToast("Comment deleted.", "success");
      load();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  if (loading) return <AnalyticsSkeleton />;

  if (!data) {
    return (
      <div className="analytics-container">
        <EmptyState
          icon="⚠️"
          title="Couldn't load the admin dashboard"
          action={
            <button type="button" className="btn btn-primary btn-sm" onClick={load}>
              Try again
            </button>
          }
        >
          Is the API server running? (npm run dev starts it.)
        </EmptyState>
      </div>
    );
  }

  const { totals, byCategory, bySeverity, reportedUsers, recentReports, flaggedComments, blockThreshold } =
    data;
  const maxCat = Math.max(1, ...Object.values(byCategory));

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <button className="back-button" onClick={() => navigate("/")}>
          ← Back to Home
        </button>
        <h1>🛡️ ToxiFilter Admin</h1>
        <p>Platform-wide moderation: reports, blocked users and flagged content.</p>
      </div>

      <div className="admin-totals">
        {[
          ["👥", "Users", totals.users],
          ["📝", "Posts", totals.posts],
          ["💬", "Comments", totals.comments],
          ["🚩", "Flagged", totals.flagged],
          ["📣", "Reports", totals.reports],
          ["🚫", "Blocked", totals.blocked],
        ].map(([icon, label, value]) => (
          <div key={label} className="admin-total">
            <span className="admin-total-icon">{icon}</span>
            <span className="admin-total-value">{value}</span>
            <span className="admin-total-label">{label}</span>
          </div>
        ))}
      </div>

      <div className="analytics-section">
        <h2>📊 Flagged Content Breakdown</h2>
        <div className="charts-container">
          <div className="chart-card">
            <h3>By Category</h3>
            {Object.keys(byCategory).length === 0 ? (
              <div className="no-data-message">
                <p>Nothing flagged yet 🎉</p>
              </div>
            ) : (
              <div className="hbar-list">
                {Object.entries(byCategory)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, n]) => (
                    <div key={cat} className="hbar-row">
                      <span className="hbar-label">{getCategoryDisplayName(cat)}</span>
                      <div className="hbar-track">
                        <div
                          className="hbar-fill"
                          style={{ width: `${(n / maxCat) * 100}%`, backgroundColor: getCategoryColor(cat) }}
                        />
                      </div>
                      <span className="hbar-value">{n}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
          <div className="chart-card">
            <h3>By Severity</h3>
            <div className="hbar-list">
              {["high", "medium", "low"].map((sev) => (
                <div key={sev} className="hbar-row">
                  <span className="hbar-label" style={{ textTransform: "capitalize" }}>
                    {sev}
                  </span>
                  <div className="hbar-track">
                    <div
                      className="hbar-fill"
                      style={{
                        width: `${totals.flagged ? (bySeverity[sev] / totals.flagged) * 100 : 0}%`,
                        backgroundColor: getSeverityColor(sev),
                      }}
                    />
                  </div>
                  <span className="hbar-value">{bySeverity[sev]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="admin-tabs">
        {[
          ["users", `Reported Users (${reportedUsers.length})`],
          ["reports", `Recent Reports (${recentReports.length})`],
          ["flagged", `Flagged Comments (${flaggedComments.length})`],
        ].map(([key, label]) => (
          <button
            key={key}
            className={`admin-tab ${tab === key ? "active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <div className="analytics-section">
          {reportedUsers.length === 0 ? (
            <EmptyState compact icon="✅" title="No reported users">
              Nobody has been reported yet.
            </EmptyState>
          ) : (
            <div className="posts-table-container">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Reports</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reportedUsers.map((u) => {
                    const blocked = u.report_count >= blockThreshold;
                    return (
                      <tr key={u.id}>
                        <td>
                          <strong>{u.name}</strong>
                          {u.role === "admin" && <span className="admin-role-tag">admin</span>}
                        </td>
                        <td>{u.email}</td>
                        <td>
                          <span className={`badge ${blocked ? "badge-warning" : "badge-info"}`}>
                            {u.report_count}/{blockThreshold}
                          </span>
                        </td>
                        <td>{blocked ? "🚫 Blocked" : "⚠️ Warned"}</td>
                        <td>
                          <button className="view-button" onClick={() => resetUser(u)}>
                            Reset & Unblock
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "reports" && (
        <div className="analytics-section">
          {recentReports.length === 0 ? (
            <EmptyState compact icon="📭" title="No reports yet">
              Reports appear here when an author reports a commenter, or a flagged comment is posted anyway.
            </EmptyState>
          ) : (
            <div className="admin-report-list">
              {recentReports.map((r) => (
                <div key={r.id} className={`admin-report ${r.resolved ? "resolved" : ""}`}>
                  <div className="admin-report-top">
                    <span className="admin-source-tag">{SOURCE_TAG[r.source] || r.source}</span>
                    <strong>{r.reported?.name || "Unknown user"}</strong>
                    <span className="admin-muted">
                      reported by {r.reporter?.name || "ToxiFilter"} ·{" "}
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                    {r.resolved && <span className="admin-resolved">resolved</span>}
                  </div>
                  {r.comment?.content && <p className="admin-quote">“{r.comment.content}”</p>}
                  {r.reason && <p className="admin-muted">Reason: {r.reason}</p>}
                  {r.post_id && (
                    <button className="view-post-button" onClick={() => navigate(`/post/${r.post_id}`)}>
                      View Post
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "flagged" && (
        <div className="analytics-section">
          {flaggedComments.length === 0 ? (
            <EmptyState compact icon="🛡️" title="No flagged comments">
              ToxiFilter has not had to hide any comment so far.
            </EmptyState>
          ) : (
            <div className="flagged-comments-list">
              {flaggedComments.map((c) => (
                <div key={c.id} className="flagged-comment-card">
                  <div className="comment-card-header">
                    <div>
                      <p className="commenter-name">
                        <strong>{c.user?.name || "Unknown"}</strong>{" "}
                        <span className="admin-muted">
                          ({c.user?.report_count ?? 0}/{blockThreshold} reports)
                        </span>
                      </p>
                      <p className="comment-date">{new Date(c.created_at).toLocaleString()}</p>
                      {c.post?.title && (
                        <p className="post-reference">
                          On post: <em>"{c.post.title}"</em>
                        </p>
                      )}
                    </div>
                    {c.severity && (
                      <span className="severity-badge" style={{ backgroundColor: getSeverityColor(c.severity) }}>
                        {c.severity.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="comment-content">
                    <p>{c.content}</p>
                  </div>
                  <div className="comment-metadata">
                    <div className="metadata-item">
                      <span className="metadata-label">Score:</span> {formatScore(c.toxicity_score)}
                    </div>
                    <div className="metadata-item">
                      <span className="metadata-label">Source:</span> {getSourceLabel(c.moderation_source)}
                    </div>
                    {(c.categories || []).length > 0 && (
                      <div className="categories-list">
                        {c.categories.map((cat) => (
                          <span key={cat} className="category-badge" style={{ backgroundColor: getCategoryColor(cat) }}>
                            {getCategoryDisplayName(cat)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="comment-actions">
                    <button className="view-post-button" onClick={() => navigate(`/post/${c.post_id}`)}>
                      View Post
                    </button>
                    <button className="report-button" onClick={() => deleteComment(c)}>
                      🗑️ Delete Comment
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Admin;
