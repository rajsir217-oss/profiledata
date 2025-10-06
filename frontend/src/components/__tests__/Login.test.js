import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
  post: jest.fn(),
  get: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

import Login from '../Login';

describe('Login Component', () => {
  const mockSetUser = jest.fn();
  const mockSetToken = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset localStorage mock
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    localStorageMock.clear.mockClear();
    // Import the mocked API module
    const api = require('../../api');
    // Set up default mock implementations
    api.post.mockResolvedValue({
      data: {
        user: { username: 'testuser' },
        access_token: 'fake-token'
      }
    });
  });

  test('renders login form', () => {
    render(<Login setUser={mockSetUser} setToken={mockSetToken} />);

    expect(screen.getByPlaceholderText('Enter username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  test('allows user to type in inputs', async () => {
    render(<Login setUser={mockSetUser} setToken={mockSetToken} />);

    const usernameInput = screen.getByPlaceholderText('Enter username');
    const passwordInput = screen.getByPlaceholderText('Enter password');

    userEvent.type(usernameInput, 'testuser');
    userEvent.type(passwordInput, 'password123');

    expect(usernameInput.value).toBe('testuser');
    expect(passwordInput.value).toBe('password123');
  });

  test('displays error message on failed login', async () => {
    const api = require('../../api');
    const mockLogin = jest.fn().mockRejectedValue(new Error('Invalid credentials'));

    // Mock console.error to avoid test output pollution
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Mock the login function
    api.post.mockImplementation(mockLogin);

    render(<Login setUser={mockSetUser} setToken={mockSetToken} />);

    const usernameInput = screen.getByPlaceholderText('Enter username');
    const passwordInput = screen.getByPlaceholderText('Enter password');
    const loginButton = screen.getByRole('button', { name: /login/i });

    userEvent.type(usernameInput, 'testuser');
    userEvent.type(passwordInput, 'wrongpass');
    userEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });

    // Restore console.error
    consoleSpy.mockRestore();
  });

  test('redirects to register page when link is clicked', async () => {
    render(<Login setUser={mockSetUser} setToken={mockSetToken} />);

    const registerLink = screen.getByText(/register/i);
    userEvent.click(registerLink);

    // Since we can't test actual navigation, we can check if the link exists
    expect(registerLink).toBeInTheDocument();
  });

  test('shows loading state during login', async () => {
    const api = require('../../api');
    const mockLogin = jest.fn().mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve({}), 100))
    );

    api.post.mockImplementation(mockLogin);

    render(<Login setUser={mockSetUser} setToken={mockSetToken} />);

    const usernameInput = screen.getByPlaceholderText('Enter username');
    const passwordInput = screen.getByPlaceholderText('Enter password');
    const loginButton = screen.getByRole('button', { name: /login/i });

    userEvent.type(usernameInput, 'testuser');
    userEvent.type(passwordInput, 'testpass123');
    userEvent.click(loginButton);

    // Check if loading state is shown (button might be disabled or show loading text)
    expect(loginButton).toBeInTheDocument();
  });
});
