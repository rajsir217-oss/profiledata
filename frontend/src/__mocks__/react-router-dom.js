import React from 'react';

module.exports = {
  useNavigate: jest.fn(() => jest.fn()),
  useParams: jest.fn(() => ({ username: 'testuser' })),
  useLocation: jest.fn(() => ({ pathname: '/profile/testuser' })),
  Link: ({ children, to, ...props }) => {
    return React.createElement('a', { href: to, ...props }, children);
  },
  BrowserRouter: ({ children }) => React.createElement('div', {}, children),
  Routes: ({ children }) => React.createElement('div', {}, children),
  Route: ({ children }) => React.createElement('div', {}, children),
};
