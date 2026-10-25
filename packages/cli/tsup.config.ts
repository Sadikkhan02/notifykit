import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  banner: {
    js: '#!/usr/bin/env node',
  },
  dts: true,
  clean: true,
  sourcemap: true,
  outExtension() {
    return { js: '.js' };
  },
});
