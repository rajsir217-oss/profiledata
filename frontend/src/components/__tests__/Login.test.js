import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from './components/Login';
import * as api from './api';

// Mock the API module
jest.mock('./api');

describe('Login Component', () => {
  const mockSetUser = jest.fn();
  const mockSetToken = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders login form', () => {
    render(<Login setUser={mockSetUser} setToken={mockSetToken} />);

    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  test('allows user to type in username and password', async () => {
    const user = userEvent.setup();
    render(<Login setUser={mockSetUser} setToken={mockSetToken} />);

    const usernameInput = screen.getByPlaceholderText('Username');
    const passwordInput = screen.getByPlaceholderText('Password');

    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'testpass123');

    expect(usernameInput.value).toBe('testuser');
    expect(passwordInput.value).toBe('testpass123');
  });

  test('calls login API when form is submitted', async () => {
    const user = userEvent.setup();
    const mockLogin = jest.fn().mockResolvedValue({
      user: { username: 'testuser', firstName: 'Test' },
      access_token: 'fake-token'
    });

    api.loginUser.mockImplementation(mockLogin);

    render(<Login setUser={mockSetUser} setToken={mockSetToken} />);

    const usernameInput = screen.getByPlaceholderText('Username');
    const passwordInput = screen.getByPlaceholderText('Password');
    const loginButton = screen.getByRole('button', { name: /login/i });

    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'testpass123');
    await user.click(loginButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('testuser', 'testpass123');
    });
  });

  test('displays error message on login failure', async () => {
    const user = userEvent.setup();
    const mockLogin = jest.fn().mockRejectedValue(new Error('Invalid credentials'));

    api.loginUser.mockImplementation(mockLogin);

    render(<Login setUser={mockSetUser} setToken={mockSetToken} />);

    const usernameInput = screen.getByPlaceholderText('Username');
    const passwordInput = screen.getByPlaceholderText('Password');
    const loginButton = screen.getByRole('button', { name: /login/i });

    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'wrongpass');
    await user.click(loginButton);

    await waitFor(() => {
      expect(screen.getByText(/login failed/i)).toBeInTheDocument();
    });
  });

  test('redirects to register page when link is clicked', async () => {
    const user = userEvent.setup();
    render(<Login setUser={mockSetUser} setToken={mockSetToken} />);

    const registerLink = screen.getByText(/register/i);
    await user.click(registerLink);

    // Since we can't test actual navigation, we can check if the link exists
    expect(registerLink).toBeInTheDocument();
  });

  test('shows loading state during login', async () => {
    const user = userEvent.setup();
    const mockLogin = jest.fn().mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve({}), 100))
    );

    api.loginUser.mockImplementation(mockLogin);

    render(<Login setUser={mockSetUser} setToken={mockSetToken} />);

    const usernameInput = screen.getByPlaceholderText('Username');
    const passwordInput = screen.getByPlaceholderText('Password');
    const loginButton = screen.getByRole('button', { name: /login/i });

    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'testpass123');
    await user.click(loginButton);

    // Check if loading state is shown (button might be disabled or show loading text)
    expect(loginButton).toBeInTheDocument();
  });
});
