import apiClient from './apiClient';

export type LoginResponse = {
  access_token: string;
  token_type: string;
};

export async function login(
  username: string,
  password: string
): Promise<LoginResponse> {
  const params = new URLSearchParams();

  params.append('grant_type', 'password');
  params.append('username', username);
  params.append('password', password);
  params.append('scope', '');

  const response = await apiClient.post<LoginResponse>(
    '/auth/login',
    params.toString(),
    {
      headers: {
        'Content-Type':
          'application/x-www-form-urlencoded',
      },
    }
  );

  return response.data;
}