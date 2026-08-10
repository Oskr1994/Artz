// Las pistas de audio y subtítulos que trae el contenido, tal como las da
// AVPlay y con nombres que se entiendan a tres metros.

// Los idiomas que aparecen en este catálogo. Un código que no esté se enseña en
// mayúsculas: «KOR» dice más que «Pista 2».
const IDIOMAS = {
  spa: 'Español', esp: 'Español', es: 'Español',
  eng: 'Inglés', en: 'Inglés',
  por: 'Portugués', pt: 'Portugués',
  fra: 'Francés', fre: 'Francés', fr: 'Francés',
  ita: 'Italiano', it: 'Italiano',
  deu: 'Alemán', ger: 'Alemán', de: 'Alemán',
  jpn: 'Japonés', ja: 'Japonés',
};

export function nombreDeIdioma(codigo) {
  const limpio = String(codigo || '').trim().toLowerCase();
  if (!limpio) return 'Desconocido';
  return IDIOMAS[limpio] || limpio.toUpperCase();
}

/**
 * `extra_info` viene como JSON EN TEXTO, y a veces con basura dentro.
 *
 * Devolver `{}` ante lo que no se pueda leer deja la pista utilizable —con su
 * índice, que es lo que hace falta para seleccionarla— en vez de perderla.
 */
function extras(pista) {
  try {
    return JSON.parse(pista.extra_info || '{}') || {};
  } catch {
    return {};
  }
}

/**
 * Reparte las pistas de `getTotalTrackInfo()` en audio y subtítulos.
 *
 * El `indice` es el `index` de AVPlay sin tocar: es lo que espera
 * `setSelectTrack`, y no tiene por qué coincidir con la posición en la lista,
 * porque en medio van las de vídeo.
 */
export function normalizarPistas(crudas) {
  const audio = [];
  const subtitulos = [];
  if (!Array.isArray(crudas)) return { audio, subtitulos };

  for (const cruda of crudas) {
    const tipo = String(cruda.type || '').toUpperCase();
    if (tipo !== 'AUDIO' && tipo !== 'TEXT') continue; // el vídeo no se elige

    const info = extras(cruda);
    // En audio el idioma es `language`; en subtítulos, `track_lang`.
    const idioma = String(info.language || info.track_lang || '').trim().toLowerCase();
    const titulo = String(info.title || info.track_name || '').trim();

    const pista = {
      indice: cruda.index,
      tipo,
      idioma: idioma || null,
      // El título del fichero manda: es lo que el proveedor quiso que se leyera
      // («Español Latino» dice más que «Español»). Si no hay, se traduce el
      // código; y si tampoco hay código, al menos el número de pista.
      etiqueta: titulo || (idioma ? nombreDeIdioma(idioma) : `Pista ${cruda.index}`),
    };

    if (tipo === 'AUDIO') audio.push(pista);
    else subtitulos.push(pista);
  }

  return { audio, subtitulos };
}

export { IDIOMAS };
