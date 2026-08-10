// Canales en directo. Lo único que este módulo sabe hacer.
import { ErrorDeApi } from '../errores.js';
import {
  panel, consultar, lista, credenciales, infoDeCuenta, unaSola,
  normalizarCategorias, categoriasDe, estaVetada, hayVetadas,
} from './nucleo.js';

const CATALOGO = 'directo';

// Para `direct_source` al construir la URL.
let canalesPorId = new Map();

export async function categorias({ adultos = false } = {}) {
  // `unaSola`: al entrar, esto lo piden a la vez el gancho de la barra lateral
  // y `canales()`, que necesita saber qué vetar. Sin esto salían dos peticiones
  // idénticas.
  return unaSola(`${CATALOGO}:categorias:${adultos}`, async () => {
    const crudas = lista(
      await consultar({ action: 'get_live_categories' }),
      'get_live_categories',
    );
    return normalizarCategorias(CATALOGO, crudas, adultos);
  });
}

/**
 * Canales con la forma que espera la interfaz: `{ items, total }`.
 *
 * El filtrado por categoría y por texto se hace aquí y no en el panel: son 149
 * canales en una sola respuesta y el panel solo admite una conexión simultánea,
 * así que cuantas menos peticiones, mejor.
 *
 * `adultos` llega como ARGUMENTO y no se lee de un estado compartido. Con un
 * estado compartido hay carrera: esta petición y la de categorías salen a la
 * vez, y si las categorías ya estaban pedidas no se vuelven a pedir, así que se
 * filtraría con el conjunto anterior.
 */
export async function canales({ category = null, q = '', adultos = false } = {}) {
  // Las dos peticiones salen A LA VEZ. Antes las categorías se pedían DESPUÉS
  // de los canales, así que el usuario esperaba la suma de las dos en vez de la
  // más lenta: medido al entrar, 376 ms + 521 ms en el camino crítico.
  //
  // Si aún no se han pedido las categorías no se sabe cuáles vetar, y hace
  // falta saberlo para que una búsqueda no destape canales de adultos. Con los
  // adultos a la vista no hay nada que vetar, así que tampoco hay que pedirlas.
  const [datos] = await Promise.all([
    consultar({ action: 'get_live_streams' }),
    adultos || hayVetadas(CATALOGO) ? null : categorias(),
  ]);
  const crudos = lista(datos, 'get_live_streams');

  canalesPorId = new Map(crudos.map((c) => [String(c.stream_id), c]));

  const texto = String(q || '').trim().toLowerCase();
  const items = crudos
    .filter((c) => {
      const suyas = categoriasDe(c);
      // Con una categoría elegida manda esa, aunque esté vetada: si el usuario
      // la ha activado a propósito, se le enseña.
      if (category != null) return suyas.has(String(category));
      // Sin categoría se veta el canal si CUALQUIERA de las suyas lo está: uno
      // de adultos puede tener una categoría principal inocente.
      if (!adultos) {
        for (const id of suyas) if (estaVetada(CATALOGO, id)) return false;
      }
      return true;
    })
    .filter((c) => !texto || String(c.name || '').toLowerCase().includes(texto))
    .map((c) => ({
      id: c.stream_id,
      name: c.name,
      icon: c.stream_icon || null,
      // `epg_channel_id` es `null` en casi todos los canales de este panel, así
      // que la insignia de guía casi nunca aparecerá. Es correcto: la guía está
      // vacía en el servidor.
      has_epg: Boolean(c.epg_channel_id),
    }));

  return { items, total: items.length };
}

/** El texto del EPG viene en Base64 y hay que descodificarlo antes de pintarlo. */
function deBase64(texto) {
  if (!texto) return '';
  try {
    // `escape` está obsoleto pero es lo que hay en Chromium 76 para recuperar
    // los acentos: `atob` devuelve bytes, no UTF-8.
    return decodeURIComponent(escape(atob(texto)));
  } catch {
    try {
      return atob(texto);
    } catch {
      return texto;
    }
  }
}

export async function epg(streamId) {
  // `get_short_epg` devuelve `{ epg_listings: [...] }`, no un array plano, así
  // que aquí no aplica `lista()`. En este panel viene vacío casi siempre:
  // `epg_channel_id` es null en la mayoría de canales y el XMLTV trae
  // `<channel id="">`, así que no hay con qué casar los programas.
  const datos = await consultar({
    action: 'get_short_epg',
    stream_id: streamId,
    limit: 4,
  });
  const programas = (datos && datos.epg_listings) || [];
  return programas.map((p) => ({
    title: deBase64(p.title),
    description: deBase64(p.description),
    start: p.start,
    end: p.end,
  }));
}

/**
 * Extensión de la URL de directo, según lo que permita LA LÍNEA.
 *
 * `allowed_output_formats` viene en `user_info` y no es igual para todas: dar
 * por hecho `.ts` funcionaría con esta línea de prueba y fallaría con otra que
 * solo tuviera HLS. Se prefiere `ts` porque es el flujo tal cual, sin la capa de
 * segmentado de HLS, y es lo que mejor le sienta al decodificador del televisor.
 *
 * Solo aplica al directo: las películas y los episodios llevan su propio
 * `container_extension`.
 */
function extensionDeSalida() {
  const info = infoDeCuenta();
  const permitidos = info && info.allowed_output_formats;
  if (!Array.isArray(permitidos) || permitidos.length === 0) return 'ts';
  if (permitidos.includes('ts')) return 'ts';
  if (permitidos.includes('m3u8')) return 'm3u8';
  return 'ts';
}

/**
 * URL de reproducción de un canal en directo.
 *
 * Sin ticket: el panel autentica con usuario y clave en la propia ruta, que es
 * la única forma que tiene AVPlay de identificarse. El servidor responde con un
 * 302 hacia una URL con token de un solo uso, así que el reproductor TIENE que
 * seguir redirecciones; AVPlay lo hace por su cuenta. Lo que no se puede cachear
 * es la URL con token, solo esta.
 */
export function urlDeDirecto(streamId) {
  const guardadas = credenciales();
  if (!guardadas) throw new ErrorDeApi(401, '');

  // Si el canal trae `direct_source` relleno, esa URL manda sobre la construida.
  const canal = canalesPorId.get(String(streamId));
  if (canal && canal.direct_source) return canal.direct_source;

  const usuario = encodeURIComponent(guardadas.usuario);
  const clave = encodeURIComponent(guardadas.clave);
  return `${panel()}/live/${usuario}/${clave}/${streamId}.${extensionDeSalida()}`;
}
