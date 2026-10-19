# FridgeYA — Frontend

App única de FridgeYA: **Ionic Vue** (Vue 3 + `<script setup>`), Vite, TypeScript, Pinia, Vue Router y Tailwind CSS 4.
Funciona en el navegador y, con Capacitor, como app Android para la tablet de la oficina.

## Requisitos

- Node.js >= 22
- El backend corriendo en `http://localhost:3000` (ver `../FRIDGE_INVENTORY_BACK`).

## Puesta en marcha

```bash
cp .env.example .env
npm install
npm run dev        # http://localhost:5173 — /api se redirige al backend (proxy de Vite)
```

Para apuntar el proxy a otro backend: `VITE_PROXY_TARGET=http://otra-maquina:3000 npm run dev`.
En producción, `VITE_API_URL` define la URL de la API (por defecto `/api`).

## Scripts

| Script                            | Descripción                                                      |
| --------------------------------- | ---------------------------------------------------------------- |
| `npm run dev`                     | Servidor de desarrollo                                           |
| `npm run build` / `preview`       | Typecheck + build de producción en `dist/` / servirlo localmente |
| `npm run typecheck`               | `vue-tsc`                                                        |
| `npm run lint` / `lint:fix`       | ESLint (incluye la regla de capas)                               |
| `npm run format` / `format:check` | Prettier                                                         |
| `npm test` / `test:watch`         | Vitest + Vue Test Utils (jsdom)                                  |
| `npm run test:e2e`                | Playwright de punta a punta contra la API real (ver más abajo)   |
| `npm run test:e2e:report`         | Abre el reporte HTML del último e2e                              |

## Diseño

- **Marca e ilustraciones**: el logo y las ilustraciones salen de `design-assets/FridgeYA – Logo e
  ilustraciones.html` (exportado de Claude Design) y viven como componentes SVG en `src/components/brand/`:
  `FridgeLogo`, `MoveIllustration` (Sacar / Meter), `LoadingFridge` (Cargando, la única animada en el diseño),
  `RankingPodium`, `PeriodPodium` (podio con nombres), `HungriestMonkey`, `HungriestCard` y `PeriodRankingResult`.
  Animaciones propias además del diseño: el brazo del mono saca/mete en la nevera y el más hambriento golpea con los
  cubiertos. Las animaciones se detienen si el sistema pide reducir el
  movimiento. Paleta del logo en los tokens de `src/assets/main.css`: `brand` (azul `#0B79C3`, marino `#073B5E`),
  `accent` (naranja `#FF8A1F`) y `success` (verde de "Meter"). Letra de la marca: Nunito (`font-display`),
  empaquetada con la app.
- **Íconos de Android y splash**: las imágenes fuente están en `assets/`; si cambia el logo, se regeneran con
  `npx @capacitor/assets generate --android --iconBackgroundColor '#0b79c3' --splashBackgroundColor '#e6f3fb' --splashBackgroundColorDark '#073b5e'`.
- **Vidrio (glassmorphism)**: un fondo de color fijo (degradados) detrás de toda la app y superficies
  translúcidas que lo desenfocan. Usa las utilidades `glass`, `glass-strong`, `glass-inset` y `card` de
  `src/assets/main.css`. Los valores (fondo, opacidad, desenfoque) y la integración con Ionic (cabeceras, menú,
  modales y pestañas) están en `src/theme/glass.css`. Si el navegador no soporta `backdrop-filter`, o el
  sistema pide menos transparencia o contraste alto, las superficies pasan a ser casi opacas.
- **Áreas seguras**: la app se dibuja de borde a borde (`viewport-fit=cover`) y se aparta de la barra de estado,
  de los botones o la barra de gestos de Android y de los recortes de cámara, también en horizontal. En Android,
  Capacitor (plugin `SystemBars`, `insetsHandling: 'css'`) informa esas medidas como `--safe-area-inset-*`; en
  los demás casos se usa `env(safe-area-inset-*)`. Ionic las aplica a las cabeceras, pies, menús y avisos, y
  `glass.css` al contenido.
