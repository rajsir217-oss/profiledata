/**
 * API service for test management functionality
 */
const API_BASE_URL = 'http://localhost:8000/api/tests';

/**
 * Get all available test suites
 */
export const getTestSuites = async () => {
  const response = await fetch(`${API_BASE_URL}/test-suites`);
  if (!response.ok) {
    throw new Error('Failed to fetch test suites');
  }
  return response.json();
};

/**
 * Get all test execution results
 */
export const getTestResults = async () => {
  const response = await fetch(`${API_BASE_URL}/test-results`);
  if (!response.ok) {
    throw new Error('Failed to fetch test results');
  }
  return response.json();
};

/**
 * Get specific test result
 */
export const getTestResult = async (testId) => {
  const response = await fetch(`${API_BASE_URL}/test-results/${testId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch test result');
  }
  return response.json();
};

/**
 * Run specified test suite
 */
export const runTests = async (testType) => {
  const response = await fetch(`${API_BASE_URL}/run-tests/${testType}`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to start tests');
  }
  return response.json();
};

/**
 * Get current test execution status
 */
export const getTestStatus = async () => {
  const response = await fetch(`${API_BASE_URL}/test-status`);
  if (!response.ok) {
    throw new Error('Failed to fetch test status');
  }
  return response.json();
};

/**
 * Delete specific test result
 */
export const deleteTestResult = async (testId) => {
  const response = await fetch(`${API_BASE_URL}/test-results/${testId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete test result');
  }
  return response.json();
};

/**
 * Clear all test results
 */
export const clearAllTestResults = async () => {
  const response = await fetch(`${API_BASE_URL}/test-results`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to clear test results');
  }
  return response.json();
};

/**
 * Get all scheduled tests
 */
export const getScheduledTests = async () => {
  const response = await fetch(`${API_BASE_URL}/scheduled-tests`);
  if (!response.ok) {
    throw new Error('Failed to fetch scheduled tests');
  }
  return response.json();
};

/**
 * Create a new test schedule
 */
export const createSchedule = async (scheduleData) => {
  const response = await fetch(`${API_BASE_URL}/scheduled-tests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(scheduleData),
  });
  if (!response.ok) {
    throw new Error('Failed to create schedule');
  }
  return response.json();
};

/**
 * Update an existing test schedule
 */
export const updateSchedule = async (scheduleId, scheduleData) => {
  const response = await fetch(`${API_BASE_URL}/scheduled-tests/${scheduleId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(scheduleData),
  });
  if (!response.ok) {
    throw new Error('Failed to update schedule');
  }
  return response.json();
};

/**
 * Delete a test schedule
 */
export const deleteSchedule = async (scheduleId) => {
  const response = await fetch(`${API_BASE_URL}/scheduled-tests/${scheduleId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete schedule');
  }
  return response.json();
};

/**
 * Manually trigger a scheduled test to run now
 */
export const runScheduleNow = async (scheduleId) => {
  const response = await fetch(`${API_BASE_URL}/scheduled-tests/${scheduleId}/run-now`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to trigger scheduled test');
  }
  return response.json();
};

/**
 * Get scheduler status
 */
export const getSchedulerStatus = async () => {
  const response = await fetch(`${API_BASE_URL}/scheduler-status`);
  if (!response.ok) {
    throw new Error('Failed to fetch scheduler status');
  }
  return response.json();
};
