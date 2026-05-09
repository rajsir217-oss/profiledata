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
   * Single Sign-On from main app via URL params.
   * The main app opens messenger with `?token=...&u=username`.
   * We validate the token by fetching /api/auth/me, persist on success,
   * and remove the token from the URL so it doesn't leak via history/bookmarks.
   *
   * Returns true if SSO succeeded (caller can skip login screen).
   */
  ssoFromUrl: async () => {
    if (typeof window === 'undefined' || !window.location) return false;
    try {
      const params = new URLSearchParams(window.location.search);
      const ssoToken = params.get('token');
      if (!ssoToken) return false;

      // Validate token + fetch user via /api/auth/me
      const res = await axios.get(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${ssoToken}` },
      });
      const user = res.data?.user || res.data;
      if (!user || !user.username) {
        console.warn('🔒 SSO failed: invalid /me response');
        return false;
      }

      await Promise.all([
        AsyncStorage.setItem(TOKEN_KEY, ssoToken),
        AsyncStorage.setItem(USER_KEY, JSON.stringify(user)),
      ]);

      set({ token: ssoToken, user, isLoading: false, error: null });

      // Strip the token from the URL — security & cleanliness.
      try {
        const cleanUrl = window.location.origin + window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
      } catch (_) { /* noop */ }

      console.log('✅ Messenger SSO succeeded for', user.username);
      return true;
    } catch (e) {
      console.warn('🔒 SSO failed:', e?.response?.status || e?.message);
      // Fall through — user will see login screen.
      return false;
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
   * Includes a response interceptor that auto-logs-out on 401
   * (expired/invalid token) so the app falls back to LoginScreen.
   */
  getApi: () => {
    const { token } = get();
    const instance = axios.create({
      baseURL: API_BASE_URL,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const status = error?.response?.status;
        // Only treat 401 from authenticated calls as session expiry.
        // (Login endpoint failures are wrong-creds and use raw axios, not this instance.)
        if (status === 401 && get().token) {
          console.warn('🔒 Session expired (401). Logging out and returning to login.');
          try {
            await Promise.all([
              AsyncStorage.removeItem(TOKEN_KEY),
              AsyncStorage.removeItem(USER_KEY),
            ]);
          } catch (_) {}
          set({
            token: null,
            user: null,
            error: 'Your session has expired. Please log in again.',
          });
        }
        return Promise.reject(error);
      }
    );

    return instance;
  },
}));

export default useAuthStore;