- **Responsive**: el mismo diseño sirve para celular, tablet (vertical u horizontal) y escritorio. En la tablet,
  con poco ancho, la lista de lo elegido queda fija abajo; en pantallas anchas va en una columna a la derecha.
  El menú de administración es fijo desde 992 px y desplegable por debajo de ese ancho.

## Estructura

```
src/
  domain/        Modelos (reflejo de los DTOs de la API) y datos de entrada de formularios.
  services/      ports.ts: interfaces por área (Auth, Users, Catalog, Movements, Funding, Purchases, Reports).
                 http/: implementación con axios (token, errores normalizados a ApiError).
                 container.ts: registro de servicios (main.ts registra HTTP; los tests registran dobles).
  stores/        Pinia (sesión en auth.ts).
  router/        Rutas y guardas (sesión, solo invitados, solo admin).
  layouts/       AdminPage (cabecera + quién más retira) y AdminMenu (menú lateral de Ionic).
  views/         Páginas (cada una es un <ion-page>); views/kiosk/ para el modo tablet.
  theme/         Variables de color de Ionic con la paleta de FridgeYA.
  components/    Componentes reutilizables.
  utils/         Formato de dinero (COP), fechas y nombres.
  testing/       Dobles para tests (no entra al build).
```

Regla de capas (ESLint): `views/`, `components/` y `layouts/` no importan axios ni `services/http/*`; usan stores o
`useServices()`. Así la UI depende de interfaces, no de la implementación HTTP.

## Modo tablet

1. **Autorizar** (una vez): en la tablet, "Autorizar esta tablet" → login de admin → "Usar este dispositivo como
   tablet". La tablet guarda su propio token (`fridgeya.kioskToken`, aparte de la sesión del admin) y la sesión del
   admin se cierra.
2. **Sacar / Meter**: tocar productos (al sacar no se puede pasar del stock) → **¿Quién eres?** → **PIN** → resumen
   ("Ana sacó 2 botellas de Gaseosa y 1 unidad de Yogur") → vuelve sola al inicio.
3. PIN incorrecto: avisa cuántos intentos quedan; al quinto, bloqueo de 5 minutos. "Cambiar mi PIN" desde la misma
   pantalla. Si mientras alguien elegía otra persona sacó algo, la lista se ajusta y se avisa.
4. **Inactividad**: tras 60 s sin tocar la pantalla con algo a medias, vuelve al inicio. Datos refrescados cada minuto.
   En una tablet, la sesión de admin se cierra sola tras 5 minutos sin uso.
5. Si el admin **revoca** la tablet, en la siguiente petición vuelve a la pantalla "Esta tablet fue desautorizada".

Código: `src/views/kiosk/KioskHomeView.vue`, `src/components/kiosk/`, `src/stores/kiosk.ts`,
`src/composables/useKioskCart.ts` y `useIdle.ts`.

## App Android (Capacitor)

La misma app se empaqueta como APK para la tablet. El proyecto nativo está en `android/` (se versiona).

### Requisitos (una sola vez)

1. Instalar **Android Studio** (trae el JDK 21 y el SDK de Android): https://developer.android.com/studio
2. Abrirlo una vez y aceptar la instalación del SDK (API 36).

### Generar el APK

```bash
npm run android:sync     # build web + copia a android/ + plugins
npm run android:open     # abre el proyecto en Android Studio
```

En Android Studio: **Build → Generate App Bundles or APKs → Generate APKs**. El APK queda en
`android/app/build/outputs/apk/debug/app-debug.apk`. Para instalarlo: conectar la tablet por USB con la depuración
activada y usar **Run ▶**, o copiar el APK a la tablet y abrirlo (permitir "instalar apps de origen desconocido").
Con la tablet conectada también sirve `npm run android:run`.

