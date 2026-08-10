/**
 * Qué debe hacer ATRÁS, según lo que haya abierto.
 *
 * Vive aquí y no dentro del manejador de teclas por dos razones. La primera es
 * que se puede probar: son ocho casos con un orden que importa, y comprobarlos
 * a mano en el televisor es lento y se olvida. La segunda es que el orden se
 * lee de un vistazo, que es justo lo que faltaba cuando el teclado del buscador
 * no aparecía en él.
 *
 * Se cierra siempre la capa MÁS INTERNA primero. Da igual que haya una búsqueda
 * puesta y una ficha abierta: si encima de todo hay un teclado, ATRÁS cierra el
 * teclado.
 */
export function accionDeAtras(estado) {
  const {
    menuPistas, pidiendoCodigo, tecleando, reproduciendo, detalle, busqueda, seccion,
  } = estado || {};

  // El menú de pistas es la capa de más arriba: se abre ENCIMA del vídeo a
  // pantalla completa y encima de la lista de canales.
  if (menuPistas) return 'cerrarMenuPistas';
  // Los dos teclados no pueden coexistir —el numérico solo existe en Ajustes,
  // donde no hay buscador—, pero el orden se escribe igual: una tabla completa
  // se lee mejor que una con huecos.
  if (pidiendoCodigo) return 'cerrarTecladoNumerico';
  if (tecleando) return 'cerrarTeclado';
  if (reproduciendo) return 'cerrarReproductor';
  if (detalle) return 'cerrarDetalle';
  if (busqueda) return 'limpiarBusqueda';
  if (seccion && seccion !== 'envivo') return 'irAEnVivo';
  // En vivo es la pantalla raíz: aquí ATRÁS deja el vídeo limpio, y un segundo
  // ATRÁS dentro de la ventana de confirmación sale de la aplicación.
  return 'ocultar';
}
