import axios, { type AxiosInstance } from 'axios';
import type { TokenStorage } from '../ports';
import type { ApiError } from '../errors';
import { toApiError } from './ApiError';

export interface ApiClientOptions {
  baseURL: string;
  tokens: TokenStorage;
  /** Se llama cuando la API responde 401 a una petición autenticada (sesión vencida, tablet revocada…). */
  onUnauthorized?: (error: ApiError) => void;
}

/** Axios con el token en cada petición y errores normalizados a ApiError. */
export function createApiClient({ baseURL, tokens, onUnauthorized }: ApiClientOptions): AxiosInstance {
  const client = axios.create({ baseURL, timeout: 15_000 });

  client.interceptors.request.use((config) => {
    const token = tokens.get();
    if (token) config.headers.set('Authorization', `Bearer ${token}`);
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      const apiError = toApiError(error);
      const sentToken = axios.isAxiosError(error) && Boolean(error.config?.headers?.Authorization);
      if (apiError.status === 401 && sentToken) onUnauthorized?.(apiError);
      return Promise.reject(apiError);
    },
  );

  return client;
}
