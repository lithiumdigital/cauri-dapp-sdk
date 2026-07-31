import { defineConfig } from 'tsdown'

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    outDir: 'dist',
    sourcemap: true,
    clean: true,
    treeshake: true,
    target: 'es2020',
    platform: 'browser',
    dts: false,
    outExtensions: ({ format }) => ({ js: format === 'cjs' ? '.cjs' : '.js' }),
})
