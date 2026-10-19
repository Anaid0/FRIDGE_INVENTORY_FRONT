export interface ApiErrorDetail {
  field?: string;
  message: string;
}

/** Error normalizado de la API: { error: { code, message, details? } }. No depende de axios. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Errores por campo (validación) para mostrarlos junto a cada input. */
  get fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    return Object.fromEntries(
      (this.details as ApiErrorDetail[]).filter((d) => d.field).map((d) => [d.field as string, d.message]),
    );
  }
}

/** Mensaje listo para mostrar a partir de cualquier error. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Ocurrió un error inesperado';
}

export function isApiError(error: unknown, code?: string): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}
