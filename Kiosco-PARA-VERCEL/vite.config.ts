import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      // Importante: ignoramos la carpeta `data/` (y los respaldos) porque ahi se guarda
      // store.json. Si Vite vigila ese archivo, cada vez que se guardan datos (pedidos,
      // abonos, importaciones) recarga la pagina sola y se pierde lo que estabas haciendo.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: ['**/.git/**', '**/node_modules/**', '**/data/**', '**/*.bak', '**/*.log'],
      },
    },
  };
});
