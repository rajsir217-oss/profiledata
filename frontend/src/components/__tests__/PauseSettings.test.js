/**
 * Tests for PauseSettings Component
 * 
 * Tests pause modal functionality including:
 * - Rendering and display
 * - Form interactions (duration, reason, message)
 * - Validation
 * - API integration
 * - Success/error handling
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PauseSettings from '../PauseSettings';
import api from '../../api';

// Mock API
jest.mock('../../api');

describe('PauseSettings Component', () => {
  const mockOnClose = jest.fn();
  const mockOnPause = jest.fn();
  const mockCurrentStatus = {
    isPaused: false,
    accountStatus: 'active'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== Rendering Tests ====================

  describe('Rendering', () => {
    test('renders modal when isOpen is true', () => {
      render(
        <PauseSettings
          isOpen={true}
          onClose={mockOnClose}
          onPause={mockOnPause}
          currentStatus={mockCurrentStatus}
        />
      );

      expect(screen.getByText(/Pause Your Account/i)).toBeInTheDocument();
    });

    test('does not render modal when isOpen is false', () => {
      render(
        <PauseSettings
          isOpen={false}
          onClose={mockOnClose}
          onPause={mockOnPause}
          currentStatus={mockCurrentStatus}
        />
      );

      expect(screen.queryByText(/Pause Your Account/i)).not.toBeInTheDocument();
    });

    test('renders all duration options', () => {
      render(
        <PauseSettings
          isOpen={true}
          onClose={mockOnClose}
          onPause={mockOnPause}
          currentStatus={mockCurrentStatus}
        />
      );

      expect(screen.getByLabelText(/3 days/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/7 days/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/14 days/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/30 days/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Manual/i)).toBeInTheDocument();
    });

    test('renders all reason options', () => {
      render(
        <PauseSettings
          isOpen={true}
          onClose={mockOnClose}
          onPause={mockOnPause}
          currentStatus={mockCurrentStatus}
        />
      );

      expect(screen.getByLabelText(/Vacation/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Feeling Overwhelmed/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Personal Reasons/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Other/i)).toBeInTheDocument();
    });

    test('renders effects explanation', () => {
      render(
        <PauseSettings
          isOpen={true}
          onClose={mockOnClose}
          onPause={mockOnPause}
          currentStatus={mockCurrentStatus}
        />
      );

      expect(screen.getByText(/What happens when you pause/i)).toBeInTheDocument();
      expect(screen.getByText(/Hidden from all searches/i)).toBeInTheDocument();
      expect(screen.getByText(/No new matches/i)).toBeInTheDocument();
      expect(screen.getByText(/Messages disabled/i)).toBeInTheDocument();
      expect(screen.getByText(/Can still edit profile/i)).toBeInTheDocument();
      expect(screen.getByText(/Subscription remains active/i)).toBeInTheDocument();
    });

    test('renders message textarea', () => {
      render(
        <PauseSettings
          isOpen={true}
          onClose={mockOnClose}
          onPause={mockOnPause}
          currentStatus={mockCurrentStatus}
        />
      );

      const textarea = screen.getByPlaceholderText(/Let others know why/i);
      expect(textarea).toBeInTheDocument();
    });
  });

  // ==================== Interaction Tests ====================

  describe('User Interactions', () => {
    test('can select duration', async () => {
      render(
        <PauseSettings
          isOpen={true}
          onClose={mockOnClose}
          onPause={mockOnPause}
          currentStatus={mockCurrentStatus}
        />
      );

      const duration7d = screen.getByLabelText(/7 days/i);
      fireEvent.click(duration7d);

      expect(duration7d).toBeChecked();
    });

    test('can select reason', async () => {
      render(
        <PauseSettings
          isOpen={true}
          onClose={mockOnClose}
          onPause={mockOnPause}
          currentStatus={mockCurrentStatus}
        />
      );

      const reasonVacation = screen.getByLabelText(/Vacation/i);
      fireEvent.click(reasonVacation);

      expect(reasonVacation).toBeChecked();
    });

    test('can type custom message', async () => {
      const user = userEvent.setup();
      
      render(
        <PauseSettings
          isOpen={true}
          onClose={mockOnClose}
          onPause={mockOnPause}
          currentStatus={mockCurrentStatus}
        />
      );

      const textarea = screen.getByPlaceholderText(/Let others know why/i);
      await user.type(textarea, 'Going on vacation');

      expect(textarea.value).toBe('Going on vacation');
    });

    test('close button calls onClose', () => {
      render(
        <PauseSettings
          isOpen={true}
          onClose={mockOnClose}
          onPause={mockOnPause}
          currentStatus={mockCurrentStatus}
        />
      );

      const closeButton = screen.getByText(/Cancel/i);
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    test('backdrop click calls onClose', () => {
      render(
        <PauseSettings
          isOpen={true}
          onClose={mockOnClose}
          onPause={mockOnPause}
          currentStatus={mockCurrentStatus}
        />
      );

      const backdrop = document.querySelector('.pause-settings-overlay');
      fireEvent.click(backdrop);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== Form Submission Tests ====================

  describe('Form Submission', () => {
    test('submits form with valid data', async () => {
      api.post.mockResolvedValue({
        data: {
          success: true,
          accountStatus: 'paused',
          pausedAt: new Date().toISOString(),
          pausedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }
      });

      render(
        <PauseSettings
          isOpen={true}
          onClose={mockOnClose}
          onPause={mockOnPause}
          currentStatus={mockCurrentStatus}
        />
      );

      // Select duration
      fireEvent.click(screen.getByLabelText(/7 days/i));

      // Select reason
      fireEvent.click(screen.getByLabelText(/Vacation/i));

      // Submit form
      const submitButton = screen.getByText(/Pause My Account/i);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/account/pause', {
          duration: '7d',
          reason: 'vacation',
          message: ''
        });
      });

      expect(mockOnPause).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });

    test('submits form with custom message', async () => {
      const user = userEvent.setup();
      
      api.post.mockResolvedValue({
        data: { success: true, accountStatus: 'paused' }
      });

      render(
        <PauseSettings
          isOpen={true}
          onClose={mockOnClose}
          onPause={mockOnPause}
          currentStatus={mockCurrentStatus}
        />
      );

      // Select duration and reason
      fireEvent.click(screen.getByLabelText(/7 days/i));
      fireEvent.click(screen.getByLabelText(/Vacation/i));

      // Type message
      const textarea = screen.getByPlaceholderText(/Let others know why/i);
      await user.type(textarea, 'Going to Hawaii');

      // Submit
      fireEvent.click(screen.getByText(/Pause My Account/i));

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/account/pause', {
          duration: '7d',
          reason: 'vacation',
          message: 'Going to Hawaii'
        });
      });
    });

    test('shows error when API call fails', async () => {
      api.post.mockRejectedValue({
        response: { data: { detail: 'Account is already paused' } }
      });

      render(
        <PauseSettings
          isOpen={true}
          onClose={mockOnClose}
          onPause={mockOnPause}
          currentStatus={mockCurrentStatus}
        />
      );

      fireEvent.click(screen.getByLabelText(/7 days/i));
      fireEvent.click(screen.getByLabelText(/Vacation/i));
      fireEvent.click(screen.getByText(/Pause My Account/i));

      await waitFor(() => {
        expect(screen.getByText(/Account is already paused/i)).toBeInTheDocument();
      });

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  // ==================== Validation Tests ====================

  describe('Validation', () => {
    test('submit button disabled when no duration selected', () => {
      render(
        <PauseSettings
          isOpen={true}
          onClose={mockOnClose}
          onPause={mockOnPause}
          currentStatus={mockCurrentStatus}
        />
      );

      const submitButton = screen.getByText(/Pause My Account/i);
      expect(submitButton).toBeDisabled();
    });

    test('submit button enabled when duration selected', () => {
      render(
        <PauseSettings
          isOpen={true}
          onClose={mockOnClose}
          onPause={mockOnPause}
          currentStatus={mockCurrentStatus}
        />
      );

      fireEvent.click(screen.getByLabelText(/7 days/i));

      const submitButton = screen.getByText(/Pause My Account/i);
      expect(submitButton).not.toBeDisabled();
    });

    test('shows loading state during submission', async () => {
      api.post.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      render(
        <PauseSettings
          isOpen={true}
          onClose={mockOnClose}
          onPause={mockOnPause}
          currentStatus={mockCurrentStatus}
        />
      );

      fireEvent.click(screen.getByLabelText(/7 days/i));
      fireEvent.click(screen.getByText(/Pause My Account/i));

      // Check for loading state
      await waitFor(() => {
        expect(screen.getByText(/Pausing.../i)).toBeInTheDocument();
      });
    });
  });

  // ==================== Edge Cases ====================

  describe('Edge Cases', () => {
    test('handles already paused status', () => {
      const pausedStatus = {
        isPaused: true,
        accountStatus: 'paused',
        pausedAt: new Date().toISOString()
      };

      render(
        <PauseSettings
          isOpen={true}
          onClose={mockOnClose}
          onPause={mockOnPause}
          currentStatus={pausedStatus}
        />
      );

      // Should show appropriate message or different UI
      // This depends on your implementation
    });

    test('handles very long custom message', async () => {
      const user = userEvent.setup();
      const longMessage = 'A'.repeat(1000);

      render(
        <PauseSettings
          isOpen={true}
          onClose={mockOnClose}
          onPause={mockOnPause}
          currentStatus={mockCurrentStatus}
        />
      );

      const textarea = screen.getByPlaceholderText(/Let others know why/i);
      await user.type(textarea, longMessage);

      expect(textarea.value).toBe(longMessage);
    });

    test('handles manual duration selection', async () => {
      api.post.mockResolvedValue({
        data: { success: true, accountStatus: 'paused', pausedUntil: null }
      });

      render(
        <PauseSettings
          isOpen={true}
          onClose={mockOnClose}
          onPause={mockOnPause}
          currentStatus={mockCurrentStatus}
        />
      );

      fireEvent.click(screen.getByLabelText(/Manual/i));
      fireEvent.click(screen.getByLabelText(/Vacation/i));
      fireEvent.click(screen.getByText(/Pause My Account/i));

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/account/pause', {
          duration: 'manual',
          reason: 'vacation',
          message: ''
        });
      });
    });

    test('resets form on close', () => {
      const { rerender } = render(
        <PauseSettings
          isOpen={true}
          onClose={mockOnClose}
          onPause={mockOnPause}
          currentStatus={mockCurrentStatus}
        />
      );

      // Select options
      fireEvent.click(screen.getByLabelText(/7 days/i));
      fireEvent.click(screen.getByLabelText(/Vacation/i));

      // Close modal
      fireEvent.click(screen.getByText(/Cancel/i));

      // Reopen modal
      rerender(
        <PauseSettings
          isOpen={true}
          onClose={mockOnClose}
          onPause={mockOnPause}
          currentStatus={mockCurrentStatus}
        />
      );

      // Form should be reset (this depends on implementation)
    });
  });

  // ==================== Accessibility Tests ====================

  describe('Accessibility', () => {
    test('modal has proper ARIA attributes', () => {
      render(
        <PauseSettings
          isOpen={true}
          onClose={mockOnClose}
          onPause={mockOnPause}
          currentStatus={mockCurrentStatus}
        />
      );

      const modal = document.querySelector('[role="dialog"]');
      expect(modal).toBeInTheDocument();
    });

    test('radio buttons have proper labels', () => {
      render(
        <PauseSettings
          isOpen={true}
          onClose={mockOnClose}
          onPause={mockOnPause}
          currentStatus={mockCurrentStatus}
        />
      );

      const duration7d = screen.getByLabelText(/7 days/i);
      expect(duration7d).toHaveAttribute('type', 'radio');
      expect(duration7d).toHaveAttribute('name', 'duration');
    });

    test('form has proper labels and associations', () => {
      render(
        <PauseSettings
          isOpen={true}
          onClose={mockOnClose}
          onPause={mockOnPause}
          currentStatus={mockCurrentStatus}
        />
      );

      const textarea = screen.getByPlaceholderText(/Let others know why/i);
      expect(textarea).toHaveAttribute('name', 'message');
    });

    test('can navigate with keyboard', async () => {
      const user = userEvent.setup();

      render(
        <PauseSettings
          isOpen={true}
          onClose={mockOnClose}
          onPause={mockOnPause}
          currentStatus={mockCurrentStatus}
        />
      );

      // Tab through elements
      await user.tab();
      
      // First radio should be focused
      const firstRadio = screen.getByLabelText(/3 days/i);
      expect(firstRadio).toHaveFocus();
    });
  });
});
