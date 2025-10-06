// No need for inline mock since we have centralized mock in __mocks__/react-router-dom.js

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
}));

import SearchPage from '../SearchPage';

describe('SearchPage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue('testuser');
    // Import the mocked API module
    const api = require('../../api');
    // Set up default mock implementations
    api.get.mockResolvedValue({ data: { users: [], total: 0 } });
  });

  test('renders search form', () => {
    render(<SearchPage />);

    expect(screen.getByPlaceholderText('Search in name, location, interests, bio...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Search Profiles/i })).toBeInTheDocument();
  });

  test('allows user to type in search input', () => {
    render(<SearchPage />);

    const searchInput = screen.getByPlaceholderText('Search in name, location, interests, bio...');
    userEvent.type(searchInput, 'John');

    expect(searchInput.value).toBe('John');
  });

  test('displays search filters', () => {
    render(<SearchPage />);

    expect(screen.getByText(/🔍 Advanced Search/i)).toBeInTheDocument();
    expect(screen.getByText(/Find your perfect match with detailed filters/i)).toBeInTheDocument();
  });

  test('displays search results section', () => {
    render(<SearchPage />);

    expect(screen.getByText(/Search Results/i)).toBeInTheDocument();
  });

  test('shows no results message when no users found', () => {
    render(<SearchPage />);

    // The component should show "No profiles found" message when there are no results
    expect(screen.getByText(/No profiles found/i)).toBeInTheDocument();
  });

  test('displays saved searches section', () => {
    render(<SearchPage />);

    expect(screen.getByText(/Saved Searches/i)).toBeInTheDocument();
  });
});
