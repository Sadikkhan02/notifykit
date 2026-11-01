import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['nodemailer', '@sadikkhan02/notifykit', '@sadikkhan02/notifykit/interfaces'],
  outExtension({ format }) {
    return {
      js: format === 'esm' ? '.js' : '.cjs',
    };
  },
});
