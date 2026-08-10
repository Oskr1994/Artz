// El código de acceso, tal como se teclea y tal como se manda.
//
// Copiado de `frontend/src/lib/codigo.js` en vez de importado: esta app dejó
// de tomar nada de `frontend/src` cuando dejó de pasar por nuestro backend
// (ver el comentario del `vite.config.js`), y no se va a reponer aquel alias
// por veinte líneas sin dependencias. Mismo criterio que con `errores.js`.

// El mismo alfabeto que `app/admin/codigos.py` en el backend y que la web.
// Duplicado a propósito: la alternativa era un endpoint para preguntarlo, y
// son 31 caracteres que no van a cambiar. Si cambiaran, cambian en los tres
// sitios y hay un test en cada uno que se cae.
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const LONGITUD = 8;

/**
 * Lo que se ve mientras se teclea: mayúsculas, sin basura y con el guion.
 *
 * FILTRA lo que no es del alfabeto en vez de rechazarlo. Con un mando y un
 * teclado en pantalla eso importa: da igual que salga el guion largo, una
 * minúscula o un espacio pegado al pegar desde otro sitio.
 */
export function formatearCodigo(texto) {
  const limpio = [...(texto ?? '').toUpperCase()]
    .filter((c) => ALFABETO.includes(c))
    .slice(0, LONGITUD)
    .join('');
  return limpio.length > 4 ? `${limpio.slice(0, 4)}-${limpio.slice(4)}` : limpio;
}

/** Lo que se manda al servidor: el mismo, sin el guion. */
export function normalizarCodigo(texto) {
  return formatearCodigo(texto).replace('-', '');
}
