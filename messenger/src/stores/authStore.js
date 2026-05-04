/**
 * Auth Store — Zustand store for authentication state.
 * Persists JWT token + user info to AsyncStorage.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const TOKEN_KEY = '@l3v3l_messenger_token';
const USER_KEY = '@l3v3l_messenger_user';

const useAuthStore = create((set, get) => ({
  token: null,
  user: null,       // { username, firstName, lastName, role, ... }
  isLoading: true,  // true while restoring session from storage
  error: null,

  /**
   * Restore persisted session on app launch.
   */
  restore: async () => {
    try {
      const [token, userJson] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY),
      ]);
      if (token && userJson) {
        const user = JSON.parse(userJson);
        set({ token, user, isLoading: false, error: null });
      } else {
        set({ isLoading: false });
      }
    } catch (e) {
      set({ isLoading: false });
    }
  },

  /**
   * Login with existing L3V3L MATCHES credentials.
   */
  login: async (username, password, captchaToken = null, mfaCode = null) => {
    set({ error: null, isLoading: true });
    try {
      const payload = {
        username: (username || '').trim(),
        password: (password || '').trim(),
      };
      if (captchaToken) {
        payload.captchaToken = captchaToken;
      }
      if (mfaCode) {
        payload.mfa_code = mfaCode;
      }
      const res = await axios.post(`${API_BASE_URL}/api/auth/login`, payload);

      const { access_token, user } = res.data;
      if (!access_token) throw new Error('No token received');

      await Promise.all([
        AsyncStorage.setItem(TOKEN_KEY, access_token),
        AsyncStorage.setItem(USER_KEY, JSON.stringify(user)),
      ]);

      set({ token: access_token, user, isLoading: false, error: null });
      return true;
    } catch (e) {
      const msg =
        e.response?.data?.detail ||
        e.response?.data?.message ||
        'Login failed. Check your credentials.';
      set({ error: msg, isLoading: false });
      return false;
    }
  },

  /**
   * Logout — clear everything.
   */
  logout: async () => {
    await Promise.all([
      AsyncStorage.removeItem(TOKEN_KEY),
      AsyncStorage.removeItem(USER_KEY),
    ]);
    set({ token: null, user: null, error: null });
  },

  /**
   * Get an Axios instance with the auth header pre-set.
   */
  getApi: () => {
    const { token } = get();
    return axios.create({
      baseURL: API_BASE_URL,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
}));

export default useAuthStore;
