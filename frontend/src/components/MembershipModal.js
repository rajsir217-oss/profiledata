import React from 'react';
import { useNavigate } from 'react-router-dom';
import './MembershipModal.css';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    icon: '🆓',
    price: '$0',
    period: '/mo',
    billing: 'No cost, limited access',
    btnLabel: 'Current Plan',
    btnClass: 'current-plan',
    disabled: true,
    features: [
      { label: 'Search result', value: '1', type: 'limit' },
      { label: 'Favorite', value: '1', type: 'limit' },
      { label: 'Shortlist', value: '1', type: 'limit' },
      { label: 'Message / day', value: '1', type: 'limit' },
      { label: 'Profile view / day', value: '1', type: 'limit' },
      { label: 'PII request / month', value: '1', type: 'limit' },
      { label: 'Privacy controls', value: false, type: 'bool' },
      { label: 'L3V3L matching', value: false, type: 'bool' },
    ]
  },
  {
    id: 'premium',
    name: 'Premium',
    icon: '⭐',
    price: '$199.99',
    period: '/year',
    billing: 'Billed annually',
    btnLabel: 'Upgrade to Premium',
    btnClass: 'primary',
    featured: true,
    features: [
      { label: 'Search results', value: '100', type: 'limit' },
      { label: 'Favorites', value: true, type: 'bool' },
      { label: 'Shortlist', value: true, type: 'bool' },
      { label: 'Messages / day', value: true, type: 'bool' },
      { label: 'Profile views / day', value: true, type: 'bool' },
      { label: 'PII requests / month', value: '10', type: 'limit' },
      { label: 'Privacy controls', value: true, type: 'bool' },
      { label: 'L3V3L matching', value: true, type: 'bool' },
    ]
  },
  {
    id: 'lifetime',
    name: 'Lifetime',
    icon: '💎',
    price: '$299.99',
    period: ' one-time',
    billing: 'Pay once, forever access',
    btnLabel: 'Get Lifetime',
    btnClass: 'gold',
    features: [
      { label: 'Search results', value: true, type: 'bool' },
      { label: 'Favorites', value: true, type: 'bool' },
      { label: 'Shortlist', value: true, type: 'bool' },
      { label: 'Messages / day', value: true, type: 'bool' },
      { label: 'Profile views / day', value: true, type: 'bool' },
      { label: 'PII requests / month', value: true, type: 'bool' },
      { label: 'Privacy controls', value: true, type: 'bool' },
      { label: 'L3V3L matching', value: true, type: 'bool' },
      { label: 'Lifetime badge', value: true, type: 'bool' },
      { label: 'Priority support', value: true, type: 'bool' },
    ]
  }
];

const COMPARISON_ROWS = [
  { section: 'Search & Discovery' },
  { feature: 'Search results', free: '1', premium: '100', lifetime: 'Unlimited' },
  { feature: 'L3V3L compatibility filter', free: false, premium: true, lifetime: true },
  { feature: 'Profile views / day', free: '1', premium: 'Unlimited', lifetime: 'Unlimited' },
  { section: 'Interactions' },
  { feature: 'Favorites', free: '1', premium: 'Unlimited', lifetime: 'Unlimited' },
  { feature: 'Shortlist', free: '1', premium: 'Unlimited', lifetime: 'Unlimited' },
  { feature: 'Messages / day', free: '1', premium: 'Unlimited', lifetime: 'Unlimited' },
  { section: 'Privacy & PII' },
  { feature: 'PII requests / month', free: '1', premium: '10', lifetime: 'Unlimited' },
  { feature: 'Hide favorites from others', free: false, premium: true, lifetime: true },
  { feature: 'Hide shortlist from others', free: false, premium: true, lifetime: true },
  { feature: 'Hide profile views', free: false, premium: true, lifetime: true },
  { section: 'Perks' },
  { feature: 'Premium badge on profile', free: false, premium: true, lifetime: true },
  { feature: 'Lifetime badge on profile', free: false, premium: false, lifetime: true },
  { feature: 'Priority support', free: false, premium: false, lifetime: true },
  { feature: 'Payment', free: 'Free', premium: 'Monthly / Yearly', lifetime: 'One-time' },
];

const MembershipModal = ({ isOpen, onClose, currentPlan = 'free' }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleUpgrade = (planId) => {
    if (planId === 'free') return;
    onClose();
    navigate(`/membership-plans?plan=${planId}`);
  };

  const renderFeatureValue = (feature) => {
    if (feature.type === 'bool') {
      return feature.value
        ? <span className="feature-check">✓</span>
        : <span className="feature-cross">✕</span>;
    }
    return <span className="feature-limit">{feature.value}</span>;
  };

  const renderCellValue = (val) => {
    if (val === false) return <span className="feature-cross">✕</span>;
    if (val === true) return <span className="feature-check">✓</span>;
    return val;
  };

  return (
    <div className="membership-modal-overlay" onClick={onClose}>
      <div className="membership-modal" onClick={(e) => e.stopPropagation()}>
        <div className="membership-modal-header">
          <h2>Choose Your Membership</h2>
          <button className="membership-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="membership-modal-body">
          <div className="current-plan-banner">
            You are currently on the <strong>{PLANS.find(p => p.id === currentPlan)?.name || 'Free'}</strong> plan.
            {currentPlan === 'free' && ' Upgrade to unlock all features.'}
          </div>

          <div className="membership-plans-grid">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`membership-plan-card ${plan.id === currentPlan ? 'current' : ''} ${plan.featured ? 'featured' : ''}`}
              >
                {plan.id === currentPlan && <div className="plan-badge current-badge">Current Plan</div>}
                {plan.featured && plan.id !== currentPlan && <div className="plan-badge popular-badge">Most Popular</div>}

                <div className="plan-icon">{plan.icon}</div>
                <div className="plan-name">{plan.name}</div>
                <div className="plan-price">{plan.price}<span>{plan.period}</span></div>
                <div className="plan-billing">{plan.billing}</div>

                <button
                  className={`plan-btn ${plan.btnClass}`}
                  disabled={plan.disabled}
                  onClick={() => handleUpgrade(plan.id)}
                >
                  {plan.btnLabel}
                </button>

                <div className="plan-feature-list">
                  {plan.features.map((f, i) => (
                    <div key={i} className="plan-feature">
                      {renderFeatureValue(f)}
                      <span>{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <h3 className="comparison-title">Full Feature Comparison</h3>
          <div className="comparison-table-wrapper">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Free</th>
                  <th>Premium</th>
                  <th>Lifetime</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) => (
                  row.section ? (
                    <tr key={i}>
                      <td colSpan={4} className="comparison-section">{row.section}</td>
                    </tr>
                  ) : (
                    <tr key={i}>
                      <td>{row.feature}</td>
                      <td>{renderCellValue(row.free)}</td>
                      <td>{renderCellValue(row.premium)}</td>
                      <td>{renderCellValue(row.lifetime)}</td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MembershipModal;
