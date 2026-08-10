// Favoritos guardados EN EL TELEVISOR.
//
// El panel XUI no tiene favoritos: eran cosa del backend propio. Yendo directo
// no hay dónde guardarlos en el servidor, así que viven en `localStorage`. La
// consecuencia es que dejan de compartirse con la web y con otros aparatos.
//
// Se conserva la forma que espera `MiLista`: `[{ kind, item_id }]`.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const CLAVE_ALMACEN = 'fp_favoritos';

function leer() {
  try {
    const guardados = JSON.parse(localStorage.getItem(CLAVE_ALMACEN) || '[]');
    return Array.isArray(guardados) ? guardados : [];
  } catch {
    return [];
  }
}

function escribir(ids) {
  try {
    localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(ids));
  } catch {
    // Almacenamiento lleno o bloqueado: no se pierde nada más que el favorito.
  }
}

export function useFavoritos() {
  return useQuery({
    queryKey: ['favoritos'],
    queryFn: async () => leer().map((id) => ({ kind: 'live', item_id: id })),
    staleTime: Infinity, // es almacenamiento local: no caduca solo
  });
}

export function useAlternarFavorito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, activo }) => {
      const id = String(itemId);
      const ids = leer().map(String);
      escribir(activo ? ids.filter((x) => x !== id) : [...new Set([...ids, id])]);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['favoritos'] }),
  });
}
