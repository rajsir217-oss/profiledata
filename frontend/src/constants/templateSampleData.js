/**
 * Sample data for email template preview
 * Moved outside component to prevent recreation on every render
 */

import { getFrontendUrl } from '../utils/urlHelper';

export const SAMPLE_DATA = {
  recipient: {
    firstName: 'Sarah',
    username: 'sarah_j',
    age: 27,
    location: 'Boston'
  },
  match: {
    firstName: 'Mike',
    username: 'mike_dev',
    age: 30,
    matchScore: 92,
    location: 'Boston',
    occupation: 'Software Engineer',
    education: 'MBA',
    profession: 'Software Engineer'
  },
  event: {
    type: 'new_match',
    timestamp: new Date().toISOString(),
    message: 'You have a new match!'
  },
  app: {
    logoUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjYwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjx0ZXh0IHg9IjEwIiB5PSI0MCIgZm9udC1zaXplPSIzMiIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IiM2NjdlZWEiPvCfposkIEwzVjNMPC90ZXh0Pjwvc3ZnPg==',
    trackingPixelUrl: 'http://localhost:8000/api/email-tracking/pixel/preview',
    profileUrl: `${getFrontendUrl()}/profile/mike_dev`,
    profileUrl_tracked: `${getFrontendUrl()}/profile/mike_dev`,
    chatUrl: `${getFrontendUrl()}/messages`,
    chatUrl_tracked: `${getFrontendUrl()}/messages`,
    matchUrl: `${getFrontendUrl()}/matches`,
    settingsUrl: `${getFrontendUrl()}/settings`,
    unsubscribeUrl: `${getFrontendUrl()}/unsubscribe`,
    unsubscribeUrl_tracked: `${getFrontendUrl()}/unsubscribe`,
    preferencesUrl_tracked: `${getFrontendUrl()}/preferences`,
    approveUrl_tracked: `${getFrontendUrl()}/pii/approve`,
    denyUrl_tracked: `${getFrontendUrl()}/pii/deny`,
    dashboardUrl: `${getFrontendUrl()}/dashboard`,
    contactUrl: `${getFrontendUrl()}/contact`,
    searchUrl: `${getFrontendUrl()}/search`,
    securityUrl: `${getFrontendUrl()}/security`
  },
  stats: {
    mutualMatches: 12,
    unreadMessages: 5,
    profileViews: 23,
    newMatches: 3,
    favorites: 8,
    searchCount: 45,
    increase: 25,
    matchCount: 5,
    messageCount: 12,
    viewCount: 25
  },
  message: {
    preview: 'Hey! I saw your profile and would love to connect...'
  },
  pii: {
    daysRemaining: 7,
    expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()
  },
  milestone: {
    description: '100 Profile Views',
    value: 100
  },
  profile: {
    completeness: 75,
    missingFields: 'photos, bio',
    url: `${getFrontendUrl()}/profile`
  },
  matches: {
    count: 5
  },
  login: {
    location: 'San Francisco, CA',
    device: 'Chrome on MacBook',
    ip: '192.168.1.100',
    timestamp: new Date().toISOString()
  },
  subscription: {
    plan: 'Premium',
    price: '$29.99',
    nextBilling: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    features: ['Unlimited Messages', 'Advanced Search', 'Profile Boost', 'Priority Support']
  },
  system: {
    version: '2.0.1',
    uptime: '99.9%',
    lastUpdate: new Date().toISOString()
  }
};
