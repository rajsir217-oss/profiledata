import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchProfiles } from '../../../api';
import './SavedSearchesListCard.css';

const orderSavedSearches = (savedSearches) => {
  const list = [...(savedSearches || [])];
  return list.sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1;
    if (!a.isDefault && b.isDefault) return 1;
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    return bTime - aTime;
  });
};

const SavedSearchesListCard = ({ savedSearches, onOpenSavedSearch }) => {
  const navigate = useNavigate();
  const ordered = useMemo(() => orderSavedSearches(savedSearches), [savedSearches]);
  const visible = useMemo(() => ordered.slice(0, 4), [ordered]);
  const visibleKey = useMemo(
    () => visible.map((s) => s?.id || s?._id || s?.name || '').join('|'),
    [visible]
  );

  const [newCounts, setNewCounts] = useState({});

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const results = {};
      for (const s of visible) {
        const data = await searchProfiles(s.criteria || {}, {
          daysBack: 7,
          sortBy: 'newest',
          sortOrder: 'desc',
          page: 1,
          limit: 1,
        });
        const total = data?.total ?? 0;
        results[s.id || s._id || s.name] = total;
      }
      if (!cancelled) setNewCounts(results);
    };

    if (visible.length > 0) {
      run();
    } else {
      setNewCounts((prev) => (Object.keys(prev).length === 0 ? prev : {}));
    }

    return () => {
      cancelled = true;
    };
  }, [visibleKey]);

  const handleOpen = (savedSearch) => {
    if (onOpenSavedSearch) {
      onOpenSavedSearch(savedSearch);
      return;
    }
    sessionStorage.setItem(
      'pendingSearchAction',
      JSON.stringify({ type: 'loadSavedSearch', savedSearch })
    );
    navigate('/search');
  };

  return (
    <div className="dv2-rail-card">
      <div className="dv2-rail-title">
        <span className="dv2-rail-title-left">⭐ Saved searches</span>
        <button className="dv2-ss-manage" type="button" onClick={() => navigate('/search')}>
          Manage
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="dv2-ss-empty">No saved searches yet.</div>
      ) : (
        <div className="dv2-ss-list">
          {visible.map((s) => {
            const key = s.id || s._id || s.name;
            const total = newCounts[key] ?? null;
            return (
              <button key={key} className="dv2-ss-row" type="button" onClick={() => handleOpen(s)}>
                <div className="dv2-ss-left">
                  <div className="dv2-ss-name">
                    {s.name}
                    {s.isDefault ? <span className="dv2-ss-default">Default</span> : null}
                  </div>
                  <div className="dv2-ss-meta">{s.notifications?.frequency ? String(s.notifications.frequency) : '—'}</div>
                </div>
                {typeof total === 'number' && total > 0 ? (
                  <span className="dv2-ss-new">{total} new</span>
                ) : null}
              </button>
            );
          })}

          <button className="dv2-ss-all" type="button" onClick={() => navigate('/search')}>
            View all
          </button>
        </div>
      )}
    </div>
  );
};

export default SavedSearchesListCard;
