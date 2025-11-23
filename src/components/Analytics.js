import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./Analytics.css";

const Analytics = ({ user, showToast }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState({
    totalPosts: 0,
    totalComments: 0,
    posts: [],
  });

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }
    fetchAnalytics();
  }, [user, navigate]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      console.log("🔍 Fetching analytics for user:", user.id);

      // Fetch all posts by this author
      const { data: posts, error: postsError } = await supabase
        .from("posts")
        .select("*")
        .eq("author_id", user.id)
        .order("created_at", { ascending: false });

      if (postsError) throw postsError;

      console.log("📝 Posts fetched:", posts.length);

      // Fetch all comments on author's posts with user details
      const postIds = posts.map((p) => p.id);
      let allComments = [];
      let flaggedComments = [];

      if (postIds.length > 0) {
        const { data: comments, error: commentsError } = await supabase
          .from("comments")
          .select(
            `
            *,
            profiles:user_id (
              id,
              name,
              email,
              report_count
            )
          `
          )
          .in("post_id", postIds)
          .order("created_at", { ascending: false });

        if (commentsError) throw commentsError;
        allComments = comments || [];
        flaggedComments = comments.filter((c) => c.is_flagged) || [];

        console.log("💬 Total comments:", allComments.length);
        console.log("🚩 Flagged comments:", flaggedComments.length);
      }

      // Calculate comment counts per post
      const postsWithCounts = posts.map((post) => ({
        ...post,
        commentCount: allComments.filter((c) => c.post_id === post.id).length,
        flaggedCount: flaggedComments.filter((c) => c.post_id === post.id)
          .length,
      }));

      console.log("📊 Analytics summary:", {
        totalPosts: posts.length,
        totalComments: allComments.length,
        totalFlagged: flaggedComments.length,
      });

      setAnalytics({
        totalPosts: posts.length,
        totalComments: allComments.length,
        totalFlagged: flaggedComments.length,
        posts: postsWithCounts,
        allComments,
        flaggedComments,
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      showToast("Error loading analytics", "error");
    } finally {
      setLoading(false);
    }
  };

  const getCategoryBadgeColor = (category) => {
    const colors = {
      hate: "#ef4444",
      threat: "#dc2626",
      harassment: "#f97316",
      profanity: "#f59e0b",
      spam: "#84cc16",
      sexual: "#ec4899",
      violence: "#b91c1c",
      bullying: "#fb923c",
    };
    return colors[category] || "#6b7280";
  };

  const getSeverityColor = (severity) => {
    const colors = {
      high: "#dc2626",
      medium: "#f59e0b",
      low: "#84cc16",
    };
    return colors[severity] || "#6b7280";
  };

  // Helper function to create SVG arc paths for pie chart
  const describeArc = (x, y, radius, startAngle, endAngle) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

    return [
      "M",
      x,
      y,
      "L",
      start.x,
      start.y,
      "A",
      radius,
      radius,
      0,
      largeArcFlag,
      0,
      end.x,
      end.y,
      "Z",
    ].join(" ");
  };

  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  };

  if (loading) {
    return (
      <div className="analytics-container">
        <div className="analytics-loading">
          <div className="loading-spinner"></div>
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <button className="back-button" onClick={() => navigate("/")}>
          ← Back to Home
        </button>
        <h1>📊 ToxiFilter Analytics Dashboard</h1>
        <p>
          Comprehensive insights into your posts and community engagement with
          the power of ToxiFilter
        </p>
      </div>

      {/* Overview Cards */}
      <div className="analytics-overview">
        <div className="stat-card stat-card-posts">
          <div className="stat-icon">📝</div>
          <div className="stat-content">
            <h3>Total Posts</h3>
            <p className="stat-number">{analytics.totalPosts}</p>
          </div>
        </div>

        <div className="stat-card stat-card-comments">
          <div className="stat-icon">💬</div>
          <div className="stat-content">
            <h3>Total Comments</h3>
            <p className="stat-number">{analytics.totalComments}</p>
          </div>
        </div>

        <div className="stat-card stat-card-flagged">
          <div className="stat-icon">🚩</div>
          <div className="stat-content">
            <h3>Flagged Comments</h3>
            <p className="stat-number">{analytics.totalFlagged || 0}</p>
          </div>
        </div>
      </div>

      {/* Analytics Graphs */}
      <div className="analytics-section">
        <h2>📈 Activity Overview</h2>
        <div className="charts-container">
          {/* Bar Chart */}
          <div className="chart-card">
            <h3>Content Statistics</h3>
            <div className="bar-chart">
              <div className="bar-group">
                <div className="bar-wrapper">
                  <div
                    className="bar bar-posts"
                    style={{
                      height: `${Math.max(
                        (analytics.totalPosts /
                          Math.max(
                            analytics.totalPosts,
                            analytics.totalComments,
                            analytics.totalFlagged,
                            1
                          )) *
                          100,
                        5
                      )}%`,
                    }}
                  >
                    <span className="bar-value">{analytics.totalPosts}</span>
                  </div>
                  <span className="bar-label">Posts</span>
                </div>
                <div className="bar-wrapper">
                  <div
                    className="bar bar-comments"
                    style={{
                      height: `${Math.max(
                        (analytics.totalComments /
                          Math.max(
                            analytics.totalPosts,
                            analytics.totalComments,
                            analytics.totalFlagged,
                            1
                          )) *
                          100,
                        5
                      )}%`,
                    }}
                  >
                    <span className="bar-value">{analytics.totalComments}</span>
                  </div>
                  <span className="bar-label">Comments</span>
                </div>
                <div className="bar-wrapper">
                  <div
                    className="bar bar-flagged"
                    style={{
                      height: `${Math.max(
                        (analytics.totalFlagged /
                          Math.max(
                            analytics.totalPosts,
                            analytics.totalComments,
                            analytics.totalFlagged,
                            1
                          )) *
                          100,
                        5
                      )}%`,
                    }}
                  >
                    <span className="bar-value">{analytics.totalFlagged}</span>
                  </div>
                  <span className="bar-label">Flagged</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pie Chart for Moderation Health */}
          <div className="chart-card">
            <h3>Community Health</h3>
            <div className="pie-chart-container">
              {analytics.totalComments > 0 ? (
                <>
                  <svg viewBox="0 0 200 200" className="pie-chart">
                    {(() => {
                      const cleanComments =
                        analytics.totalComments - analytics.totalFlagged;
                      const cleanPercent =
                        (cleanComments / analytics.totalComments) * 100;

                      const cleanAngle = (cleanPercent / 100) * 360;

                      const cleanPath = describeArc(
                        100,
                        100,
                        80,
                        0,
                        cleanAngle
                      );
                      const flaggedPath = describeArc(
                        100,
                        100,
                        80,
                        cleanAngle,
                        360
                      );

                      return (
                        <>
                          <path
                            d={cleanPath}
                            fill="#10b981"
                            opacity="0.8"
                            className="pie-slice"
                          />
                          <path
                            d={flaggedPath}
                            fill="#ef4444"
                            opacity="0.8"
                            className="pie-slice"
                          />
                          <circle cx="100" cy="100" r="50" fill="#111827" />
                          <text
                            x="100"
                            y="95"
                            textAnchor="middle"
                            fill="#f1f5f9"
                            fontSize="24"
                            fontWeight="bold"
                          >
                            {cleanPercent.toFixed(0)}%
                          </text>
                          <text
                            x="100"
                            y="115"
                            textAnchor="middle"
                            fill="#94a3b8"
                            fontSize="12"
                          >
                            Clean
                          </text>
                        </>
                      );
                    })()}
                  </svg>
                  <div className="pie-legend">
                    <div className="legend-item">
                      <span
                        className="legend-color"
                        style={{ backgroundColor: "#10b981" }}
                      ></span>
                      <span className="legend-text">
                        Clean Comments (
                        {analytics.totalComments - analytics.totalFlagged})
                      </span>
                    </div>
                    <div className="legend-item">
                      <span
                        className="legend-color"
                        style={{ backgroundColor: "#ef4444" }}
                      ></span>
                      <span className="legend-text">
                        Flagged Comments ({analytics.totalFlagged})
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="no-data-message">
                  <p>No comments data yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Posts Breakdown */}
      <div className="analytics-section">
        <h2>📝 Posts Breakdown</h2>
        {analytics.posts.length === 0 ? (
          <div className="empty-state">
            <p>No posts yet. Create your first post!</p>
          </div>
        ) : (
          <div className="posts-table-container">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Created</th>
                  <th>Comments</th>
                  <th>Flagged</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {analytics.posts.map((post) => (
                  <tr key={post.id}>
                    <td className="post-title-cell">
                      <strong>{post.title}</strong>
                    </td>
                    <td>{new Date(post.created_at).toLocaleDateString()}</td>
                    <td>
                      <span className="badge badge-info">
                        {post.commentCount}
                      </span>
                    </td>
                    <td>
                      {post.flaggedCount > 0 ? (
                        <span className="badge badge-warning">
                          {post.flaggedCount}
                        </span>
                      ) : (
                        <span className="badge badge-success">0</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="view-button"
                        onClick={() => navigate(`/post/${post.id}`)}
                      >
                        View Post
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Flagged Comments Section */}
      {analytics.flaggedComments && analytics.flaggedComments.length > 0 && (
        <div className="analytics-section">
          <h2>🚩 Flagged Comments Details</h2>
          <p className="section-subtitle">
            All comments flagged by the moderation system across your posts
          </p>
          <div className="flagged-comments-list">
            {analytics.flaggedComments.map((comment) => {
              const post = analytics.posts.find(
                (p) => p.id === comment.post_id
              );
              return (
                <div key={comment.id} className="flagged-comment-card">
                  <div className="comment-card-header">
                    <div className="commenter-info">
                      <div className="commenter-avatar">
                        {comment.profiles?.name
                          ? comment.profiles.name.charAt(0).toUpperCase()
                          : "?"}
                      </div>
                      <div>
                        <p className="commenter-name">
                          <strong>
                            {comment.profiles?.name || "Anonymous User"}
                          </strong>
                          {comment.profiles?.report_count >= 3 && (
                            <span className="blocked-indicator-inline">
                              🚫 Blocked
                            </span>
                          )}
                        </p>
                        <p className="comment-date">
                          {new Date(comment.created_at).toLocaleString()}
                        </p>
                        {post && (
                          <p className="post-reference">
                            On post: <em>"{post.title}"</em>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="severity-badge-container">
                      {comment.severity && (
                        <span
                          className="severity-badge"
                          style={{
                            backgroundColor: getSeverityColor(comment.severity),
                          }}
                        >
                          {comment.severity.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="comment-content">
                    <p>{comment.content}</p>
                  </div>

                  <div className="comment-metadata">
                    {comment.toxicity_score && (
                      <div className="metadata-item">
                        <span className="metadata-label">Toxicity Score:</span>
                        <div className="toxicity-bar-container">
                          <div
                            className="toxicity-bar"
                            style={{
                              width: `${comment.toxicity_score * 100}%`,
                              backgroundColor:
                                comment.toxicity_score > 0.7
                                  ? "#dc2626"
                                  : comment.toxicity_score > 0.4
                                  ? "#f59e0b"
                                  : "#84cc16",
                            }}
                          >
                            <span className="toxicity-percentage">
                              {(comment.toxicity_score * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {comment.categories && comment.categories.length > 0 && (
                      <div className="metadata-item">
                        <span className="metadata-label">Categories:</span>
                        <div className="categories-list">
                          {comment.categories.map((category, idx) => (
                            <span
                              key={idx}
                              className="category-badge"
                              style={{
                                backgroundColor:
                                  getCategoryBadgeColor(category),
                              }}
                            >
                              {category}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {comment.source && (
                      <div className="metadata-item">
                        <span className="metadata-label">
                          Detection Source:
                        </span>
                        <span className="source-badge">
                          {comment.source === "huggingface"
                            ? "🤗 Hugging Face AI"
                            : comment.source === "openai"
                            ? "🤖 OpenAI"
                            : comment.source === "keyword"
                            ? "🔍 Keyword Filter"
                            : comment.source}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="comment-actions">
                    <button
                      className="view-post-button"
                      onClick={() => navigate(`/post/${comment.post_id}`)}
                    >
                      View Post
                    </button>
                    <div className="comment-meta-info">
                      <span className="info-label">User Email:</span>
                      <span className="info-value">
                        {comment.profiles?.email || "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
