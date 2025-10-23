/**
 * Test suite for TestResultsList component
 * Tests test result display, expansion/collapse, and admin delete functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TestResultsList from './TestResultsList';

describe('TestResultsList Component', () => {
  const mockResults = [
    {
      id: '1',
      test_type: 'frontend',
      status: 'completed',
      timestamp: '2025-10-20T15:30:00Z',
      total_tests: 100,
      passed_tests: 85,
      failed_tests: 15,
      duration: 45.2,
      details: {
        passed: ['test1', 'test2'],
        failed: ['test3'],
        errors: []
      }
    },
    {
      id: '2',
      test_type: 'backend',
      status: 'failed',
      timestamp: '2025-10-20T14:00:00Z',
      total_tests: 50,
      passed_tests: 40,
      failed_tests: 10,
      duration: 30.5,
      details: {
        passed: ['test4'],
        failed: ['test5', 'test6'],
        errors: ['Error in test5']
      }
    }
  ];

  const mockHandleDelete = jest.fn();
  const mockHandleClearAll = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // Rendering Tests
  // ============================================

  test('renders without crashing', () => {
    render(
      <TestResultsList
        results={[]}
        handleDeleteResult={mockHandleDelete}
        handleClearAllResults={mockHandleClearAll}
        isAdmin={false}
      />
    );
    expect(screen.getByText(/Total Results/i)).toBeInTheDocument();
  });

  test('displays total results count', () => {
    render(
      <TestResultsList
        results={mockResults}
        handleDeleteResult={mockHandleDelete}
        handleClearAllResults={mockHandleClearAll}
        isAdmin={false}
      />
    );
    expect(screen.getByText(/Total Results: 2/i)).toBeInTheDocument();
  });

  test('renders all test result cards', () => {
    render(
      <TestResultsList
        results={mockResults}
        handleDeleteResult={mockHandleDelete}
        handleClearAllResults={mockHandleClearAll}
        isAdmin={false}
      />
    );
    
    expect(screen.getByText('frontend')).toBeInTheDocument();
    expect(screen.getByText('backend')).toBeInTheDocument();
  });

  test('displays empty state when no results', () => {
    render(
      <TestResultsList
        results={[]}
        handleDeleteResult={mockHandleDelete}
        handleClearAllResults={mockHandleClearAll}
        isAdmin={false}
      />
    );
    expect(screen.getByText(/No test results found/i)).toBeInTheDocument();
  });

  // ============================================
  // Status Badge Tests
  // ============================================

  test('displays status badge correctly', () => {
    render(
      <TestResultsList
        results={mockResults}
        handleDeleteResult={mockHandleDelete}
        handleClearAllResults={mockHandleClearAll}
        isAdmin={false}
      />
    );
    
    expect(screen.getByText(/completed/i)).toBeInTheDocument();
    expect(screen.getByText(/failed/i)).toBeInTheDocument();
  });

  test('status badge has correct class name', () => {
    const { container } = render(
      <TestResultsList
        results={mockResults}
        handleDeleteResult={mockHandleDelete}
        handleClearAllResults={mockHandleClearAll}
        isAdmin={false}
      />
    );
    
    const statusBadges = container.querySelectorAll('.result-status-badge');
    expect(statusBadges.length).toBe(2);
  });

  test('status badge and delete button are on same line', () => {
    const { container } = render(
      <TestResultsList
        results={mockResults}
        handleDeleteResult={mockHandleDelete}
        handleClearAllResults={mockHandleClearAll}
        isAdmin={true}
      />
    );
    
    const rightContainers = container.querySelectorAll('.result-right');
    expect(rightContainers.length).toBe(2);
    
    // Each should contain both badge and button
    rightContainers.forEach(container => {
      expect(container.querySelector('.result-status-badge')).toBeInTheDocument();
      expect(container.querySelector('.btn-delete')).toBeInTheDocument();
    });
  });

  // ============================================
  // Test Statistics Display Tests
  // ============================================

  test('displays test statistics correctly', () => {
    render(
      <TestResultsList
        results={mockResults}
        handleDeleteResult={mockHandleDelete}
        handleClearAllResults={mockHandleClearAll}
        isAdmin={false}
      />
    );
    
    expect(screen.getByText('100')).toBeInTheDocument(); // total tests
    expect(screen.getByText('85')).toBeInTheDocument(); // passed
    expect(screen.getByText('15')).toBeInTheDocument(); // failed
  });

  test('displays duration correctly', () => {
    render(
      <TestResultsList
        results={mockResults}
        handleDeleteResult={mockHandleDelete}
        handleClearAllResults={mockHandleClearAll}
        isAdmin={false}
      />
    );
    
    expect(screen.getByText(/45\.2s/)).toBeInTheDocument();
    expect(screen.getByText(/30\.5s/)).toBeInTheDocument();
  });

  // ============================================
  // Expand/Collapse Tests
  // ============================================

  test('expands test result on header click', () => {
    const { container } = render(
      <TestResultsList
        results={mockResults}
        handleDeleteResult={mockHandleDelete}
        handleClearAllResults={mockHandleClearAll}
        isAdmin={false}
      />
    );
    
    const headers = container.querySelectorAll('.result-header');
    fireEvent.click(headers[0]);
    
    // Should show expanded details
    expect(screen.getByText('test1')).toBeInTheDocument();
  });

  test('collapses test result on second header click', () => {
    const { container } = render(
      <TestResultsList
        results={mockResults}
        handleDeleteResult={mockHandleDelete}
        handleClearAllResults={mockHandleClearAll}
        isAdmin={false}
      />
    );
    
    const headers = container.querySelectorAll('.result-header');
    
    // Expand
    fireEvent.click(headers[0]);
    expect(screen.getByText('test1')).toBeInTheDocument();
    
    // Collapse
    fireEvent.click(headers[0]);
    expect(screen.queryByText('test1')).not.toBeInTheDocument();
  });

  test('can expand multiple results simultaneously', () => {
    const { container } = render(
      <TestResultsList
        results={mockResults}
        handleDeleteResult={mockHandleDelete}
        handleClearAllResults={mockHandleClearAll}
        isAdmin={false}
      />
    );
    
    const headers = container.querySelectorAll('.result-header');
    
    fireEvent.click(headers[0]);
    fireEvent.click(headers[1]);
    
    expect(screen.getByText('test1')).toBeInTheDocument();
    expect(screen.getByText('test4')).toBeInTheDocument();
  });

  // ============================================
  // Delete Functionality Tests (Admin Only)
  // ============================================

  test('shows delete button for admin', () => {
    render(
      <TestResultsList
        results={mockResults}
        handleDeleteResult={mockHandleDelete}
        handleClearAllResults={mockHandleClearAll}
        isAdmin={true}
      />
    );
    
    const deleteButtons = screen.getAllByTitle(/Admin only: Delete this test result/i);
    expect(deleteButtons).toHaveLength(2);
  });

  test('hides delete button for non-admin', () => {
    render(
      <TestResultsList
        results={mockResults}
        handleDeleteResult={mockHandleDelete}
        handleClearAllResults={mockHandleClearAll}
        isAdmin={false}
      />
    );
    
    const deleteButtons = screen.queryAllByTitle(/Admin only: Delete this test result/i);
    expect(deleteButtons).toHaveLength(0);
  });

  test('calls handleDeleteResult when delete button clicked', () => {
    render(
      <TestResultsList
        results={mockResults}
        handleDeleteResult={mockHandleDelete}
        handleClearAllResults={mockHandleClearAll}
        isAdmin={true}
      />
    );
    
    const deleteButtons = screen.getAllByTitle(/Admin only: Delete this test result/i);
    fireEvent.click(deleteButtons[0]);
    
    expect(mockHandleDelete).toHaveBeenCalledWith('1');
  });

  test('delete button click does not expand card', () => {
    const { container } = render(
      <TestResultsList
        results={mockResults}
        handleDeleteResult={mockHandleDelete}
        handleClearAllResults={mockHandleClearAll}
        isAdmin={true}
      />
    );
    
    const deleteButtons = screen.getAllByTitle(/Admin only: Delete this test result/i);
    fireEvent.click(deleteButtons[0]);
    
    // Card should not be expanded
    expect(screen.queryByText('test1')).not.toBeInTheDocument();
  });

  test('shows loading state when deleting', () => {
    const { rerender } = render(
      <TestResultsList
        results={mockResults}
        handleDeleteResult={mockHandleDelete}
        handleClearAllResults={mockHandleClearAll}
        isAdmin={true}
        deletingId={null}
      />
    );
    
    // Simulate deleting state
    rerender(
      <TestResultsList
        results={mockResults}
        handleDeleteResult={mockHandleDelete}
        handleClearAllResults={mockHandleClearAll}
        isAdmin={true}
        deletingId="1"
      />
    );
    
    const deleteButtons = screen.getAllByTitle(/Admin only: Delete this test result/i);
    expect(deleteButtons[0]).toHaveTextContent('...');
    expect(deleteButtons[0]).toBeDisabled();
  });

  // ============================================
  // Clear All Tests (Admin Only)
  // ============================================

  test('shows clear all button for admin', () => {
    render(
      <TestResultsList
        results={mockResults}
        handleDeleteResult={mockHandleDelete}
        handleClearAllResults={mockHandleClearAll}
        isAdmin={true}
      />
    );
    
    expect(screen.getByText(/Clear All Results/i)).toBeInTheDocument();
  });

  test('hides clear all button for non-admin', () => {
    render(
      <TestResultsList
        results={mockResults}
        handleDeleteResult={mockHandleDelete}
        handleClearAllResults={mockHandleClearAll}
        isAdmin={false}
      />
    );
    
    expect(screen.queryByText(/Clear All Results/i)).not.toBeInTheDocument();
  });

  test('calls handleClearAllResults when clear all clicked', () => {
    render(
      <TestResultsList
        results={mockResults}
        handleDeleteResult={mockHandleDelete}
        handleClearAllResults={mockHandleClearAll}
        isAdmin={true}
      />
    );
    
    const clearAllButton = screen.getByText(/Clear All Results/i);
    fireEvent.click(clearAllButton);
    
    expect(mockHandleClearAll).toHaveBeenCalled();
  });

  test('shows loading state when clearing all', () => {
    const { rerender } = render(
      <TestResultsList
        results={mockResults}
        handleDeleteResult={mockHandleDelete}
        handleClearAllResults={mockHandleClearAll}
        isAdmin={true}
        clearingAll={false}
      />
    );
    
    rerender(
      <TestResultsList
        results={mockResults}
        handleDeleteResult={mockHandleDelete}
        handleClearAllResults={mockHandleClearAll}
        isAdmin={true}
        clearingAll={true}
      />
    );
    
    expect(screen.getByText(/Clearing\.\.\./i)).toBeInTheDocument();
  });

  // ============================================
  // Timestamp Display Tests
  // ============================================

  test('displays formatted timestamp', () => {
    render(
      <TestResultsList
        results={mockResults}
        handleDeleteResult={mockHandleDelete}
        handleClearAllResults={mockHandleClearAll}
        isAdmin={false}
      />
    );
    
    // Should display localized date
    const timestamps = screen.getAllByText(/2025|10\/20/);
    expect(timestamps.length).toBeGreaterThan(0);
  });

  // ============================================
  // Details Display Tests
  // ============================================

  test('shows passed tests in details', () => {
    const { container } = render(
      <TestResultsList
        results={mockResults}
        handleDeleteResult={mockHandleDelete}
        handleClearAllResults={mockHandleClearAll}
        isAdmin={false}
      />
    );
    
    const headers = container.querySelectorAll('.result-header');
    fireEvent.click(headers[0]);
    
    expect(screen.getByText(/Passed Tests/i)).toBeInTheDocument();
    expect(screen.getByText('test1')).toBeInTheDocument();
    expect(screen.getByText('test2')).toBeInTheDocument();
  });

  test('shows failed tests in details', () => {
    const { container } = render(
      <TestResultsList
        results={mockResults}
        handleDeleteResult={mockHandleDelete}
        handleClearAllResults={mockHandleClearAll}
        isAdmin={false}
      />
    );
    
    const headers = container.querySelectorAll('.result-header');
    fireEvent.click(headers[0]);
    
    expect(screen.getByText(/Failed Tests/i)).toBeInTheDocument();
    expect(screen.getByText('test3')).toBeInTheDocument();
  });

  test('shows errors in details when present', () => {
    const { container } = render(
      <TestResultsList
        results={mockResults}
        handleDeleteResult={mockHandleDelete}
        handleClearAllResults={mockHandleClearAll}
        isAdmin={false}
      />
    );
    
    const headers = container.querySelectorAll('.result-header');
    fireEvent.click(headers[1]); // Second result has errors
    
    expect(screen.getByText(/Errors/i)).toBeInTheDocument();
    expect(screen.getByText('Error in test5')).toBeInTheDocument();
  });

  // ============================================
  // Accessibility Tests
  // ============================================

  test('delete buttons have accessible titles', () => {
    render(
      <TestResultsList
        results={mockResults}
        handleDeleteResult={mockHandleDelete}
        handleClearAllResults={mockHandleClearAll}
        isAdmin={true}
      />
    );
    
    const deleteButtons = screen.getAllByTitle(/Admin only: Delete this test result/i);
    deleteButtons.forEach(button => {
      expect(button).toHaveAttribute('title');
    });
  });

  test('clear all button has accessible title', () => {
    render(
      <TestResultsList
        results={mockResults}
        handleDeleteResult={mockHandleDelete}
        handleClearAllResults={mockHandleClearAll}
        isAdmin={true}
      />
    );
    
    const clearAllButton = screen.getByText(/Clear All Results/i);
    expect(clearAllButton).toHaveAttribute('title');
  });

  // ============================================
  // Edge Cases Tests
  // ============================================

  test('handles result with no details gracefully', () => {
    const resultWithoutDetails = [{
      id: '3',
      test_type: 'all',
      status: 'completed',
      timestamp: '2025-10-20T15:30:00Z',
      total_tests: 10,
      passed_tests: 10,
      failed_tests: 0,
      duration: 5.0
    }];

    const { container } = render(
      <TestResultsList
        results={resultWithoutDetails}
        handleDeleteResult={mockHandleDelete}
        handleClearAllResults={mockHandleClearAll}
        isAdmin={false}
      />
    );
    
    const headers = container.querySelectorAll('.result-header');
    fireEvent.click(headers[0]);
    
    // Should not crash
    expect(screen.getByText('all')).toBeInTheDocument();
  });

  test('handles very large numbers correctly', () => {
    const largeResult = [{
      id: '4',
      test_type: 'frontend',
      status: 'completed',
      timestamp: '2025-10-20T15:30:00Z',
      total_tests: 9999,
      passed_tests: 8888,
      failed_tests: 1111,
      duration: 3600.5
    }];

    render(
      <TestResultsList
        results={largeResult}
        handleDeleteResult={mockHandleDelete}
        handleClearAllResults={mockHandleClearAll}
        isAdmin={false}
      />
    );
    
    expect(screen.getByText('9999')).toBeInTheDocument();
    expect(screen.getByText('8888')).toBeInTheDocument();
    expect(screen.getByText('1111')).toBeInTheDocument();
  });
});
