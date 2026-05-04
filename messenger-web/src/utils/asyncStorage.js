// Web-compatible AsyncStorage shim using localStorage
// This replaces @react-native-async-storage/async-storage for web builds

const STORAGE_PREFIX = '@l3v3l_messenger_';

const AsyncStorage = {
  async getItem(key) {
    try {
      const value = localStorage.getItem(STORAGE_PREFIX + key);
      return value ? JSON.parse(value) : null;
    } catch (e) {
      console.error('AsyncStorage.getItem error:', e);
      return null;
    }
  },

  async setItem(key, value) {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
      return null;
    } catch (e) {
      console.error('AsyncStorage.setItem error:', e);
      return e;
    }
  },

  async removeItem(key) {
    try {
      localStorage.removeItem(STORAGE_PREFIX + key);
      return null;
    } catch (e) {
      console.error('AsyncStorage.removeItem error:', e);
      return e;
    }
  },

  async clear() {
    try {
      // Only clear keys with our prefix
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith(STORAGE_PREFIX)) {
          localStorage.removeItem(key);
        }
      }
      return null;
    } catch (e) {
      console.error('AsyncStorage.clear error:', e);
      return e;
    }
  },

  async getAllKeys() {
    try {
      const keys = Object.keys(localStorage);
      return keys.filter(key => key.startsWith(STORAGE_PREFIX)).map(key => key.replace(STORAGE_PREFIX, ''));
    } catch (e) {
      console.error('AsyncStorage.getAllKeys error:', e);
      return [];
    }
  },
};

export default AsyncStorage;
