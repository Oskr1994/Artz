// Núcleo del cliente XUI: sesión, transporte y lo que comparten los tres
// catálogos. No conoce canales, ni películas, ni series.
import { ErrorDeApi } from '../errores.js';
import { mostrarAdultos } from '../adultos.js';

// Respaldo SOLO para `npm run dev`, donde no hay sesión guardada. Dentro del
// .wgt no se usa nunca: sin sesión la app está en la pantalla de acceso y no
// pide catálogo.
//
// HTTPS a propósito: el panel declara `http` en `server_info`, y por ahí usuario
// y clave viajarían en claro dentro de la URL, hasta en los logs de nginx.
const PANEL_DE_COMPILACION = import.meta.env?.VITE_PANEL ?? 'https://digitalsmarther.com';
const CLAVE_ALMACEN = 'fp_xui';

/**
 * Contra qué panel se habla. Sale del código de acceso, vía nuestro backend.
 *
 * Era `export const PANEL`. Dejó de serlo cuando el código de acceso pasó a
 * decidir el proveedor: con una constante, todos los televisores hablarían con
 * el mismo panel para siempre, y el fallo solo aparecería al dar de alta un
 * segundo proveedor.
 *
 * `credenciales` se declara más abajo: las declaraciones `function` se izan.
 */
export function panel() {
  return credenciales()?.base_url || PANEL_DE_COMPILACION;
}

/**
 * Quién está pidiendo los datos, para que la caché no mezcle cuentas.
 *
 * Las consultas se cacheaban con claves como `['live','canales',categoria]`,
 * que no dicen de quién son los datos. La caché sobrevive a cerrar sesión, así
 * que al entrar con otra cuenta se seguían viendo los canales de la anterior:
 * medido en el televisor, `manueldemo` en digitalsmarther veía los 17 canales
 * de fsplaystreams, y no se corregía solo porque `staleTime` los daba por
 * frescos.
 *
 * Lleva el panel Y el usuario: cambiar de cuenta dentro del mismo proveedor
 * también cambia el catálogo, y el panel puede cambiar al revalidar sin que
 * cambie el usuario.
 */
export function claveDeSesion() {
  const g = credenciales();
  if (!g) return 'sin-sesion';
  return `${g.base_url || ''}|${g.usuario || ''}`;
}

// Peticiones en vuelo, para que dos que coincidan no salgan dos veces.
const enVuelo = new Map();

/**
 * Junta en una sola las peticiones idénticas que coinciden en el tiempo.
 *
 * No es una caché: en cuanto termina, la siguiente vuelve a pedir. De cuánto
 * duran los datos ya decide TanStack Query; esto solo evita que dos partes de
 * la interfaz pidan lo mismo a la vez. Medido al entrar: `get_live_categories`
 * salía dos veces, una por el gancho de la barra lateral y otra desde dentro de
 * `canales()`, contra un panel que admite UNA conexión simultánea.
 */
export function unaSola(clave, hacer) {
  const yaVa = enVuelo.get(clave);
  if (yaVa) return yaVa;
  // El `finally` es imprescindible: sin él, una petición fallida dejaría la
  // clave ocupada para siempre y nadie podría reintentar.
  const promesa = Promise.resolve().then(hacer).finally(() => enVuelo.delete(clave));
  enVuelo.set(clave, promesa);
  return promesa;
}

// Categorías para adultos. El filtro lo hacía el backend cuando el front pedía
// `?adultos=false`; yendo directo no lo hace nadie, y sin esto la categoría
// aparece en la lista de un televisor familiar.
export const ES_DE_ADULTOS = /adult|xxx|porn|\+18/i;

// Un conjunto de ids vetados POR CATÁLOGO, no uno solo. Los ids se repiten entre
// catálogos —la categoría 17 es NETFLIX en películas y otra cosa en directo—,
// así que un único conjunto vetaría categorías inocentes en cuanto hubiera una
// de adultos con el mismo número en otro catálogo.
const vetadasPorCatalogo = new Map();

export function anotarVetadas(catalogo, crudas) {
  vetadasPorCatalogo.set(
    catalogo,
    new Set(
      crudas
        .filter((c) => ES_DE_ADULTOS.test(c.category_name || ''))
        .map((c) => String(c.category_id)),
    ),
  );
}

/** `false` mientras no se hayan pedido las categorías de ese catálogo. */
export function hayVetadas(catalogo) {
  return vetadasPorCatalogo.has(catalogo);
}

export function estaVetada(catalogo, id) {
  const suyas = vetadasPorCatalogo.get(catalogo);
  return Boolean(suyas && suyas.has(String(id)));
}

export function normalizarCategorias(catalogo, crudas, adultos) {
  anotarVetadas(catalogo, crudas);
  return crudas
    .filter((c) => adultos || !ES_DE_ADULTOS.test(c.category_name || ''))
    .map((c) => ({ id: String(c.category_id), name: c.category_name }));
}

/**
 * Todas las categorías de un elemento del catálogo.
 *
 * Puede estar en VARIAS: `category_id` es la principal (texto) y `category_ids`
 * las lleva todas (enteros). Mirar solo la principal deja fuera de su categoría
 * a lo que está en más de una.
 */
