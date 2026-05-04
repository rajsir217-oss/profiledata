/**
 * Web fallback for @react-native-async-storage/async-storage.
 * Uses localStorage on web.
 */

const AsyncStorage = {
  getItem: async (key) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  setItem: async (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      // ignore
    }
  },
  removeItem: async (key) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      // ignore
    }
  },
  multiGet: async (keys) => {
    return keys.map((key) => [key, localStorage.getItem(key)]);
  },
  multiSet: async (pairs) => {
    pairs.forEach(([key, value]) => localStorage.setItem(key, value));
  },
  multiRemove: async (keys) => {
    keys.forEach((key) => localStorage.removeItem(key));
  },
  clear: async () => {
    localStorage.clear();
  },
  getAllKeys: async () => {
    return Object.keys(localStorage);
  },
};

export default AsyncStorage;
