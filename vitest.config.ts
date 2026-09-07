import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@mycarcost/shared': path.resolve(__dirname, './shared/src'),
    },
  },
  test: {
    globals: true,
    include: [
      'shared/**/*.{test,spec}.{ts,tsx}',
      'frontend/**/*.{test,spec}.{ts,tsx}',
      'worker/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
