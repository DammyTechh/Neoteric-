'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  ApiError,
  apiDelete,
  apiGet,
  apiGetList,
  apiPatch,
  apiPost,
  apiPut,
  type RequestOptions,
} from './api';
import type { AdminUser, LoginResponse, PaginationMeta } from './types';

/**
 * Dashboard authentication.
 *
 * The access token is held in memory only. The refresh token is an httpOnly
 * cookie the backend sets, which is why nothing here reads `document.cookie`
 * and nothing is written to localStorage: a token in storage is readable by
 * any injected script, and an article body is rendered as HTML on this site.
 *
 * On a hard refresh the access token is gone, so the provider silently asks
 * the backend to mint a new one from the cookie before deciding whether the
 * person is signed in.
 */

interface AuthState {
  user: AdminUser | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<LoginResponse>;
  signOut: () => Promise<void>;
  refresh: () => Promise<string | null>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  /** Exchanges the refresh cookie for a new access token. */
  const refresh = useCallback(async (): Promise<string | null> => {
    try {
      const result = await apiPost<{ accessToken: string }>('/auth/refresh', {}, {
        credentials: 'include',
      });
      setToken(result.data.accessToken);
      return result.data.accessToken;
    } catch {
      setToken(null);
      setUser(null);
      return null;
    }
  }, []);

  // Restore the session on first mount, and on a hard refresh.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const fresh = await refresh();

      if (!fresh) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const me = await apiGet<AdminUser>('/auth/me', {
          token: fresh,
          credentials: 'include',
        });
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) setToken(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  /**
   * Keeps the token fresh while the tab is open.
   *
   * Access tokens last 15 minutes; refreshing at 12 means an editor midway
   * through a long article never hits a 401 on save.
   */
  useEffect(() => {
    if (!token) return;
    const timer = setInterval(() => void refresh(), 12 * 60 * 1000);
    return () => clearInterval(timer);
  }, [token, refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await apiPost<LoginResponse>(
      '/auth/login',
      { email, password },
      { credentials: 'include' },
    );

    setToken(result.data.accessToken);
    setUser(result.data.user);
    return result.data;
  }, []);

  const signOut = useCallback(async () => {
    await apiPost('/auth/logout', {}, { credentials: 'include' }).catch(() => undefined);
    setToken(null);
    setUser(null);
    router.push('/admin/login');
  }, [router]);

  const value = useMemo(
    () => ({ user, token, loading, signIn, signOut, refresh }),
    [user, token, loading, signIn, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

/**
 * An authenticated API client that retries once after refreshing.
 *
 * A token can expire between render and click; retrying once turns what would
 * be a spurious "please sign in again" into something the editor never sees.
 * Every dashboard call goes through here, so the retry is written once rather
 * than remembered at forty call sites.
 */
export function useApi() {
  const { token, refresh, signOut } = useAuth();

  /** Runs `attempt`, and on a 401 refreshes and runs it once more. */
  const authed = useCallback(
    async <T,>(attempt: (bearer: string | null) => Promise<T>): Promise<T> => {
      try {
        return await attempt(token);
      } catch (error) {
        if (error instanceof ApiError && error.isAuthError) {
          const fresh = await refresh();
          if (fresh) return attempt(fresh);
          await signOut();
        }
        throw error;
      }
    },
    [token, refresh, signOut],
  );

  return useMemo(() => {
    const base = (bearer: string | null): RequestOptions => ({
      token: bearer,
      credentials: 'include',
      // The dashboard must never read a cached page: an editor who just saved
      // and navigated back needs to see what they saved.
      cache: 'no-store',
    });

    return {
      /** GET, unwrapping to `data`. */
      get: <T,>(path: string, params?: RequestOptions['params']) =>
        authed<T>((bearer) => apiGet<T>(path, { ...base(bearer), params })),

      /** GET a paginated collection, keeping `meta`. */
      list: <T,>(path: string, params?: RequestOptions['params']) =>
        authed<{ items: T[]; meta: PaginationMeta }>((bearer) =>
          apiGetList<T>(path, { ...base(bearer), params }),
        ),

      post: <T,>(path: string, body?: unknown) =>
        authed<T>(async (bearer) => (await apiPost<T>(path, body, base(bearer))).data),

      patch: <T,>(path: string, body?: unknown) =>
        authed<T>(async (bearer) => (await apiPatch<T>(path, body, base(bearer))).data),

      put: <T,>(path: string, body?: unknown) =>
        authed<T>(async (bearer) => (await apiPut<T>(path, body, base(bearer))).data),

      remove: <T,>(path: string) =>
        authed<T>(async (bearer) => (await apiDelete<T>(path, base(bearer))).data),

      /**
       * POSTs multipart form data.
       *
       * `apiRequest` detects FormData and leaves Content-Type unset so the
       * browser can supply its own multipart boundary.
       */
      upload: <T,>(path: string, form: FormData) =>
        authed<T>(async (bearer) => (await apiPost<T>(path, form, base(bearer))).data),
    };
  }, [authed]);
}
