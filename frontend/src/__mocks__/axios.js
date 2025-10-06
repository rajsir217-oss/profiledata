// Axios mock for testing
const mockAxios = {
  create: jest.fn(() => mockAxios),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  interceptors: {
    request: {
      use: jest.fn(),
    },
    response: {
      use: jest.fn(),
    },
  },
  defaults: {
    baseURL: '',
    timeout: 0,
    headers: {},
  },
};

// Mock implementations
mockAxios.get.mockResolvedValue({ data: {} });
mockAxios.post.mockResolvedValue({ data: {} });
mockAxios.put.mockResolvedValue({ data: {} });
mockAxios.delete.mockResolvedValue({ data: {} });
mockAxios.patch.mockResolvedValue({ data: {} });
mockAxios.head.mockResolvedValue({ data: {} });
mockAxios.options.mockResolvedValue({ data: {} });

module.exports = mockAxios;