Para una versión firmada (release): **Build → Generate Signed App Bundle or APK** y crear una keystore; guárdala bien,
sin ella no se pueden publicar actualizaciones de la misma app.

### Primera vez en la tablet

1. **Servidor**: la app pide la dirección del servidor de FridgeYA en la red de la oficina
   (ej. `192.168.1.50:3000`) y prueba la conexión antes de guardarla. Se puede cambiar después desde
   "Cambiar servidor" en la pantalla de la tablet sin autorizar o sin conexión.
2. **Autorizar**: "Autorizar esta tablet" → login de admin → "Usar este dispositivo como tablet".
3. Listo: la pantalla queda siempre encendida mientras funciona como tablet. La barra de estado y los botones
   de navegación de Android siguen visibles y la app no se dibuja debajo de ellos. El botón "atrás" de Android
   retrocede un paso y nunca cierra la app.

### Servidor y red

- El backend debe estar accesible desde la red local (escucha en todas las interfaces, puerto `PORT`). Abre ese
  puerto en el firewall del equipo servidor y usa una IP fija (o reserva DHCP) para que la dirección no cambie.
- CORS: `CORS_ORIGIN` del backend ya incluye el origen de la app (`http://localhost`, `capacitor://localhost`).
- La app usa HTTP en la red local (`androidScheme: 'http'` y `usesCleartextTraffic`). Los PIN viajan sin cifrar
  dentro de la red Wi-Fi de la oficina: si la red no es de confianza, publica la API con **HTTPS** (p. ej. detrás de
  un proxy con certificado) y escribe la dirección `https://…` en la tablet.
- La autorización y la dirección del servidor se guardan en `Preferences` (no en localStorage) y están excluidas de
  las copias de seguridad de Android: no se pueden restaurar en otro dispositivo.

### Dejar la tablet fija en FridgeYA

- **Fijar pantalla** (Android): Ajustes → Seguridad → Fijar apps; luego, en Recientes, mantener presionado el ícono
  de FridgeYA → Fijar. Para salir hace falta el PIN del dispositivo.
- Desactivar el bloqueo de pantalla automático y dejar la tablet conectada al cargador.
- Opcional: ícono propio con `npx @capacitor/assets generate` a partir de `assets/icon.png` (1024×1024).

## Notas de Ionic

- **Estilos**: los CSS de Ionic se cargan en una capa inferior y las utilidades de Tailwind al final, así las clases de
  Tailwind ganan. No se usa el _preflight_ de Tailwind: su reset global rompe los componentes de Ionic
  (ver `src/assets/main.css`).
- **Páginas en memoria**: Ionic deja montadas las páginas visitadas para animar el "atrás"; por eso las vistas cargan
  datos con `useOnEnter()` (al montar y cada vez que se vuelve a la página) en lugar de `onMounted`.
- **Tests**: `ion-modal` no pinta su contenido en jsdom; los tests de componentes usan `dialogStubs`
  (`src/testing/stubs.ts`). En Playwright, `activeView(page)` limita las búsquedas a la página visible.

## Sesión

- El token se guarda en `localStorage` (con respaldo en memoria si el navegador lo bloquea).
- Al recargar, la guarda del router recupera el usuario con `/auth/me`.
- Si la API responde 401 a una petición autenticada (sesión vencida o usuario desactivado), se cierra la sesión
  y se vuelve al login conservando la ruta (`?redirect=`). Solo se aceptan redirecciones internas.

## Pantallas

