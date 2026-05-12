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
const INTRO_CARD_KEY = '@l3v3l_messenger_intro_card';

const INTRO_CARD_TTL_MS = 30 * 60 * 1000;

const calcAge = (dob, birthYear, birthMonth) => {
  let d = null;
  if (dob) {
    const parsed = new Date(dob);
    if (!Number.isNaN(parsed.getTime())) d = parsed;
  } else if (birthYear) {
    const m = Number(birthMonth) || 1;
    const y = Number(birthYear);
    if (y > 1900 && y < 2200) d = new Date(Date.UTC(y, m - 1, 1));
  }
  if (!d) return null;
  const diff = Date.now() - d.getTime();
  const age = new Date(diff).getUTCFullYear() - 1970;
  return age > 0 && age < 130 ? age : null;
};

const buildImageUrl = (path, token) => {
  if (!path) return null;
  const fullUrl = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  if (token && !fullUrl.includes('token=')) {
    const sep = fullUrl.includes('?') ? '&' : '?';
    return `${fullUrl}${sep}token=${encodeURIComponent(token)}`;
  }
  return fullUrl;
};

const buildIntroductionCardSnapshot = (profile, token, fallbackUsername) => {
  const p = profile || {};
  const username = p.username || fallbackUsername;
  const fullName = `${p.firstName || ''} ${p.lastName || ''}`.trim() || username;
  const rawDob = p.dob || p.dateOfBirth || null;
  const age = calcAge(rawDob, p.birthYear, p.birthMonth);
  let dobLabel = null;
  if (rawDob) {
    const parsed = new Date(rawDob);
    if (!Number.isNaN(parsed.getTime())) {
      dobLabel = parsed.toLocaleDateString('en-US', { month: '2-digit', year: 'numeric' });
    }
  } else if (p.birthMonth && p.birthYear) {
    dobLabel = `${String(p.birthMonth).padStart(2, '0')}/${p.birthYear}`;
  }

  const avatarPath = p.imageVisibility?.profilePic || p.images?.[0] || p.profileImage || null;

  let heightLabel = null;
  if (p.height && String(p.height).trim()) {
    heightLabel = String(p.height).trim();
  } else if (p.heightFeet) {
    const inches = Number(p.heightInches) || 0;
    heightLabel = `${p.heightFeet}'${inches}"`;
  } else if (p.heightInches && Number(p.heightInches) > 11) {
    const total = Number(p.heightInches);
    heightLabel = `${Math.floor(total / 12)}'${total % 12}"`;
  }

  const message = (() => {
    const g = String(p.gender || '').trim().toLowerCase();
    if (g === 'male' || g === 'm' || g === 'man') {
      return 'Looking for a suitable bride for our son — please review the profile for details and Contact me. Thanks';
    }
    if (g === 'female' || g === 'f' || g === 'woman') {
      return 'Looking for a suitable groom for our daughter — please review the profile for details and Contact me. Thanks';
    }
    return 'Looking for a suitable match — please review the profile for details and Contact me. Thanks';
  })();

  return {
    username,
    fullName,
    avatarUrl: buildImageUrl(avatarPath, token),
    age,
    dob: rawDob,
    dobLabel,
    height: heightLabel,
    location: p.location || p.currentLocation || null,
    educationHistory: Array.isArray(p.educationHistory) ? p.educationHistory : [],
    workExperience: Array.isArray(p.workExperience) ? p.workExperience : [],
    message,
  };
};

const useAuthStore = create((set, get) => ({
  token: null,
  user: null,       // { username, firstName, lastName, role, ... }
  isLoading: true,  // true while restoring session from storage
  error: null,

  introCardSnapshot: null,
  introCardFetchedAt: null,

  /**
   * Restore persisted session on app launch.
   */
  restore: async () => {
    try {
      const [token, userJson, introCardJson] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY),
        AsyncStorage.getItem(INTRO_CARD_KEY),
      ]);
      if (token && userJson) {
        const user = JSON.parse(userJson);
        let introCardSnapshot = null;
        let introCardFetchedAt = null;
        if (introCardJson) {
          try {
            const parsed = JSON.parse(introCardJson);
            introCardSnapshot = parsed?.snapshot || null;
            introCardFetchedAt = parsed?.fetchedAt || null;
          } catch (_) {}
        }
        set({ token, user, introCardSnapshot, introCardFetchedAt, isLoading: false, error: null });
        get().prefetchIntroCard({ force: false });
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
      get().prefetchIntroCard({ force: false });

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
   *
   * Returns:
   *   { ok: true }                                                — logged in
   *   { ok: false, mfaRequired: true, mfa_channel, contact_masked } — MFA needed
   *   { ok: false, error: <msg> }                                 — failed
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

      set({ token: access_token, user, isLoading: false, error: null });
      try {
        await Promise.all([
          AsyncStorage.setItem(TOKEN_KEY, access_token),
          AsyncStorage.setItem(USER_KEY, JSON.stringify(user)),
        ]);
      } catch (_) {}
      get().prefetchIntroCard({ force: true });
      return { ok: true };
    } catch (e) {
      // Detect MFA_REQUIRED: backend returns 403 with detail "MFA_REQUIRED"
      // and metadata (mfa_channel, contact_masked). Surface that to the UI
      // so it can transition to the OTP entry screen.
      const status = e.response?.status;
      const rawData = e.response?.data;
      let data = rawData || {};
      if (typeof rawData === 'string') {
        try {
          data = JSON.parse(rawData);
        } catch (_) {
          data = { detail: rawData };
        }
      }
      if (status === 403 && data.detail === 'MFA_REQUIRED') {
        set({ isLoading: false, error: null });
        return {
          ok: false,
          mfaRequired: true,
          mfa_channel: data.mfa_channel || 'email',
          contact_masked: data.contact_masked || '',
        };
      }

      const msg = data.detail || data.message || `Login failed (${status || 'unknown'}).`;
      set({ error: msg, isLoading: false });
      return { ok: false, error: msg };
    }
  },

  /**
   * Logout — clear everything.
   */
  logout: async () => {
    await Promise.all([
      AsyncStorage.removeItem(TOKEN_KEY),
      AsyncStorage.removeItem(USER_KEY),
      AsyncStorage.removeItem(INTRO_CARD_KEY),
    ]);
    set({ token: null, user: null, error: null, introCardSnapshot: null, introCardFetchedAt: null });
  },

  prefetchIntroCard: async ({ force = false } = {}) => {
    const { token, user, introCardSnapshot, introCardFetchedAt } = get();
    if (!token || !user?.username) return null;

    if (!force && introCardSnapshot && introCardFetchedAt) {
      const ageMs = Date.now() - Number(introCardFetchedAt);
      if (Number.isFinite(ageMs) && ageMs >= 0 && ageMs < INTRO_CARD_TTL_MS) {
        return introCardSnapshot;
      }
    }

    try {
      const api = get().getApi();
      const profRes = await api.get(`/api/users/profile/${user.username}?requester=${user.username}`);
      const profile = profRes.data?.user || profRes.data || {};
      const snapshot = buildIntroductionCardSnapshot(profile, token, user.username);
      const fetchedAt = Date.now();

      set({ introCardSnapshot: snapshot, introCardFetchedAt: fetchedAt });
      await AsyncStorage.setItem(INTRO_CARD_KEY, JSON.stringify({ snapshot, fetchedAt }));
      return snapshot;
    } catch (_) {
      return null;
    }
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
