import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Deja el HTML como lo necesita un paquete Tizen.
 *
 * Vite etiqueta el bundle con `type="module" crossorigin` aunque el formato de
 * salida sea `iife`. Desde `file://` el origen es `null`, así que un módulo ES
 * y cualquier recurso `crossorigin` quedan bloqueados por CORS: la app arranca
 * en blanco y lo único que se ve es un `ERR_FAILED` en la consola. Comprobado
 * en Chromium, que es el mismo motor del WebEngine de Tizen.
 *
 * `apply: 'build'` NO es un detalle. Sin él esto corría también en `npm run
 * dev`, donde Vite sirve el fuente como módulos ES de verdad: quitarles
 * `type="module"` los rompía con «Cannot use import statement outside a
 * module» y la app no arrancaba en el navegador. Es decir, el modo desarrollo
 * estaba inservible, que es justo lo que permite probar sin el televisor.
 */
function htmlParaTizen() {
  return {
    name: 'html-para-tizen',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html) {
      return html
        .replace(/\s+crossorigin(?==|\s|>)/g, '')
        // `defer`, no solo quitar `type="module"`. Un módulo ES se ejecuta
        // diferido por defecto; un script clásico NO, así que correría desde
        // el <head> antes de que exista <body> y `createRoot` no encontraría
        // el contenedor (React #299). `defer` recupera ese comportamiento.
        .replace(/\s+type="module"(\s+)?/g, ' defer ');
    },
  };
}

export default defineConfig({
  plugins: [react(), htmlParaTizen()],
  // Rutas RELATIVAS. Dentro del .wgt la página se sirve desde `file://`, así
  // que una ruta absoluta (`/assets/...`) apuntaría a la raíz del sistema de
  // ficheros del televisor y la app arrancaría en blanco. Es el fallo clásico
  // al empaquetar una SPA para Tizen.
  base: './',
  // Sin alias `@nucleo`: esta app ya no toma nada de `frontend/src`. Todo lo
  // que necesitaba de allí —`lib/errores.js` y `lib/token.js`, unas ochenta
  // líneas sin dependencias— vive ahora en `src/lib/`. Antes hacía falta
  // además un alias para axios, porque `frontend/src/api/client.js` lo
  // importaba y se resolvía desde una carpeta sin `node_modules`; ya no entra
  // ningún fichero de fuera, así que todo se resuelve dentro de `tv/`.
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // El televisor es Tizen 6.0 = Chromium 76 / V8 7.6 (leído de
    // `http://<tv>:<puerto>/json/version` con el inspector). Sin fijar esto,
    // Vite compila para navegadores modernos y cuela `||=` `&&=` `??=`
    // (Chrome 85) y `?.` `??` (Chrome 80). El primero de ellos rompe el
    // PARSEO DEL FICHERO ENTERO con `SyntaxError: Unexpected token =`, así que
    // `app.js` no llega a ejecutarse y la app arranca en NEGRO, sin más pista
    // que esa excepción en la consola del inspector.
    target: 'chrome76',
    // Baja `inset` a top/right/bottom/left (Chrome 87). Afecta a
    // `.reproductor`, que es el contenedor del vídeo: no es cosmético.
    // Ojo: NO cubre `gap` en flexbox (Chrome 84), que ningún transpilador
    // puede polirrellenar. Eso se resuelve a mano en `estilos/tv.css`.
    cssTarget: 'chrome76',
    // Script CLÁSICO, no módulo ES. Dentro del .wgt la página se carga desde
    // `file://`, y ahí el origen es `null`: un `<script type="module">` queda
    // bloqueado por CORS y la aplicación arranca en blanco, sin más pista que
    // un ERR_FAILED en la consola. Comprobado en Chromium, que es el mismo
    // motor que usa el WebEngine de Tizen.
    //
    // `iife` obliga a un único fichero, así que también se desactiva la carga
    // diferida: en un paquete local no hay nada que ahorrar, todo está ya en
    // el disco del televisor.
    modulePreload: false,
    cssCodeSplit: false,
    rollupOptions: {
      output: { format: 'iife', inlineDynamicImports: true, entryFileNames: 'assets/app.js' },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.js', 'src/**/*.test.jsx'],
  },
});
