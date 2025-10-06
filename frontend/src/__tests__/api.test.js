// Mock the api module instead of axios directly
jest.mock('../api');

import {
  loginUser,
  registerUser,
  searchUsers,
  getUserProfile,
  updateUserProfile,
  createAccessRequest,
  getSavedSearches,
  addToFavorites,
  sendMessage,
  getMessages
} from '../api';

describe('API Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up localStorage mock
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => 'fake-token'),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    });
  });

  test('API functions are defined', () => {
    expect(typeof loginUser).toBe('function');
    expect(typeof registerUser).toBe('function');
    expect(typeof searchUsers).toBe('function');
    expect(typeof getUserProfile).toBe('function');
    expect(typeof updateUserProfile).toBe('function');
    expect(typeof createAccessRequest).toBe('function');
    expect(typeof getSavedSearches).toBe('function');
    expect(typeof addToFavorites).toBe('function');
    expect(typeof sendMessage).toBe('function');
    expect(typeof getMessages).toBe('function');
  });
});
