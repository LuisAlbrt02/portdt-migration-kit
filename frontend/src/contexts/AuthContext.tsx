'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  usePathname,
  useRouter,
} from 'next/navigation';

import {
  AuthUser,
  authService,
} from '../services/AuthService';

type LoginResult = {
  success: boolean;
  error?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (
    username: string,
    password: string
  ) => Promise<LoginResult>;

  logout: () => void;
};

const AuthContext =
  createContext<AuthContextValue | undefined>(
    undefined
  );

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] =
    useState<AuthUser | null>(null);

  const [
    isAuthenticated,
    setIsAuthenticated,
  ] = useState(false);

  const [isLoading, setIsLoading] =
    useState(true);

  /*
   * Restore authentication state
   * when the application loads.
   */
  useEffect(() => {
    const token = authService.getToken();

    setIsAuthenticated(!!token);
    setIsLoading(false);
  }, []);

  /*
   * Protect all pages except /login.
   *
   * If there is no token, automatically
   * redirect the user to the login page.
   */
  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (
      !isAuthenticated &&
      pathname !== '/login'
    ) {
      router.replace('/login');
    }
  }, [
    isAuthenticated,
    isLoading,
    pathname,
    router,
  ]);

  const login = async (
    username: string,
    password: string
  ): Promise<LoginResult> => {
    try {
      await authService.login(
        username,
        password
      );

      setIsAuthenticated(true);

      return {
        success: true,
      };
    } catch (error) {
      setIsAuthenticated(false);
      setUser(null);

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Login failed',
      };
    }
  };

  const logout = () => {
    authService.logout();

    setUser(null);
    setIsAuthenticated(false);

    router.replace('/login');
  };

  const value = useMemo(
    () => ({
      user,
      isAuthenticated,
      isLoading,
      login,
      logout,
    }),
    [
      user,
      isAuthenticated,
      isLoading,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider'
    );
  }

  return context;
}