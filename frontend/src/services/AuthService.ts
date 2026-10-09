const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:5001';

const ACCESS_TOKEN_KEY = 'access_token';
const TOKEN_TYPE_KEY = 'token_type';

export interface AuthUser {
  email?: string;
  username?: string;
  name?: string;
  roles?: string[];
  [key: string]: unknown;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

class AuthService {
  getToken(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    return localStorage.getItem(
      ACCESS_TOKEN_KEY
    );
  }

  getTokenType(): string {
    if (typeof window === 'undefined') {
      return 'bearer';
    }

    return (
      localStorage.getItem(
        TOKEN_TYPE_KEY
      ) || 'bearer'
    );
  }

  setSession(
    accessToken: string,
    tokenType: string
  ): void {
    localStorage.setItem(
      ACCESS_TOKEN_KEY,
      accessToken
    );

    localStorage.setItem(
      TOKEN_TYPE_KEY,
      tokenType
    );
  }

  clearSession(): void {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.removeItem(
      ACCESS_TOKEN_KEY
    );

    localStorage.removeItem(
      TOKEN_TYPE_KEY
    );
  }

  async login(
    username: string,
    password: string
  ): Promise<LoginResponse> {
    const response = await fetch(
      `${BACKEND_URL}/api/auth/login`,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
          Accept: 'application/json',
        },

        body: JSON.stringify({
          username,
          password,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        typeof data?.error === 'string'
          ? data.error
          : 'Login failed'
      );
    }

    if (!data.access_token) {
      throw new Error(
        'No access token returned by backend'
      );
    }

    const tokenType =
      data.token_type || 'bearer';

    this.setSession(
      data.access_token,
      tokenType
    );

    return {
      access_token:
        data.access_token,
      token_type: tokenType,
    };
  }

  logout(): void {
    this.clearSession();
  }
}

export const authService =
  new AuthService();