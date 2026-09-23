import axios from 'axios';

import { clearToken, getToken } from './token-storage';

/**
 * The axios instance every generated API class is bound to.
 *
 * The base URL comes from the environment so the same build can point at a local
 * API or the deployed one. Every path the generated client produces already
 * carries the `/api` global prefix, so the base URL must NOT repeat it.
 */
export const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3333',
  headers: {
    'Content-Type': 'application/json',
  },
});

/** Called when the API rejects the token, so the app can return to sign-in. */
let onUnauthorized: (() => void) | null = null;

/**
 * Registers the callback the 401 handler invokes.
 *
 * A callback rather than an import, so this module stays free of React and can be
 * imported by the generated client without a cycle.
 * @param handler What to run when a request comes back 401.
 */
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

// Attach the bearer token. Read per request rather than captured once, so a fresh
// sign-in takes effect without rebuilding the instance.
axiosInstance.interceptors.request.use((config) => {
  const token = getToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    // A 401 means the token is missing, expired, or revoked — the API's denylist
    // makes the last case real, so the token cannot be trusted again.
    if (error.response?.status === 401) {
      clearToken();
      onUnauthorized?.();
    }

    return Promise.reject(error);
  },
);
