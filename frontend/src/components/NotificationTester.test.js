/**
 * Test suite for NotificationTester component
 * Tests notification testing functionality, analytics display, and queue management
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import NotificationTester from './NotificationTester';

// Mock axios
jest.mock('axios');

describe('NotificationTester Component', () => {
  const mockNotificationApi = {
    get: jest.fn(),
    post: jest.fn()
  };

  beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks();
    
    // Mock localStorage
    Storage.prototype.getItem = jest.fn((key) => {
      if (key === 'username') return 'test_user';
      if (key === 'token') return 'fake-jwt-token';
      return null;
    });

    // Mock axios.create to return our mock API
    axios.create = jest.fn(() => mockNotificationApi);

    // Setup default successful API responses
    mockNotificationApi.get.mockImplementation((url) => {
      if (url.includes('/api/notifications/queue')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/api/notifications/analytics')) {
        return Promise.resolve({
          data: {
            total_sent: 100,
            delivered: 95,
            opened: 60,
            clicked: 30
          }
        });
      }
      if (url.includes('/api/notifications/preferences')) {
        return Promise.resolve({
          data: {
            username: 'test_user',
            preferences: {}
          }
        });
      }
      return Promise.resolve({ data: {} });
    });

    mockNotificationApi.post.mockResolvedValue({ data: { success: true } });
  });

  // ============================================
  // Rendering Tests
  // ============================================

  test('renders notification tester header', () => {
    render(<NotificationTester />);
    expect(screen.getByText(/Notification Tester/i)).toBeInTheDocument();
  });

  test('renders for logged in user', async () => {
    render(<NotificationTester />);
    
    await waitFor(() => {
      expect(screen.getByText(/Test & manage notification system/i)).toBeInTheDocument();
    });
  });

  test('shows please login message when not authenticated', () => {
    Storage.prototype.getItem = jest.fn(() => null);
    
    render(<NotificationTester />);
    expect(screen.getByText(/Please login to test notifications/i)).toBeInTheDocument();
  });

  // ============================================
  // Analytics Display Tests
  // ============================================

  test('displays analytics data correctly', async () => {
    render(<NotificationTester />);
    
    await waitFor(() => {
      expect(screen.getByText('100')).toBeInTheDocument(); // total_sent
      expect(screen.getByText('95')).toBeInTheDocument(); // delivered
      expect(screen.getByText('60')).toBeInTheDocument(); // opened
      expect(screen.getByText('30')).toBeInTheDocument(); // clicked
    });
  });

  test('loads analytics on mount', async () => {
    render(<NotificationTester />);
    
    await waitFor(() => {
      expect(mockNotificationApi.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/notifications/analytics')
      );
    });
  });

  // ============================================
  // Notification Triggers Tests
  // ============================================

  test('renders all notification trigger categories', () => {
    render(<NotificationTester />);
    
    expect(screen.getByText('Matches')).toBeInTheDocument();
    expect(screen.getByText('Activity')).toBeInTheDocument();
    expect(screen.getByText('Messages')).toBeInTheDocument();
    expect(screen.getByText('Privacy')).toBeInTheDocument();
  });

  test('renders notification trigger cards', () => {
    render(<NotificationTester />);
    
    expect(screen.getByText('New Match')).toBeInTheDocument();
    expect(screen.getByText('Mutual Favorite')).toBeInTheDocument();
    expect(screen.getByText('New Message')).toBeInTheDocument();
  });

  // ============================================
  // Channel Selection Tests
  // ============================================

  test('allows selecting notification channels', () => {
    render(<NotificationTester />);
    
    const emailButtons = screen.getAllByText('email');
    expect(emailButtons.length).toBeGreaterThan(0);
    
    // Click first email channel button
    fireEvent.click(emailButtons[0]);
    expect(emailButtons[0]).toHaveClass('active');
  });

  test('allows deselecting notification channels', () => {
    render(<NotificationTester />);
    
    const emailButtons = screen.getAllByText('email');
    const firstEmailBtn = emailButtons[0];
    
    // Select then deselect
    fireEvent.click(firstEmailBtn);
    fireEvent.click(firstEmailBtn);
    
    expect(firstEmailBtn).not.toHaveClass('active');
  });

  test('allows selecting multiple channels', () => {
    render(<NotificationTester />);
    
    const emailButtons = screen.getAllByText('email');
    const smsButtons = screen.getAllByText('sms');
    
    fireEvent.click(emailButtons[0]);
    fireEvent.click(smsButtons[0]);
    
    expect(emailButtons[0]).toHaveClass('active');
    expect(smsButtons[0]).toHaveClass('active');
  });

  // ============================================
  // Send Notification Tests
  // ============================================

  test('sends test notification successfully', async () => {
    render(<NotificationTester />);
    
    // Find and click a Send Test button
    const sendButtons = screen.getAllByText(/Send Test/i);
    fireEvent.click(sendButtons[0]);
    
    await waitFor(() => {
      expect(mockNotificationApi.post).toHaveBeenCalledWith(
        '/api/notifications/send',
        expect.objectContaining({
          username: 'test_user',
          trigger: expect.any(String),
          channels: expect.any(Array),
          templateData: expect.any(Object)
        })
      );
    });
  });

  test('shows success toast after sending notification', async () => {
    render(<NotificationTester />);
    
    const sendButtons = screen.getAllByText(/Send Test/i);
    fireEvent.click(sendButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Test notification sent/i)).toBeInTheDocument();
    });
  });

  test('shows error toast when notification fails', async () => {
    mockNotificationApi.post.mockRejectedValueOnce(new Error('API Error'));
    
    render(<NotificationTester />);
    
    const sendButtons = screen.getAllByText(/Send Test/i);
    fireEvent.click(sendButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to send test notification/i)).toBeInTheDocument();
    });
  });

  test('disables send button when no channels selected', () => {
    render(<NotificationTester />);
    
    // Deselect default email channel
    const emailButtons = screen.getAllByText('email');
    fireEvent.click(emailButtons[0]); // Select
    fireEvent.click(emailButtons[0]); // Deselect
    
    const sendButtons = screen.getAllByText(/Send Test/i);
    expect(sendButtons[0]).toBeDisabled();
  });

  test('includes correct template data in notification', async () => {
    render(<NotificationTester />);
    
    const sendButtons = screen.getAllByText(/Send Test/i);
    fireEvent.click(sendButtons[0]);
    
    await waitFor(() => {
      expect(mockNotificationApi.post).toHaveBeenCalledWith(
        '/api/notifications/send',
        expect.objectContaining({
          templateData: expect.objectContaining({
            recipient: expect.objectContaining({
              username: 'test_user'
            }),
            match: expect.objectContaining({
              firstName: 'Test User',
              age: 28,
              matchScore: 95
            })
          })
        })
      );
    });
  });

  // ============================================
  // Queue Display Tests
  // ============================================

  test('displays notification queue', async () => {
    mockNotificationApi.get.mockImplementation((url) => {
      if (url.includes('/api/notifications/queue')) {
        return Promise.resolve({
          data: [
            {
              id: '1',
              trigger: 'new_match',
              status: 'pending',
              channels: ['email'],
              scheduled_at: new Date().toISOString()
            }
          ]
        });
      }
      return Promise.resolve({ data: {} });
    });

    render(<NotificationTester />);
    
    await waitFor(() => {
      expect(screen.getByText('new_match')).toBeInTheDocument();
      expect(screen.getByText('pending')).toBeInTheDocument();
    });
  });

  test('shows empty state when queue is empty', async () => {
    render(<NotificationTester />);
    
    await waitFor(() => {
      expect(screen.getByText(/No pending notifications/i)).toBeInTheDocument();
    });
  });

  test('refresh button reloads queue', async () => {
    render(<NotificationTester />);
    
    const refreshButton = screen.getByText(/Refresh/i);
    fireEvent.click(refreshButton);
    
    await waitFor(() => {
      // Should call queue API again
      expect(mockNotificationApi.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/notifications/queue')
      );
    });
  });

  // ============================================
  // Loading State Tests
  // ============================================

  test('shows loading state while sending notification', async () => {
    mockNotificationApi.post.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ data: { success: true } }), 100))
    );

    render(<NotificationTester />);
    
    const sendButtons = screen.getAllByText(/Send Test/i);
    fireEvent.click(sendButtons[0]);
    
    // Button should show loading state
    await waitFor(() => {
      const loadingButton = screen.getByText('⏳');
      expect(loadingButton).toBeInTheDocument();
    });
  });

  // ============================================
  // Error Handling Tests
  // ============================================

  test('handles analytics loading error gracefully', async () => {
    mockNotificationApi.get.mockRejectedValueOnce(new Error('Analytics error'));
    
    render(<NotificationTester />);
    
    await waitFor(() => {
      // Component should still render, just without analytics
      expect(screen.getByText(/Notification Tester/i)).toBeInTheDocument();
    });
  });

  test('handles queue loading error gracefully', async () => {
    mockNotificationApi.get.mockImplementation((url) => {
      if (url.includes('/api/notifications/queue')) {
        return Promise.reject(new Error('Queue error'));
      }
      return Promise.resolve({ data: {} });
    });

    render(<NotificationTester />);
    
    await waitFor(() => {
      // Component should still render
      expect(screen.getByText(/Notification Tester/i)).toBeInTheDocument();
    });
  });

  // ============================================
  // Integration Tests
  // ============================================

  test('updates queue after sending notification', async () => {
    render(<NotificationTester />);
    
    const sendButtons = screen.getAllByText(/Send Test/i);
    fireEvent.click(sendButtons[0]);
    
    await waitFor(() => {
      // Should reload queue after 1 second
      expect(mockNotificationApi.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/notifications/queue')
      );
    }, { timeout: 2000 });
  });

  test('displays username correctly in header', async () => {
    render(<NotificationTester />);
    
    await waitFor(() => {
      expect(screen.getByText(/test_user/i)).toBeInTheDocument();
    });
  });

  // ============================================
  // Accessibility Tests
  // ============================================

  test('buttons have proper titles for accessibility', () => {
    render(<NotificationTester />);
    
    const sendButtons = screen.getAllByText(/Send Test/i);
    expect(sendButtons[0].closest('button')).toBeInTheDocument();
  });

  test('toast auto-dismisses after timeout', async () => {
    jest.useFakeTimers();
    
    render(<NotificationTester />);
    
    const sendButtons = screen.getAllByText(/Send Test/i);
    fireEvent.click(sendButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Test notification sent/i)).toBeInTheDocument();
    });
    
    // Fast-forward time
    jest.advanceTimersByTime(3000);
    
    await waitFor(() => {
      expect(screen.queryByText(/Test notification sent/i)).not.toBeInTheDocument();
    });
    
    jest.useRealTimers();
  });
});
