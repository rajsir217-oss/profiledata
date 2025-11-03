import React from 'react';
import SEO from './SEO';
import { getPageSEO } from '../utils/seo';
import './L3V3LInfo.css';

const L3V3LInfo = () => {
  const pageSEO = getPageSEO('l3v3l-info');

  return (
    <>
      <SEO
        title={pageSEO.title}
        description={pageSEO.description}
        keywords={pageSEO.keywords}
        url={pageSEO.url}
        type={pageSEO.type}
      />
    <div className="l3v3l-info-container">
      <div className="l3v3l-header">
        <h1>🦋 L3V3L: A Fresh Dating Philosophy</h1>
        <p className="tagline">
          A fresh, dating-inspired meaning—something modern, playful, and emotionally resonant.
        </p>
      </div>

      <div className="l3v3l-content">
        {/* Definition Card */}
        <div className="definition-card">
          <h2>🦋 L3V3L: Love, Loyalty, Laughter, Vulnerability, Elevation, Loyalty (again)</h2>
          <p className="definition-text">
            <strong>L3V3L</strong> is a relationship philosophy that defines the emotional depth and compatibility between
            two people. Each letter represents a key pillar of a meaningful connection:
          </p>
        </div>

        {/* Pillars Section */}
        <div className="pillars-section">
          <h2>The Pillars of L3V3L</h2>
          
          <div className="pillar-card">
            <div className="pillar-icon">L</div>
            <div className="pillar-content">
              <h3>Love</h3>
              <p>The spark, the chemistry, the butterflies. Where it all begins.</p>
            </div>
          </div>

          <div className="pillar-card highlight">
            <div className="pillar-icon">3</div>
            <div className="pillar-content">
              <h3>Loyalty, Laughter, and Vulnerability</h3>
              <p>
                The trio that makes love sustainable. <strong>Loyalty</strong> builds trust, 
                <strong> laughter</strong> keeps it light, and <strong>vulnerability</strong> deepens intimacy.
              </p>
            </div>
          </div>

          <div className="pillar-card">
            <div className="pillar-icon">V</div>
            <div className="pillar-content">
              <h3>Vulnerability</h3>
              <p>A double emphasis—because opening up is hard, but essential. True connection requires authenticity.</p>
            </div>
          </div>

          <div className="pillar-card highlight">
            <div className="pillar-icon">3</div>
            <div className="pillar-content">
              <h3>Elevation, Empathy, and Effort</h3>
              <p>
                Relationships thrive when both partners lift each other up, understand each other, 
                and show up consistently.
              </p>
            </div>
          </div>

          <div className="pillar-card">
            <div className="pillar-icon">L</div>
            <div className="pillar-content">
              <h3>Loyalty (again)</h3>
              <p>Because loyalty isn't a one-time thing—it's a daily choice. Consistency matters.</p>
            </div>
          </div>
        </div>

        {/* How to Use Section */}
        <div className="usage-section">
          <h2>💬 How to Use It</h2>
          <div className="usage-examples">
            <div className="example-card">
              <span className="example-icon">💕</span>
              <p>"We're finally at <strong>L3V3L</strong>"</p>
            </div>
            <div className="example-card">
              <span className="example-icon">🔍</span>
              <p>"I'm looking for someone who gets the <strong>L3V3L mindset</strong>"</p>
            </div>
            <div className="example-card">
              <span className="example-icon">🤔</span>
              <p>"That date was fun, but not <strong>L3V3L material</strong>"</p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="cta-section">
          <h2>🎯 Find Your L3V3L Match</h2>
          <p>
            Ready to find someone who shares your L3V3L philosophy? 
            Our matching algorithm considers all these pillars to find your perfect match.
          </p>
          <button 
            className="cta-button"
            onClick={() => window.location.href = '/l3v3l-matches'}
          >
            🦋 Discover L3V3L Matches
          </button>
        </div>

        {/* Footer Note */}
        <div className="l3v3l-footer">
          <p>
            <em>
              L3V3L is more than just a concept—it's a commitment to building relationships 
              that are deep, sustainable, and truly fulfilling.
            </em>
          </p>
        </div>
      </div>
    </div>
    </>
  );
};

export default L3V3LInfo;
