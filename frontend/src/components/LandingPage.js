import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SEO from './SEO';
import { getPageSEO, getOrganizationSchema, getWebsiteSchema, injectStructuredData } from '../utils/seo';
import './LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate();

  // Inject structured data for SEO
  useEffect(() => {
    const schemas = [
      getOrganizationSchema(),
      getWebsiteSchema()
    ];
    injectStructuredData(schemas);
  }, []);

  // Get page-specific SEO data
  const pageSEO = getPageSEO('home');

  return (
    <>
      {/* SEO Meta Tags */}
      <SEO
        title={pageSEO.title}
        description={pageSEO.description}
        keywords={pageSEO.keywords}
        url={pageSEO.url}
        type={pageSEO.type}
      />
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

      {/* About Us Section */}
      <section className="about-section">
        <div className="about-container">
          <div className="about-content">
            <h2 className="section-title">About L3V3L Matches</h2>
            <p className="about-description">
              L3V3L Matches is a premium <strong>matrimonial and matchmaking platform</strong> designed to help individuals find meaningful, long-term relationships leading to marriage. Founded with the belief that compatibility goes beyond surface-level attraction, we use advanced AI algorithms to analyze 50+ compatibility factors.
            </p>
            <p className="about-description">
              Our platform serves individuals seeking serious relationships and marriage partners. We prioritize <strong>privacy, safety, and genuine connections</strong> over casual dating. Every profile is verified, and our matching system focuses on values, lifestyle compatibility, and long-term relationship potential.
            </p>
            <div className="about-highlights">
              <div className="highlight-item">
                <span className="highlight-icon">✓</span>
                <span>Verified Profiles Only</span>
              </div>
              <div className="highlight-item">
                <span className="highlight-icon">✓</span>
                <span>Marriage-Focused Matching</span>
              </div>
              <div className="highlight-item">
                <span className="highlight-icon">✓</span>
                <span>18+ Adults Only</span>
              </div>
              <div className="highlight-item">
                <span className="highlight-icon">✓</span>
                <span>Privacy-First Approach</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What We Offer Section */}
      <section className="services-section">
        <h2 className="section-title">What We Offer</h2>
        <p className="section-subtitle">Comprehensive matchmaking services designed for serious relationships</p>
        
        <div className="services-grid">
          <div className="service-card">
            <div className="service-icon">🧬</div>
            <h3>AI-Powered Compatibility Matching</h3>
            <p>Our proprietary L3V3L algorithm analyzes <strong>50+ compatibility factors</strong> including personality traits, values, lifestyle preferences, communication styles, and life goals to calculate a precise compatibility score (0-100) for every potential match.</p>
          </div>
          
          <div className="service-card">
            <div className="service-icon">👤</div>
            <h3>Verified Profile Creation</h3>
            <p>Create a comprehensive profile showcasing your personality, interests, family background, education, career, and partner preferences. All profiles undergo verification to ensure authenticity and serious intent.</p>
          </div>
          
          <div className="service-card">
            <div className="service-icon">🔍</div>
            <h3>Advanced Search & Discovery</h3>
            <p>Find compatible matches using powerful search filters including age, location, education, profession, religion, lifestyle habits, and more. Our smart recommendations surface profiles most likely to be compatible with you.</p>
          </div>
          
          <div className="service-card">
            <div className="service-icon">💬</div>
            <h3>Secure Messaging Platform</h3>
            <p>Connect with matches through our secure in-app messaging system. Premium members enjoy unlimited messaging, read receipts, and real-time chat notifications to facilitate meaningful conversations.</p>
          </div>
          
          <div className="service-card">
            <div className="service-icon">🔒</div>
            <h3>Privacy & PII Protection</h3>
            <p>Your personal information is protected with enterprise-grade security. Control who sees your contact details, photos, and sensitive information with granular privacy settings and PII access controls.</p>
          </div>
          
          <div className="service-card">
            <div className="service-icon">📊</div>
            <h3>Compatibility Insights</h3>
            <p>Understand <strong>why</strong> you match with someone. View detailed compatibility breakdowns across 8 categories: values, lifestyle, personality, career, family, communication, goals, and interests.</p>
          </div>
        </div>
        
        <div className="services-cta">
          <p>Ready to find your life partner?</p>
          <button className="btn-get-started" onClick={() => navigate('/register2')}>
            Start Your Journey Free
          </button>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="pricing-section">
        <h2 className="section-title">Membership Plans</h2>
        <p className="section-subtitle">Choose the plan that fits your journey</p>
        
        <div className="pricing-grid">
          <div className="pricing-card">
            <div className="pricing-header">
              <h3>Free</h3>
              <div className="pricing-price">
                <span className="price-amount">$0</span>
                <span className="price-period">/month</span>
              </div>
            </div>
            <ul className="pricing-features">
              <li>✓ Create your profile</li>
              <li>✓ Browse profiles</li>
              <li>✓ View L3V3L compatibility scores</li>
              <li>✓ Basic search filters</li>
              <li>✗ Send messages</li>
              <li>✗ See who viewed you</li>
            </ul>
            <button className="btn-pricing" onClick={() => navigate('/register2')}>Get Started</button>
          </div>
          
          <div className="pricing-card featured">
            <div className="pricing-badge">Most Popular</div>
            <div className="pricing-header">
              <h3>Premium</h3>
              <div className="pricing-price">
                <span className="price-amount">$29</span>
                <span className="price-period">/month</span>
              </div>
            </div>
            <ul className="pricing-features">
              <li>✓ Everything in Free</li>
              <li>✓ Unlimited messaging</li>
              <li>✓ See who viewed your profile</li>
              <li>✓ Advanced search filters</li>
              <li>✓ Priority customer support</li>
              <li>✓ Hide your activity</li>
            </ul>
            <button className="btn-pricing featured" onClick={() => navigate('/register2')}>Start Free Trial</button>
          </div>
          
          <div className="pricing-card">
            <div className="pricing-header">
              <h3>Premium Plus</h3>
              <div className="pricing-price">
                <span className="price-amount">$49</span>
                <span className="price-period">/month</span>
              </div>
            </div>
            <ul className="pricing-features">
              <li>✓ Everything in Premium</li>
              <li>✓ Profile boost (3x visibility)</li>
              <li>✓ Dedicated matchmaker support</li>
              <li>✓ Verified badge on profile</li>
              <li>✓ Read receipts on messages</li>
              <li>✓ Early access to new features</li>
            </ul>
            <button className="btn-pricing" onClick={() => navigate('/register2')}>Get Started</button>
          </div>
        </div>
        
        <p className="pricing-note">
          All paid plans include a 7-day free trial. Cancel anytime. See our <a href="/terms">Terms of Service</a> and <a href="/privacy">Refund Policy</a> for details.
        </p>
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
          <div className="footer-section footer-brand">
            <h4>🦋 L3V3L Matches</h4>
            <p>Premium matrimonial matchmaking platform using AI-powered compatibility analysis to help you find your life partner.</p>
            <div className="social-links">
              <a href="https://instagram.com/l3v3lmatches" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                <span className="social-icon">📷</span> @l3v3lmatches
              </a>
            </div>
          </div>
          <div className="footer-section">
            <h4>Company</h4>
            <ul>
              <li><a href="/l3v3l-info">About L3V3L</a></li>
              <li><a href="/help">Help Center</a></li>
              <li><a href="/contact">Contact Us</a></li>
              <li><a href="/testimonials">Success Stories</a></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Legal</h4>
            <ul>
              <li><a href="/terms">Terms of Service</a></li>
              <li><a href="/privacy">Privacy Policy</a></li>
              <li><a href="/community-guidelines">Community Guidelines</a></li>
              <li><a href="/cookie-policy">Cookie Policy</a></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Contact Us</h4>
            <p><strong>Email:</strong> support@l3v3lmatches.com</p>
            <p><strong>Phone:</strong> +1 (800) 555-L3V3L</p>
            <p><strong>Hours:</strong> Mon-Fri 9AM-6PM PST</p>
            <p className="footer-address">
              L3V3L Matches Inc.<br/>
              San Francisco, CA, USA
            </p>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2025 L3V3L Matches Inc. All rights reserved.</p>
          <p className="footer-disclaimer">L3V3L Matches is a matrimonial matchmaking service for adults 18+ seeking marriage partners.</p>
        </div>
      </footer>
    </div>
    </>
  );
};

export default LandingPage;
