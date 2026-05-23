import React from 'react';
import './AttentionGrid.css';

const AttentionGrid = ({ items }) => {
  if (!items?.length) return null;

  return (
    <section className="dv2-attention">
      <h2 className="dv2-section-title">What needs your attention</h2>
      <div className="dv2-attention-grid">
        {items.map((item) => (
          <button
            key={item.key}
            className={`dv2-attention-card dv2-variant-${item.variant || 'default'}`}
            onClick={item.onClick}
            type="button"
          >
            <span className="dv2-attention-icon-wrap" aria-hidden="true">
              <span className="dv2-attention-icon">{item.icon}</span>
            </span>
            <span className="dv2-attention-title">{item.title}</span>
            {item.count > 0 && <span className="dv2-attention-count">{item.count}</span>}
            {item.subtitle ? <span className="dv2-attention-subtitle">{item.subtitle}</span> : null}
          </button>
        ))}
      </div>
    </section>
  );
};

export default AttentionGrid;
