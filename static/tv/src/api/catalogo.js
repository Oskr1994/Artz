// Ganchos de catálogo, con las mismas firmas que los de la web para que las
// pantallas se lean igual en los dos sitios.
//
// Todas las claves empiezan por `claveDeSesion()`: la caché sobrevive a cerrar
// sesión, y sin eso al entrar con otra cuenta se seguía viendo el catálogo de
// la anterior.
import { useQuery } from '@tanstack/react-query';
import {
  categoriasDePeliculas, peliculas, pelicula,
  categoriasDeSeries, series, serie,
} from '../lib/xui.js';
import { claveDeSesion } from '../lib/xui/nucleo.js';

// Las categorías no cambian dentro de una sesión: no merece repetir la petición
// a un panel que solo admite una conexión simultánea.
const CATEGORIAS = 30 * 60_000;
// Los listados cambian poco y son grandes: media hora de frescura evita volver a
// bajar 2,5 MB por ir y volver de una ficha.
const LISTADOS = 30 * 60_000;

/**
 * `activo` es lo que evita pedirlas al entrar.
 *
 * `App` llama a los tres ganchos de categorías —directo, películas y series—
 * porque la barra lateral pinta las de la sección activa. Sin `enabled`, al
 * iniciar sesión se pedían las tres aunque solo se vea una: medido en Chrome,
 * dos peticiones de más contra un panel que admite UNA conexión simultánea, y
 * eso en el momento en que la app está haciendo todo lo demás.
 */
export function useCategoriasPeliculas(adultos = false, activo = true) {
  return useQuery({
    queryKey: [claveDeSesion(), 'vod', 'categorias', adultos],
    queryFn: () => categoriasDePeliculas({ adultos }),
    enabled: activo,
    staleTime: CATEGORIAS,
  });
}

export function usePeliculas({ category = null, q = '' } = {}) {
  return useQuery({
    queryKey: [claveDeSesion(), 'vod', 'peliculas', category, q],
    queryFn: () => peliculas({ category, q }),
    staleTime: LISTADOS,
  });
}

export function usePelicula(id) {
  return useQuery({
    queryKey: [claveDeSesion(), 'vod', 'pelicula', id],
    queryFn: () => pelicula(id),
    enabled: id != null,
    staleTime: LISTADOS,
  });
}

/** Ver `useCategoriasPeliculas` para qué hace `activo`. */
export function useCategoriasSeries(adultos = false, activo = true) {
  return useQuery({
    queryKey: [claveDeSesion(), 'series', 'categorias', adultos],
    queryFn: () => categoriasDeSeries({ adultos }),
    enabled: activo,
    staleTime: CATEGORIAS,
  });
}

export function useSeries({ category = null, q = '' } = {}) {
  return useQuery({
    queryKey: [claveDeSesion(), 'series', 'listado', category, q],
    queryFn: () => series({ category, q }),
    staleTime: LISTADOS,
  });
}

export function useSerie(id) {
  return useQuery({
    queryKey: [claveDeSesion(), 'series', 'serie', id],
    queryFn: () => serie(id),
    enabled: id != null,
    staleTime: LISTADOS,
  });
}
