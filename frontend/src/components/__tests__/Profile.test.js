import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Profile from '../Profile';
import * as api from '../../api';

// Mock the API module
jest.mock('../../api');

describe('Profile Component', () => {
  const mockUser = {
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    contactEmail: 'test@example.com',
    contactNumber: '555-123-4567',
    location: 'New York, NY',
    education: 'Bachelor\'s Degree',
    images: ['/uploads/test1.jpg', '/uploads/test2.jpg'],
    aboutYou: 'Test about section',
    piiMasked: false,
    contactEmailMasked: false,
    contactNumberMasked: false,
    locationMasked: false
  };

  const mockSetLoading = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => 'fake-token'),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    });
  });

  test('renders user profile information', () => {
    render(<Profile user={mockUser} setLoading={mockSetLoading} />);

    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText('555-123-4567')).toBeInTheDocument();
    expect(screen.getByText('New York, NY')).toBeInTheDocument();
    expect(screen.getByText('Bachelor\'s Degree')).toBeInTheDocument();
    expect(screen.getByText('Test about section')).toBeInTheDocument();
  });

  test('displays masked PII when profile is masked', () => {
    const maskedUser = {
      ...mockUser,
      contactEmail: 't***@example.com',
      contactNumber: '***-***-4567',
      location: 'NY',
      piiMasked: true,
      contactEmailMasked: true,
      contactNumberMasked: true,
      locationMasked: true
    };

    render(<Profile user={maskedUser} setLoading={mockSetLoading} />);

    expect(screen.getByText('t***@example.com')).toBeInTheDocument();
    expect(screen.getByText('***-***-4567')).toBeInTheDocument();
    expect(screen.getByText('NY')).toBeInTheDocument();
    expect(screen.getByText(/pii masked/i)).toBeInTheDocument();
  });

  test('displays profile images in carousel', () => {
    render(<Profile user={mockUser} setLoading={mockSetLoading} />);

    // Check if images are rendered (you might need to check for img tags or carousel indicators)
    const images = screen.getAllByRole('img');
    expect(images.length).toBeGreaterThan(0);
  });

  test('shows request access button for masked profile', () => {
    const maskedUser = {
      ...mockUser,
      piiMasked: true
    };

    render(<Profile user={maskedUser} setLoading={mockSetLoading} />);

    expect(screen.getByText(/request access/i)).toBeInTheDocument();
  });

  test('allows requesting access to PII', async () => {
    const maskedUser = {
      ...mockUser,
      piiMasked: true
    };

    const mockRequestAccess = jest.fn().mockResolvedValue({
      message: 'Request sent successfully'
    });

    api.createAccessRequest.mockImplementation(mockRequestAccess);

    const user = userEvent.setup();
    render(<Profile user={maskedUser} setLoading={mockSetLoading} />);

    const requestButton = screen.getByText(/request access/i);
    await user.click(requestButton);

    await waitFor(() => {
      expect(mockRequestAccess).toHaveBeenCalled();
    });
  });

  test('shows add to favorites button', () => {
    render(<Profile user={mockUser} setLoading={mockSetLoading} />);

    expect(screen.getByText(/add to favorites/i)).toBeInTheDocument();
  });

  test('allows adding user to favorites', async () => {
    const mockAddToFavorites = jest.fn().mockResolvedValue({
      message: 'Added to favorites successfully'
    });

    api.addToFavorites.mockImplementation(mockAddToFavorites);

    const user = userEvent.setup();
    render(<Profile user={mockUser} setLoading={mockSetLoading} />);

    const favoritesButton = screen.getByText(/add to favorites/i);
    await user.click(favoritesButton);

    await waitFor(() => {
      expect(mockAddToFavorites).toHaveBeenCalledWith('testuser');
    });
  });

  test('shows send message button', () => {
    render(<Profile user={mockUser} setLoading={mockSetLoading} />);

    expect(screen.getByText(/send message/i)).toBeInTheDocument();
  });

  test('handles missing profile data gracefully', () => {
    const incompleteUser = {
      username: 'testuser',
      firstName: 'Test'
      // Missing other fields
    };

    render(<Profile user={incompleteUser} setLoading={mockSetLoading} />);

    expect(screen.getByText('Test')).toBeInTheDocument();
    // Should not crash with missing fields
  });

  test('displays profile actions for own profile', () => {
    // Mock current user as profile owner
    jest.spyOn(React, 'useState').mockImplementation(() => [mockUser, jest.fn()]);

    render(<Profile user={mockUser} setLoading={mockSetLoading} />);

    // Should show edit profile option for own profile
    expect(screen.getByText(/edit profile/i)).toBeInTheDocument();
  });
});
