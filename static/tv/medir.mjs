// Reproduce cambios de cuenta en Chrome y cronometra cada petición.
//
// No hace falta el televisor: la app se detecta por CAPACIDAD, así que sin
// AVPlay cae al respaldo de mpegts.js y todo lo que no sea el plano de vídeo
// se prueba aquí. Hace falta desactivar CORS porque en el televisor la página
// vive en `file://` dentro de un webview con privilegios y aquí no.
//
//   npm run dev          (en otra terminal)
//   node medir.mjs
import { chromium } from 'playwright';

const URL = process.env.URL ?? 'http://localhost:5173/';
const PERFIL = process.env.PERFIL ?? 'C:/Users/OSCARP~1/AppData/Local/Temp/perfil-fastplay';

const CUENTAS = [
  { nombre: 'demo', codigo: 'ebgetrdr', usuario: 'demo', clave: 'demo' },
  { nombre: 'manueldemo', codigo: '7ernb5xk', usuario: 'manueldemo', clave: 'manueldemo' },
  { nombre: 'demo (vuelta)', codigo: 'ebgetrdr', usuario: 'demo', clave: 'demo' },
];

const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: 'chrome',
  headless: true,
  viewport: { width: 1920, height: 1080 },
  args: ['--disable-web-security'],
});
const pagina = await contexto.newPage();

let red = [];
const arranques = new Map();
pagina.on('request', (p) => arranques.set(p, Date.now()));
pagina.on('requestfinished', (p) => {
  const u = p.url();
  // Solo lo que sale a la red de verdad, y sin las carátulas, que son ruido.
  if (!u.startsWith('http') || u.includes('localhost') || u.includes('/images/')) return;
  red.push({
    ms: Date.now() - (arranques.get(p) ?? Date.now()),
    url: u.replace(/password=[^&]*/, 'password=***'),
  });
});
pagina.on('pageerror', (e) => console.log(`   [EXCEPCION] ${e.message.slice(0, 200)}`));

const tecla = (c) => pagina.click(`.teclado__tecla:text-is("${c}")`, { timeout: 8000 });
async function escribir(t) { for (const c of t) await tecla(c); }

async function entrar(cuenta) {
  for (let i = 0; i < 12; i += 1) {
    await pagina.click('.teclado__tecla--ancha:text-is("Borrar")');
  }
  await escribir(cuenta.codigo);
  await pagina.click('.teclado__tecla--principal');
  await escribir(cuenta.usuario);
  await pagina.click('.teclado__tecla--principal');
  await escribir(cuenta.clave);

  red = [];
  const t0 = Date.now();
  await pagina.click('.teclado__tecla--principal');
  await pagina.waitForSelector('.fila-canal', { timeout: 45000 });
  const total = Date.now() - t0;
  // Deja respirar para cazar lo que llega DESPUÉS de pintar la lista.
  await pagina.waitForTimeout(6000);
  return total;
}

async function salir() {
  await pagina.click('.lateral__salir');
  await pagina.click('.lateral__salir');
  await pagina.waitForSelector('.acceso', { timeout: 15000 });
}

await pagina.goto(URL, { waitUntil: 'domcontentloaded' });
// Arranca con la sesión del perfil anterior si la hubiera.
if (await pagina.locator('.lateral__salir').count()) await salir();
await pagina.waitForSelector('.acceso', { timeout: 20000 });

for (const [i, cuenta] of CUENTAS.entries()) {
  if (i > 0) await salir();
  const ms = await entrar(cuenta);
  const canales = await pagina.locator('.fila-canal').count();
  const primeros = (await pagina.locator('.canal__nombre').allTextContents()).slice(0, 3);
  console.log(`\n=== ${cuenta.nombre}: ${ms} ms hasta ver la lista ===`);
  console.log(`   ${canales} canales: ${primeros.join(' | ')}`);
  console.log(`   ${red.length} peticiones a la red:`);
  for (const r of red) {
    console.log(`      ${String(r.ms).padStart(6)} ms  ${r.url.replace(/^https?:\/\//, '').slice(0, 96)}`);
  }
}

await contexto.close();
