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
  getTrustedUsernames,
} from '../utils/trustedDevice';
import './LandingPageV2.css';

const getHomeRoute = (homePage) => {
  const homeRoutes = {
    dashboard: '/dashboardv2',
    search: '/search',
    messages: '/messages',
  };
  return homeRoutes[homePage] || '/dashboardv2';
};

const LandingPageV2 = () => {
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

  const handleTrustedUserLogin = useCallback(async (username) => {
    const token = getTrustedDeviceToken(username);
    if (!token) {
      setTopLoginStatus('Selected account is no longer trusted.');
      setTopLoginLoading(false);
      navigate('/login');
      return;
    }

    setTopLoginLoading(true);
    setTopLoginStatus(`Signing in as ${username}...`);

    try {
      const deviceContext = getTrustedDeviceContext();
      const autoLoginResponse = await trustedDeviceAutoLogin({
        trusted_device_token: token,
        device_id: deviceContext.deviceId,
        app_id: deviceContext.appId,
      });

      if (autoLoginResponse?.access_token && autoLoginResponse?.user?.username) {
        setTopLoginStatus('Auto-login enabled. Logging you in...');
        completeLogin(autoLoginResponse);
        return;
      }

      setTopLoginStatus('Auto-login not enabled. Redirecting to login...');
      navigate('/login');
    } catch (autoLoginError) {
      if (autoLoginError?.response?.status === 401) {
        clearTrustedDeviceToken(token);
      }
      setTopLoginStatus('Auto-login failed. Redirecting to login...');
      navigate('/login');
    } finally {
      setTopLoginLoading(false);
    }
  }, [completeLogin, navigate]);

  const handleTopLoginClick = useCallback(async () => {
    setTopLoginLoading(true);
    setTopLoginStatus('Checking auto-login...');

    const usernames = getTrustedUsernames();
    const legacyToken = getTrustedDeviceToken();
    const accounts = usernames.length > 0 ? usernames : (legacyToken ? [''] : []);

    if (accounts.length === 0) {
      setTopLoginStatus('Auto-login not enabled. Redirecting to login...');
      setTopLoginLoading(false);
      navigate('/login');
      return;
    }

    if (accounts.length === 1) {
      await handleTrustedUserLogin(accounts[0]);
      return;
    }

    setTopLoginStatus('Multiple saved accounts found. Redirecting to login...');
    setTopLoginLoading(false);
    navigate('/login');
  }, [handleTrustedUserLogin, navigate]);

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

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <SEO
        title={pageSEO.title}
        description={pageSEO.description}
        keywords={pageSEO.keywords}
        url={pageSEO.url}
        type={pageSEO.type}
      />
      <div className="lp2">

        {/* NAV */}
        <nav className="lp2-nav">
          <div className="brand">
            <img src="/landing-page-logo-transparent.png" alt="L3V3L Matches" className="brand-logo-img" />
          </div>
          <div className="nav-links">
            <a href="#lp2-paths" onClick={(e) => { e.preventDefault(); scrollToSection('lp2-paths'); }}>For Parents</a>
            <a href="#lp2-journey" onClick={(e) => { e.preventDefault(); scrollToSection('lp2-journey'); }}>How It Works</a>
            <a href="#lp2-events" onClick={(e) => { e.preventDefault(); scrollToSection('lp2-events'); }}>Events</a>
            <a href="#lp2-testimonials" onClick={(e) => { e.preventDefault(); scrollToSection('lp2-testimonials'); }}>Success Stories</a>
          </div>
          <button
            type="button"
            className="btn-login"
            onClick={handleTopLoginClick}
            disabled={topLoginLoading}
          >
            {topLoginLoading ? 'CHECKING...' : 'Log in'}
          </button>
        </nav>
        {topLoginStatus && <p className="nav-login-status">{topLoginStatus}</p>}

        {/* HERO */}
        <div className="hero">
          <div>
            <span className="eyebrow">👨‍👩‍👧 Community-built · Family-verified</span>
            <h1>A match the whole<br/><span className="hl">family</span> will love.</h1>
            <p className="hero-sub">
              L3V3L is a matrimonial community for Indian-origin singles born or raised
              in the USA — where profiles are lovingly posted by parents, siblings, and
              members themselves, and every single one is verified. Our AI then analyzes
              50+ compatibility factors so the right match finds you.
              <span className="native">प्यार जो परिवार से जुड़ा हो — love that begins with family.</span>
            </p>
            <div className="hero-ctas">
              <button className="btn-main" onClick={() => navigate('/register-interest')}>Register — It's Free</button>
              <button className="btn-soft" onClick={() => scrollToSection('lp2-paths')}>I'm a parent →</button>
            </div>
            <div className="hero-proof">
              <div className="avatar-stack">
                <div className="av" style={{ background: '#f7dcd4' }}>👩🏽</div>
                <div className="av" style={{ background: '#fdf0d9' }}>👴🏽</div>
                <div className="av" style={{ background: '#e4ecf7' }}>👵🏻</div>
                <div className="av" style={{ background: '#e8f3e6' }}>👨🏽</div>
              </div>
              <span><strong>1,000+ verified profiles</strong> — many posted by loving families</span>
            </div>
          </div>

          <div className="hero-visual">
            <img className="hero-photo-main" src="/images/hands_color1.jpeg" alt="Mehndi-decorated hands" />
            <img className="hero-photo-secondary" src="/images/wedding.png" alt="Couple under a mandap" />
            <div className="float-card float-score">
              <div className="n">94</div>
              <div className="l">L3V3L SCORE</div>
            </div>
            <div className="float-card float-family">
              <div className="ico">👨‍👩‍👧</div>
              <div>
                <div className="t1">Posted by her mother</div>
                <div className="t2">Family-managed profile</div>
              </div>
            </div>
            <div className="float-card float-verified">
              <div className="ico">✓</div>
              <div>
                <div className="t1">Community Verified</div>
                <div className="t2">ID + family checked</div>
              </div>
            </div>
          </div>
        </div>

        {/* STATS */}
        <div className="stats-band">
          <div className="stats-inner">
            <div className="stat"><div className="stat-num">1,000+</div><div className="stat-label">Verified Profiles</div></div>
            <div className="stat"><div className="stat-num">50+</div><div className="stat-label">Successful Matches</div></div>
            <div className="stat"><div className="stat-num">98%</div><div className="stat-label">Profile Verification</div></div>
          </div>
        </div>

        {/* WHO ARE YOU REGISTERING FOR */}
        <section id="lp2-paths">
          <div className="wrap">
            <div className="sec-head">
              <span className="eyebrow">Two ways to begin</span>
              <h2>Who are you searching for?</h2>
              <p>Whether it's you or someone you love — everyone is welcome here.</p>
            </div>
            <div className="paths">
              <div className="path-card path-self">
                <div className="path-emoji">🌸</div>
                <h3>For yourself</h3>
                <p>You're ready to find your life partner on your own terms — with your family cheering you on.</p>
                <ul>
                  <li>Build your own verified profile</li>
                  <li>Control your privacy &amp; contact settings</li>
                  <li>Get your personal L3V3L compatibility scores</li>
                </ul>
                <button className="path-btn" onClick={() => navigate('/register-interest')}>Create My Profile</button>
              </div>
              <div className="path-card path-parent">
                <span className="path-tag">POPULAR</span>
                <div className="path-emoji">💞</div>
                <h3>For your child</h3>
                <p>Parents have always found the best matches — now with better tools and full transparency.</p>
                <ul>
                  <li>Post a profile for your son or daughter</li>
                  <li>They approve every connection before contact</li>
                  <li>Talk to other families directly &amp; safely</li>
                </ul>
                <button className="path-btn" onClick={() => navigate('/register-interest')}>Post Their Profile</button>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="lp2-journey" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="sec-head">
              <span className="eyebrow">The Journey</span>
              <h2>From searching to found</h2>
              <p>Science meets intuition. Data meets destiny.</p>
            </div>
            <div className="journey">
              <div className="jstep">
                <div className="jstep-bubble">📝</div>
                <div className="jnum">STEP 01</div>
                <h3>Create the profile</h3>
                <p>For yourself or your child — values, interests, lifestyle, aspirations.</p>
              </div>
              <div className="jstep">
                <div className="jstep-bubble">🧠</div>
                <div className="jnum">STEP 02</div>
                <h3>AI analyzes 50+ factors</h3>
                <p>Personality, values, lifestyle, goals, family expectations, language.</p>
              </div>
              <div className="jstep">
                <div className="jstep-bubble">✨</div>
                <div className="jnum">STEP 03</div>
                <h3>Get your L3V3L score</h3>
                <p>Personalized 0–100 compatibility score with a transparent breakdown.</p>
              </div>
              <div className="jstep">
                <div className="jstep-bubble">💬</div>
                <div className="jnum">STEP 04</div>
                <h3>Connect meaningfully</h3>
                <p>Families and members talk safely — nothing shared without consent.</p>
              </div>
            </div>
            <div className="ornament" style={{ marginTop: '56px' }}>❋</div>
          </div>
        </section>

        {/* PHILOSOPHY */}
        <div className="philosophy">
          <div className="philo-inner">
            <div>
              <div className="philo-letters">L<span>3</span>V<span>3</span>L</div>
              <p className="philo-desc">
                A relationship philosophy defining the emotional depth between two
                people — modern, playful, and emotionally resonant. Each letter is a
                pillar of meaningful connection.
              </p>
            </div>
            <div className="pillar-list">
              <div className="pillar-item">
                <div className="pl">L</div>
                <div><h4>Love</h4><p>The spark, the chemistry, the butterflies — where it all begins.</p></div>
              </div>
              <div className="pillar-item">
                <div className="pl">3</div>
                <div><h4>Loyalty · Laughter · Vulnerability</h4><p>The trio that makes love sustainable.</p></div>
              </div>
              <div className="pillar-item">
                <div className="pl">V</div>
                <div><h4>Vulnerability</h4><p>Double-emphasized — opening up is hard, but essential.</p></div>
              </div>
              <div className="pillar-item">
                <div className="pl">3</div>
                <div><h4>Elevation · Empathy · Effort</h4><p>Partners who lift each other up, daily.</p></div>
              </div>
              <div className="pillar-item">
                <div className="pl">L</div>
                <div><h4>Loyalty, again</h4><p>Because loyalty is a daily choice, not a one-time thing.</p></div>
              </div>
            </div>
          </div>
        </div>

        {/* SERVICES */}
        <section>
          <div className="wrap">
            <div className="sec-head">
              <span className="eyebrow">What We Offer</span>
              <h2>Built for serious relationships</h2>
              <p>Comprehensive matchmaking — not another swipe app.</p>
            </div>
            <div className="cards">
              <div className="card">
                <div className="card-ico ico-a">🧬</div>
                <h3>AI-Powered Compatibility</h3>
                <p>The L3V3L algorithm scores every match 0–100 across personality, values, lifestyle, and goals.</p>
              </div>
              <div className="card">
                <div className="card-ico ico-b">👨‍👩‍👧</div>
                <h3>Family-Managed Profiles</h3>
                <p>Parents can post and manage profiles for their children — with consent built into every step.</p>
              </div>
              <div className="card">
                <div className="card-ico ico-c">🌐</div>
                <h3>Mother-Tongue Matching</h3>
                <p>Filter and connect in Hindi, Tamil, Telugu, Gujarati, Punjabi, Bengali, and more.</p>
              </div>
              <div className="card">
                <div className="card-ico ico-d">💬</div>
                <h3>Secure Messaging</h3>
                <p>Private in-app chat between members — or between families — with read receipts.</p>
              </div>
              <div className="card">
                <div className="card-ico ico-e">🔒</div>
                <h3>Privacy &amp; PII Controls</h3>
                <p>You decide who sees contact details and photos. Nothing is shared without approval.</p>
              </div>
              <div className="card">
                <div className="card-ico ico-f">📊</div>
                <h3>Compatibility Insights</h3>
                <p>See exactly <em>why</em> you match — breakdowns across 8 categories, no black box.</p>
              </div>
            </div>
          </div>
        </section>

        {/* EVENTS */}
        <section id="lp2-events" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="sec-head">
              <span className="eyebrow">Events &amp; Meetups</span>
              <h2>Meet online or in person</h2>
              <p>Monthly virtual meets · in-person gatherings nationwide · families always welcome</p>
            </div>
            <div className="event-row">
              <div className="event-card">
                <div className="event-emoji">🎯</div>
                <div>
                  <h3>Virtual Meet &amp; Match <span className="event-kind">· ZOOM</span></h3>
                  <p>Monthly Zoom calls with pre-matched profiles — our algorithm aligns compatibility before you ever say hello.</p>
                  <div className="event-meta">Monthly · Pre-matched for better alignment</div>
                </div>
              </div>
              <div className="event-card">
                <div className="event-emoji">🍷</div>
                <div>
                  <h3>Family Meet &amp; Greets <span className="event-kind">· IN-PERSON</span></h3>
                  <p>Relaxed gatherings where parents and members meet over chai and conversation.</p>
                  <div className="event-meta">📍 SF · LA · NYC · Chicago</div>
                </div>
              </div>
            </div>
            <div className="event-row">
              <div className="event-card">
                <div className="event-emoji">💬</div>
                <div>
                  <h3>Compatibility Workshops <span className="event-kind">· VIRTUAL</span></h3>
                  <p>Group sessions with relationship experts on values and communication.</p>
                  <div className="event-meta">Bi-weekly · Wednesdays</div>
                </div>
              </div>
              <div className="event-card">
                <div className="event-emoji">🎭</div>
                <div>
                  <h3>Cultural Celebrations <span className="event-kind">· IN-PERSON</span></h3>
                  <p>Diwali galas, festival gatherings, and holiday parties — celebrate traditions together.</p>
                  <div className="event-meta">📍 Nationwide</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section id="lp2-testimonials" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="sec-head">
              <span className="eyebrow">Success Stories</span>
              <h2>From our community</h2>
            </div>
            <div className="testimonials">
              <div className="testimonial">
                <img className="testimonial-photo" src="/images/hands.jpeg" alt="Wedding hands" />
                <div className="big-quote">“</div>
                <p>After years on apps that felt like shopping, L3V3L felt like a matchmaker who actually knew both of our families' expectations.</p>
                <div className="attrib">Meera &amp; Vikram <span>— engaged 2026 · New Jersey</span></div>
              </div>
              <div className="testimonial parent">
                <div className="big-quote">“</div>
                <p>I posted my daughter's profile on a Sunday evening. By Diwali, we were meeting her fiancé's family. The verification gave us complete peace of mind.</p>
                <div className="attrib">Sunita Sharma <span>— mother of the bride · Fremont, CA</span></div>
                <div className="ornament">❋</div>
              </div>
            </div>
          </div>
        </section>

        {/* COMMUNITY VERIFICATION */}
        <section style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="verify-grid">
              <div>
                <span className="eyebrow">Trust &amp; Safety</span>
                <h2 className="verify-h2">Every profile earns its ✓</h2>
                <p className="verify-tagline">Community-collected. Human-verified. Family-approved.</p>
                <div className="verify-steps">
                  <div className="vstep">
                    <div className="vn">1</div>
                    <div>
                      <h4>Profile posted by member or family</h4>
                      <p>Members create their own profile — or a parent, sibling, or relative posts on their behalf with consent.</p>
                    </div>
                  </div>
                  <div className="vstep">
                    <div className="vn">2</div>
                    <div>
                      <h4>Community &amp; ID verification</h4>
                      <p>Every profile passes ID checks and community review — no anonymous accounts, no fake photos.</p>
                    </div>
                  </div>
                  <div className="vstep">
                    <div className="vn">3</div>
                    <div>
                      <h4>Verified badge awarded</h4>
                      <p>Only verified profiles can search, message, and connect. Your details stay private until you choose to share.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <img className="verify-photo" src="/images/wedding-bg.jpg" alt="Wedding celebration" />
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="cta-band">
          <h2>Your family's blessing,<br/><span className="hl">calculated</span> into the match.</h2>
          <p>Join a community of verified members and families seeking marriage-minded relationships.</p>
          <button className="btn-main" onClick={() => navigate('/register-interest')}>Register — For Yourself or Your Child</button>
        </div>

        {/* FOOTER */}
        <footer>
          <div className="footer-grid">
            <div>
              <div className="footer-brand">🦋 L3V3L Matches</div>
              <p className="footer-desc">A community-built matrimonial platform for Indian-origin singles in the USA — verified profiles, family-managed accounts, AI-powered compatibility.</p>
            </div>
            <div>
              <h4>Company</h4>
              <ul>
                <li><a href="/l3v3l-info">About L3V3L</a></li>
                <li><a href="/help">Help &amp; Contact</a></li>
                <li><a href="#lp2-testimonials" onClick={(e) => { e.preventDefault(); scrollToSection('lp2-testimonials'); }}>Success Stories</a></li>
              </ul>
            </div>
            <div>
              <h4>Legal</h4>
              <ul>
                <li><a href="/terms">Terms of Service</a></li>
                <li><a href="/privacy">Privacy Policy</a></li>
                <li><a href="/community-guidelines">Community Guidelines</a></li>
                <li><a href="/cookie-policy">Cookie Policy</a></li>
              </ul>
            </div>
            <div>
              <h4>Follow</h4>
              <ul>
                <li><a href="https://instagram.com/l3v3lmatches" target="_blank" rel="noopener noreferrer">Instagram</a></li>
                <li><a href="/help">Contact Support</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2025 L3V3L Matches Inc. All rights reserved.</span>
            <span>Matrimonial matchmaking for adults 18+</span>
          </div>
        </footer>

      </div>
    </>
  );
};

export default LandingPageV2;
