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

/** Pantalla completa: oculta la barra de estado de Android. */
export async function setFullscreen(on: boolean): Promise<void> {
  if (!isNative()) return;
  try {
    const { StatusBar } = await import('@capacitor/status-bar');
    await (on ? StatusBar.hide() : StatusBar.show());
  } catch {
    // Igual que arriba: no es imprescindible.
  }
}
