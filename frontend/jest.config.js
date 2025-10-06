module.exports = {
  // Use react-scripts preset for compatibility
  preset: 'react-scripts',

  // Transform ES modules from node_modules that use ES syntax
  transformIgnorePatterns: [
    'node_modules/(?!(axios|react-router-dom|react-router)/)',
  ],

  // Module name mapping for better resolution
  moduleNameMapper: {
    '^axios$': '<rootDir>/src/__mocks__/axios.js',
    '^react-router-dom$': '<rootDir>/src/__mocks__/react-router-dom.js',
  },

  // Setup files for testing
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],

  // Test environment
  testEnvironment: 'jsdom',

  // Verbose output for debugging
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Additional test configuration
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/index.js',
    '!src/reportWebVitals.js',
    '!src/setupTests.js',
  ],

  // Test timeout
  testTimeout: 10000,
};
