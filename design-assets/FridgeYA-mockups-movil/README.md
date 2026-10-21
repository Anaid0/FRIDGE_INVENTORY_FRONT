# FridgeYA · Mockups móvil

Mockups de referencia (Claude Design) del rediseño en glassmorphism.

## Cómo verlos
Los navegadores bloquean los scripts si se abren con file://, así que sirve la carpeta:

    cd FridgeYA-mockups-movil
    python3 -m http.server 8080

y abre http://localhost:8080/ (galería con todas las pantallas).

## Contenido
- `index.html` — galería con todas las pantallas agrupadas.
- `*.dc.html` — una pantalla por archivo. Los valores de diseño (colores, tamaños, radios, sombras) están en los `style="…"`.
- `Main.dc.html` — máquina interactiva: toca productos o marca su código + OK, quita del retiro, "Retirar", PIN de 4 dígitos.
  Las variantes `MaquinaPin`, `MaquinaError`, `MaquinaRegreso` y `MaquinaAdmin` la reutilizan con otro estado inicial.
- `support.js`, `vendor/` — runtime que dibuja los componentes; no es parte del diseño.

## Tokens principales
- Marca: azul #0B79C3 · marino #073B5E · naranja #FF8A1F · verde ingreso #157A4B · error #B42318
- Fondo: degradado #EAF5FD → #D4E9F8 con manchas desenfocadas
- Vidrio: rgba(255,255,255,0.58–0.74) + backdrop-filter blur(16–22px) saturate(160%) + borde rgba(255,255,255,0.85–0.95)
- Tipografía: Nunito (títulos), Nunito Sans (texto), JetBrains Mono (códigos, PIN, cifras)
