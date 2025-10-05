import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchPage from '../SearchPage';
import * as api from '../../api';

// Mock the API module
jest.mock('../../api');

describe('SearchPage Component', () => {
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

  test('renders search page elements', () => {
    render(<SearchPage setLoading={mockSetLoading} />);

    expect(screen.getByText(/advanced search/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search by name/i)).toBeInTheDocument();
  });

  test('allows user to enter search keyword', async () => {
    const user = userEvent.setup();
    render(<SearchPage setLoading={mockSetLoading} />);

    const searchInput = screen.getByPlaceholderText(/search by name/i);
    await user.type(searchInput, 'John');

    expect(searchInput.value).toBe('John');
  });

  test('displays search filters', () => {
    render(<SearchPage setLoading={mockSetLoading} />);

    expect(screen.getByText(/gender/i)).toBeInTheDocument();
    expect(screen.getByText(/age/i)).toBeInTheDocument();
    expect(screen.getByText(/location/i)).toBeInTheDocument();
  });

  test('calls search API when search is performed', async () => {
    const user = userEvent.setup();
    const mockSearch = jest.fn().mockResolvedValue({
      users: [],
      total: 0,
      page: 1,
      limit: 20
    });

    api.searchUsers.mockImplementation(mockSearch);

    render(<SearchPage setLoading={mockSetLoading} />);

    const searchInput = screen.getByPlaceholderText(/search by name/i);
    const searchButton = screen.getByRole('button', { name: /search/i });

    await user.type(searchInput, 'test search');
    await user.click(searchButton);

    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalled();
    });
  });

  test('displays search results', async () => {
    const mockUsers = [
      {
        username: 'user1',
        firstName: 'John',
        lastName: 'Doe',
        location: 'New York, NY',
        images: ['/uploads/user1.jpg']
      },
      {
        username: 'user2',
        firstName: 'Jane',
        lastName: 'Smith',
        location: 'Los Angeles, CA',
        images: []
      }
    ];

    const mockSearch = jest.fn().mockResolvedValue({
      users: mockUsers,
      total: 2,
      page: 1,
      limit: 20
    });

    api.searchUsers.mockImplementation(mockSearch);

    const user = userEvent.setup();
    render(<SearchPage setLoading={mockSetLoading} />);

    const searchButton = screen.getByRole('button', { name: /search/i });
    await user.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  test('handles search error gracefully', async () => {
    const mockSearch = jest.fn().mockRejectedValue(new Error('Search failed'));

    api.searchUsers.mockImplementation(mockSearch);

    const user = userEvent.setup();
    render(<SearchPage setLoading={mockSetLoading} />);

    const searchButton = screen.getByRole('button', { name: /search/i });
    await user.click(searchButton);

    await waitFor(() => {
      expect(mockSetLoading).toHaveBeenCalledWith(false);
    });
  });

  test('paginates search results', async () => {
    const mockSearch = jest.fn().mockResolvedValue({
      users: [],
      total: 50,
      page: 1,
      limit: 20,
      totalPages: 3
    });

    api.searchUsers.mockImplementation(mockSearch);

    const user = userEvent.setup();
    render(<SearchPage setLoading={mockSetLoading} />);

    const searchButton = screen.getByRole('button', { name: /search/i });
    await user.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
    });
  });

  test('filters by gender', async () => {
    const user = userEvent.setup();
    const mockSearch = jest.fn().mockResolvedValue({
      users: [],
      total: 0,
      page: 1,
      limit: 20
    });

    api.searchUsers.mockImplementation(mockSearch);

    render(<SearchPage setLoading={mockSetLoading} />);

    // Find and interact with gender filter
    const genderSelect = screen.getByDisplayValue('Any');
    await user.selectOptions(genderSelect, 'Male');

    const searchButton = screen.getByRole('button', { name: /search/i });
    await user.click(searchButton);

    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({ gender: 'Male' })
      );
    });
  });

  test('saves search criteria', async () => {
    const user = userEvent.setup();
    render(<SearchPage setLoading={mockSetLoading} />);

    const searchInput = screen.getByPlaceholderText(/search by name/i);
    const saveSearchButton = screen.getByText(/save search/i);

    await user.type(searchInput, 'test criteria');
    await user.click(saveSearchButton);

    // Check if save search modal appears
    expect(screen.getByText(/save this search/i)).toBeInTheDocument();
  });

  test('loads saved searches', async () => {
    const mockGetSavedSearches = jest.fn().mockResolvedValue({
      savedSearches: [
        { id: '1', name: 'Test Search', criteria: { keyword: 'test' } }
      ]
    });

    api.getSavedSearches.mockImplementation(mockGetSavedSearches);

    const user = userEvent.setup();
    render(<SearchPage setLoading={mockSetLoading} />);

    const savedSearchesButton = screen.getByText(/saved searches/i);
    await user.click(savedSearchesButton);

    await waitFor(() => {
      expect(screen.getByText('Test Search')).toBeInTheDocument();
    });
  });
});
