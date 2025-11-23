import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "./Home.css";
import Toxi from "../assets/toxifilter.jpg";

const Home = ({ blogs, loading, showToast, user, onAuthClick }) => {
  const { isBlocked, userReportCount } = useAuth();
  // Image URLs for the slideshow - Add your image URLs here
  const heroImages = [
    "https://images.unsplash.com/photo-1556711905-4bd1b6603275?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    "https://images.unsplash.com/photo-1502465771179-51f3535da42c?q=80&w=1169&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    "https://images.unsplash.com/photo-1516414447565-b14be0adf13e?q=80&w=1073&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  ];

  const [currentImageIndex, setCurrentImageIndex] = React.useState(0);

  // Auto-advance slideshow every 5 seconds
  React.useEffect(() => {
    if (heroImages.length === 0) return;

    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % heroImages.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [heroImages.length]);

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % heroImages.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) =>
      prev === 0 ? heroImages.length - 1 : prev - 1
    );
  };

  const goToImage = (index) => {
    setCurrentImageIndex(index);
  };

  if (loading) {
    return (
      <div className="home">
        <div className="loading-state">
          <p>Loading posts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="home">
      {/* Blocked User Alert */}
      {user && isBlocked && (
        <div className="blocked-alert">
          <div className="blocked-alert-content">
            <span className="blocked-icon">🚫</span>
            <div className="blocked-text">
              <strong>Account Restricted</strong>
              <p>
                Your account has been reported {userReportCount} times and is
                blocked from commenting on posts.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="hero-section">
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title">Welcome to BlogX</h1>
            <p className="hero-description">
              Your platform for sharing ideas, stories, and insights with a
              global community. Join thousands of writers who are making their
              voices heard. Create, publish, and engage with content that
              matters.
            </p>
            {user ? (
              <Link to="/create" className="hero-cta-button">
                <span>✏️</span> Start Writing
              </Link>
            ) : (
              <button className="hero-cta-button" onClick={onAuthClick}>
                <span>🚀</span> Get Started
              </button>
            )}
          </div>
          <div className="hero-image">
            {heroImages.length > 0 ? (
              <div className="image-slideshow">
                <div className="slideshow-container">
                  {heroImages.map((image, index) => (
                    <div
                      key={index}
                      className={`slide ${
                        index === currentImageIndex ? "active" : ""
                      }`}
                      style={{ backgroundImage: `url(${image})` }}
                    />
                  ))}
                </div>
                {heroImages.length > 1 && (
                  <>
                    <button
                      className="slide-btn prev"
                      onClick={prevImage}
                      aria-label="Previous image"
                    >
                      ‹
                    </button>
                    <button
                      className="slide-btn next"
                      onClick={nextImage}
                      aria-label="Next image"
                    >
                      ›
                    </button>
                    <div className="slide-dots">
                      {heroImages.map((_, index) => (
                        <button
                          key={index}
                          className={`dot ${
                            index === currentImageIndex ? "active" : ""
                          }`}
                          onClick={() => goToImage(index)}
                          aria-label={`Go to image ${index + 1}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="image-placeholder">
                <span className="placeholder-icon">📝</span>
                <p className="placeholder-text">Your Story Here</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="home-header">
        <div className="header-content">
          <div>
            <h2>Latest Blog Posts</h2>
            <p>Explore thoughts and ideas from our community</p>
          </div>
          {user ? (
            <Link to="/create" className="create-post-button">
              ✏️ Create Post
            </Link>
          ) : (
            <button className="create-post-button" onClick={onAuthClick}>
              ✏️ Create Post (Login Required)
            </button>
          )}
        </div>
      </div>
      <div className="blog-list">
        {blogs.map((blog) => (
          <Link to={`/post/${blog.id}`} key={blog.id} className="blog-card">
            {blog.image_url && (
              <div className="blog-card-image">
                <img src={blog.image_url} alt={blog.title} />
              </div>
            )}
            <div className="blog-card-content">
              <div className="blog-card-header">
                <h3>{blog.title}</h3>
                <div className="blog-meta">
                  <span className="blog-author">By {blog.author}</span>
                  <span className="blog-date">
                    {blog.created_at
                      ? new Date(blog.created_at).toLocaleDateString()
                      : new Date(blog.date).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <p className="blog-excerpt">{blog.excerpt}</p>
              <div className="blog-card-footer">
                <span className="read-more">Read more →</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      {blogs.length === 0 && (
        <div className="empty-state">
          <p>No blog posts yet. Be the first to share your thoughts!</p>
        </div>
      )}

      {/* ToxiFilter Section */}
      <div className="toxifilter-section">
        <div className="toxifilter-header">
          <div className="toxifilter-badge">
            <span className="badge-icon">🛡️</span>
            <span className="badge-text">Powered by ToxiFilter AI</span>
          </div>
          <h2 className="toxifilter-title">
            AI-Powered Real-Time Protection Against Social Media Harassment
          </h2>
        </div>

        <div className="toxifilter-content">
          <div className="toxifilter-text">
            <div className="toxifilter-intro">
              <p>
                <strong>ToxiFilter</strong> is an intelligent, AI-driven
                moderation engine built to make social media a safer, healthier
                space. In today's digital world, harmful and toxic comments
                spread at lightning speed, often long before any human moderator
                can intervene. This creates emotional harm, discourages healthy
                conversations, and damages the overall online experience.
              </p>
            </div>

            <div className="toxifilter-features">
              <div className="feature-card">
                <div className="feature-icon">⚡</div>
                <div className="feature-content">
                  <h4>Real-Time Detection</h4>
                  <p>
                    ToxiFilter connects directly to social media APIs to
                    continuously monitor live comment streams. As soon as a user
                    posts something, it instantly analyzes and identifies
                    harmful intent.
                  </p>
                </div>
              </div>

              <div className="feature-card">
                <div className="feature-icon">🤖</div>
                <div className="feature-content">
                  <h4>AI-Generated Alternatives</h4>
                  <p>
                    The system can block or flag harmful content before it
                    reaches a wider audience, provide immediate warnings, and
                    suggest more constructive alternatives using AI-generated
                    rephrasing.
                  </p>
                </div>
              </div>

              <div className="feature-card">
                <div className="feature-icon">🚀</div>
                <div className="feature-content">
                  <h4>End-to-End Automation</h4>
                  <p>
                    Removes the need for manual moderation in high-velocity
                    environments where human review cannot keep up. Built with
                    Python (Flask/FastAPI) for low-latency processing.
                  </p>
                </div>
              </div>
            </div>

            <div className="toxifilter-technical">
              <p>
                Designed for{" "}
                <strong>
                  scalability, accuracy, and real-time responsiveness
                </strong>
                , ToxiFilter is not just a tool—it's a crucial safety layer for
                modern social platforms. Whether it's handling slang,
                multi-language content, or nuanced toxic behavior, ToxiFilter
                aims to redefine how online communities maintain healthy
                interactions.
              </p>
              <p className="toxifilter-credit">
                <span className="sparkle">✨</span> Made with ❤️ by{" "}
                <strong>Innovative D</strong>
              </p>
            </div>
          </div>

          <div className="toxifilter-visual">
            <div className="screenshot-container">
              {/* Replace with actual screenshot: */}
              <img src={Toxi} alt="ToxiFilter Dashboard" />
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">99.2%</div>
                <div className="stat-label">Accuracy Rate</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">&lt;50ms</div>
                <div className="stat-label">Response Time</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">24/7</div>
                <div className="stat-label">Active Protection</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
