import { useState, useCallback } from 'react';
import api, { setDefaultSavedSearch, unsetDefaultSavedSearch } from '../api';
import logger from '../utils/logger';
import toastService from '../services/toastService';
import { generateSearchDescription } from '../utils/searchDescription';

const MAX_SAVED_SEARCHES = 5;

// Owns saved-search list state, CRUD against the saved-searches API, and the
// inline schedule editor form state used inside the Saved tab of the search
// filters panel.
//
// Extracted from SearchPage2.js as part of the #11 refactor.
//
// Cross-talk with the parent (SearchPage2):
//   - onAfterDelete(searchId): parent should null `selectedSearch` if it
//     matched the deleted ID.
//   - onAfterSave(): parent should close the SaveSearchModal and clear any
//     "edit schedule for" target.
//
// Things this hook intentionally DOES NOT own:
//   - selectedSearch / setSearchCriteria / handleSearchHook (parent state)
//   - handleLoadSavedSearch (too coupled to search execution; parent owns)
const useSavedSearches = ({
  onAfterDelete,
  onAfterSave
} = {}) => {
  // --- list state ---
  const [savedSearches, setSavedSearches] = useState([]);

  const loadSavedSearches = useCallback(async () => {
    try {
      const username = localStorage.getItem('username');
      if (username) {
        const response = await api.get(`/${username}/saved-searches`);
        setSavedSearches(response.data.savedSearches || []);
      }
    } catch (err) {
      if (err.response?.status === 404 || err.response?.data?.savedSearches?.length === 0) {
        logger.info('No saved searches found for user (this is normal for new users)');
        setSavedSearches([]);
      } else {
        logger.error('Error loading saved searches:', err);
        setSavedSearches([]);
      }
    }
  }, []);

  // --- CRUD ---
  const handleSaveSearch = useCallback(async (saveData, { criteria, minMatchScore } = {}) => {
    try {
      const username = localStorage.getItem('username');
      if (!username) {
        toastService.error('Please login to save searches');
        return;
      }

      const isUpdate =
        typeof saveData === 'object' &&
        saveData !== null &&
        (saveData.isUpdate === true || Boolean(saveData.id || saveData._id));

      if (!isUpdate && savedSearches.length >= MAX_SAVED_SEARCHES) {
        toastService.error('You can save up to 5 searches. Please delete one before saving a new search.');
        return;
      }

      logger.info('🔍 Saving search with minMatchScore:', minMatchScore);
      const description = generateSearchDescription(criteria, minMatchScore);
      logger.info('📝 Generated description:', description);

      // Handle both old format (string) and new format (object with notifications)
      const searchName = typeof saveData === 'string' ? saveData : saveData.name;
      const notifications = typeof saveData === 'object' ? saveData.notifications : null;

      if (isUpdate) {
        const searchId = saveData?.id || saveData?._id;
        if (!searchId) {
          toastService.error('Could not update saved search (missing search ID)');
          return;
        }

        await api.put(`/${username}/saved-searches/${searchId}`, {
          name: searchName?.trim(),
          ...(notifications && { notifications }),
          ...(typeof saveData?.isDefault === 'boolean' ? { isDefault: saveData.isDefault } : {}),
        });

        toastService.success(`✅ Saved search updated: "${searchName}"`);
        onAfterSave?.();
        loadSavedSearches();
        return;
      }

      const searchData = {
        name: searchName.trim(),
        description,
        criteria,
        minMatchScore,
        created_at: new Date().toISOString(),
        ...(notifications && { notifications })
      };

      logger.info('💾 Search data to save:', searchData);

      await api.post(`/${username}/saved-searches`, searchData);

      const notificationMsg = notifications?.enabled
        ? ` with ${notifications.frequency} notifications`
        : '';
      toastService.success(`✅ Search saved: "${searchName}"${notificationMsg}`);

      onAfterSave?.();
      loadSavedSearches();
    } catch (err) {
      logger.error('Error saving search:', err);
      toastService.error('Failed to save search. ' + (err.response?.data?.detail || err.message));
    }
  }, [onAfterSave, loadSavedSearches, savedSearches.length]);

  const handleUpdateSavedSearch = useCallback(async (searchId, newName) => {
    try {
      const username = localStorage.getItem('username');
      await api.put(`/${username}/saved-searches/${searchId}`, { name: newName });
      toastService.success(`✅ Search renamed to: "${newName}"`);
      loadSavedSearches();
    } catch (err) {
      logger.error('Error updating saved search:', err);
      toastService.error('Failed to update saved search');
    }
  }, [loadSavedSearches]);

  const handleDeleteSavedSearch = useCallback(async (searchId) => {
    if (!searchId) {
      toastService.error('Cannot delete: Invalid search ID');
      return;
    }

    try {
      const username = localStorage.getItem('username');
      await api.delete(`/${username}/saved-searches/${searchId}`);
      toastService.success('✅ Search deleted successfully');
      loadSavedSearches();
      onAfterDelete?.(searchId);
    } catch (err) {
      logger.error('❌ Error deleting saved search:', err);
      toastService.error('Failed to delete saved search');
    }
  }, [loadSavedSearches, onAfterDelete]);

  const handleSetDefaultSearch = useCallback(async (searchId, searchName, isCurrentlyDefault = false) => {
    try {
      if (isCurrentlyDefault) {
        await unsetDefaultSavedSearch();
        toastService.success(`☆ "${searchName}" is no longer the default search`);
      } else {
        await setDefaultSavedSearch(searchId);
        toastService.success(`⭐ "${searchName}" set as default search`);
      }
      loadSavedSearches();
    } catch (err) {
      logger.error('Error toggling default search:', err);
      toastService.error('Failed to update default search');
    }
  }, [loadSavedSearches]);

  // --- inline schedule editor state ---
  const [editingScheduleSearch, setEditingScheduleSearch] = useState(null);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState('daily');
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [scheduleDay, setScheduleDay] = useState('monday');
  const [savingSchedule, setSavingSchedule] = useState(false);

  const startInlineScheduleEdit = useCallback((search) => {
    setEditingScheduleSearch(search);
    const notifications = search.notifications || {};
    setScheduleEnabled(notifications.enabled || false);
    setScheduleFrequency(notifications.frequency || 'daily');
    setScheduleTime(notifications.time || '09:00');
    setScheduleDay(notifications.dayOfWeek || 'monday');
  }, []);

  const cancelInlineScheduleEdit = useCallback(() => {
    setEditingScheduleSearch(null);
  }, []);

  const saveInlineSchedule = useCallback(async () => {
    if (!editingScheduleSearch) return;

    setSavingSchedule(true);
    try {
      const username = localStorage.getItem('username');
      const searchId = editingScheduleSearch.id || editingScheduleSearch._id;

      await api.put(`/${username}/saved-searches/${searchId}`, {
        notifications: {
          enabled: scheduleEnabled,
          frequency: scheduleFrequency,
          time: scheduleTime,
          dayOfWeek: scheduleFrequency === 'weekly' ? scheduleDay : null
        }
      });

      toastService.success('✅ Schedule updated successfully');
      setEditingScheduleSearch(null);
      loadSavedSearches();
    } catch (err) {
      logger.error('Error saving schedule:', err);
      toastService.error('Failed to update schedule');
    } finally {
      setSavingSchedule(false);
    }
  }, [editingScheduleSearch, scheduleEnabled, scheduleFrequency, scheduleTime, scheduleDay, loadSavedSearches]);

  return {
    // list state + CRUD
    savedSearches,
    loadSavedSearches,
    handleSaveSearch,
    handleUpdateSavedSearch,
    handleDeleteSavedSearch,
    handleSetDefaultSearch,
    // inline schedule editor
    editingScheduleSearch,
    scheduleEnabled,
    setScheduleEnabled,
    scheduleFrequency,
    setScheduleFrequency,
    scheduleTime,
    setScheduleTime,
    scheduleDay,
    setScheduleDay,
    savingSchedule,
    startInlineScheduleEdit,
    cancelInlineScheduleEdit,
    saveInlineSchedule
  };
};

export default useSavedSearches;
