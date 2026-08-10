// Iconos en SVG, dibujados aquí en vez de traer `lucide-react` como hace la
// web: son cuatro trazos y meter una dependencia entera en el paquete del
// televisor por eso no sale a cuenta. Mismo grosor de trazo (2) y mismo estilo
// de contorno que los de la web, para que se lean como la misma familia.
//
// A tres metros el tamaño por defecto es 32, no los 18 de la web.

function Svg({ children, tam = 32 }) {
  return (
    <svg className="icono" width={tam} height={tam} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export function IconoEnVivo(props) {
  return (
    <Svg {...props}>
      <path d="M4.9 19.1a10 10 0 0 1 0-14.2M19.1 4.9a10 10 0 0 1 0 14.2" />
      <path d="M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconoBuscar(props) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </Svg>
  );
}

export function IconoMiLista(props) {
  return (
    <Svg {...props}>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </Svg>
  );
}

/** Claqueta: una bobina sería un círculo más y a 32 px no se distingue. */
export function IconoPeliculas(props) {
  return (
    <Svg {...props}>
      <rect x="2" y="3" width="20" height="18" rx="2" />
      <path d="M7 3v18M17 3v18M2 9h5M2 15h5M17 9h5M17 15h5" />
    </Svg>
  );
}

export function IconoSeries(props) {
  return (
    <Svg {...props}>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M7 3l5 4 5-4" />
    </Svg>
  );
}

/** Puerta con flecha saliendo: cerrar sesión. */
export function IconoSalir(props) {
  return (
    <Svg {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </Svg>
  );
}

/** Bocadillo con líneas: audio y subtítulos. */
export function IconoPistas(props) {
  return (
    <Svg {...props}>
      <rect x="2" y="4" width="20" height="14" rx="2" />
      <path d="M6 9h8M6 13h5" />
    </Svg>
  );
}

/** La estrella se rellena cuando el canal está en la lista. */
export function IconoEstrella({ relleno = false, tam = 30 }) {
  return (
    <svg className="icono" width={tam} height={tam} viewBox="0 0 24 24"
      fill={relleno ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01z" />
    </svg>
  );
}
