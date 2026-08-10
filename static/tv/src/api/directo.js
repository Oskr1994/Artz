// Mismos ganchos que `@nucleo/api/directo.js`, pero contra el panel XUI en vez
// de contra el backend propio. La firma es idéntica a propósito: los
// componentes solo cambian de dónde importan, no cómo se usan.
//
// Todas las claves empiezan por `claveDeSesion()`. Sin eso, al entrar con otra
// cuenta se seguían viendo los canales de la anterior: la caché sobrevive al
// cierre de sesión y `staleTime` daba esos datos por frescos.
import { useQuery } from '@tanstack/react-query';
import { categorias, canales, epg } from '../lib/xui.js';
import { claveDeSesion } from '../lib/xui/nucleo.js';

export function useCategoriasDirecto(adultos = false, activo = true) {
  return useQuery({
    queryKey: [claveDeSesion(), 'live', 'categorias', adultos],
    queryFn: () => categorias({ adultos }),
    // Solo se piden las de la sección que se está viendo. Ver el comentario de
    // `useCategoriasPeliculas` en `api/catalogo.js`.
    enabled: activo,
    staleTime: 30 * 60_000, // cambian poquísimo; no merece repetir la petición
  });
}

// Los 149 canales caben de sobra en una sola petición: se piden enteros y se
// filtra en el televisor. El panel solo admite UNA conexión simultánea, así que
// cuantas menos peticiones se le hagan, mejor.
export function useCanales({ category = null, q = '' } = {}) {
  return useQuery({
    queryKey: [claveDeSesion(), 'live', 'canales', category, q],
    queryFn: () => canales({ category, q }),
    staleTime: 5 * 60_000,
  });
}

export function useEpg(streamId) {
  return useQuery({
    queryKey: [claveDeSesion(), 'live', 'epg', streamId],
    queryFn: () => epg(streamId),
    enabled: streamId != null,
    staleTime: 5 * 60_000,
    retry: false, // la guía está vacía en este panel; insistir no la crea
  });
}
