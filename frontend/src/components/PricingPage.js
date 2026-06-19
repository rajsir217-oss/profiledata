import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getBackendUrl } from '../config/apiConfig';
import toastService from '../services/toastService';
import './PricingPage.css';

const FREE_PLAN = {
  id: 'free',
  name: 'Free',
  icon: '🆓',
  price: 0,
  duration: null,
  features: [
    '1 Search result',
    '1 Favorite',
    '1 Shortlist',
    '1 Message / day',
    '1 Profile view / day',
    '1 PII request / month',
  ],
  missing: [
    'Privacy controls',
    'L3V3L matching',
  ]
};

const PricingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(null);
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [paypalConfigured, setPaypalConfigured] = useState(false);
  const [paypalClientId, setPaypalClientId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('paypal');
  const [paypalReady, setPaypalReady] = useState(false);
  const paypalContainerRef = useRef(null);
  const [cloverLoading, setCloverLoading] = useState(false);
  const [cloverReady, setCloverReady] = useState(false);
  const [cloverConfig, setCloverConfig] = useState(null);
  const cloverInstanceRef = useRef(null);
  const cloverMountedRef = useRef(false);

  useEffect(() => {
    loadPlans();
    loadSubscriptionStatus();
    checkPaymentConfigs();
  }, []);

  const checkPaymentConfigs = async () => {
    const token = localStorage.getItem('token');
    try {
      const pr = await fetch(`${getBackendUrl()}/api/paypal/config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const pd = await pr.json();
      setPaypalConfigured(pd.configured);
      if (pd.configured && pd.client_id) setPaypalClientId(pd.client_id);
    } catch (e) { console.error('PayPal config check:', e); }
  };

  useEffect(() => {
    if (paymentMethod === 'clover' && selectedPlan && selectedPlan !== 'free') {
      if (cloverMountedRef.current) return;
      initClover();
    }
    return () => {
      cloverMountedRef.current = false;
      setCloverReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethod, selectedPlan]);

  useEffect(() => {
    if (paymentMethod === 'paypal' && paypalConfigured && paypalClientId && selectedPlan && selectedPlan !== 'free') {
      initializePayPal();
    }
    const containerRef = paypalContainerRef.current;
    return () => {
      if (containerRef) containerRef.innerHTML = '';
      setPaypalReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethod, paypalConfigured, paypalClientId, selectedPlan]);

  const initClover = async () => {
    try {
      if (!window.isSecureContext) {
        toastService.error('Card payments require HTTPS. Please use PayPal.');
        return;
      }
      const token = localStorage.getItem('token');
      const res = await fetch(`${getBackendUrl()}/api/clover/sdk-config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const config = await res.json();
      if (!res.ok || !config.public_key) {
        toastService.error('Clover card payments not available.');
        return;
      }
      setCloverConfig(config);

      if (!window.Clover) {
        await new Promise((resolve, reject) => {
          const existing = document.querySelector(`script[src="${config.sdk_url}"]`);
          if (existing) { resolve(); return; }
          const script = document.createElement('script');
          script.src = config.sdk_url;
          script.async = true;
          script.onload = resolve;
          script.onerror = () => reject(new Error('Failed to load Clover SDK'));
          document.head.appendChild(script);
        });
      }

      const clover = new window.Clover(config.public_key);
      cloverInstanceRef.current = clover;
      const elements = clover.elements();
      const styles = {
        body: { fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontSize: '14px' },
        input: { fontSize: '15px', padding: '10px 8px' }
      };
      const cardNumber = elements.create('CARD_NUMBER', styles);
      const cardDate = elements.create('CARD_DATE', styles);
      const cardCvv = elements.create('CARD_CVV', styles);
      const cardPostalCode = elements.create('CARD_POSTAL_CODE', styles);

      setTimeout(() => {
        try {
          cardNumber.mount('#pricing-clover-card-number');
          cardDate.mount('#pricing-clover-card-date');
          cardCvv.mount('#pricing-clover-card-cvv');
          cardPostalCode.mount('#pricing-clover-card-zip');
          cloverMountedRef.current = true;
          setCloverReady(true);
        } catch (mountErr) {
          toastService.error('Failed to mount card form. Please try again.');
        }
      }, 300);
    } catch (err) {
      toastService.error('Failed to initialize card payment form.');
    }
  };

  const initializePayPal = async () => {
    if (!window.paypal) {
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${paypalClientId}&currency=USD`;
      script.async = true;
      script.onload = () => renderPayPalButtons();
      script.onerror = () => toastService.error('Failed to load PayPal SDK');
      document.body.appendChild(script);
    } else {
      renderPayPalButtons();
    }
  };

  const renderPayPalButtons = async () => {
    if (!window.paypal || !paypalContainerRef.current) return;
    paypalContainerRef.current.innerHTML = '';
    const plan = plans.find(p => p.id === selectedPlan);
    if (!plan) return;
    const amount = getSelectedPlanPrice().toFixed(2);
    const token = localStorage.getItem('token');
    try {
      window.paypal.Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' },
        createOrder: async () => {
          const response = await fetch(`${getBackendUrl()}/api/paypal/create-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ amount, currency: 'USD', plan_id: selectedPlan, description: `${plan.name} Membership` })
          });
          const data = await response.json();
          if (data.order_id) return data.order_id;
          throw new Error(data.detail || 'Failed to create PayPal order');
        },
        onApprove: async (data) => {
          setCheckingOut(true);
          try {
            const response = await fetch(`${getBackendUrl()}/api/paypal/capture-order`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ order_id: data.orderID })
            });
            const captureData = await response.json();
            if (captureData.success) {
              const plan = plans.find(p => p.id === selectedPlan);
              await activateMembership(selectedPlan, plan?.name || selectedPlan, parseFloat(amount), 'paypal', captureData.capture_id || data.orderID);
              toastService.success('Payment successful! Welcome to Premium!');
              navigate(`/payment/success?provider=paypal&transaction_id=${captureData.capture_id || ''}`);
            } else {
              toastService.error(captureData.detail || 'Payment capture failed');
            }
          } catch (error) {
            toastService.error('Payment failed. Please try again.');
          } finally { setCheckingOut(false); }
        },
        onCancel: () => toastService.warning('Payment cancelled'),
        onError: (err) => { console.error('PayPal error:', err); toastService.error('PayPal error. Please try again.'); }
      }).render(paypalContainerRef.current);
      setPaypalReady(true);
    } catch (error) {
      console.error('Error rendering PayPal buttons:', error);
      toastService.error('Failed to initialize PayPal');
    }
  };

  const loadPlans = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/site-settings/membership`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success && data.membership) {
        const allPlans = data.membership.plans || [];
        const activePlans = allPlans
          .filter(p => p.isActive !== false && (p.id === 'premium' || p.id === 'lifetime'))
          .sort((a, b) => a.price - b.price);
        setPlans(activePlans);
        const urlPlanId = searchParams.get('plan');
        const defaultPlanId = data.membership.defaultPlanId;
        const preselectedPlan = activePlans.find(p => p.id === urlPlanId)
          || activePlans.find(p => p.id === defaultPlanId)
          || activePlans[0];
        if (preselectedPlan) setSelectedPlan(preselectedPlan.id);
      }
    } catch (error) {
      console.error('Error loading plans:', error);
      toastService.error('Failed to load membership plans');
    } finally { setLoading(false); }
  };

  const loadSubscriptionStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const username = localStorage.getItem('username');
      if (!username) return;
      const response = await fetch(`${getBackendUrl()}/api/users/profile/${username}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data) {
        setSubscriptionStatus({
          isPremium: data.isPremium || false,
          premiumStatus: data.premiumStatus || 'free',
          planId: data.membershipPlanId,
          activatedAt: data.premiumActivatedAt,
          expiresAt: data.premiumExpiresAt,
          isLifetime: data.membershipPlanId === 'lifetime'
        });
      }
    } catch (error) { console.error('Error loading subscription:', error); }
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim() || !selectedPlan || selectedPlan === 'free') {
      toastService.warning('Please select a paid plan and enter a promo code');
      return;
    }
    setApplyingPromo(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${getBackendUrl()}/api/contributions/apply-promo?plan_id=${selectedPlan}&promo_code=${encodeURIComponent(promoCode)}`,
        { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.success) {
        setPromoApplied(data);
        toastService.success(`Promo code applied! You save $${data.discountAmount.toFixed(2)}`);
      } else {
        toastService.error(data.detail || 'Invalid promo code');
        setPromoApplied(null);
      }
    } catch (error) {
      toastService.error('Failed to apply promo code');
      setPromoApplied(null);
    } finally { setApplyingPromo(false); }
  };

  const handleCloverPay = async () => {
    if (!cloverInstanceRef.current) return;
    const amount = getSelectedPlanPrice();
    if (!amount || amount < 1) {
      toastService.error('Please select a valid plan');
      return;
    }
    setCloverLoading(true);
    try {
      const result = await cloverInstanceRef.current.createToken();
      if (result.errors) {
        const errMsgs = Object.values(result.errors).map(e => typeof e === 'string' ? e : (e?.message || JSON.stringify(e)));
        toastService.error(errMsgs.join(', '));
        setCloverLoading(false);
        return;
      }
      const sourceToken = result.token;
      const token = localStorage.getItem('token');
      const plan = plans.find(p => p.id === selectedPlan);
      const chargeRes = await fetch(`${getBackendUrl()}/api/clover/charge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          source: sourceToken,
          amount: amount.toFixed(2),
          description: `${plan?.name || 'Membership'} - $${amount.toFixed(2)}`,
          recurring: false
        })
      });
      const chargeData = await chargeRes.json();
      if (chargeData.success) {
        const plan = plans.find(p => p.id === selectedPlan);
        await activateMembership(selectedPlan, plan?.name || selectedPlan, amount, 'clover', chargeData.charge_id || '');
        toastService.success('Payment successful! Welcome to Premium!');
        navigate(`/payment/success?provider=clover&transaction_id=${chargeData.charge_id || ''}`);
      } else {
        const detail = chargeData.detail;
        const msg = typeof detail === 'string' ? detail
          : Array.isArray(detail) ? detail.map(d => d.msg || JSON.stringify(d)).join(', ')
          : (detail?.msg || 'Card charge failed. Please try again.');
        toastService.error(msg);
      }
    } catch (err) {
      toastService.error('Failed to process card payment. Please try again.');
    } finally {
      setCloverLoading(false);
    }
  };

  const activateMembership = async (planId, planName, amount, paymentMethod, transactionId) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${getBackendUrl()}/api/membership/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          plan_id: planId,
          plan_name: planName,
          amount: amount,
          payment_method: paymentMethod,
          transaction_id: transactionId,
          promo_code: promoApplied?.promoCode || null,
          discount_amount: promoApplied?.discountAmount || 0,
        })
      });
    } catch (e) { console.error('Failed to activate membership:', e); }
  };

  const getSelectedPlanPrice = () => {
    const plan = plans.find(p => p.id === selectedPlan);
    if (!plan) return 0;
    if (promoApplied && promoApplied.finalPrice !== undefined) return promoApplied.finalPrice;
    return plan.price;
  };

  const formatDuration = (months) => {
    if (!months) return 'Lifetime';
    if (months === 1) return '1 month';
    if (months === 12) return '1 year';
    return `${months} months`;
  };

  const getPlanBilling = (plan) => {
    if (plan.id === 'lifetime') return 'Pay once, forever access';
    if (!plan.duration) return 'No cost, limited access';
    if (plan.duration === 12) return `or $${plan.price.toFixed(2)}/year`;
    return `${formatDuration(plan.duration)} plan`;
  };

  if (loading) {
    return (
      <div className="pricing-page">
        <div className="pricing-loading"><div className="spinner"></div><p>Loading membership plans...</p></div>
      </div>
    );
  }

  if (subscriptionStatus?.isPremium && subscriptionStatus?.isLifetime) {
    return (
      <div className="pricing-page">
        <div className="pricing-container">
          <div className="current-subscription">
            <div className="subscription-card">
              <div className="subscription-badge">Active</div>
              <h3>💎 Lifetime Membership</h3>
              <div className="subscription-details">
                <p><strong>Status:</strong> <span className="status-active">Active</span></p>
                {subscriptionStatus.activatedAt && <p><strong>Member since:</strong> {new Date(subscriptionStatus.activatedAt).toLocaleDateString()}</p>}
                <p className="lifetime-badge">Lifetime Access - Never Expires!</p>
              </div>
            </div>
          </div>
          <div className="subscription-actions"><button className="btn-secondary" onClick={() => navigate('/dashboard')}>Back to Dashboard</button></div>
        </div>
      </div>
    );
  }

  const isFreeSelected = selectedPlan === 'free';
  const selectedPaidPlan = plans.find(p => p.id === selectedPlan);

  return (
    <div className="pricing-page">
      <div className="pricing-container">
        {subscriptionStatus?.isPremium && !subscriptionStatus?.isLifetime && (
          <div className="current-plan-banner">
            ⭐ You currently have <strong>Premium</strong>. Upgrade to Lifetime for permanent access!
          </div>
        )}

        <h2 className="pricing-heading">Choose Your Membership</h2>

        {/* 3-Column Plan Cards */}
        <div className="plans-grid three-col">
          {/* Free */}
          <div
            className={`plan-card ${isFreeSelected ? 'selected' : ''} ${subscriptionStatus?.premiumStatus === 'free' && !subscriptionStatus?.isPremium ? 'current' : ''}`}
            onClick={() => { setSelectedPlan('free'); setPromoApplied(null); }}
          >
            {subscriptionStatus?.premiumStatus === 'free' && !subscriptionStatus?.isPremium && (
              <div className="popular-badge current-badge">Current Plan</div>
            )}
            <div className="plan-icon">{FREE_PLAN.icon}</div>
            <div className="plan-name">{FREE_PLAN.name}</div>
            <div className="plan-price"><span className="price-amount">$0</span><span className="price-period">/mo</span></div>
            <div className="plan-billing">No cost, limited access</div>
            <ul className="plan-features">
              {FREE_PLAN.features.map((f, i) => <li key={i}><span className="feature-limit">1</span>{f.replace(/^\d+\s/, '')}</li>)}
              {FREE_PLAN.missing.map((f, i) => <li key={`m-${i}`} className="feature-missing"><span className="feature-cross">✕</span>{f}</li>)}
            </ul>
            <div className="plan-select">
              <div className={`radio-button ${isFreeSelected ? 'checked' : ''}`}>
                {isFreeSelected && <div className="radio-inner"></div>}
              </div>
              <span>Current Plan</span>
            </div>
          </div>

          {/* Paid Plans from API */}
          {plans.map(plan => {
            const isSelected = selectedPlan === plan.id;
            const isCurrent = subscriptionStatus?.planId === plan.id;
            const isLifetime = plan.id === 'lifetime';
            return (
              <div
                key={plan.id}
                className={`plan-card ${isSelected ? 'selected' : ''} ${plan.isPopular ? 'popular' : ''} ${isCurrent ? 'current' : ''}`}
                onClick={() => { setSelectedPlan(plan.id); setPromoApplied(null); }}
              >
                {plan.isPopular && <div className="popular-badge">Most Popular</div>}
                {isCurrent && !plan.isPopular && <div className="popular-badge current-badge">Current Plan</div>}
                <div className="plan-icon">{isLifetime ? '💎' : '⭐'}</div>
                <div className="plan-name">{plan.name}</div>
                <div className="plan-price">
                  <span className="price-amount">${plan.price}</span>
                  <span className="price-period">/{formatDuration(plan.duration)}</span>
                </div>
                <div className="plan-billing">{getPlanBilling(plan)}</div>
                <ul className="plan-features">
                  {plan.features && plan.features.map((f, i) => (
                    <li key={i}><span className="feature-check">✓</span>{f}</li>
                  ))}
                </ul>
                <div className="plan-select">
                  <div className={`radio-button ${isSelected ? 'checked' : ''}`}>
                    {isSelected && <div className="radio-inner"></div>}
                  </div>
                  <span>{isCurrent ? 'Current Plan' : `Select ${plan.name}`}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Checkout Section (only for paid plans) */}
        {!isFreeSelected && selectedPaidPlan && (
          <div className="checkout-section">
            <div className="payment-method-section">
              <label>Choose Payment Method</label>
              <div className="payment-methods">
                {paypalConfigured && (
                  <div className={`payment-method-option ${paymentMethod === 'paypal' ? 'selected' : ''}`} onClick={() => setPaymentMethod('paypal')}>
                    <div className="payment-method-icon paypal-icon">P</div>
                    <div className="payment-method-info">
                      <span className="payment-method-name">PayPal</span>
                      <span className="payment-method-desc">Pay with PayPal account or card</span>
                    </div>
                    <div className={`radio-button ${paymentMethod === 'paypal' ? 'checked' : ''}`}>
                      {paymentMethod === 'paypal' && <div className="radio-inner"></div>}
                    </div>
                  </div>
                )}
                <div className={`payment-method-option ${paymentMethod === 'clover' ? 'selected' : ''}`} onClick={() => setPaymentMethod('clover')}>
                  <div className="payment-method-icon">☘</div>
                  <div className="payment-method-info">
                    <span className="payment-method-name">Card</span>
                    <span className="payment-method-desc">Pay securely with credit or debit card</span>
                  </div>
                  <div className={`radio-button ${paymentMethod === 'clover' ? 'checked' : ''}`}>
                    {paymentMethod === 'clover' && <div className="radio-inner"></div>}
                  </div>
                </div>
              </div>
            </div>

            {paymentMethod === 'paypal' && (
              <div className="paypal-container">
                <div ref={paypalContainerRef} id="paypal-buttons"></div>
                {!paypalReady && <div className="paypal-loading"><div className="spinner"></div><p>Loading PayPal...</p></div>}
              </div>
            )}

            {paymentMethod === 'clover' && (
              <div className="clover-checkout-section">
                <div className="clover-info">
                  <p>Pay securely with credit or debit card.</p>
                </div>
                <div className="clover-card-form">
                  <div className="clover-field">
                    <label className="clover-label">Card Number</label>
                    <div id="pricing-clover-card-number" className="clover-input-container"></div>
                  </div>
                  <div className="clover-field-row">
                    <div className="clover-field clover-field-half">
                      <label className="clover-label">Expiry</label>
                      <div id="pricing-clover-card-date" className="clover-input-container"></div>
                    </div>
                    <div className="clover-field clover-field-half">
                      <label className="clover-label">CVV</label>
                      <div id="pricing-clover-card-cvv" className="clover-input-container"></div>
                    </div>
                  </div>
                  <div className="clover-field">
                    <label className="clover-label">ZIP Code</label>
                    <div id="pricing-clover-card-zip" className="clover-input-container"></div>
                  </div>
                </div>
                <button
                  className="btn-checkout clover-pay-btn"
                  onClick={handleCloverPay}
                  disabled={cloverLoading || !cloverReady}
                >
                  {cloverLoading ? (
                    <><span className="spinner"></span> Processing...</>
                  ) : !cloverReady ? (
                    <><span className="spinner"></span> Loading card form...</>
                  ) : (
                    `Pay $${getSelectedPlanPrice().toFixed(2)}`
                  )}
                </button>
              </div>
            )}

            <div className="promo-section">
              <label>Have a promo code?</label>
              <div className="promo-input-group">
                <input type="text" value={promoCode} onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoApplied(null); }} placeholder="Enter promo code" />
                <button onClick={handleApplyPromo} disabled={!promoCode.trim() || applyingPromo} className="btn-apply-promo">{applyingPromo ? 'Applying...' : 'Apply'}</button>
              </div>
              {promoApplied && <div className="promo-success">✓ {promoApplied.promoCode} applied - {promoApplied.discountType === 'percentage' ? `${promoApplied.discountValue}% off` : `$${promoApplied.discountValue} off`}</div>}
            </div>

            <div className="order-summary">
              <h3>Order Summary</h3>
              <div className="summary-row"><span>{selectedPaidPlan.name} Membership</span><span>${selectedPaidPlan.price.toFixed(2)}</span></div>
              {promoApplied && <div className="summary-row discount"><span>Discount ({promoApplied.promoCode})</span><span>-${promoApplied.discountAmount.toFixed(2)}</span></div>}
              <div className="summary-row total"><span>Total</span><span>${getSelectedPlanPrice().toFixed(2)}</span></div>
            </div>

            <p className="secure-notice">
              {paymentMethod === 'paypal' && '🔒 Secure payment powered by PayPal'}
              {paymentMethod === 'clover' && '🔒 Secure payment powered by Clover'}
            </p>
          </div>
        )}

        {!paypalConfigured && (
          <div className="payment-warning">Payment system is being configured. Please check back soon.</div>
        )}
      </div>
    </div>
  );
};

export default PricingPage;