| Ruta                                           | Qué hace                                                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `/`                                            | Modo tablet (sin login): sacar, meter, ranking y movimientos                                                        |
| `/admin/login`                                 | Login de administrador (email + contraseña)                                                                         |
| `/admin`                                       | Inicio: quién más retira, indicadores, últimos movimientos, saldo, stock bajo                                       |
| `/admin/productos` (+ `/nuevo`, `/:id/editar`) | Stock; Meter/Sacar a nombre de una persona; crear/editar productos y categorías                                     |
| `/admin/movimientos`                           | Log con filtros sincronizados con la URL                                                                            |
| `/admin/ranking`                               | Quién más retira: todo / 30 / 7 días                                                                                |
| `/admin/quincenas`, `/admin/quincenas/:id`     | Recaudado, gastado, saldo, aportes por persona, compras; abrir/cerrar                                               |
| `/admin/compras` (+ `/nueva`, `/:id`)          | Historial, registro con varias líneas y comprobante, detalle y anulación                                            |
| `/admin/reportes`                              | Gasto por producto y categoría, evolución del precio                                                                |
| `/admin/personas`                              | Personas de la tablet: alta con nombre + PIN (botón "Generar"), editar, asignar/restablecer PIN, activar/desactivar |
| `/admin/tablets`                               | Tablets autorizadas, última conexión, revocar                                                                       |
| `/admin/administradores`                       | Cuentas de administrador (email + contraseña)                                                                       |

La administración usa `ion-split-pane` con menú lateral (fijo en pantallas ≥ 992 px, desplegable en las más chicas),
`ion-modal` para los diálogos e `ion-toast` para los avisos. Cada página va dentro de `AdminPage`
(`src/layouts/AdminPage.vue`).

En la cabecera siempre se ve **quién más retira**; se actualiza cada minuto y después de cada movimiento.

Los gráficos (`src/components/charts/`) son HTML/SVG propios: una sola serie en el color de marca (validado),
énfasis del primer lugar en gris de contexto, tooltip con mouse y teclado, y una tabla oculta para lectores de pantalla.

## Tests de punta a punta (Playwright)

`npm run test:e2e` prueba la app completa (navegador → front → API real → MySQL) en Google Chrome, el instalado en
la máquina (no descarga navegadores):

1. Levanta la API real en `:3100` contra la base `fridgeya_test` y el front en `:5174` apuntando a ella.
2. Cada archivo reinicia esa base al empezar (`npm run e2e:reset-db` del backend: migraciones, admin, categorías y
   datos de demo), así no dependen entre sí.
3. Tres perfiles de dispositivo:

| Perfil                     | Archivos         | Qué prueba                                                                                                                                                                                                                                                                                                                |
| -------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `escritorio`               | `admin*.spec.ts` | Login y vuelta a la página pedida; menú; quién más retira en la cabecera; personas con PIN; retiro a nombre de otro; aporte, compra con comprobante, ver comprobante, anular; cerrar y abrir quincena; reportes; desactivar a un admin cierra su sesión                                                                   |
| `tablet` (1280×800 táctil) | `kiosk*.spec.ts` | Autorizar la tablet desde ella; sacar varios productos con nombre + PIN; PIN incorrecto y bloqueo tras 5 intentos; restablecer PIN; cambiar el propio PIN; stock que cambia mientras alguien elige; vuelta al inicio por inactividad (reloj simulado); meter; ranking y movimientos; revocar la tablet con la app abierta |
| `celular` (Pixel 7)        | `mobile.spec.ts` | Menú plegable y todas las pantallas de administración sin scroll horizontal; la tablet usable en un teléfono                                                                                                                                                                                                              |

Requiere MySQL arriba (`npm run db:up` en el backend) y los puertos 3100 y 5174 libres. Las credenciales se leen del
`.env` del backend y de `prisma/seed-demo.ts`. `npm run test:e2e:report` abre el reporte HTML (con trazas de los fallos).

`e2e/fixtures.ts` tiene los helpers: `activeView(page)` (Ionic deja en el DOM las páginas anteriores, ocultas),
`openPairedTablet` (tablet ya autorizada vía API), `kioskRegister`, `typePin`, `openTab` y `horizontalOverflow`
(mide el scroll dentro de `<ion-content>`).
