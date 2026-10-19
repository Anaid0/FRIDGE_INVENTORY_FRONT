import { isAxiosError } from 'axios';
import { ApiError } from '../errors';

/** Convierte un error de axios (o cualquiera) en ApiError. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (isAxiosError(error)) {
    if (!error.response) {
      return new ApiError(0, 'NETWORK_ERROR', 'No se pudo conectar con el servidor. Revisa tu conexión.');
    }
    const body = error.response.data as {
      error?: { code?: string; message?: string; details?: unknown };
    } | null;
    return new ApiError(
      error.response.status,
      body?.error?.code ?? 'HTTP_ERROR',
      body?.error?.message ?? `Error ${error.response.status}`,
      body?.error?.details,
    );
  }
  return new ApiError(0, 'UNKNOWN_ERROR', error instanceof Error ? error.message : 'Error inesperado');
}
