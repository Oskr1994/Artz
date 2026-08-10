# FastPlay TV — app para Samsung Tizen

Reproduce la TV en directo con el **decodificador por hardware del televisor**,
sin pasar por ffmpeg.

## Por qué existe

La web desentrelaza con ffmpeg los canales que Chromium no sabe decodificar
(ver `backend/app/stream/adaptador.py`). Ese transcodificado existe **solo** por
una limitación del navegador. Un televisor no la tiene: `webapis.avplay` usa el
decodificador del propio aparato, que traga MPEG-TS con H.264 entrelazado igual
que traga una emisión de TDT.

Medido contra producción con **HBO HD (canal 7694)**, entrelazado real:

| | ffmpeg | bytes en 14 s |
|---|---|---|
| Sin `nativo` (camino de la web) | **1 proceso** | 4,17 MB |
| Con `nativo=1` (camino del televisor) | **0** | **4,98 MB** |

Cero CPU de transcodificación, cero hueco consumido de `transcode_max_concurrent`
y más caudal, porque no hay latencia de recodificado.

## Compilar

```bash
npm install
./empaquetar.sh
```

Deja `dist/` con `index.html`, los assets, `config.xml` e `icon.png`.

## Probar sin el televisor

**No hace falta el emulador de Tizen.** La app se detecta por CAPACIDAD, así que
sin `webapis.avplay` cae al respaldo de mpegts.js y todo lo que no sea el plano
de vídeo —acceso, catálogo, navegación con flechas, rendimiento— se prueba en
Chrome:

```bash
npm run dev          # http://localhost:5173/
```

Con una salvedad: en el televisor la página vive en `file://` dentro de un
webview con privilegios y **no hay CORS**; en un navegador normal sí, y tanto
nuestro backend como el panel del proveedor lo bloquean. Para probar de verdad
hay que abrir Chrome con la comprobación desactivada y un perfil aparte:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --disable-web-security --user-data-dir=$env:TEMP\perfil-fastplay `
  http://localhost:5173/
```

Dos herramientas manejan ese Chrome con Playwright y miden lo que interesa:

```bash
node medir.mjs       # cronometra un cambio de cuenta y lista cada petición
node comprobar.mjs   # comprueba qué se pide al entrar y al abrir cada sección
```

Ojo al leer las medidas: en desarrollo hay `StrictMode`, que ejecuta los efectos
dos veces. Lo que sale de `npm run build` no lo hace.

## Firmar e instalar

Esto **no se puede hacer en el servidor**: `tizen` y `sdb` vienen con Tizen
Studio, y el certificado está atado a tu cuenta Samsung y a tu PC.

### 1. Modo Desarrollador en el televisor

1. Menú **Apps**.
2. Teclea **`12345`** con el mando. Se abre un diálogo oculto.
3. **Developer mode: On**.
4. Escribe la **IP del PC** desde el que vas a instalar.
5. **Reinicia el televisor** (no basta con apagar la pantalla).

Apunta la IP del televisor: Ajustes → General → Red → Estado de la red.

### 2. Certificado

Tizen Studio → **Tools → Certificate Manager** → `+` → **Samsung** → **TV**:

1. Inicia sesión con tu cuenta Samsung.
2. Crea el certificado de autor.
3. En el certificado de distribuidor, **selecciona el televisor conectado** para
   que tome su **DUID**.

> Sin ese DUID el paquete se instala pero **no arranca**, y el televisor no da
> ningún error que lo explique. Es el fallo más habitual.

### 3. Instalar

```bash
tizen package -t wgt -s <tu-perfil> -- dist
sdb connect <IP-DEL-TELEVISOR>:26101
tizen install -n FastPlay.wgt -t "$(sdb devices | awk 'NR==2{print $3}')"
```

## Comprobar que NO se transcodifica

Con un canal reproduciéndose en el televisor, **en el servidor**:

```bash
pgrep -a ffmpeg
```

No debe aparecer nada. Si aparece un proceso, la app está pidiendo el stream sin
`nativo=1`: revisa `src/lib/ticket.js`.

Para contrastar que la comprobación sirve de algo, reproduce el mismo canal
desde la **web** (fast-play.oscar-dev.lat) y vuelve a mirar: ahí sí debe salir un
ffmpeg si el canal es de los entrelazados.

## Depurar en el televisor

```bash
sdb dlog -v time | grep -i fastplay      # log de la aplicación
```

Inspector web (el mismo de Chrome): `http://<IP-DEL-TELEVISOR>:7011`

## Desarrollar sin televisor

El reproductor elige motor **por capacidad**: si no hay `window.webapis.avplay`,
cae a `mpegts.js`, el mismo motor que la web. Eso permite probar en Chromium
toda la navegación por mando, el foco y las pantallas.

```bash
npm run build
npx vite preview --port 4173
```

Para reproducir el entorno real del `.wgt`, abre el build **desde `file://`**,
no desde `http://localhost`: es lo que hace el televisor, y es donde aparecen
los problemas de origen `null`.

```
file:///var/www/Fast-Play/tv/dist/index.html
```

## Detalles que costaron encontrarse

Ninguno de estos da un error legible; todos dejan la app en blanco o a medias.

- **Nada de `<script type="module">`.** Desde `file://` el origen es `null` y el
  módulo queda bloqueado por CORS. El build sale en formato `iife` y un plugin
  de `vite.config.js` quita `type="module"` y `crossorigin`, y añade `defer`
  (un script clásico no es diferido, así que sin `defer` correría antes de que
  exista `<body>` y `createRoot` fallaría con React #299).
- **`base: './'`.** Con rutas absolutas, `/assets/...` apunta a la raíz del
  sistema de ficheros del televisor.
- **Nada de fuera de `tv/`.** Hubo un alias `@nucleo` que traía ficheros de
  `../frontend/src`; resolvían SU react y acababan dos copias en el paquete, lo
  que rompe los hooks ("Cannot read properties of null (reading 'useContext')").
  Ya no existe: `lib/errores.js` y `lib/token.js` viven aquí y esta carpeta se
  compila sola.
- **URLs absolutas.** `VITE_API_BASE` y `VITE_ORIGEN_STREAM` en `.env`: desde
  `file://` una ruta relativa como `/img/<id>` se resuelve a `file:///img/<id>`.
- **`hwkey-event="enable"` en `config.xml`.** Sin eso, la tecla ATRÁS del mando
  cierra la aplicación en vez de llegar a JavaScript.
- **`stop()` + `close()` de AVPlay al cambiar de canal.** Si no, el
  decodificador queda ocupado y el canal siguiente se queda en negro, sin error.

## Qué NO incluye la entrega A

Películas, series y sus fichas. Van en la entrega B. El backend ya está listo
para ellas: `/vod/movies?nativo=1` marca reproducibles los `.mkv`, que son el
51% del catálogo y que en la web salen todos como "No compatible".
