import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getBackendUrl } from '../config/apiConfig';
import logger from '../utils/logger';
import './InfoTicker.css';

const InfoTicker = () => {
  const [items, setItems] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const tickerRef = useRef(null);
  const currentUsername = localStorage.getItem('username');

  useEffect(() => {
    if (currentUsername) {
      loadTickerItems();
      
      // Refresh every 60 seconds
      const interval = setInterval(loadTickerItems, 60000);
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [currentUsername]);

  const loadTickerItems = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('🔄 Loading ticker items for:', currentUsername);
      const response = await axios.get(
        `${getBackendUrl()}/api/ticker/items?username=${currentUsername}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      console.log('📢 Ticker items loaded:', response.data);
      const loadedItems = response.data.items || [];
      console.log('📢 Items count:', loadedItems.length);
      setItems(loadedItems);
    } catch (error) {
      console.error('❌ Error loading ticker items:', error);
      logger.error('Error loading ticker items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = (item) => {
    if (item.link) {
      window.location.href = item.link;
    }
  };

  const handleDismiss = async (item, event) => {
    event.stopPropagation(); // Prevent item click
    
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        item_type: item.type,
        username: currentUsername
      });
      
      if (item.announcementId) {
        params.append('item_id', item.announcementId);
      } else if (item.subtype) {
        params.append('item_id', item.subtype);
      }
      
      await axios.post(
        `${getBackendUrl()}/api/ticker/dismiss?${params}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      // Remove from local state
      setItems(prev => prev.filter(i => i !== item));
    } catch (error) {
      logger.error('Error dismissing ticker item:', error);
    }
  };

  const getItemClassName = (item) => {
    const baseClass = 'ticker-item';
    const typeClass = `ticker-${item.type}`; // ticker-announcement, ticker-stat, ticker-tip
    const subtypeClass = item.subtype ? `ticker-${item.subtype}` : ''; // ticker-warning, ticker-error
    
    return `${baseClass} ${typeClass} ${subtypeClass}`.trim();
  };

  if (loading) {
    console.log('⏳ Ticker loading...');
    return null;
  }
  
  if (items.length === 0) {
    console.log('📭 No ticker items to display');
    return null;
  }
  
  console.log('✅ Rendering ticker with', items.length, 'items');

  // Duplicate items for seamless infinite scroll
  const duplicatedItems = [...items, ...items];

  return (
    <div className="info-ticker">
      <div className="ticker-icon">📢</div>
      
      <div 
        className="ticker-content"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div 
          ref={tickerRef}
          className={`ticker-scroll ${isPaused ? 'paused' : ''}`}
        >
          {duplicatedItems.map((item, index) => (
            <React.Fragment key={`${item.type}-${item.subtype}-${index}`}>
              <span 
                className={getItemClassName(item)}
                onClick={() => handleItemClick(item)}
                title={item.linkText || 'Click for details'}
              >
                {item.icon && <span className="item-icon">{item.icon}</span>}
                <span className="item-text">{item.text}</span>
                {item.dismissible && (
                  <button
                    className="item-dismiss"
                    onClick={(e) => handleDismiss(item, e)}
                    title="Dismiss"
                  >
                    ✕
                  </button>
                )}
              </span>
              {index < duplicatedItems.length - 1 && (
                <span className="ticker-separator">•</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
      
      <button 
        className="ticker-pause"
        onClick={() => setIsPaused(!isPaused)}
        title={isPaused ? 'Resume ticker' : 'Pause ticker'}
      >
        {isPaused ? '▶️' : '⏸️'}
      </button>
    </div>
  );
};

export default InfoTicker;
