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
