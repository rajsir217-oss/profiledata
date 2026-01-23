import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBackendUrl } from '../config/apiConfig';
import toastService from '../services/toastService';
import './PricingPage.css';

const PricingPage = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(null);
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [stripeConfigured, setStripeConfigured] = useState(false);
  const [braintreeConfigured, setBraintreeConfigured] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('stripe'); // 'stripe' or 'braintree'
  const [braintreeReady, setBraintreeReady] = useState(false);
  const [braintreeInstance, setBraintreeInstance] = useState(null);
  const braintreeContainerRef = useRef(null);

  useEffect(() => {
    loadPlans();
    loadSubscriptionStatus();
    checkPaymentConfigs();
  }, []);

  const checkPaymentConfigs = async () => {
    const token = localStorage.getItem('token');
    
    // Check Stripe
    try {
      const stripeResponse = await fetch(`${getBackendUrl()}/api/stripe/config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const stripeData = await stripeResponse.json();
      setStripeConfigured(stripeData.isConfigured);
    } catch (error) {
      console.error('Error checking Stripe config:', error);
    }
    
    // Check Braintree
    try {
      const braintreeResponse = await fetch(`${getBackendUrl()}/api/braintree/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const braintreeData = await braintreeResponse.json();
      setBraintreeConfigured(braintreeData.configured);
    } catch (error) {
      console.error('Error checking Braintree config:', error);
    }
  };

  // Initialize Braintree Drop-in when payment method changes to braintree
  useEffect(() => {
    if (paymentMethod === 'braintree' && braintreeConfigured && selectedPlan) {
      initializeBraintree();
    }
    
    return () => {
      // Cleanup Braintree instance
      if (braintreeInstance) {
        braintreeInstance.teardown();
        setBraintreeInstance(null);
        setBraintreeReady(false);
      }
    };
  }, [paymentMethod, braintreeConfigured, selectedPlan]);

  const initializeBraintree = async () => {
    if (!window.braintree) {
      // Load Braintree Drop-in script
      const script = document.createElement('script');
      script.src = 'https://js.braintreegateway.com/web/dropin/1.42.0/js/dropin.min.js';
      script.async = true;
      script.onload = () => setupBraintreeDropin();
      document.body.appendChild(script);
    } else {
      setupBraintreeDropin();
    }
  };

  const setupBraintreeDropin = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/braintree/client-token`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (!data.clientToken) {
        toastService.error('Failed to initialize PayPal payment');
        return;
      }

      // Clear previous instance and container
      if (braintreeInstance) {
        await braintreeInstance.teardown();
        setBraintreeInstance(null);
      }
      
      // Clear the container HTML
      if (braintreeContainerRef.current) {
        braintreeContainerRef.current.innerHTML = '';
      }

      // Create Drop-in instance - card only (PayPal disabled until sandbox account is linked)
      const instance = await window.braintree.dropin.create({
        authorization: data.clientToken,
        container: braintreeContainerRef.current,
        paymentOptionPriority: ['card'], // Only show card, hide PayPal
        card: {
          cardholderName: {
            required: true
          }
        }
      });

      setBraintreeInstance(instance);
      setBraintreeReady(true);
    } catch (error) {
      console.error('Error initializing Braintree:', error);
      toastService.error('Failed to initialize payment form');
    }
  };

  const loadPlans = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/stripe/plans`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setPlans(data.plans || []);
        const popularPlan = data.plans?.find(p => p.isPopular);
        if (popularPlan) {
          setSelectedPlan(popularPlan.id);
        }
      }
    } catch (error) {
      console.error('Error loading plans:', error);
      toastService.error('Failed to load membership plans');
    } finally {
      setLoading(false);
    }
  };

  const loadSubscriptionStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/stripe/subscription-status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setSubscriptionStatus(data);
      }
    } catch (error) {
      console.error('Error loading subscription status:', error);
    }
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim() || !selectedPlan) {
      toastService.warning('Please select a plan and enter a promo code');
      return;
    }
    setApplyingPromo(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${getBackendUrl()}/api/stripe/apply-promo?plan_id=${selectedPlan}&promo_code=${encodeURIComponent(promoCode)}`,
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
    } finally {
      setApplyingPromo(false);
    }
  };

  const handleCheckout = async () => {
    if (!selectedPlan) {
      toastService.warning('Please select a membership plan');
      return;
    }
    
    if (paymentMethod === 'stripe') {
      await handleStripeCheckout();
    } else if (paymentMethod === 'braintree') {
      await handleBraintreeCheckout();
    }
  };

  const handleStripeCheckout = async () => {
    if (!stripeConfigured) {
      toastService.error('Stripe payment is not configured. Please try PayPal.');
      return;
    }
    setCheckingOut(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/stripe/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ planId: selectedPlan, promoCode: promoApplied ? promoCode : null })
      });
      const data = await response.json();
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        toastService.error(data.detail || 'Failed to start checkout');
      }
    } catch (error) {
      toastService.error('Failed to start checkout. Please try again.');
    } finally {
      setCheckingOut(false);
    }
  };

  const handleBraintreeCheckout = async () => {
    if (!braintreeConfigured || !braintreeInstance) {
      toastService.error('PayPal payment is not ready. Please try again.');
      return;
    }
    
    setCheckingOut(true);
    try {
      // Get payment method nonce from Drop-in
      const { nonce } = await braintreeInstance.requestPaymentMethod();
      
      const token = localStorage.getItem('token');
      const plan = plans.find(p => p.id === selectedPlan);
      const amount = getSelectedPlanPrice().toFixed(2);
      
      const response = await fetch(`${getBackendUrl()}/api/braintree/process-payment`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          payment_method_nonce: nonce,
          amount: amount,
          plan_type: plan?.duration === 12 ? 'yearly' : plan?.duration === 6 ? '6month' : plan?.duration === 3 ? '3month' : 'monthly',
          order_id: `${selectedPlan}-${Date.now()}`
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        toastService.success('Payment successful! Welcome to Premium!');
        navigate(`/payment/success?provider=braintree&transaction_id=${data.transactionId || ''}`);
      } else {
        toastService.error(data.detail || 'Payment failed. Please try again.');
        navigate('/payment/cancel?provider=braintree');
      }
    } catch (error) {
      if (error.message?.includes('No payment method')) {
        toastService.warning('Please select a payment method');
      } else {
        toastService.error('Payment failed. Please try again.');
      }
    } finally {
      setCheckingOut(false);
    }
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

  if (loading) {
    return (
      <div className="pricing-page">
        <div className="pricing-loading"><div className="spinner"></div><p>Loading membership plans...</p></div>
      </div>
    );
  }

  if (subscriptionStatus?.isPremium) {
    return (
      <div className="pricing-page">
        <div className="pricing-container">
          <div className="pricing-header"><h1>You are a Premium Member!</h1><p>Thank you for being a valued member.</p></div>
          <div className="current-subscription">
            <div className="subscription-card">
              <div className="subscription-badge">Active</div>
              <h3>{subscriptionStatus.planId === 'lifetime' ? 'Lifetime' : 'Premium'} Membership</h3>
              <div className="subscription-details">
                <p><strong>Status:</strong> <span className="status-active">Active</span></p>
                {subscriptionStatus.activatedAt && <p><strong>Member since:</strong> {new Date(subscriptionStatus.activatedAt).toLocaleDateString()}</p>}
                {subscriptionStatus.expiresAt && !subscriptionStatus.isLifetime && <p><strong>Renews on:</strong> {new Date(subscriptionStatus.expiresAt).toLocaleDateString()}</p>}
                {subscriptionStatus.isLifetime && <p className="lifetime-badge">Lifetime Access - Never Expires!</p>}
              </div>
            </div>
          </div>
          <div className="subscription-actions"><button className="btn-secondary" onClick={() => navigate('/dashboard')}>Back to Dashboard</button></div>
        </div>
      </div>
    );
  }

  return (
    <div className="pricing-page">
      <div className="pricing-container">
        <div className="pricing-header"><h1>Choose Your Membership</h1><p>Unlock premium features and find your perfect match</p></div>
        {!stripeConfigured && !braintreeConfigured && <div className="stripe-warning">Payment system is being configured. Please check back soon.</div>}
        <div className="plans-grid">
          {plans.map(plan => (
            <div key={plan.id} className={`plan-card ${selectedPlan === plan.id ? 'selected' : ''} ${plan.isPopular ? 'popular' : ''}`} onClick={() => { setSelectedPlan(plan.id); setPromoApplied(null); }}>
              {plan.isPopular && <div className="popular-badge">Most Popular</div>}
              <div className="plan-name">{plan.name}</div>
              <div className="plan-price"><span className="price-currency">$</span><span className="price-amount">{plan.price}</span><span className="price-period">/{formatDuration(plan.duration)}</span></div>
              <ul className="plan-features">{plan.features.map((feature, idx) => <li key={idx}><span className="feature-check">✓</span>{feature}</li>)}</ul>
              <div className="plan-select"><div className={`radio-button ${selectedPlan === plan.id ? 'checked' : ''}`}>{selectedPlan === plan.id && <div className="radio-inner"></div>}</div><span>Select {plan.name}</span></div>
            </div>
          ))}
        </div>
        <div className="checkout-section">
          {/* Payment Method Selector */}
          {(stripeConfigured || braintreeConfigured) && (
            <div className="payment-method-section">
              <label>Choose Payment Method</label>
              <div className="payment-methods">
                {stripeConfigured && (
                  <div 
                    className={`payment-method-option ${paymentMethod === 'stripe' ? 'selected' : ''}`}
                    onClick={() => setPaymentMethod('stripe')}
                  >
                    <div className="payment-method-icon">💳</div>
                    <div className="payment-method-info">
                      <span className="payment-method-name">Credit/Debit Card</span>
                      <span className="payment-method-desc">Visa, Mastercard, Amex</span>
                    </div>
                    <div className={`radio-button ${paymentMethod === 'stripe' ? 'checked' : ''}`}>
                      {paymentMethod === 'stripe' && <div className="radio-inner"></div>}
                    </div>
                  </div>
                )}
                {braintreeConfigured && (
                  <div 
                    className={`payment-method-option ${paymentMethod === 'braintree' ? 'selected' : ''}`}
                    onClick={() => setPaymentMethod('braintree')}
                  >
                    <div className="payment-method-icon">💳</div>
                    <div className="payment-method-info">
                      <span className="payment-method-name">Card (Braintree)</span>
                      <span className="payment-method-desc">Alternative payment processor</span>
                    </div>
                    <div className={`radio-button ${paymentMethod === 'braintree' ? 'checked' : ''}`}>
                      {paymentMethod === 'braintree' && <div className="radio-inner"></div>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Braintree Drop-in Container */}
          {paymentMethod === 'braintree' && selectedPlan && (
            <div className="braintree-container">
              <div ref={braintreeContainerRef} id="braintree-dropin"></div>
              {!braintreeReady && (
                <div className="braintree-loading">
                  <div className="spinner"></div>
                  <p>Loading payment form...</p>
                </div>
              )}
            </div>
          )}

          <div className="promo-section">
            <label>Have a promo code?</label>
            <div className="promo-input-group">
              <input type="text" value={promoCode} onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoApplied(null); }} placeholder="Enter promo code" disabled={!selectedPlan} />
              <button onClick={handleApplyPromo} disabled={!promoCode.trim() || !selectedPlan || applyingPromo} className="btn-apply-promo">{applyingPromo ? 'Applying...' : 'Apply'}</button>
            </div>
            {promoApplied && <div className="promo-success">✓ {promoApplied.promoCode} applied - {promoApplied.discountType === 'percentage' ? `${promoApplied.discountValue}% off` : `$${promoApplied.discountValue} off`}</div>}
          </div>
          <div className="order-summary">
            <h3>Order Summary</h3>
            {selectedPlan && (
              <>
                <div className="summary-row"><span>{plans.find(p => p.id === selectedPlan)?.name} Membership</span><span>${plans.find(p => p.id === selectedPlan)?.price.toFixed(2)}</span></div>
                {promoApplied && <div className="summary-row discount"><span>Discount ({promoApplied.promoCode})</span><span>-${promoApplied.discountAmount.toFixed(2)}</span></div>}
                <div className="summary-row total"><span>Total</span><span>${getSelectedPlanPrice().toFixed(2)}</span></div>
              </>
            )}
          </div>
          <button 
            className="btn-checkout" 
            onClick={handleCheckout} 
            disabled={
              !selectedPlan || 
              checkingOut || 
              (paymentMethod === 'stripe' && !stripeConfigured) ||
              (paymentMethod === 'braintree' && (!braintreeConfigured || !braintreeReady))
            }
          >
            {checkingOut ? 'Processing...' : `Proceed to Payment - $${getSelectedPlanPrice().toFixed(2)}`}
          </button>
          <p className="secure-notice">
            {paymentMethod === 'stripe' ? '🔒 Secure payment powered by Stripe' : '🔒 Secure payment powered by PayPal'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
