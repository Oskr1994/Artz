// Comprueba el selector de pistas en Chrome.
//
// Sin AVPlay no hay pistas de verdad, así que se inyecta uno falso con las de
// Zootrópolis 2 para ver que el menú las pinta, las elige y las recuerda.
import { chromium } from 'playwright';

// OJO: no llamarla URL, que tapa el constructor global.
const DIRECCION = process.env.URL ?? 'http://localhost:5173/';
const PERFIL = process.env.PERFIL ?? 'C:/Users/OSCARP~1/AppData/Local/Temp/perfil-fastplay';

const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: 'chrome', headless: true,
  viewport: { width: 1920, height: 1080 },
  args: ['--disable-web-security'],
});
const pagina = await contexto.newPage();
pagina.on('pageerror', (e) => console.log(`[EXCEPCION] ${e.message.slice(0, 250)}`));

// AVPlay de mentira, con las pistas del ejemplo real.
await pagina.addInitScript(() => {
  const seleccionadas = { AUDIO: null, TEXT: null };
  window.__seleccionadas = seleccionadas;
  window.webapis = {
    avplay: {
      getTotalTrackInfo: () => ([
        { index: 0, type: 'VIDEO', extra_info: JSON.stringify({ Width: 1920, Height: 1080 }) },
        { index: 1, type: 'AUDIO', extra_info: JSON.stringify({ language: 'spa', title: 'Español Latino' }) },
        { index: 2, type: 'AUDIO', extra_info: JSON.stringify({ language: 'eng', title: 'Inglés' }) },
        { index: 3, type: 'TEXT', extra_info: JSON.stringify({ track_lang: 'spa', title: 'Español Forzado' }) },
      ]),
      setSelectTrack: (tipo, indice) => { seleccionadas[tipo] = indice; },
      setSilentSubtitle: (callado) => { seleccionadas.callado = callado; },
      // Lo mínimo para que el reproductor no reviente al montarse.
      open() {}, close() {}, stop() {}, play() {}, pause() {},
      setDisplayRect() {}, setDisplayMethod() {}, setListener() {},
      getDuration: () => 0, getCurrentStreamInfo: () => [],
      getState: () => 'PLAYING',
      prepareAsync: (exito) => exito(),
      jumpForward() {}, jumpBackward() {},
    },
  };
});

const tecla = (c) => pagina.click(`.teclado__tecla:text-is("${c}")`, { timeout: 8000 });
async function escribir(t) { for (const c of t) await tecla(c); }

await pagina.goto(DIRECCION, { waitUntil: 'domcontentloaded' });

if (await pagina.locator('.acceso').count()) {
  for (let i = 0; i < 12; i += 1) await pagina.click('.teclado__tecla--ancha:text-is("Borrar")');
  await escribir('ebgetrdr');
  await pagina.click('.teclado__tecla--principal');
  await escribir('demo');
  await pagina.click('.teclado__tecla--principal');
  await escribir('demo');
  await pagina.click('.teclado__tecla--principal');
}
await pagina.waitForSelector('.fila-canal', { timeout: 40000 });

console.log('--- sin canal elegido, el boton no deberia estar ---');
console.log('   boton:', await pagina.locator('.panel__pistas').count());

await pagina.locator('.fila-canal .canal').first().click();
await pagina.waitForTimeout(2500);
console.log('\n--- con canal en marcha ---');
console.log('   boton:', await pagina.locator('.panel__pistas').count());

await pagina.locator('.panel__pistas').click();
await pagina.waitForTimeout(800);
console.log('\n--- menu abierto ---');
console.log('   titulo   :', await pagina.locator('.pistas__titulo').textContent());
console.log('   grupos   :', (await pagina.locator('.pistas__grupo').allTextContents()).join(' | '));
console.log('   opciones :', (await pagina.locator('.pistas__nombre').allTextContents()).join(' | '));
console.log('   enfocado :', await pagina.locator('[data-enfocado] .pistas__nombre').textContent().catch(() => 'NADA'));

// Elegir "Inglés"
await pagina.locator('.pistas__opcion:has-text("Inglés")').click();
await pagina.waitForTimeout(500);
console.log('\n--- tras elegir Ingles ---');
console.log('   AVPlay recibio:', await pagina.evaluate(() => window.__seleccionadas.AUDIO));
console.log('   guardado      :', await pagina.evaluate(() => localStorage.getItem('fp_pistas')));
// TODAS las activas: subtitulos "Ninguno" tambien lo esta, y coger solo la
// primera daba un falso negativo.
console.log('   activas ahora :', (await pagina.locator('.pistas__opcion.es-activa .pistas__nombre').allTextContents()).join(' | '));

// Subtitulos
await pagina.locator('.pistas__opcion:has-text("Español Forzado")').click();
await pagina.waitForTimeout(500);
console.log('\n--- tras elegir subtitulos ---');
console.log('   AVPlay recibio:', await pagina.evaluate(() => window.__seleccionadas.TEXT));
console.log('   guardado      :', await pagina.evaluate(() => localStorage.getItem('fp_pistas')));
console.log('   activas ahora :', (await pagina.locator('.pistas__opcion.es-activa .pistas__nombre').allTextContents()).join(' | '));

// ATRAS cierra
await pagina.evaluate(() => window.dispatchEvent(
  new KeyboardEvent('keydown', { keyCode: 10009, which: 10009, bubbles: true }),
));
await pagina.waitForTimeout(600);
console.log('\n--- tras ATRAS ---');
console.log('   menu abierto  :', await pagina.locator('.pistas').count() > 0);
console.log('   sigue en vivo :', await pagina.locator('.fila-canal').count() > 0);

// Lo que de verdad importa: que al cambiar de contenido se aplique sola.
await pagina.evaluate(() => { window.__seleccionadas.AUDIO = null; window.__seleccionadas.TEXT = null; });
await pagina.locator('.fila-canal .canal').nth(1).click();
await pagina.waitForTimeout(3000);
console.log('\n--- cambiando de canal, deberia aplicarse lo guardado ---');
console.log('   AVPlay audio  :', await pagina.evaluate(() => window.__seleccionadas.AUDIO), '(esperado 2 = Ingles)');
console.log('   AVPlay subtit.:', await pagina.evaluate(() => window.__seleccionadas.TEXT), '(esperado 3)');

// Y que NO se aplique si en esa posicion hay otro idioma.
await pagina.evaluate(() => {
  window.__seleccionadas.AUDIO = null;
  const av = window.webapis.avplay;
  // Mismas posiciones, idiomas al reves: es el caso que protege la salvaguarda.
  av.getTotalTrackInfo = () => ([
    { index: 1, type: 'AUDIO', extra_info: JSON.stringify({ language: 'spa', title: 'Español' }) },
    { index: 2, type: 'AUDIO', extra_info: JSON.stringify({ language: 'por', title: 'Portugués' }) },
  ]);
});
await pagina.locator('.fila-canal .canal').nth(2).click();
await pagina.waitForTimeout(3000);
console.log('\n--- otro fichero con los idiomas cambiados ---');
console.log('   AVPlay audio  :', await pagina.evaluate(() => window.__seleccionadas.AUDIO), '(esperado null: no coincide el idioma)');

await contexto.close();
