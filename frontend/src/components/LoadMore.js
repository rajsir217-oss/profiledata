import React from 'react';
import './LoadMore.css';

/**
 * LoadMore Component
 * Modern "View more" button with item count display
 * Replaces traditional pagination for a cleaner UX
 */
const LoadMore = ({
  currentCount = 0,
  totalCount = 0,
  onLoadMore,
  loading = false,
  itemsPerLoad = 20,
  itemLabel = 'items',
  buttonText = 'View more',
  showCountFirst = true
}) => {
  const hasMore = currentCount < totalCount;
  const remaining = totalCount - currentCount;
  const nextLoadCount = Math.min(remaining, itemsPerLoad);

  if (totalCount === 0) {
    return null;
  }

  return (
    <div className="load-more-container">
      <div className="load-more-content">
        {showCountFirst && (
          <div className="load-more-count">
            Viewing {currentCount.toLocaleString()} of {totalCount.toLocaleString()} {itemLabel}
          </div>
        )}
        
        {hasMore && (
          <button
            className="load-more-button"
            onClick={onLoadMore}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="load-more-spinner"></span>
                Loading...
              </>
            ) : (
              <>
                {buttonText}
                {nextLoadCount > 0 && (
                  <span className="load-more-next-count">
                    ({nextLoadCount} more)
                  </span>
                )}
              </>
            )}
          </button>
        )}

        {!hasMore && currentCount > 0 && (
          <div className="load-more-complete">
            ✓ All {totalCount.toLocaleString()} {itemLabel} loaded
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadMore;
