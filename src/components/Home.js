import React from "react";
import { Link } from "react-router-dom";
import "./Home.css";

const Home = ({ blogs, loading, showToast, user, onAuthClick }) => {
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
          </Link>
        ))}
      </div>
      {blogs.length === 0 && (
        <div className="empty-state">
          <p>No blog posts yet. Be the first to share your thoughts!</p>
        </div>
      )}
    </div>
  );
};

export default Home;
