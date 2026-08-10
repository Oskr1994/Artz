import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import './estilos/tv.css';

const cliente = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Un televisor no cambia de ventana: refrescar al recuperar el foco solo
      // dispararía peticiones extra contra un panel que admite pocas conexiones.
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('raiz')).render(
  <StrictMode>
    <QueryClientProvider client={cliente}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
