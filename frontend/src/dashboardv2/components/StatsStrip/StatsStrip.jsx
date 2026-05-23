import React from 'react';
import './StatsStrip.css';

const StatsStrip = ({ tiles, loading }) => {
  if (!tiles?.length) return null;

  return (
    <section className="dv2-stats">
      <h2 className="dv2-section-title">Your activity</h2>
      <div className={`dv2-stats-strip dv2-stats-strip-cols-${tiles.length}`}>
        {tiles.map((t) => (
          <button
            key={t.key}
            className={`dv2-stat-tile dv2-variant-${t.variant || 'default'}`}
            onClick={t.onClick}
            disabled={loading}
            type="button"
          >
            {t.icon ? <span className="dv2-stat-icon" aria-hidden="true">{t.icon}</span> : null}
            <span className="dv2-stat-num">{loading ? '—' : t.num}</span>
            <span className="dv2-stat-label">{t.label}</span>
            {t.hasNew ? <span className="dv2-stat-dot" aria-hidden="true" /> : null}
          </button>
        ))}
      </div>
    </section>
  );
};

export default StatsStrip;
