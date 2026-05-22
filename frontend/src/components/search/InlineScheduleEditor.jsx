import React from 'react';

// Inline schedule editor used inside the Saved tab of the search filters panel.
// Pure presentational — all state + handlers come from the parent (SearchPage2).
//
// Extracted from SearchPage2.js as part of the #11 refactor.
const InlineScheduleEditor = ({
  search,
  scheduleEnabled,
  setScheduleEnabled,
  savingSchedule,
  onCancel,
  onSave
}) => {
  if (!search) return null;

  return (
    <div className="inline-schedule-edit">
      <div className="schedule-edit-header">
        <h4>⏰ Edit Schedule: {search.name}</h4>
        <button type="button" className="btn-close-schedule" onClick={onCancel}>✕</button>
      </div>
      <div className="schedule-edit-body">
        <div className="schedule-toggle">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={scheduleEnabled}
              onChange={(e) => setScheduleEnabled(e.target.checked)}
            />
            <span className="toggle-text">Enable Email Notifications</span>
          </label>
        </div>
      </div>
      <div className="schedule-edit-footer">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={onSave} disabled={savingSchedule}>
          {savingSchedule ? '⏳ Saving...' : '💾 Save Schedule'}
        </button>
      </div>
    </div>
  );
};

export default InlineScheduleEditor;
