import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import SEO from './SEO';
import { getPageSEO, getOrganizationSchema, getWebsiteSchema, injectStructuredData } from '../utils/seo';
import { trustedDeviceAutoLogin } from '../api';
import socketService from '../services/socketService';
import sessionManager from '../services/sessionManager';
import {
  clearTrustedDeviceToken,
  getTrustedDeviceContext,
  getTrustedDeviceToken,
} from '../utils/trustedDevice';
import './LandingPage.css';

const getHomeRoute = (homePage) => {
  const homeRoutes = {
    dashboard: '/dashboardv2',
    search: '/search',
    messages: '/messages',
  };
  return homeRoutes[homePage] || '/dashboardv2';
};

const LandingPage = () => {
  const navigate = useNavigate();

  const [topLoginStatus, setTopLoginStatus] = useState('');
  const [topLoginLoading, setTopLoginLoading] = useState(false);

  const completeLogin = useCallback((data) => {
    const user = data.user || {};
    const username = user.username || '';
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('username', username);
    if (data.refresh_token) localStorage.setItem('refreshToken', data.refresh_token);
    localStorage.setItem('userStatus', user.accountStatus || 'active');
    localStorage.setItem('userRole', user.role_name || user.role || data.role || 'free_user');
    const homePage = user.homePage || localStorage.getItem('homePage') || 'dashboard';
    localStorage.setItem('homePage', homePage);
    localStorage.removeItem('appTheme');
    sessionStorage.removeItem('photoReminderDismissed');
    sessionManager.init();
    socketService.connect(username);
    window.dispatchEvent(new Event('loginStatusChanged'));
    window.dispatchEvent(new Event('userLoggedIn'));
    navigate(getHomeRoute(homePage), { replace: true, state: { user } });
  }, [navigate]);

  const handleTopLoginClick = useCallback(async () => {
    setTopLoginLoading(true);
    setTopLoginStatus('Checking auto-login...');

    const trustedToken = getTrustedDeviceToken();
    if (!trustedToken) {
      setTopLoginStatus('Auto-login not enabled. Redirecting to login...');
      setTopLoginLoading(false);
      navigate('/login');
      return;
    }

    try {
      const deviceContext = getTrustedDeviceContext();
      const autoLoginResponse = await trustedDeviceAutoLogin({
        trusted_device_token: trustedToken,
        device_id: deviceContext.deviceId,
        app_id: deviceContext.appId,
      });

      if (autoLoginResponse?.access_token && autoLoginResponse?.user?.username) {
        setTopLoginStatus('Auto-login enabled. Logging you in...');
        completeLogin(autoLoginResponse);
        return;
      }

      clearTrustedDeviceToken(trustedToken);
      setTopLoginStatus('Auto-login not enabled. Redirecting to login...');
      navigate('/login');
    } catch (_) {
      clearTrustedDeviceToken(trustedToken);
      setTopLoginStatus('Auto-login failed. Redirecting to login...');
      navigate('/login');
    } finally {
      setTopLoginLoading(false);
    }
  }, [completeLogin, navigate]);

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
      {/* Hero Section — Split Layout with merged header */}
      <section
        className="hero-section lp-hero-split lp-hero-backdrop"
        style={{
          background: `linear-gradient(125deg, rgba(39, 19, 7, 0.58) 0%, rgba(33, 15, 8, 0.42) 52%, rgba(18, 15, 22, 0.52) 100%), url('/images/hands_color1.jpeg') center center / cover no-repeat`,
        }}
      >
        <div className="lp-hero-container">
        <div className="lp-hero-topline">
          <div className="lp-hero-top-brand">
            <span className="lp-brand-purple"><span aria-hidden="true">🦋</span> L3V3L Matches</span>
            <span className="lp-brand-red lp-brand-tagline">premium community matrimonial platform</span>
          </div>
          <button
            type="button"
            className="lp-hero-top-login"
            onClick={handleTopLoginClick}
            disabled={topLoginLoading}
          >
            {topLoginLoading ? 'CHECKING...' : 'LOGIN'}
          </button>
        </div>
        {topLoginStatus && <p className="lp-hero-top-status">{topLoginStatus}</p>}
        <div className="lp-hero-main">
        <div className="lp-hero-left">
          <div className="lp-trust-pill">
            <span className="lp-trust-check">✓</span>
            Search with confidence. Every profile on L3V3LMatches.com is genuine, verified, and community‑collected — supporting families in finding the right match
          </div>
          <h1 className="hero-title lp-hero-title-dark">
            Transform Your Search.<br/>
            Discover <span className="lp-title-accent">True Compatibility.</span>
          </h1>
          <p className="hero-subtitle lp-subtitle-dark">
            L3V3L uses AI to analyze 50+ compatibility factors, creating meaningful connections beyond surface-level matching. Your perfect match isn't random—it's calculated.
          </p>
          <div className="hero-cta">
            <button className="btn-register-profile" onClick={() => navigate('/register-interest')}>
              Register Profile
            </button>
            <button className="btn-learn-more" onClick={() => document.querySelector('.how-it-works').scrollIntoView({ behavior: 'smooth' })}>
              ↓ Learn How It Works
            </button>
          </div>
        </div>
        </div>
        </div>
      </section>

      {/* Stats Bar */}
      <div className="lp-stats-bar">
        <div className="lp-stat"><div className="lp-stat-number">1,000+</div><div className="lp-stat-label">Verified Profiles</div></div>
        <div className="lp-stat"><div className="lp-stat-number">50+</div><div className="lp-stat-label">Successful Matches</div></div>
        <div className="lp-stat"><div className="lp-stat-number">50+</div><div className="lp-stat-label">Compatibility Factors</div></div>
        <div className="lp-stat"><div className="lp-stat-number">98%</div><div className="lp-stat-label">Profile Verification</div></div>
      </div>

      {/* How L3V3L Works Section */}
      <section className="how-it-works">
        <span className="how-title-badge">How L3V3L Transforms Matchmaking</span>
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

      {/* L3V3L Philosophy Section */}
      <section className="philosophy-section">
        <div className="philosophy-header">
          <span className="philosophy-title-badge">🦋 L3V3L: A Fresh Dating Philosophy</span>
          <p className="philosophy-subtitle">A fresh, dating-inspired meaning—something modern, playful, and emotionally resonant.</p>
        </div>
        
        <div className="philosophy-intro">
          <h3>🦋 L3V3L: Love, Loyalty, Laughter, Vulnerability, Elevation, Loyalty (again)</h3>
          <p className="philosophy-description">
            <strong>L3V3L</strong> is a relationship philosophy that defines the emotional depth and compatibility between two people. Each letter represents a key pillar of a meaningful connection:
          </p>
        </div>
        
        <div className="pillars-container">
          <div className="pillar-card">
            <div className="pillar-badge">L</div>
            <h3>Love</h3>
            <p className="pillar-description">The spark, the chemistry, the butterflies. Where it all begins.</p>
          </div>
          
          <div className="pillar-card">
            <div className="pillar-badge">3</div>
            <h3>Loyalty, Laughter, and Vulnerability</h3>
            <p className="pillar-description">
              The trio that makes love sustainable. <strong>Loyalty</strong> builds trust, <strong>laughter</strong> keeps it light, and <strong>vulnerability</strong> deepens intimacy.
            </p>
          </div>
          
          <div className="pillar-card">
            <div className="pillar-badge">V</div>
            <h3>Vulnerability</h3>
            <p className="pillar-description">
              A double emphasis—because opening up is hard, but essential. True connection requires authenticity.
            </p>
          </div>
          
          <div className="pillar-card">
            <div className="pillar-badge">3</div>
            <h3>Elevation, Empathy, and Effort</h3>
            <p className="pillar-description">
              Relationships thrive when both partners lift each other up, understand each other, and show up consistently.
            </p>
          </div>
          
          <div className="pillar-card">
            <div className="pillar-badge">L</div>
            <h3>Loyalty (again)</h3>
            <p className="pillar-description">
              Because loyalty isn't a one-time thing—it's a daily choice. Consistency matters.
            </p>
          </div>
        </div>
      </section>


      {/* About Us Section */}
      <section className="about-section">
        <div className="about-container">
          <div className="about-content">
            <span className="about-title-badge">About L3V3L Matches</span>
            <p className="about-description">
              L3V3L Matches is a premium <strong>matrimonial and matchmaking platform</strong> designed to help individuals find meaningful, long-term relationships leading to marriage. Founded with the belief that compatibility goes beyond surface-level attraction, we use advanced AI to analyze what truly matters in a life partner.
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
        <span className="services-title-badge">What We Offer</span>
        <p className="section-subtitle">Comprehensive matchmaking services designed for serious relationships</p>
        
        <div className="services-grid">
          <div className="service-card">
            <div className="service-icon">🧬</div>
            <h3>AI-Powered Compatibility Matching</h3>
            <p>Our proprietary L3V3L algorithm analyzes personality traits, values, lifestyle preferences, communication styles, and life goals to calculate a precise compatibility score (0-100) for every potential match.</p>
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
          <button className="btn-get-started" onClick={() => navigate('/login')}>
            Member Login
          </button>
        </div>
      </section>

      {/* Events & Meetups Section */}
      <section className="events-unified-section">
        <span className="meetups-title-badge">Events & Meetups</span>
        <p className="section-subtitle">Connect online and in person — wherever you are</p>
        
        <div className="events-tabs">
          {/* Virtual Events */}
          <div className="events-category">
            <div className="events-category-header">
              <span className="category-badge">🎥 Virtual</span>
              <h3>Online Meetups & Zoom Sessions</h3>
            </div>
            <div className="meetups-grid">
              <div className="meetup-card">
                <div className="meetup-icon">🎯</div>
                <h3>Speed Dating Sessions</h3>
                <p>5-minute rotating video chats with pre-matched compatible members. Meet 8-10 potential matches in one evening.</p>
                <span className="meetup-frequency">Every Saturday • 7 PM PST</span>
              </div>
              <div className="meetup-card">
                <div className="meetup-icon">💬</div>
                <h3>Compatibility Workshops</h3>
                <p>Interactive group sessions led by relationship experts on values, communication, and what makes relationships work.</p>
                <span className="meetup-frequency">Bi-weekly • Wednesdays</span>
              </div>
              <div className="meetup-card">
                <div className="meetup-icon">🌍</div>
                <h3>Cultural Connection Calls</h3>
                <p>Themed meetups celebrating diverse backgrounds. Connect with members who share your heritage and values.</p>
                <span className="meetup-frequency">Monthly • Various times</span>
              </div>
            </div>
          </div>

          {/* In-Person Events */}
          <div className="events-category">
            <div className="events-category-header">
              <span className="category-badge">🎉 In-Person</span>
              <h3>Social Events Across the US</h3>
            </div>
            <div className="events-grid">
              <div className="event-card">
                <div className="event-image-placeholder">🍷</div>
                <div className="event-details">
                  <h3>Wine & Dine Mixers</h3>
                  <p>Elegant evening events at upscale venues with fine wine, gourmet appetizers, and meaningful conversations.</p>
                  <span className="event-location">📍 San Francisco, LA, NYC</span>
                </div>
              </div>
              <div className="event-card">
                <div className="event-image-placeholder">🎨</div>
                <div className="event-details">
                  <h3>Activity-Based Meetups</h3>
                  <p>Cooking classes, art workshops, hiking groups — bond over shared interests while getting to know potential partners.</p>
                  <span className="event-location">📍 Multiple cities</span>
                </div>
              </div>
              <div className="event-card">
                <div className="event-image-placeholder">🎭</div>
                <div className="event-details">
                  <h3>Cultural Celebrations</h3>
                  <p>Festival gatherings, holiday parties, and cultural events. Celebrate traditions with like-minded individuals.</p>
                  <span className="event-location">📍 Nationwide</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="events-highlights">
          <div className="highlight-stat">
            <span className="stat-number">50+</span>
            <span className="stat-text">Events hosted annually</span>
          </div>
          <div className="highlight-stat">
            <span className="stat-number">12</span>
            <span className="stat-text">Cities across the US</span>
          </div>
          <div className="highlight-stat">
            <span className="stat-number">500+</span>
            <span className="stat-text">Couples met at our events</span>
          </div>
        </div>

        <div className="events-cta">
          <p>Join L3V3L to get exclusive invites to our events</p>
          <button className="btn-get-started" onClick={() => navigate('/login')}>
            Become a Member
          </button>
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
