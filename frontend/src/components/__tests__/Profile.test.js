// Mock react-router-dom before importing Profile
jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(),
  useParams: jest.fn(),
  useLocation: jest.fn(() => ({ pathname: '/profile/testuser' })),
  Link: ({ children, to, ...props }) => {
    const React = require('react');
    return React.createElement('a', { href: to, ...props }, children);
  },
  BrowserRouter: ({ children }) => {
    const React = require('react');
    return React.createElement('div', {}, children);
  },
  Routes: ({ children }) => {
    const React = require('react');
    return React.createElement('div', {}, children);
  },
  Route: ({ children }) => {
    const React = require('react');
    return React.createElement('div', {}, children);
  },
}));

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { waitFor } from '@testing-library/react';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock the API module
jest.mock('../../api', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  createAccessRequest: jest.fn(),
  addToFavorites: jest.fn(),
}));

import Profile from '../Profile';

describe('Profile Component', () => {
  const mockUser = {
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    contactEmail: 'test@example.com',
    contactNumber: '555-123-4567',
    location: 'New York, NY',
    education: 'Bachelor\'s Degree',
    dob: null,
    sex: '',
    height: '',
    castePreference: '',
    eatingPreference: '',
    workingStatus: '',
    workplace: '',
    citizenshipStatus: '',
    familyBackground: '',
    aboutYou: '',
    partnerPreference: '',
    createdAt: null,
    updatedAt: null,
    images: []
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset localStorage mock
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    localStorageMock.clear.mockClear();
    // Reset react-router-dom mocks
    const reactRouterDom = require('react-router-dom');
    reactRouterDom.useParams.mockReturnValue({ username: 'testuser' });
    reactRouterDom.useNavigate.mockReturnValue(jest.fn());
    // Import the mocked API module
    const api = require('../../api');
    // Set up default mock implementations
    api.get.mockResolvedValue({ data: mockUser });
  });

  test('renders user profile information', async () => {
    render(<Profile />);

    // Wait for the API call to complete and component to render
    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    expect(screen.getByText('testuser')).toBeInTheDocument();
    expect(screen.getByText('555-123-4567')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText('New York, NY')).toBeInTheDocument();
    expect(screen.getByText('Bachelor\'s Degree')).toBeInTheDocument();
  });

  test('handles missing profile data gracefully', async () => {
    const api = require('../../api');
    api.get.mockResolvedValue({ data: null });

    render(<Profile />);

    await waitFor(() => {
      expect(screen.getByText('No profile found.')).toBeInTheDocument();
    });
  });

  test('shows loading state initially', () => {
    const api = require('../../api');
    // Mock API to not resolve immediately
    api.get.mockImplementation(() => new Promise(() => {}));

    render(<Profile />);

    expect(screen.getByText('Loading profile...')).toBeInTheDocument();
  });

  test('displays error message on API failure', async () => {
    const api = require('../../api');
    api.get.mockRejectedValue(new Error('API Error'));

    render(<Profile />);

    await waitFor(() => {
      expect(screen.getByText('Unable to load profile')).toBeInTheDocument();
    });
  });
});
