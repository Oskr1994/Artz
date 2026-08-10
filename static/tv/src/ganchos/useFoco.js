import { useEffect, useRef } from 'react';
import { registrar, enfocar, enfocado } from '../lib/foco.js';

/** Registra el elemento en el gestor de foco mientras el componente viva. */
export function useFoco({ inicial = false } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return undefined;
    const quitar = registrar(ref.current);
    // El primero que se declare inicial se lleva el foco si aún no hay
    // ninguno: una pantalla de televisor nunca debe aparecer sin nada
    // enfocado, porque entonces el mando no haría absolutamente nada y el
    // usuario no tendría forma de saber por qué.
    if (inicial && !enfocado()) enfocar(ref.current);
    return quitar;
  }, [inicial]);

  return ref;
}
