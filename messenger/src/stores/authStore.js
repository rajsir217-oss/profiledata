/**
 * Auth Store — Zustand store for authentication state.
 * Persists JWT token + user info to AsyncStorage.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const TOKEN_KEY = '@l3v3l_messenger_token';
const REFRESH_TOKEN_KEY = '@l3v3l_messenger_refresh_token';
const USER_KEY = '@l3v3l_messenger_user';
const INTRO_CARD_KEY = '@l3v3l_messenger_intro_card';

const INTRO_CARD_TTL_MS = 30 * 60 * 1000;

let keepAliveIntervalId = null;
let refreshInFlight = null;

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
  const rawGender = p.gender || p.sex || null;
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
    const g = String(rawGender || '').trim().toLowerCase();
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
    gender: rawGender,
    location: p.location || p.currentLocation || null,
    educationHistory: Array.isArray(p.educationHistory) ? p.educationHistory : [],
    workExperience: Array.isArray(p.workExperience) ? p.workExperience : [],
    message,
  };
};

const normalizeErrorText = (value, fallback) => {
  if (!value) return fallback;
  if (typeof value === 'string') return value;

  if (Array.isArray(value)) {
    const messages = value
      .map((item) => {
        if (!item) return null;
        if (typeof item === 'string') return item;
        if (typeof item?.msg === 'string') {
          const field = Array.isArray(item?.loc) ? item.loc[item.loc.length - 1] : null;
          return field ? `${field}: ${item.msg}` : item.msg;
        }
        if (typeof item?.message === 'string') return item.message;
        if (typeof item?.detail === 'string') return item.detail;
        return null;
      })
      .filter(Boolean);

    return messages.length ? messages.join(' ') : fallback;
  }

  if (typeof value === 'object') {
    if (typeof value?.msg === 'string') return value.msg;
    if (typeof value?.message === 'string') return value.message;
    if (typeof value?.detail === 'string') return value.detail;
  }

  return fallback;
};

const resolveApiErrorMessage = (data, fallback) => {
  const fromDetail = normalizeErrorText(data?.detail, null);
  if (fromDetail) return fromDetail;
  const fromMessage = normalizeErrorText(data?.message, null);
  if (fromMessage) return fromMessage;
  return fallback;
};

const normalizePhoneRequest = (phone) => {
  const raw = (typeof phone === 'string' ? phone : String(phone ?? '')).trim();
  const digits = raw.replace(/\D/g, '');
  return { raw, digits };
};

const normalizeUsernameRequest = (selectedUsername) => {
  if (typeof selectedUsername !== 'string') return '';
  return selectedUsername.trim();
};

const normalizeCodeRequest = (code) => {
  const raw = (typeof code === 'string' ? code : String(code ?? '')).trim();
  const digits = raw.replace(/\D/g, '');
  return { raw, digits };
};

const useAuthStore = create((set, get) => ({
  token: null,
  refreshToken: null,
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
      const [token, refreshToken, userJson, introCardJson] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(REFRESH_TOKEN_KEY),
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
        set({ token, refreshToken, user, introCardSnapshot, introCardFetchedAt, isLoading: false, error: null });
        get().startKeepAlive();
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
    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get('token');
    if (!ssoToken) return false;

    const stripUrlToken = () => {
      try {
        const cleanUrl = window.location.origin + window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
      } catch (_) { /* noop */ }
    };

    try {
      // Validate token + fetch user via /api/auth/me
      const res = await axios.get(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${ssoToken}` },
      });
      const user = res.data?.user || res.data;
      if (!user || !user.username) {
        console.warn('🔒 SSO failed: invalid /me response');
        stripUrlToken();
        return false;
      }

      await Promise.all([
        AsyncStorage.setItem(TOKEN_KEY, ssoToken),
        AsyncStorage.setItem(USER_KEY, JSON.stringify(user)),
      ]);

      set({ token: ssoToken, refreshToken: null, user, isLoading: false, error: null });
      get().startKeepAlive();
      get().prefetchIntroCard({ force: false });

      // Strip the token from the URL — security & cleanliness.
      stripUrlToken();

      console.log('✅ Messenger SSO succeeded for', user.username);
      return true;
    } catch (e) {
      console.warn('🔒 SSO failed:', e?.response?.status || e?.message);
      stripUrlToken();
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

      const { access_token, refresh_token, user } = res.data;
      if (!access_token) throw new Error('No token received');

      set({ token: access_token, refreshToken: refresh_token || null, user, isLoading: false, error: null });
      try {
        await Promise.all([
          AsyncStorage.setItem(TOKEN_KEY, access_token),
          refresh_token ? AsyncStorage.setItem(REFRESH_TOKEN_KEY, refresh_token) : AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
          AsyncStorage.setItem(USER_KEY, JSON.stringify(user)),
        ]);
      } catch (_) {}
      get().startKeepAlive();
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

      const msg = resolveApiErrorMessage(data, `Login failed (${status || 'unknown'}).`);
      set({ error: msg, isLoading: false });
      return { ok: false, error: msg };
    }
  },

  sendPhoneLoginCode: async (phone, captchaToken = null, selectedUsername = null) => {
    set({ error: null, isLoading: true });
    try {
      const { raw: rawPhone, digits: phoneDigits } = normalizePhoneRequest(phone);
      if (phoneDigits.length < 10 || phoneDigits.length > 15) {
        const msg = 'Phone number must be 10-15 digits.';
        set({ isLoading: false, error: msg });
        return { ok: false, error: msg };
      }

      const payload = { phone: rawPhone || phoneDigits };
      if (captchaToken) {
        payload.captchaToken = captchaToken;
      }
      const selectedUsernameValue = normalizeUsernameRequest(selectedUsername);
      if (selectedUsernameValue) {
        payload.selected_username = selectedUsernameValue;
      }

      const res = await axios.post(`${API_BASE_URL}/api/auth/login/phone/send-code`, payload);
      const data = res.data || {};

      if (data?.requires_account_selection) {
        set({ isLoading: false, error: null });
        return {
          ok: false,
          requiresAccountSelection: true,
          accounts: Array.isArray(data.accounts) ? data.accounts : [],
          message: data.message || 'Select your account to continue.',
        };
      }

      set({ isLoading: false, error: null });

      return {
        ok: true,
        message: data?.message,
        contact_masked: data?.contact_masked || '',
        expires_at: data?.expires_at || null,
        mock_code: data?.mock_code || null,
        selected_username: data?.selected_username || selectedUsernameValue || null,
      };
    } catch (e) {
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

      if (
        data?.requires_account_selection ||
        (status === 409 && data.detail === 'MULTIPLE_ACCOUNTS_FOR_PHONE')
      ) {
        set({ isLoading: false, error: null });
        return {
          ok: false,
          requiresAccountSelection: true,
          accounts: Array.isArray(data.accounts) ? data.accounts : [],
          message: data.message || 'Select your account to continue.',
        };
      }

      const msg = resolveApiErrorMessage(data, `Failed to send login code (${status || 'unknown'}).`);
      set({ isLoading: false, error: msg });
      return { ok: false, error: msg };
    }
  },

  verifyPhoneLoginCode: async (phone, code, selectedUsername = null) => {
    set({ error: null, isLoading: true });
    try {
      const { raw: rawPhone, digits: phoneDigits } = normalizePhoneRequest(phone);
      if (phoneDigits.length < 10 || phoneDigits.length > 15) {
        const msg = 'Phone number must be 10-15 digits.';
        set({ isLoading: false, error: msg });
        return { ok: false, error: msg };
      }

      const { digits: codeDigits } = normalizeCodeRequest(code);
      if (codeDigits.length !== 6) {
        const msg = 'Verification code must be 6 digits.';
        set({ isLoading: false, error: msg });
        return { ok: false, error: msg };
      }

      const payload = {
        phone: rawPhone || phoneDigits,
        code: codeDigits,
      };
      const selectedUsernameValue = normalizeUsernameRequest(selectedUsername);
      if (selectedUsernameValue) {
        payload.selected_username = selectedUsernameValue;
      }

      const res = await axios.post(`${API_BASE_URL}/api/auth/login/phone/verify-code`, payload);
      const responseData = res.data || {};
      if (responseData?.requires_account_selection) {
        set({ isLoading: false, error: null });
        return {
          ok: false,
          requiresAccountSelection: true,
          accounts: Array.isArray(responseData.accounts) ? responseData.accounts : [],
          message: responseData.message || 'Select your account to continue.',
        };
      }

      const { access_token, refresh_token, user } = responseData;
      if (!access_token) throw new Error('No token received');

      set({ token: access_token, refreshToken: refresh_token || null, user, isLoading: false, error: null });
      try {
        await Promise.all([
          AsyncStorage.setItem(TOKEN_KEY, access_token),
          refresh_token ? AsyncStorage.setItem(REFRESH_TOKEN_KEY, refresh_token) : AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
          AsyncStorage.setItem(USER_KEY, JSON.stringify(user)),
        ]);
      } catch (_) {}

      get().startKeepAlive();
      get().prefetchIntroCard({ force: true });
      return { ok: true, user };
    } catch (e) {
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

      if (
        data?.requires_account_selection ||
        (status === 409 && data.detail === 'MULTIPLE_ACCOUNTS_FOR_PHONE')
      ) {
        set({ isLoading: false, error: null });
        return {
          ok: false,
          requiresAccountSelection: true,
          accounts: Array.isArray(data.accounts) ? data.accounts : [],
          message: data.message || 'Select your account to continue.',
        };
      }

      const msg = resolveApiErrorMessage(data, `Verification failed (${status || 'unknown'}).`);
      set({ isLoading: false, error: msg });
      return { ok: false, error: msg };
    }
  },

  loginWithRefreshToken: async (refreshTokenOverride = null) => {
    set({ error: null, isLoading: true });
    try {
      const refreshToken =
        refreshTokenOverride ||
        get().refreshToken ||
        (await AsyncStorage.getItem(REFRESH_TOKEN_KEY));

      if (!refreshToken) {
        set({ isLoading: false, error: 'No saved session found. Please log in with password.' });
        return { ok: false, error: 'No saved session found. Please log in with password.' };
      }

      const refreshRes = await axios.post(`${API_BASE_URL}/api/auth/refresh-token`, {
        refresh_token: refreshToken,
      });

      const accessToken = refreshRes.data?.access_token;
      if (!accessToken) {
        set({ isLoading: false, error: 'Failed to refresh session. Please log in again.' });
        return { ok: false, error: 'Failed to refresh session. Please log in again.' };
      }

      const meRes = await axios.get(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const user = meRes.data?.user || meRes.data;

      if (!user || !user.username) {
        set({ isLoading: false, error: 'Failed to load user session. Please log in again.' });
        return { ok: false, error: 'Failed to load user session. Please log in again.' };
      }

      set({ token: accessToken, refreshToken, user, isLoading: false, error: null });
      try {
        await Promise.all([
          AsyncStorage.setItem(TOKEN_KEY, accessToken),
          AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken),
          AsyncStorage.setItem(USER_KEY, JSON.stringify(user)),
        ]);
      } catch (_) {}

      get().startKeepAlive();
      get().prefetchIntroCard({ force: false });

      return { ok: true };
    } catch (e) {
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
      const msg =
        status === 401
          ? 'Saved session expired. Please log in with password.'
          : resolveApiErrorMessage(data, e.message || 'Session refresh failed.');

      set({ isLoading: false, error: msg });
      return { ok: false, error: msg };
    }
  },

  /**
   * Logout — clear everything.
   */
  logout: async () => {
    get().stopKeepAlive();
    await Promise.all([
      AsyncStorage.removeItem(TOKEN_KEY),
      AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
      AsyncStorage.removeItem(USER_KEY),
      AsyncStorage.removeItem(INTRO_CARD_KEY),
    ]);
    set({ token: null, refreshToken: null, user: null, error: null, introCardSnapshot: null, introCardFetchedAt: null });
  },

  startKeepAlive: () => {
    if (keepAliveIntervalId) return;
    keepAliveIntervalId = setInterval(async () => {
      try {
        await get().refreshAccessToken();
      } catch (_) {}
    }, 5 * 60 * 1000);
  },

  stopKeepAlive: () => {
    if (keepAliveIntervalId) {
      clearInterval(keepAliveIntervalId);
      keepAliveIntervalId = null;
    }
  },

  refreshAccessToken: async () => {
    const refreshToken = get().refreshToken || (await AsyncStorage.getItem(REFRESH_TOKEN_KEY));
    if (!refreshToken) return null;

    if (refreshInFlight) {
      return refreshInFlight;
    }

    refreshInFlight = (async () => {
      const res = await axios.post(`${API_BASE_URL}/api/auth/refresh-token`, {
        refresh_token: refreshToken,
      });

      const newAccessToken = res.data?.access_token;
      if (!newAccessToken) return null;

      set({ token: newAccessToken, refreshToken, error: null });
      try {
        await AsyncStorage.setItem(TOKEN_KEY, newAccessToken);
        await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      } catch (_) {}
      return newAccessToken;
    })();

    try {
      return await refreshInFlight;
    } finally {
      refreshInFlight = null;
    }
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
      const profileGender = profile.gender || profile.sex || null;
      const snapshot = buildIntroductionCardSnapshot(profile, token, user.username);
      const fetchedAt = Date.now();

      if (profileGender && !user?.gender) {
        const nextUser = { ...(user || {}), gender: profileGender };
        set({ user: nextUser });
        try {
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(nextUser));
        } catch (_) {}
      }

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
        const originalRequest = error?.config;
        // Only treat 401 from authenticated calls as session expiry.
        // (Login endpoint failures are wrong-creds and use raw axios, not this instance.)
        if (status === 401 && get().token) {
          if (originalRequest && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
              const newToken = await get().refreshAccessToken();
              if (newToken) {
                originalRequest.headers = {
                  ...(originalRequest.headers || {}),
                  Authorization: `Bearer ${newToken}`,
                };
                return instance.request(originalRequest);
              }
            } catch (_) {}
          }

          console.warn('🔒 Session expired (401). Logging out and returning to login.');
          try {
            await Promise.all([
              AsyncStorage.removeItem(TOKEN_KEY),
              AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
              AsyncStorage.removeItem(USER_KEY),
            ]);
          } catch (_) {}
          get().stopKeepAlive();
          set({
            token: null,
            refreshToken: null,
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
