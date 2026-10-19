import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { AxiosError } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryTokens } from '@/testing/fakeServices';
import { ApiError } from '../errors';
import { createApiClient } from './apiClient';

function reply(status: number, data: unknown): AxiosAdapter {
  return async (config: InternalAxiosRequestConfig) => {
    const response = { status, data, statusText: '', headers: {}, config };
    if (status >= 400) throw new AxiosError('fail', String(status), config, null, response);
    return response;
  };
}

describe('createApiClient', () => {
  it('envía el token guardado en Authorization', async () => {
    const client = createApiClient({ baseURL: '/api', tokens: createMemoryTokens('abc') });
    let sent: string | undefined;
    client.defaults.adapter = async (config) => {
      sent = config.headers.get('Authorization') as string;
      return { status: 200, data: {}, statusText: '', headers: {}, config };
    };
    await client.get('/x');
    expect(sent).toBe('Bearer abc');
  });

  it('convierte el error de la API en ApiError con code, message y fieldErrors', async () => {
    const client = createApiClient({ baseURL: '/api', tokens: createMemoryTokens() });
    client.defaults.adapter = reply(400, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Datos inválidos',
        details: [{ field: 'email', message: 'Requerido' }],
      },
    });
    const error = await client.get('/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', message: 'Datos inválidos' });
    expect((error as ApiError).fieldErrors).toEqual({ email: 'Requerido' });
  });

  it('avisa del 401 solo si la petición iba autenticada', async () => {
    const onUnauthorized = vi.fn();
    const anonymous = createApiClient({ baseURL: '/api', tokens: createMemoryTokens(), onUnauthorized });
    anonymous.defaults.adapter = reply(401, { error: { code: 'INVALID_CREDENTIALS', message: 'x' } });
    await anonymous.post('/auth/login').catch(() => undefined);
    expect(onUnauthorized).not.toHaveBeenCalled();

    const authed = createApiClient({ baseURL: '/api', tokens: createMemoryTokens('t'), onUnauthorized });
    authed.defaults.adapter = reply(401, { error: { code: 'SESSION_INVALID', message: 'x' } });
    await authed.get('/auth/me').catch(() => undefined);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('un fallo de red se informa como NETWORK_ERROR', async () => {
    const client = createApiClient({ baseURL: '/api', tokens: createMemoryTokens() });
    client.defaults.adapter = async (config) => {
      throw new AxiosError('Network Error', 'ERR_NETWORK', config);
    };
    await expect(client.get('/x')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });
});
