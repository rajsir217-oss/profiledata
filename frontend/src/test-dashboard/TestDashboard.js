import React, { useState, useEffect, useCallback } from 'react';
import { getTestSuites, getTestResults, runTests, getTestStatus } from './testApi';
import TestSuiteCard from './TestSuiteCard';
import TestResultsList from './TestResultsList';
import TestStatusIndicator from './TestStatusIndicator';
import './TestDashboard.css';

const TestDashboard = () => {
  const [testSuites, setTestSuites] = useState([]);
  const [testResults, setTestResults] = useState({});
  const [testStatus, setTestStatus] = useState({ is_running: false, running_tests: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [suites, results, status] = await Promise.all([
        getTestSuites(),
        getTestResults(),
        getTestStatus()
      ]);
      setTestSuites(suites);
      setTestResults(results);
      setTestStatus(status);
      setError(null);
    } catch (err) {
      setError('Failed to load test data');
      console.error('Error loading test data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTestStatus = useCallback(async () => {
    try {
      const status = await getTestStatus();
      setTestStatus(status);

      // Refresh results if tests completed
      if (!status.is_running && testStatus.is_running) {
        const results = await getTestResults();
        setTestResults(results);
      }
    } catch (err) {
      console.error('Error loading test status:', err);
    }
  }, [testStatus.is_running]);

  const handleRunTests = useCallback(async (testType) => {
    try {
      await runTests(testType);
      // Refresh status immediately
      await loadTestStatus();
    } catch (err) {
      setError(`Failed to run ${testType} tests`);
      console.error('Error running tests:', err);
    }
  }, [loadTestStatus]);

  const handleRefresh = useCallback(() => {
    loadData();
  }, [loadData]);

  // Load initial data
  useEffect(() => {
    loadData();

    // Poll for test status every 2 seconds when tests are running
    const interval = setInterval(() => {
      if (testStatus.is_running) {
        loadTestStatus();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [testStatus.is_running, loadTestStatus, loadData]);

  if (loading) {
    return (
      <div className="test-dashboard">
        <div className="loading">Loading test dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="test-dashboard">
        <div className="error">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={handleRefresh} className="btn btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="test-dashboard">
      <header className="dashboard-header">
        <h1>Test Suite Dashboard</h1>
        <div className="header-actions">
          <TestStatusIndicator status={testStatus} />
          <button onClick={handleRefresh} className="btn btn-secondary">
            Refresh
          </button>
        </div>
      </header>

      <div className="dashboard-content">
        <section className="test-suites-section">
          <h2>Test Suites</h2>
          <div className="test-suites-grid">
            {testSuites.map((suite) => (
              <TestSuiteCard
                key={suite.type}
                testSuite={suite}
                onRunTests={handleRunTests}
                isRunning={testStatus.running_tests.some(t => t.test_type === suite.type)}
              />
            ))}
          </div>
        </section>

        <section className="test-results-section">
          <h2>Test Results</h2>
          <TestResultsList
            testResults={testResults}
            onRefresh={handleRefresh}
          />
        </section>
      </div>
    </div>
  );
};

export default TestDashboard;
