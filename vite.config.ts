import {defineConfig, loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig(({mode}) => {
  const fileEnv = loadEnv(mode, '.', '');
  /** Merge so GitHub Actions / CI can inject secrets via `process.env` without a checked-in `.env`. */
  const env = {...fileEnv, ...process.env} as NodeJS.ProcessEnv & typeof fileEnv;
  return {
    base: mode === 'production' ? '/step-2-it-up/' : '/',
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
