import { request } from './client';
import type { User } from './types';

export const authApi = {
  me: (signal?: AbortSignal) => request<User>('/auth/me', { signal }),
  login: (email: string, password: string) =>
    request<User>('/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
};
