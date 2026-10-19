import { Capacitor } from '@capacitor/core';

/**
 * Integraciones con el dispositivo (solo en la app nativa; en el navegador no hacen nada).
 * Los plugins se cargan bajo demanda para no sumarlos al bundle web inicial.
 */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/** Pantalla siempre encendida mientras la app es una tablet de uso compartido. */
export async function keepScreenOn(on: boolean): Promise<void> {
  if (!isNative()) return;
  try {
    const { KeepAwake } = await import('@capacitor-community/keep-awake');
    await (on ? KeepAwake.keepAwake() : KeepAwake.allowSleep());
  } catch {
    // Si el dispositivo no lo soporta, la app sigue funcionando igual.
  }
}

/**
 * Barras del sistema visibles (estado arriba, navegación abajo) con íconos oscuros sobre el fondo claro
 * de la app. La app se dibuja de borde a borde y se aparta de ellas con las áreas seguras
 * (theme/glass.css); Capacitor las informa con las variables --safe-area-inset-*.
 */
export async function showSystemBars(): Promise<void> {
  if (!isNative()) return;
  try {
    const { SystemBars, SystemBarsStyle } = await import('@capacitor/core');
    await SystemBars.show();
    await SystemBars.setStyle({ style: SystemBarsStyle.Light });
  } catch {
    // Igual que arriba: no es imprescindible.
  }
}
