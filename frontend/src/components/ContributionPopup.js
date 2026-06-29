import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getBackendUrl } from '../config/apiConfig';
import toastService from '../services/toastService';
import logger from '../utils/logger';
import './ContributionPopup.css';

const MEMBER_STATS_CACHE_TTL_MS = 10 * 60 * 1000;

const ContributionPopup = ({ isOpen, onClose, contributionConfig }) => {
  const [selectedAmount, setSelectedAmount] = useState(25); // Default to $25
  const [customAmount, setCustomAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paypalReady, setPaypalReady] = useState(false);
  const [paypalFailed, setPaypalFailed] = useState(false);
  const [paypalKey, setPaypalKey] = useState(0);
  const paypalContainerRef = useRef(null);
  const paypalScriptLoaded = useRef(false);
  const amountRef = useRef(25);
  const paypalInitialized = useRef(false);
  const [paymentMethod, setPaymentMethod] = useState('paypal'); // 'paypal', 'venmo-qr', 'paypal-qr', 'clover'
  const [cloverLoading, setCloverLoading] = useState(false);
  const [cloverReady, setCloverReady] = useState(false);
  const [cloverConfig, setCloverConfig] = useState(null);
  const cloverInstanceRef = useRef(null);
  const cloverMountedRef = useRef(false);
  const [cloverSuccess, setCloverSuccess] = useState(false);
  const [cloverRecurring, setCloverRecurring] = useState(false);
  const [memberStats, setMemberStats] = useState({
    daysActive: 0,
    profileViews: 0,
    profileFavorites: 0,
    profileShortlists: 0,
    conversations: 0,
  });
  const [memberStatsLoading, setMemberStatsLoading] = useState(false);

  const computeDaysActive = useCallback((createdAtValue) => {
    if (!createdAtValue) return 0;
    const createdAt = new Date(createdAtValue);
    if (Number.isNaN(createdAt.getTime())) return 0;
    const diffMs = Date.now() - createdAt.getTime();
    return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }, []);

  const loadMemberStats = useCallback(async () => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    if (!token || !username) return;

    const cacheKey = `contribution_member_stats_v3:${username}`;
    try {
      const cachedRaw = sessionStorage.getItem(cacheKey);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (
          cached &&
          cached.cachedAt &&
          Date.now() - Number(cached.cachedAt) < MEMBER_STATS_CACHE_TTL_MS &&
          cached.stats
        ) {
          setMemberStats(cached.stats);
          return;
        }
      }
    } catch (err) {
      logger.debug('Contribution popup stats cache parse failed', err);
    }

    setMemberStatsLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const statsRes = await fetch(`${getBackendUrl()}/api/users/${encodeURIComponent(username)}/stats`, { headers });

      if (!statsRes.ok) {
        logger.warn('Failed to fetch user stats, using fallback');
        throw new Error('Stats endpoint failed');
      }

      const statsData = await statsRes.json();
      const stats = statsData?.stats || {};

      const nextStats = {
        daysActive: stats.daysActive || 0,
        profileViews: stats.profileViews || 0,
        profileFavorites: stats.favoritedBy || 0,
        profileShortlists: stats.shortlistedBy || 0,
        conversations: stats.uniqueConversations || 0,
      };

      setMemberStats(nextStats);
      try {
        sessionStorage.setItem(
          cacheKey,
          JSON.stringify({
            cachedAt: Date.now(),
            stats: nextStats,
          })
        );
      } catch (err) {
        logger.debug('Contribution popup stats cache write failed', err);
      }
    } catch (err) {
      logger.warn('Failed to load contribution member stats, falling back to live calculation', err);
      // Fallback to live calculation if snapshot endpoint fails
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [profileRes, viewsRes, favoritesRes, shortlistRes, conversationsRes] = await Promise.allSettled([
          fetch(`${getBackendUrl()}/api/users/profile/${encodeURIComponent(username)}`, { headers }),
          fetch(`${getBackendUrl()}/api/users/profile-views/${encodeURIComponent(username)}`, { headers }),
          fetch(`${getBackendUrl()}/api/users/favorites/${encodeURIComponent(username)}`, { headers }),
          fetch(`${getBackendUrl()}/api/users/shortlist/${encodeURIComponent(username)}`, { headers }),
          fetch(`${getBackendUrl()}/api/users/messages/conversations?username=${encodeURIComponent(username)}`, { headers }),
        ]);

        const safeJson = async (res) => {
          if (!res || !res.ok) return null;
          try {
            return await res.json();
          } catch (err) {
            return null;
          }
        };

        const profileData = await safeJson(profileRes.status === 'fulfilled' ? profileRes.value : null);
        const viewsData = await safeJson(viewsRes.status === 'fulfilled' ? viewsRes.value : null);
        const favoritesData = await safeJson(favoritesRes.status === 'fulfilled' ? favoritesRes.value : null);
        const shortlistData = await safeJson(shortlistRes.status === 'fulfilled' ? shortlistRes.value : null);
        const conversationsData = await safeJson(conversationsRes.status === 'fulfilled' ? conversationsRes.value : null);

        const fallbackStats = {
          daysActive: computeDaysActive(profileData?.createdAt),
          profileViews: Number(viewsData?.totalViews ?? viewsData?.uniqueViewers ?? viewsData?.views?.length ?? viewsData?.viewers?.length ?? 0) || 0,
          profileFavorites: Array.isArray(favoritesData?.favorites) ? favoritesData.favorites.length : 0,
          profileShortlists: Array.isArray(shortlistData?.shortlist) ? shortlistData.shortlist.length : 0,
          conversations: Array.isArray(conversationsData?.conversations) ? conversationsData.conversations.length : 0,
        };

        setMemberStats(fallbackStats);
      } catch (fallbackErr) {
        logger.warn('Fallback stats calculation also failed', fallbackErr);
      }
    } finally {
      setMemberStatsLoading(false);
    }
  }, [computeDaysActive]);

  // Use admin-configured amounts (deduped + descending numeric sort for display).
  // Default [25, 50, 75, 100] renders as [100, 75, 50, 25].
  const amounts = [...new Set(contributionConfig?.amounts || [25, 50, 75, 100])]
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => b - a);

  // Log activity to backend (fire and forget)
  const logActivity = useCallback(async (action, amount = null, pType = null) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${getBackendUrl()}/api/contributions/log-contribution-activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action,
          amount,
          paymentType: pType
        })
      });
    } catch (err) {
      // Silent fail - don't disrupt user experience
    }
  }, []);

  // Get the current amount
  const getAmount = useCallback(() => {
    if (selectedAmount === 'custom') {
      return parseFloat(customAmount) || 0;
    }
    return parseFloat(selectedAmount) || 0;
  }, [selectedAmount, customAmount]);

  // Load PayPal SDK script
  const loadPayPalScript = useCallback(async () => {
    if (paypalScriptLoaded.current || window.paypal) {
      paypalScriptLoaded.current = true;
      return true;
    }

    try {
      const response = await fetch(`${getBackendUrl()}/api/paypal/config`);
      const config = await response.json();

      if (!config.configured || !config.client_id) {
        setPaypalFailed(true);
        setError('PayPal is not configured. Please contact support.');
        return false;
      }

      return new Promise((resolve) => {
        const script = document.createElement('script');
        // Only disable the legacy PayPal Credit funding source. Keep 'card'
        // so the "Debit or Credit Card" button shows alongside PayPal.
        script.src = `https://www.paypal.com/sdk/js?client-id=${config.client_id}&currency=USD&disable-funding=credit`;
        script.async = true;
        script.onload = () => {
          paypalScriptLoaded.current = true;
          resolve(true);
        };
        script.onerror = () => {
          setPaypalFailed(true);
          setError('PayPal failed to load. Please disable ad blockers and try again.');
          resolve(false);
        };
        document.body.appendChild(script);
      });
    } catch (err) {
      setPaypalFailed(true);
      setError('Failed to initialize PayPal.');
      return false;
    }
  }, []);

  // Render PayPal buttons into the current container
  const renderPayPalButtons = useCallback(() => {
    if (!window.paypal || !paypalContainerRef.current) return;

    const token = localStorage.getItem('token');

    try {
      window.paypal.Buttons({
        style: {
          layout: 'vertical',
          color: 'gold',
          shape: 'rect',
          label: 'paypal',
          height: 40,
          tagline: false
        },
        createOrder: async () => {
          const amount = amountRef.current;
          if (!amount || amount < 1) {
            setError('Please select a valid amount (minimum $1)');
            throw new Error('Invalid amount');
          }

          const response = await fetch(`${getBackendUrl()}/api/paypal/create-order`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              amount: amount.toFixed(2),
              currency: 'USD',
              plan_id: 'contribution',
              description: `Contribution - $${amount.toFixed(2)}`
            })
          });
          const data = await response.json();
          if (data.order_id) {
            logActivity('proceed_to_payment', amount, 'one-time');
            return data.order_id;
          }
          throw new Error(data.detail || 'Failed to create order');
        },
        onApprove: async (data) => {
          setLoading(true);
          setError('');
          try {
            const response = await fetch(`${getBackendUrl()}/api/paypal/capture-order`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ order_id: data.orderID })
            });
            const captureData = await response.json();
            if (captureData.success) {
              logActivity('contributed', amountRef.current, 'one-time');
              // Notify the hook so banners refresh (silence window now active).
              window.dispatchEvent(new Event('contributionMade'));
              if (toastService) {
                toastService.success('Thank you for your contribution! 💜');
              }
              onClose();
            } else {
              setError(captureData.detail || 'Payment failed. Please try again.');
            }
          } catch (err) {
            setError('Payment failed. Please try again.');
          } finally {
            setLoading(false);
          }
        },
        onCancel: () => {
          logActivity('payment_cancelled');
        },
        onError: (err) => {
          setError('PayPal encountered an error. Please try again.');
        }
      }).render(paypalContainerRef.current)
        .then(() => {
          setPaypalReady(true);
        })
        .catch((renderErr) => {
          // Suppress 'container removed from DOM' errors when popup closes
          const msg = renderErr?.message || String(renderErr);
          if (!msg.includes('container') && !msg.includes('removed') && !msg.includes('DOM')) {
            setPaypalFailed(true);
          }
        });
    } catch (err) {
      setPaypalFailed(true);
    }
  }, [logActivity, onClose]);

  // Keep amountRef in sync and debounce paypalKey bump to avoid duplicate buttons
  useEffect(() => {
    const newAmount = getAmount();
    amountRef.current = newAmount;

    if (!paypalInitialized.current) return;

    // Debounce for custom input (user typing), instant for preset amounts
    const delay = selectedAmount === 'custom' ? 800 : 50;
    const timer = setTimeout(() => {
      setPaypalKey(k => k + 1);
      setPaypalReady(false);
    }, delay);

    return () => clearTimeout(timer);
  }, [getAmount, selectedAmount]);

  // Re-render PayPal buttons when container remounts (key changed)
  useEffect(() => {
    if (isOpen && paypalScriptLoaded.current && window.paypal && paypalContainerRef.current && !paypalReady) {
      renderPayPalButtons();
    }
  }, [paypalKey, isOpen, paypalReady, renderPayPalButtons]);

  // ESC key handler
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && !loading) {
        handleDismiss();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, loading]);

  // Handle body scroll lock when popup opens/closes
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      logActivity('popup_shown');
      loadMemberStats();
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, logActivity, loadMemberStats]);

  // Load PayPal SDK once and render buttons on first open
  useEffect(() => {
    if (isOpen && !paypalInitialized.current && !paypalFailed) {
      const initPayPal = async () => {
        const loaded = await loadPayPalScript();
        if (loaded) {
          paypalInitialized.current = true;
          setTimeout(() => renderPayPalButtons(), 200);
        }
      };
      initPayPal();
    }
  }, [isOpen, paypalFailed, loadPayPalScript, renderPayPalButtons]);

  // Initialize Clover SDK when Card tab is selected
  useEffect(() => {
    if (!isOpen || paymentMethod !== 'clover') return;
    if (cloverMountedRef.current) return;

    const initClover = async () => {
      try {
        if (!window.isSecureContext) {
          setError('Card payments require HTTPS. Please use PayPal.');
          return;
        }

        // Fetch SDK config from backend
        const token = localStorage.getItem('token');
        const res = await fetch(`${getBackendUrl()}/api/clover/sdk-config`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const config = await res.json();
        if (!res.ok) {
          setError(config?.detail || 'Clover card payments not available.');
          return;
        }
        if (!config.public_key) {
          setError('Clover card payments not available.');
          return;
        }
        setCloverConfig(config);

        // Load Clover SDK script if not already loaded
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

        // Initialize Clover instance
        const clover = new window.Clover(config.public_key);
        cloverInstanceRef.current = clover;
        const elements = clover.elements();

        // Mount card elements into DOM containers
        const styles = {
          body: { fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontSize: '14px' },
          input: { fontSize: '15px', padding: '10px 8px' }
        };
        const cardNumber = elements.create('CARD_NUMBER', styles);
        const cardDate = elements.create('CARD_DATE', styles);
        const cardCvv = elements.create('CARD_CVV', styles);
        const cardPostalCode = elements.create('CARD_POSTAL_CODE', styles);

        // Small delay to ensure DOM containers are rendered
        setTimeout(() => {
          try {
            cardNumber.mount('#clover-card-number');
            cardDate.mount('#clover-card-date');
            cardCvv.mount('#clover-card-cvv');
            cardPostalCode.mount('#clover-card-zip');
            cloverMountedRef.current = true;
            setCloverReady(true);
          } catch (mountErr) {
            setError('Failed to mount card form. Please try again.');
          }
        }, 300);
      } catch (err) {
        setError('Failed to initialize card payment form.');
      }
    };
    initClover();

    return () => {
      cloverMountedRef.current = false;
      setCloverReady(false);
    };
  }, [isOpen, paymentMethod]);

  // Handle Clover card payment submission
  const handleCloverPay = useCallback(async () => {
    if (!cloverInstanceRef.current) return;
    const amount = getAmount();
    if (!amount || amount < 1) {
      setError('Please select a valid amount (minimum $1)');
      return;
    }
    setCloverLoading(true);
    setError('');
    try {
      const result = await cloverInstanceRef.current.createToken();
      if (result.errors) {
        const errMsgs = Object.values(result.errors).map(e => typeof e === 'string' ? e : (e?.message || JSON.stringify(e)));
        setError(errMsgs.join(', '));
        setCloverLoading(false);
        return;
      }
      const sourceToken = result.token;
      logActivity('proceed_to_payment', amount, 'clover-card');

      // Send token to backend to create charge
      const authToken = localStorage.getItem('token');
      const chargeRes = await fetch(`${getBackendUrl()}/api/clover/charge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          source: sourceToken,
          amount: amount.toFixed(2),
          description: `Contribution - $${amount.toFixed(2)}`,
          recurring: cloverRecurring
        })
      });
      const chargeData = await chargeRes.json();
      if (chargeData.success) {
        setCloverSuccess(true);
        // Notify the hook so banners refresh (silence window now active).
        window.dispatchEvent(new Event('contributionMade'));
        if (toastService) {
          const recurMsg = cloverRecurring ? ' (monthly recurring)' : '';
          toastService.success(`Payment of $${amount.toFixed(2)}${recurMsg} successful! Thank you!`);
        }
        setTimeout(() => onClose(), 2500);
      } else {
        const detail = chargeData.detail;
        const msg = typeof detail === 'string' ? detail
          : Array.isArray(detail) ? detail.map(d => d.msg || JSON.stringify(d)).join(', ')
          : (detail?.msg || 'Card charge failed. Please try again.');
        setError(msg);
      }
    } catch (err) {
      setError('Failed to process card payment. Please try again.');
    } finally {
      setCloverLoading(false);
    }
  }, [getAmount, logActivity, onClose, cloverRecurring]);

  // Handle dismiss. onClose() delegates to the hook, which writes the
  // per-session SESSION_POPUP_DISMISSED flag. No localStorage write here.
  const handleDismiss = () => {
    if (!loading) {
      logActivity('popup_dismissed');
      onClose();
    }
  };

  return (
    <div className="contribution-popup-overlay" onClick={handleDismiss} style={{ display: isOpen ? 'flex' : 'none' }}>
      <div className="contribution-popup" onClick={(e) => e.stopPropagation()}>
        <div className="contribution-popup-header">
          <button 
            className="contribution-popup-close" 
            onClick={handleDismiss}
            disabled={loading}
          >
            ✕
          </button>
        </div>

        <div className="contribution-popup-body">
          <p className="contribution-message">
            Your support helps and enourage our team to continuously improving the platform for everyone.
          </p>

          <section className="contribution-member-stats" aria-label="Your member value stats">
            <div className="contribution-member-stats-title">Your Value Snapshot ✨</div>
            <div className="contribution-member-stats-grid">
              <div className="contribution-member-stat-card">
                <span className="contribution-member-stat-label"><span className="contribution-member-stat-emoji">📅</span> Days Active</span>
                <span className="contribution-member-stat-value">{memberStatsLoading ? '...' : memberStats.daysActive}</span>
              </div>
              <div className="contribution-member-stat-card">
                <span className="contribution-member-stat-label"><span className="contribution-member-stat-emoji">👀</span> Views</span>
                <span className="contribution-member-stat-value">{memberStatsLoading ? '...' : memberStats.profileViews}</span>
              </div>
              <div className="contribution-member-stat-card">
                <span className="contribution-member-stat-label"><span className="contribution-member-stat-emoji">⭐</span> Favorites</span>
                <span className="contribution-member-stat-value">{memberStatsLoading ? '...' : memberStats.profileFavorites}</span>
              </div>
              <div className="contribution-member-stat-card">
                <span className="contribution-member-stat-label"><span className="contribution-member-stat-emoji">📝</span> Shortlists</span>
                <span className="contribution-member-stat-value">{memberStatsLoading ? '...' : memberStats.profileShortlists}</span>
              </div>
              <div className="contribution-member-stat-card">
                <span className="contribution-member-stat-label"><span className="contribution-member-stat-emoji">💬</span> Messages</span>
                <span className="contribution-member-stat-value">{memberStatsLoading ? '...' : memberStats.conversations}</span>
              </div>
            </div>
          </section>

          {error && <div className="contribution-error">{error}</div>}

          <section className="contribution-block contribution-amounts-block" aria-label="Contribution amount options">
            <div className="contribution-block-title">Choose Your Contribution</div>
            <div className="contribution-amounts">
              {amounts.map((amt) => (
                <label
                  key={amt}
                  className={`contribution-amount-option ${selectedAmount === amt ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="contributionAmount"
                    value={amt}
                    checked={selectedAmount === amt}
                    onChange={() => {
                      setSelectedAmount(amt);
                      setCustomAmount('');
                      setError('');
                    }}
                    disabled={loading}
                  />
                  <span className="contribution-amount-label">${amt}</span>
                  {amt === 100 && <span className="heart-badge">❤️</span>}
                </label>
              ))}

              <label
                className={`contribution-amount-option custom-option ${selectedAmount === 'custom' ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="contributionAmount"
                  value="custom"
                  checked={selectedAmount === 'custom'}
                  onChange={() => setSelectedAmount('custom')}
                  disabled={loading}
                />
                <span className="contribution-amount-label custom-amount-label">
                  $
                  <input
                    type="number"
                    className="custom-amount-input"
                    value={customAmount}
                    onChange={(e) => {
                      setCustomAmount(e.target.value);
                      setSelectedAmount('custom');
                      setError('');
                    }}
                    placeholder="Amt"
                    min="1"
                    disabled={loading}
                  />
                </span>
              </label>
            </div>
          </section>

          {/* Payment Method Selection */}
          <section className="contribution-block contribution-payment-block" aria-label="Payment method selection">
            <div className="contribution-block-title">Select Payment Method</div>
            <div className="payment-method-toggle">
              <button
                className={`payment-method-btn ${paymentMethod === 'paypal' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('paypal')}
                disabled={loading}
              >
                <span className="paypal-p">P</span>
                PayPal
              </button>
              <button
                className={`payment-method-btn ${paymentMethod === 'paypal-qr' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('paypal-qr')}
                disabled={loading}
              >
                <span className="paypal-p">P</span>
                PayPal QR
              </button>
              <button
                className={`payment-method-btn ${paymentMethod === 'venmo-qr' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('venmo-qr')}
                disabled={loading}
              >
                <span className="venmo-v">V</span>
                Venmo QR
              </button>
              <button
                className={`payment-method-btn ${paymentMethod === 'clover' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('clover')}
                disabled={loading || cloverLoading}
              >
                <span className="clover-icon">☘</span>
                Card
              </button>
            </div>
          </section>

          {/* PayPal Buttons */}
          {paymentMethod === 'paypal' && (
            <div className="contribution-paypal-section">
              {loading && (
                <div className="paypal-processing">
                  <span className="spinner"></span>
                  Processing payment...
                </div>
              )}
              
              {!paypalReady && !paypalFailed && (
                <div className="paypal-loading">
                  <span className="spinner"></span>
                  Loading PayPal...
                </div>
              )}

              {/* Key forces clean React unmount/remount when amount changes */}
              <div 
                key={paypalKey}
                ref={paypalContainerRef} 
                id="contribution-paypal-buttons"
                style={{ display: paypalFailed ? 'none' : 'block' }}
              />

              {paypalFailed && (
                <div className="paypal-fallback">
                  <p>PayPal is currently unavailable.</p>
                  <button 
                    className="contribution-proceed-btn"
                    onClick={() => {
                      setPaypalFailed(false);
                      setError('');
                      loadPayPalScript().then((loaded) => {
                        if (loaded) renderPayPalButtons();
                      });
                    }}
                  >
                    Retry PayPal
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Venmo QR Code */}
          {paymentMethod === 'venmo-qr' && (
            <div className="qr-code-section">
              <div >
                <div className="qr-code-header">
                  <span className="venmo-v">V</span>
                  <h3>Scan with Venmo</h3>
                </div>
                <div className="qr-code-image">
                  <img 
                    src="/images/VenmoQR.png" 
                    alt="Venmo QR Code"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'block';
                    }}
                  />
                  <div className="qr-code-fallback" style={{ display: 'none' }}>
                    <p>📱 Venmo QR Code</p>
                    <p className="qr-username">@username</p>
                    <p className="qr-amount">${getAmount().toFixed(2)}</p>
                  </div>
                </div>
                <div className="qr-code-instructions">
                  <p>1. Open Venmo app</p>
                  <p>2. Scan this QR code</p>
                  <p>3. Send ${getAmount().toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Clover Card Payment (iframe SDK) */}
          {paymentMethod === 'clover' && (
            <div className="clover-checkout-section">
              {cloverSuccess ? (
                <div className="clover-success-msg">
                  <span className="clover-success-icon">✓</span>
                  <p>Payment successful! Thank you for your contribution.</p>
                </div>
              ) : (
                <>
                  <div className="clover-info">
                    <p>Pay securely with credit or debit card.</p>
                  </div>
                  <div className="clover-card-form">
                    <div className="clover-field">
                      <label className="clover-label">Card Number</label>
                      <div id="clover-card-number" className="clover-input-container"></div>
                    </div>
                    <div className="clover-field-row">
                      <div className="clover-field clover-field-half">
                        <label className="clover-label">Expiry</label>
                        <div id="clover-card-date" className="clover-input-container"></div>
                      </div>
                      <div className="clover-field clover-field-half">
                        <label className="clover-label">CVV</label>
                        <div id="clover-card-cvv" className="clover-input-container"></div>
                      </div>
                    </div>
                    <div className="clover-field">
                      <label className="clover-label">ZIP Code</label>
                      <div id="clover-card-zip" className="clover-input-container"></div>
                    </div>
                  </div>
                  <div
                    className={`clover-recurring-toggle ${cloverRecurring ? 'active' : ''}`}
                    onClick={() => setCloverRecurring(prev => !prev)}
                  >
                    <div className={`clover-recurring-switch ${cloverRecurring ? 'on' : ''}`} />
                    <div className="clover-recurring-label">
                      <span>Monthly recurring</span>
                      <span>{cloverRecurring ? `$${getAmount().toFixed(2)}/month auto-charge` : 'One-time payment'}</span>
                    </div>
                  </div>
                  <button
                    className="contribution-proceed-btn clover-pay-btn"
                    onClick={handleCloverPay}
                    disabled={cloverLoading || !cloverReady || loading}
                  >
                    {cloverLoading ? (
                      <><span className="spinner"></span> Processing...</>
                    ) : !cloverReady ? (
                      <><span className="spinner"></span> Loading card form...</>
                    ) : (
                      <>{cloverRecurring ? `Pay $${getAmount().toFixed(2)}/mo` : `Pay $${getAmount().toFixed(2)}`}</>
                    )}
                  </button>
                </>
              )}
            </div>
          )}

          {/* PayPal QR Code */}
          {paymentMethod === 'paypal-qr' && (
            <div className="qr-code-section">
              <div >
                <div className="qr-code-header">
                  <span className="paypal-p">P</span>
                  <h3>Scan with PayPal</h3>
                </div>
                <div className="qr-code-image">
                  <img 
                    src="/images/PaypalQR.png" 
                    alt="PayPal QR Code"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'block';
                    }}
                  />
                  <div className="qr-code-fallback" style={{ display: 'none' }}>
                    <p>💳 PayPal QR Code</p>
                    <p className="qr-username">@username</p>
                    <p className="qr-amount">${getAmount().toFixed(2)}</p>
                  </div>
                </div>
                <div className="qr-code-instructions">
                  <p>1. Open PayPal app</p>
                  <p>2. Scan this QR code</p>
                  <p>3. Send ${getAmount().toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}

          <button 
            className="contribution-remind-btn"
            onClick={handleDismiss}
            disabled={loading}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContributionPopup;
