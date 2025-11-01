import React from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      {/* Header */}
      <header className="landing-header">
        <div className="landing-header-content">
          <div className="logo-section">
            <span className="logo-icon">🦋</span>
            <span className="logo-text">L3V3L</span>
          </div>
          <div className="header-actions">
            <span className="already-member">Already a member?</span>
            <button className="btn-login" onClick={() => navigate('/login')}>
              LOG IN
            </button>
            <button className="btn-help">
              ❓ Help
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content-centered">
          <div className="butterfly-animation">🦋</div>
          <h1 className="hero-title">
            Transform Your Search.<br/>
            Discover True Compatibility.
          </h1>
          <p className="hero-subtitle">
            L3V3L uses AI to analyze 50+ compatibility factors, creating meaningful connections beyond surface-level matching. Your perfect match isn't random—it's calculated.
          </p>
          
          <div className="hero-cta">
            <button className="btn-get-started" onClick={() => navigate('/register2')}>
              Get Started Free
            </button>
            <button className="btn-learn-more" onClick={() => document.querySelector('.how-it-works').scrollIntoView({ behavior: 'smooth' })}>
              Learn How It Works
            </button>
          </div>

          <div className="hero-features">
            <div className="hero-feature">
              <span className="feature-icon">🧬</span>
              <span className="feature-text">Deep Compatibility Analysis</span>
            </div>
            <div className="hero-feature">
              <span className="feature-icon">🎯</span>
              <span className="feature-text">Precision Matching Algorithm</span>
            </div>
            <div className="hero-feature">
              <span className="feature-icon">🔒</span>
              <span className="feature-text">Privacy-First Approach</span>
            </div>
          </div>
        </div>
      </section>

      {/* How L3V3L Works Section */}
      <section className="how-it-works">
        <h2 className="section-title">How L3V3L Transforms Matchmaking</h2>
        <p className="section-subtitle">Science meets intuition. Data meets destiny.</p>
        
        <div className="process-grid">
          <div className="process-step">
            <div className="step-number">1</div>
            <div className="step-icon">📝</div>
            <h3>Complete Your Profile</h3>
            <p>Share your values, interests, lifestyle, and aspirations. Our AI analyzes what truly matters.</p>
          </div>
          
          <div className="process-step">
            <div className="step-number">2</div>
            <div className="step-icon">🧠</div>
            <h3>AI Analyzes 50+ Factors</h3>
            <p>Our algorithm evaluates compatibility across personality, values, lifestyle, goals, and communication styles.</p>
          </div>
          
          <div className="process-step">
            <div className="step-number">3</div>
            <div className="step-icon">✨</div>
            <h3>Receive Your L3V3L Score</h3>
            <p>Get personalized match scores (0-100) showing compatibility potential with each profile.</p>
          </div>
          
          <div className="process-step">
            <div className="step-number">4</div>
            <div className="step-icon">💬</div>
            <h3>Connect Meaningfully</h3>
            <p>Start conversations with matches that share your values and vision for the future.</p>
          </div>
        </div>
      </section>

      {/* L3V3L Difference Section */}
      <section className="stats-section">
        <div className="stats-container">
          <div className="stat-item">
            <div className="stat-icon">🧬</div>
            <div className="stat-content">
              <div className="stat-value">50+</div>
              <div className="stat-label">Compatibility Factors Analyzed</div>
              <div className="stat-description">Values, lifestyle, goals, personality & more</div>
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-icon">🎯</div>
            <div className="stat-content">
              <div className="stat-value">0-100</div>
              <div className="stat-label">L3V3L Score Range</div>
              <div className="stat-description">Scientific compatibility measurement</div>
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-icon">🦋</div>
            <div className="stat-content">
              <div className="stat-value">Transform</div>
              <div className="stat-label">Your Search Journey</div>
              <div className="stat-description">From random to meaningful connections</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <h2 className="features-title">The L3V3L Difference</h2>
        <p className="features-subtitle">Why traditional matchmaking falls short—and how we're different</p>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🦋</div>
            <h3>Metamorphosis Philosophy</h3>
            <p>Just as a butterfly transforms, we help you evolve from searching to finding. Growth-focused matching that adapts with you.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🧬</div>
            <h3>Deep Compatibility DNA</h3>
            <p>Beyond photos and bio. We analyze personality traits, values alignment, lifestyle compatibility, communication patterns, and future goals.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🎯</div>
            <h3>Precision Over Volume</h3>
            <p>Quality matches, not endless scrolling. Our AI ranks profiles by genuine compatibility, not just proximity or popularity.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3>Privacy-First Design</h3>
            <p>Your personal information is protected with PII controls and MFA security. Share what you want, when you want, with whom you want.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Transparent Scoring</h3>
            <p>See exactly why you match. Understand your compatibility breakdown across all 50+ factors—no black box algorithms.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">💡</div>
            <h3>Continuous Learning</h3>
            <p>Our AI improves with every interaction. Your preferences, feedback, and behavior refine future matches for better results.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-section">
            <h4>L3V3L Matrimony</h4>
            <p>Find your perfect match with AI-powered compatibility</p>
          </div>
          <div className="footer-section">
            <h4>Quick Links</h4>
            <ul>
              <li><a href="/about">About Us</a></li>
              <li><a href="/contact">Contact</a></li>
              <li><a href="/terms">Terms & Conditions</a></li>
              <li><a href="/privacy">Privacy Policy</a></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Contact</h4>
            <p>Email: support@l3v3lmatch.com</p>
            <p>Phone: +1 800-800-1234</p>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2025 L3V3L Matrimony. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
