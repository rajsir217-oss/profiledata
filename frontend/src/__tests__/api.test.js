import axios from 'axios';
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

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

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

  describe('loginUser', () => {
    test('successfully logs in user', async () => {
      const mockResponse = {
        data: {
          user: { username: 'testuser', firstName: 'Test' },
          access_token: 'fake-token'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await loginUser('testuser', 'testpass123');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:8000/api/users/login',
        { username: 'testuser', password: 'testpass123' }
      );
      expect(result).toEqual(mockResponse.data);
    });

    test('handles login error', async () => {
      const errorMessage = 'Invalid credentials';
      mockedAxios.post.mockRejectedValue(new Error(errorMessage));

      await expect(loginUser('testuser', 'wrongpass')).rejects.toThrow(errorMessage);
    });
  });

  describe('registerUser', () => {
    test('successfully registers user', async () => {
      const userData = {
        username: 'testuser',
        password: 'testpass123',
        firstName: 'Test',
        lastName: 'User',
        contactEmail: 'test@example.com'
      };

      const mockResponse = {
        data: {
          message: 'User registered successfully',
          user: userData
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await registerUser(userData);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:8000/api/users/register',
        expect.any(FormData)
      );
      expect(result).toEqual(mockResponse.data);
    });

    test('handles registration error', async () => {
      const errorMessage = 'Username already exists';
      mockedAxios.post.mockRejectedValue(new Error(errorMessage));

      await expect(registerUser({ username: 'existing' })).rejects.toThrow(errorMessage);
    });
  });

  describe('searchUsers', () => {
    test('searches users with filters', async () => {
      const searchCriteria = {
        keyword: 'John',
        gender: 'Male',
        ageMin: 25,
        ageMax: 35,
        location: 'New York'
      };

      const mockResponse = {
        data: {
          users: [
            { username: 'user1', firstName: 'John' },
            { username: 'user2', firstName: 'Johnny' }
          ],
          total: 2,
          page: 1,
          limit: 20
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await searchUsers(searchCriteria);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:8000/api/users/search',
        { params: searchCriteria }
      );
      expect(result).toEqual(mockResponse.data);
    });

    test('handles search error', async () => {
      const errorMessage = 'Search failed';
      mockedAxios.get.mockRejectedValue(new Error(errorMessage));

      await expect(searchUsers({ keyword: 'test' })).rejects.toThrow(errorMessage);
    });
  });

  describe('getUserProfile', () => {
    test('gets user profile', async () => {
      const mockResponse = {
        data: {
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          piiMasked: false
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await getUserProfile('testuser');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:8000/api/users/profile/testuser'
      );
      expect(result).toEqual(mockResponse.data);
    });

    test('gets profile with requester context', async () => {
      const mockResponse = {
        data: {
          username: 'testuser',
          firstName: 'Test',
          piiMasked: true
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await getUserProfile('testuser', 'requester');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:8000/api/users/profile/testuser',
        { params: { requester: 'requester' } }
      );
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('updateUserProfile', () => {
    test('updates user profile', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name'
      };

      const mockResponse = {
        data: {
          message: 'Profile updated successfully',
          user: { ...updateData, username: 'testuser' }
        }
      };

      mockedAxios.put.mockResolvedValue(mockResponse);

      const result = await updateUserProfile('testuser', updateData);

      expect(mockedAxios.put).toHaveBeenCalledWith(
        'http://localhost:8000/api/users/profile/testuser',
        expect.any(FormData)
      );
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('createAccessRequest', () => {
    test('creates access request', async () => {
      const requestData = {
        requester: 'user1',
        requested_user: 'user2',
        message: 'Please grant access'
      };

      const mockResponse = {
        data: {
          message: 'PII request sent successfully',
          requestId: 'req123'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await createAccessRequest(requestData);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:8000/api/users/access-request',
        expect.any(FormData)
      );
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getSavedSearches', () => {
    test('gets saved searches', async () => {
      const mockResponse = {
        data: {
          savedSearches: [
            { id: '1', name: 'Test Search', criteria: { keyword: 'test' } }
          ],
          count: 1
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await getSavedSearches('testuser');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:8000/api/users/testuser/saved-searches'
      );
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('addToFavorites', () => {
    test('adds user to favorites', async () => {
      const mockResponse = {
        data: {
          message: 'Added to favorites successfully'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await addToFavorites('targetuser');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:8000/api/users/favorites/targetuser',
        expect.any(FormData)
      );
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('sendMessage', () => {
    test('sends message', async () => {
      const messageData = {
        from_username: 'user1',
        to_username: 'user2',
        content: 'Hello!'
      };

      const mockResponse = {
        data: {
          message: 'Message sent successfully'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await sendMessage(messageData);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:8000/api/users/messages',
        expect.any(FormData)
      );
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getMessages', () => {
    test('gets messages for user', async () => {
      const mockResponse = {
        data: {
          messages: [
            {
              id: 'msg1',
              fromUsername: 'user1',
              toUsername: 'user2',
              content: 'Hello!',
              createdAt: '2023-01-01T00:00:00'
            }
          ]
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await getMessages('testuser');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:8000/api/users/messages/testuser'
      );
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('Error Handling', () => {
    test('handles network errors', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network Error'));

      await expect(getUserProfile('testuser')).rejects.toThrow('Network Error');
    });

    test('handles HTTP errors', async () => {
      const httpError = {
        response: {
          status: 404,
          data: { detail: 'User not found' }
        }
      };

      mockedAxios.get.mockRejectedValue(httpError);

      try {
        await getUserProfile('nonexistent');
      } catch (error) {
        expect(error.response.status).toBe(404);
        expect(error.response.data.detail).toBe('User not found');
      }
    });
  });

  describe('Authentication Headers', () => {
    test('includes auth token in requests', async () => {
      const mockResponse = { data: {} };
      mockedAxios.get.mockResolvedValue(mockResponse);

      await getUserProfile('testuser');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer fake-token'
          })
        })
      );
    });
  });
});
