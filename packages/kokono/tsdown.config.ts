import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    entry: './src/index.ts',
    platform: 'node',
    clean: ['./dist'],
    outDir: './dist',
    minify: true,
  },
]);
