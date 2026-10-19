import type { CapacitorConfig } from '@capacitor/cli';

/**
 * App Android de FridgeYA (la misma app web empaquetada con Capacitor).
 *
 * La API vive en un servidor de la red local, normalmente por HTTP (ej. http://192.168.1.50:3000).
 * Por eso el WebView usa el esquema `http` (origen http://localhost) y permite tráfico sin cifrar:
 * con el `https` por defecto, el navegador bloquearía las llamadas http como "contenido mixto".
 * Si el servidor se publica con HTTPS, se puede volver a `androidScheme: 'https'` y quitar `cleartext`.
 */
const config: CapacitorConfig = {
  appId: 'com.fridgeya.app',
  appName: 'FridgeYA',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    cleartext: true,
  },
  android: {
    // No hay contenido de terceros: la app solo habla con el servidor de la oficina.
    allowMixedContent: false,
  },
  plugins: {
    // Barras del sistema visibles y app de borde a borde: el contenido se aparta de ellas con las áreas
    // seguras (--safe-area-inset-*, que Capacitor inyecta en el WebView). Íconos oscuros: fondo claro.
    SystemBars: { insetsHandling: 'css', initialViewportFitValueHint: 'cover', style: 'LIGHT' },
  },
};

export default config;
