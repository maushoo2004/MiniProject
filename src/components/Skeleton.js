import React from "react";
import "./Skeleton.css";

/** One grey, softly shimmering block. Decorative: the wrappers below announce "loading" once. */
export const Skeleton = ({ w = "100%", h = "1rem", r, className = "", style }) => (
  <span className={`sk ${className}`} style={{ width: w, height: h, borderRadius: r, ...style }} aria-hidden="true" />
);

const Busy = ({ label, className = "", children }) => (
  <div className={className} role="status" aria-busy="true" aria-live="polite">
    <span className="sr-only">{label}</span>
    {children}
  </div>
);

/** Home page: a grid of blog-card placeholders (same shape as the real cards). */
export const HomeSkeleton = ({ count = 6 }) => (
  <Busy label="Loading posts…" className="hm-grid">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="hm-card glass sk-card">
        <Skeleton h="auto" r="0" className="sk-cover" />
        <div className="hm-card-body">
          <Skeleton w="82%" h="1.2rem" />
          <Skeleton w="100%" h="0.85rem" />
          <Skeleton w="70%" h="0.85rem" />
          <div className="sk-row sk-card-meta">
            <Skeleton w="32px" h="32px" r="50%" />
            <div className="sk-col">
              <Skeleton w="45%" h="0.75rem" />
              <Skeleton w="65%" h="0.65rem" />
            </div>
          </div>
        </div>
      </div>
    ))}
  </Busy>
);

/** A single blog post page. */
export const PostSkeleton = () => (
  <Busy label="Loading post…" className="blog-post">
    <Skeleton w="140px" h="2.2rem" r="8px" className="sk-gap" />
    <div className="post-content glass sk-post">
      <Skeleton w="72%" h="2.2rem" />
      <div className="sk-row">
        <Skeleton w="32px" h="32px" r="50%" />
        <Skeleton w="180px" h="0.8rem" />
      </div>
      <Skeleton h="220px" r="12px" />
      {[100, 96, 100, 88, 94, 60].map((w, i) => (
        <Skeleton key={i} w={`${w}%`} h="0.9rem" />
      ))}
    </div>
    <div className="sk-comments">
      <Skeleton w="170px" h="1.4rem" />
      <Skeleton h="110px" r="12px" />
    </div>
  </Busy>
);

/** Analytics and Admin dashboards: header, stat tiles, two panels. */
export const AnalyticsSkeleton = () => (
  <Busy label="Loading dashboard…" className="analytics-container sk-dash">
    <Skeleton w="260px" h="2rem" />
    <div className="sk-stats">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="glass sk-stat">
          <Skeleton w="44%" h="0.8rem" />
          <Skeleton w="30%" h="2rem" />
        </div>
      ))}
    </div>
    <div className="sk-panels">
      <div className="glass sk-panel">
        <Skeleton w="40%" h="1.1rem" />
        <Skeleton h="150px" r="10px" />
      </div>
      <div className="glass sk-panel">
        <Skeleton w="40%" h="1.1rem" />
        <Skeleton h="150px" r="10px" />
      </div>
    </div>
  </Busy>
);

/** Generic page: a title and a block of lines (forms, route guards). */
export const PageSkeleton = ({ label = "Loading…" }) => (
  <Busy label={label} className="sk-page">
    <Skeleton w="38%" h="2rem" />
    <Skeleton h="0.9rem" />
    <Skeleton w="84%" h="0.9rem" />
    <Skeleton h="260px" r="12px" />
  </Busy>
);
