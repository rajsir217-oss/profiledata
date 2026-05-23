import React from 'react';
import ProfileCompletenessCard from './cards/ProfileCompletenessCard';
import SavedSearchesListCard from './cards/SavedSearchesListCard';
import NotificationsCard from './cards/NotificationsCard';
import ActivePollsCard from './cards/ActivePollsCard';
import './SideRail.css';

const SideRail = ({
  userProfile,
  savedSearches,
  activePolls,
  onOpenSavedSearch,
  onPollResponded,
}) => {
  return (
    <aside className="dv2-side-rail">
      <ProfileCompletenessCard userProfile={userProfile} />
      <SavedSearchesListCard savedSearches={savedSearches} onOpenSavedSearch={onOpenSavedSearch} />
      <NotificationsCard savedSearches={savedSearches} />
      <ActivePollsCard polls={activePolls} onPollResponded={onPollResponded} />
    </aside>
  );
};

export default SideRail;
