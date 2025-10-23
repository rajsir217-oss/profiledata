// frontend/src/components/__tests__/Sidebar.test.js
/**
 * Test Suite for Sidebar Component
 * Tests menu rendering, user status-based access control, and admin features
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock useNavigate before importing components
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }) => <div>{children}</div>,
  useNavigate: () => mockNavigate,
}));

import Sidebar from '../Sidebar';

// Helper to render component
const renderWithRouter = (component) => {
  return render(component);
};

describe('Sidebar Component', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    mockNavigate.mockClear();
  });

  // ===== LOGGED OUT STATE =====
  
  describe('Logged Out State', () => {
    test('shows login and register options when not logged in', () => {
      renderWithRouter(<Sidebar isCollapsed={false} />);
      
      expect(screen.getByText('Login')).toBeInTheDocument();
      expect(screen.getByText('Register')).toBeInTheDocument();
    });

    test('does not show user menu items when not logged in', () => {
      renderWithRouter(<Sidebar isCollapsed={false} />);
      
      expect(screen.queryByText('My Dashboard')).not.toBeInTheDocument();
      expect(screen.queryByText('My Messages')).not.toBeInTheDocument();
    });
  });

  // ===== ACTIVE USER STATE =====
  
  describe('Active User State', () => {
    beforeEach(() => {
      localStorage.setItem('username', 'testuser');
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('userStatus', 'active');
    });

    test('shows all menu items for active users', () => {
      renderWithRouter(<Sidebar isCollapsed={false} />);
      
      expect(screen.getByText('My Dashboard')).toBeInTheDocument();
      expect(screen.getByText('testuser')).toBeInTheDocument();
      expect(screen.getByText('Privacy & Data')).toBeInTheDocument();
      expect(screen.getByText('Search Profiles')).toBeInTheDocument();
      expect(screen.getByText('My Messages')).toBeInTheDocument();
    });

    test('all menu items are enabled for active users', () => {
      renderWithRouter(<Sidebar isCollapsed={false} />);
      
      const dashboard = screen.getByText('My Dashboard').closest('.menu-item');
      const search = screen.getByText('Search Profiles').closest('.menu-item');
      
      expect(dashboard).not.toHaveClass('disabled');
      expect(search).not.toHaveClass('disabled');
    });

    test('clicking menu item navigates to correct route', () => {
      renderWithRouter(<Sidebar isCollapsed={false} />);
      
      const dashboard = screen.getByText('My Dashboard');
      fireEvent.click(dashboard);
      
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  // ===== PENDING USER STATE =====
  
  describe('Pending User State', () => {
    beforeEach(() => {
      localStorage.setItem('username', 'pendinguser');
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('userStatus', 'pending');
    });

    test('shows all menu items but most are disabled', () => {
      renderWithRouter(<Sidebar isCollapsed={false} />);
      
      // Should show items
      expect(screen.getByText('My Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Search Profiles')).toBeInTheDocument();
      
      // But they should be disabled
      const dashboard = screen.getByText('My Dashboard').closest('.menu-item');
      const search = screen.getByText('Search Profiles').closest('.menu-item');
      
      expect(dashboard).toHaveClass('disabled');
      expect(search).toHaveClass('disabled');
    });

    test('profile menu is always enabled for pending users', () => {
      renderWithRouter(<Sidebar isCollapsed={false} />);
      
      const profile = screen.getByText('Profile data').closest('.menu-item');
      expect(profile).not.toHaveClass('disabled');
    });

    test('disabled menu items show lock icon', () => {
      renderWithRouter(<Sidebar isCollapsed={false} />);
      
      const dashboard = screen.getByText('My Dashboard').closest('.menu-item');
      expect(dashboard).toHaveTextContent('🔒');
    });

    test('disabled menu items do not navigate on click', () => {
      renderWithRouter(<Sidebar isCollapsed={false} />);
      
      const dashboard = screen.getByText('My Dashboard').closest('.menu-item');
      fireEvent.click(dashboard);
      
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    test('profile menu navigates on click', () => {
      renderWithRouter(<Sidebar isCollapsed={false} />);
      
      const profile = screen.getByText('Profile data');
      fireEvent.click(profile);
      
      expect(mockNavigate).toHaveBeenCalledWith('/profile/pendinguser');
    });
  });

  // ===== ADMIN USER STATE =====
  
  describe('Admin User State', () => {
    beforeEach(() => {
      localStorage.setItem('username', 'admin');
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('userStatus', 'active');
    });

    test('shows admin section for admin users', () => {
      renderWithRouter(<Sidebar isCollapsed={false} />);
      
      expect(screen.getByText('ADMIN SECTION')).toBeInTheDocument();
    });

    test('shows admin menu items', () => {
      renderWithRouter(<Sidebar isCollapsed={false} />);
      
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
      expect(screen.getByText('User Management')).toBeInTheDocument();
      expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
    });

    test('admin section has distinct styling', () => {
      renderWithRouter(<Sidebar isCollapsed={false} />);
      
      const adminSection = screen.getByText('ADMIN SECTION').closest('.menu-item');
      expect(adminSection).toHaveClass('menu-header');
    });

    test('admin menu items navigate correctly', () => {
      renderWithRouter(<Sidebar isCollapsed={false} />);
      
      const userManagement = screen.getByText('User Management');
      fireEvent.click(userManagement);
      
      expect(mockNavigate).toHaveBeenCalledWith('/user-management');
    });
  });

  // ===== NO STATUS (LEGACY USERS) =====
  
  describe('Users Without Status Field', () => {
    beforeEach(() => {
      localStorage.setItem('username', 'legacyuser');
      localStorage.setItem('token', 'fake-token');
      // No userStatus set
    });

    test('defaults to pending when no status in localStorage', () => {
      renderWithRouter(<Sidebar isCollapsed={false} />);
      
      const dashboard = screen.getByText('My Dashboard').closest('.menu-item');
      expect(dashboard).toHaveClass('disabled');
    });
  });

  // ===== LOGOUT FUNCTIONALITY =====
  
  describe('Logout Functionality', () => {
    beforeEach(() => {
      localStorage.setItem('username', 'testuser');
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('userStatus', 'active');
    });

    test('shows logout button for logged in users', () => {
      renderWithRouter(<Sidebar isCollapsed={false} />);
      
      expect(screen.getByText('Logout')).toBeInTheDocument();
    });

    test('logout clears localStorage', () => {
      renderWithRouter(<Sidebar isCollapsed={false} />);
      
      const logout = screen.getByText('Logout');
      fireEvent.click(logout);
      
      expect(localStorage.getItem('username')).toBeNull();
      expect(localStorage.getItem('token')).toBeNull();
    });

    test('logout navigates to login page', () => {
      renderWithRouter(<Sidebar isCollapsed={false} />);
      
      const logout = screen.getByText('Logout');
      fireEvent.click(logout);
      
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  // ===== RESPONSIVE BEHAVIOR =====
  
  describe('Responsive Behavior', () => {
    test('sidebar is collapsed by default', () => {
      const { container } = renderWithRouter(<Sidebar isCollapsed={true} />);
      
      const sidebar = container.querySelector('.sidebar');
      expect(sidebar).not.toHaveClass('open');
    });

    test('sidebar opens when isCollapsed is false', () => {
      const { container } = renderWithRouter(<Sidebar isCollapsed={false} />);
      
      const sidebar = container.querySelector('.sidebar');
      expect(sidebar).toHaveClass('open');
    });
  });

  // ===== DYNAMIC UPDATES =====
  
  describe('Dynamic Updates', () => {
    test('updates when localStorage changes', async () => {
      const { rerender } = renderWithRouter(<Sidebar isCollapsed={false} />);
      
      // Initially not logged in
      expect(screen.getByText('Login')).toBeInTheDocument();
      
      // Simulate login
      localStorage.setItem('username', 'newuser');
      localStorage.setItem('token', 'new-token');
      localStorage.setItem('userStatus', 'active');
      
      // Trigger storage event wrapped in act
      await act(async () => {
        window.dispatchEvent(new Event('loginStatusChanged'));
      });
      
      await waitFor(() => {
        expect(screen.queryByText('Login')).not.toBeInTheDocument();
        expect(screen.getByText('My Dashboard')).toBeInTheDocument();
      });
    });
  });

  // ===== ACCESSIBILITY =====
  
  describe('Accessibility', () => {
    beforeEach(() => {
      localStorage.setItem('username', 'testuser');
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('userStatus', 'pending');
    });

    test('disabled items have appropriate title attribute', () => {
      renderWithRouter(<Sidebar isCollapsed={false} />);
      
      const dashboard = screen.getByText('My Dashboard').closest('.menu-item');
      expect(dashboard).toHaveAttribute('title', 'Please activate your account to access this feature');
    });

    test('menu items have proper semantic structure', () => {
      renderWithRouter(<Sidebar isCollapsed={false} />);
      
      // Menu items are now divs with menu-item class, not buttons
      const menuItems = document.querySelectorAll('.menu-item');
      expect(menuItems.length).toBeGreaterThan(0);
    });
  });
});
