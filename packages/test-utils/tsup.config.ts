import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsup';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    external: ['vitest', '@sadikkhan02/notifykit'],
    outExtension() {
      return { js: '.js' };
    },
  },
  {
    entry: ['src/index.ts'],
    format: ['cjs'],
    dts: true,
    clean: false,
    sourcemap: true,
    external: ['@sadikkhan02/notifykit'],
    noExternal: ['vitest'],
    esbuildOptions(options) {
      options.alias = {
        vitest: path.resolve(__dirname, 'src/vitest-shim.cjs'),
      };
    },
    outExtension() {
      return { js: '.cjs' };
    },
  },
]);
