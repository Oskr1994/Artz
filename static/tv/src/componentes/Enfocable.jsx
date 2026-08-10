import { useFoco } from '../ganchos/useFoco.js';

/**
 * Cualquier cosa a la que se pueda llegar con el mando.
 *
 * Se apoya en `onClick` a propósito: el bucle de teclado de `App.jsx` traduce
 * OK a `.click()` sobre el elemento enfocado. Así el mismo componente responde
 * al mando en el televisor y al ratón en Chromium durante el desarrollo, sin
 * dos caminos distintos que mantener.
 */
export default function Enfocable({
  children, alPulsar, inicial = false, className = '', ...resto
}) {
  const ref = useFoco({ inicial });
  return (
    <div ref={ref} tabIndex={-1} className={`enfocable ${className}`}
      onClick={alPulsar} {...resto}>
      {children}
    </div>
  );
}