export function categoriasDe(item) {
  const ids = new Set();
  if (item.category_id != null) ids.add(String(item.category_id));
  if (Array.isArray(item.category_ids)) {
    for (const id of item.category_ids) ids.add(String(id));
  }
  return ids;
}

/**
 * Guarda la sesión del televisor.
 *
 * `sesion` lleva lo que decide nuestro backend y la app no puede inventarse:
 * `{ codigo, base_url, caduca_el, revalidado_en }`. Va aparte de `info`
 * -que es lo que dice el panel del proveedor- porque son dos fuentes
 * distintas y se actualizan en momentos distintos.
 */
export function guardarCredenciales(usuario, clave, info = null, sesion = {}) {
  try {
    // `user_info` viene con `username` y `password` dentro: el panel devuelve la
    // contraseña en claro en cada respuesta. Se quitan antes de guardar para no
    // dejarla escrita dos veces en el almacenamiento del televisor.
    let resumen = null;
    if (info) {
      resumen = { ...info };
      delete resumen.password;
      delete resumen.username;
    }
    // Lo que ya hubiera se conserva: al revalidar solo llegan los campos que
    // cambian, y escribir el objeto entero borraría el código de acceso.
    const previo = credenciales() ?? {};
    localStorage.setItem(
      CLAVE_ALMACEN,
      JSON.stringify({ ...previo, usuario, clave, info: resumen, ...sesion }),
    );
  } catch {
    // Almacenamiento lleno o bloqueado: la sesión durará lo que dure la app.
  }
}

export function credenciales() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_ALMACEN) || 'null');
  } catch {
    return null;
  }
}

/**
 * `user_info` de la línea, tal como lo devolvió el panel al entrar.
 *
 * Interesan `allowed_output_formats`, que decide la extensión de la URL de
 * directo, y `max_connections`, que en las líneas de prueba es 1 — y superarlo
 * provoca fallos de reproducción que PARECEN de autenticación.
 */
export function infoDeCuenta() {
  const guardadas = credenciales();
  return guardadas ? guardadas.info ?? null : null;
}

export function olvidarCredenciales() {
  try {
    localStorage.removeItem(CLAVE_ALMACEN);
  } catch {
    // Nada que hacer; el estado en memoria ya se ha limpiado.
  }
  vetadasPorCatalogo.clear();
  // Cambiar de cuenta tiene que volver a pedir el código. El CÓDIGO no se
  // borra: es un control del televisor, no una credencial de la cuenta.
  mostrarAdultos(false);
}

/** Una llamada a `player_api.php` con las credenciales dadas. */
export async function llamar(usuario, clave, parametros = {}) {
  const consulta = new URLSearchParams({ username: usuario, password: clave });
  for (const [nombre, valor] of Object.entries(parametros)) {
    if (valor != null) consulta.set(nombre, String(valor));
  }

  let respuesta;
  try {
    respuesta = await fetch(`${panel()}/player_api.php?${consulta}`);
  } catch {
    // Sin red o servidor caído: código nulo, que `mensajeDeError` traduce a
    // "no hay conexión".
    throw new ErrorDeApi(null, '');
  }

  // El panel responde 404 con HTML tanto a una ruta inexistente como a unas
  // credenciales incorrectas. Traducirlo a 401 es lo que hace que el usuario lea
  // "usuario o contraseña incorrectos" en vez del mensaje de 404, que aquí sería
  // "este contenido ya no está disponible".
  if (respuesta.status === 404) {
    throw new ErrorDeApi(401, 'Usuario o contraseña incorrectos.');
  }
  if (!respuesta.ok) throw new ErrorDeApi(respuesta.status, '');

  const tipo = respuesta.headers.get('content-type') || '';
  if (!tipo.includes('application/json')) {
    throw new ErrorDeApi(401, 'Usuario o contraseña incorrectos.');
  }
  return respuesta.json();
}

/** Igual que `llamar`, pero con las credenciales ya guardadas. */
export async function consultar(parametros) {
  const guardadas = credenciales();
  if (!guardadas) throw new ErrorDeApi(401, '');
  return llamar(guardadas.usuario, guardadas.clave, parametros);
}

/**
 * Las acciones de catálogo devuelven arrays planos.
 *
 * Si el panel recibe una `action` que no conoce, NO da error: la ignora y
 * responde con `{ user_info, server_info }` y un 200. Sin este control ese
 * objeto llegaría a un `.filter` y reventaría con un TypeError que no diría nada
 * del problema real, que es un nombre de acción mal escrito.
 */
export function lista(datos, accion) {
  if (Array.isArray(datos)) return datos;
  if (datos && typeof datos === 'object' && 'user_info' in datos) {
    throw new ErrorDeApi(null, `El panel no reconoce la acción «${accion}».`);
  }
  return [];
}

// Aquí había un `iniciarSesion` que validaba usuario y clave contra el panel
// y los guardaba. Se retiró al llegar el código de acceso: era una segunda
// puerta que no lo pedía, así que cualquiera con una cuenta del proveedor
// entraba y no había forma de cortarle el paso a nadie.
//
// Ahora entra por `lib/acceso.js`, contra NUESTRO backend, que valida las
// mismas credenciales contra el panel y además devuelve contra cuál. Las
// comprobaciones que se hacían aquí -`auth`, `status`, `exp_date`- las hace
// `LoginResponse.is_valid()` en el backend.
