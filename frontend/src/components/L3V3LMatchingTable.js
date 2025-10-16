import React from 'react';
import './L3V3LMatchingTable.css';

/**
 * L3V3L Matching Breakdown Table
 * Shows detailed compatibility across all matching dimensions
 * Used on profile pages when viewing matches from L3V3L Matches page
 */
const L3V3LMatchingTable = ({ matchingData }) => {
  if (!matchingData) return null;

  // Helper to get color based on match percentage
  const getMatchColor = (percentage) => {
    if (percentage >= 90) return 'perfect-match'; // Bright green
    if (percentage >= 75) return 'high-match';    // Medium green
    if (percentage >= 60) return 'good-match';    // Light green
    if (percentage >= 45) return 'medium-match';  // Yellow-green
    return 'low-match';                           // Yellow/Orange
  };

  // Helper to get match label
  const getMatchLabel = (percentage) => {
    if (percentage >= 90) return 'Perfect Match';
    if (percentage >= 75) return 'High Match';
    if (percentage >= 60) return 'Good Match';
    if (percentage >= 45) return 'Medium Match';
    return 'Low Match';
  };

  const matchCategories = [
    {
      title: '💕 Love',
      score: matchingData.love || 0,
      description: 'Romantic compatibility & emotional connection'
    },
    {
      title: '🤝 Loyalty',
      score: matchingData.loyalty || 0,
      description: 'Trust, commitment & reliability'
    },
    {
      title: '😄 Laughter',
      score: matchingData.laughter || 0,
      description: 'Humor compatibility & joy in life'
    },
    {
      title: '💭 Vulnerability',
      score: matchingData.vulnerability || 0,
      description: 'Emotional openness & authenticity'
    },
    {
      title: '🚀 Elevation',
      score: matchingData.elevation || 0,
      description: 'Growth mindset & mutual inspiration'
    },
    {
      title: '🎯 Demographics',
      score: matchingData.demographics || 0,
      description: 'Age, location, background compatibility'
    },
    {
      title: '💼 Career & Education',
      score: matchingData.career || 0,
      description: 'Professional goals & educational alignment'
    },
    {
      title: '🌍 Cultural Factors',
      score: matchingData.cultural || 0,
      description: 'Religion, values, traditions'
    },
    {
      title: '👥 Physical Preferences',
      score: matchingData.physical || 0,
      description: 'Height, body type, appearance preferences'
    },
    {
      title: '🏃 Lifestyle & Habits',
      score: matchingData.lifestyle || 0,
      description: 'Daily routines, hobbies, eating habits'
    }
  ];

  // Calculate overall score
  const overallScore = matchingData.overall || Math.round(
    matchCategories.reduce((sum, cat) => sum + cat.score, 0) / matchCategories.length
  );

  return (
    <div className="l3v3l-matching-section">
      <div className="l3v3l-matching-header">
        <h3>🦋 L3V3L Matching Breakdown</h3>
        <div className="overall-compatibility">
          <div className={`overall-score-badge ${getMatchColor(overallScore)}`}>
            <span className="score-value">{overallScore}%</span>
            <span className="score-label">Overall Match</span>
          </div>
        </div>
      </div>

      <p className="matching-subtitle">
        Our AI algorithm analyzes these key dimensions to find your perfect match
      </p>

      <div className="matching-grid">
        {matchCategories.map((category, index) => {
          const colorClass = getMatchColor(category.score);
          const matchLabel = getMatchLabel(category.score);

          return (
            <div key={index} className="matching-item">
              <div className="matching-item-header">
                <span className="matching-title">{category.title}</span>
                <div className={`match-bubble ${colorClass}`}>
                  <span className="bubble-score">{category.score}%</span>
                </div>
              </div>
              <div className="matching-progress-bar">
                <div 
                  className={`matching-progress-fill ${colorClass}`}
                  style={{ width: `${category.score}%` }}
                />
              </div>
              <p className="matching-description">{category.description}</p>
              <span className={`match-label ${colorClass}`}>{matchLabel}</span>
            </div>
          );
        })}
      </div>

      <div className="matching-legend">
        <h4>Match Level Guide:</h4>
        <div className="legend-items">
          <div className="legend-item">
            <span className="legend-bubble perfect-match">●</span>
            <span>90-100%: Perfect Match</span>
          </div>
          <div className="legend-item">
            <span className="legend-bubble high-match">●</span>
            <span>75-89%: High Match</span>
          </div>
          <div className="legend-item">
            <span className="legend-bubble good-match">●</span>
            <span>60-74%: Good Match</span>
          </div>
          <div className="legend-item">
            <span className="legend-bubble medium-match">●</span>
            <span>45-59%: Medium Match</span>
          </div>
          <div className="legend-item">
            <span className="legend-bubble low-match">●</span>
            <span>0-44%: Low Match</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default L3V3LMatchingTable;
