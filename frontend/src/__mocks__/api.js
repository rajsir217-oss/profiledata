// Mock for the api module
const mockApi = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn(),
  head: jest.fn(),
  options: jest.fn(),
};

// Mock API functions
export const loginUser = jest.fn();
export const registerUser = jest.fn();
export const searchUsers = jest.fn();
export const getUserProfile = jest.fn();
export const updateUserProfile = jest.fn();
export const createAccessRequest = jest.fn();
export const getSavedSearches = jest.fn();
export const addToFavorites = jest.fn();
export const sendMessage = jest.fn();
export const getMessages = jest.fn();

export default mockApi;
