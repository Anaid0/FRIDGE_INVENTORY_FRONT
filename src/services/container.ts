import type { Services, TokenStorage } from './ports';
import type { ServerConfig } from './serverConfig';

/**
 * Registro de servicios (composition root del front). main.ts registra las implementaciones HTTP;
 * los tests registran dobles. Stores y vistas los obtienen con useServices()/useTokenStorage().
 */
let services: Services | null = null;
let tokenStorage: TokenStorage | null = null;
let kioskTokenStorage: TokenStorage | null = null;

export function provideServices(value: Services, tokens: TokenStorage, kioskTokens: TokenStorage): void {
  services = value;
  tokenStorage = tokens;
  kioskTokenStorage = kioskTokens;
}

export function useServices(): Services {
  if (!services) throw new Error('Servicios no registrados: llama a provideServices() en main.ts');
  return services;
}

export function useTokenStorage(): TokenStorage {
  if (!tokenStorage) throw new Error('TokenStorage no registrado: llama a provideServices() en main.ts');
  return tokenStorage;
}

/** Token de la tablet (dispositivo autorizado), separado de la sesión del admin. */
export function useKioskTokenStorage(): TokenStorage {
  if (!kioskTokenStorage)
    throw new Error('TokenStorage de tablet no registrado: llama a provideServices() en main.ts');
  return kioskTokenStorage;
}

let serverConfig: ServerConfig | null = null;

export function provideServerConfig(config: ServerConfig): void {
  serverConfig = config;
}

/** Dirección de la API (configurable en la app Android). */
export function useServerConfig(): ServerConfig {
  if (!serverConfig) throw new Error('ServerConfig no registrado: llama a provideServerConfig() en main.ts');
  return serverConfig;
}
