/** Duración legible a partir de segundos. `null` cuando no hay dato. */
export function formatearDuracion(segundos) {
  const total = Number(segundos);
  if (!total || total < 0) return null;
  // Se TRUNCA, no se redondea, igual que hace el panel: `duration_secs` 6396 es
  // `duration: "01:46:36"` y `episode_run_time: 106`. Redondeando saldría
  // "1 h 47 min" y no cuadraría con lo que el propio proveedor anuncia.
  const minutosTotales = Math.floor(total / 60);
  const horas = Math.floor(minutosTotales / 60);
  const minutos = minutosTotales % 60;
  return horas ? `${horas} h ${minutos} min` : `${minutos} min`;
}

/** `1:46:36` o `36:07`, para la barra de progreso del reproductor. */
export function reloj(segundos) {
  const total = Math.max(0, Math.floor(Number(segundos) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const dos = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${dos(m)}:${dos(s)}` : `${m}:${dos(s)}`;
}
