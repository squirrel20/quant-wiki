import esbuild from 'esbuild';

const prod = process.argv.includes('production');

const ctx = await esbuild.context({
  entryPoints: ['main.ts'],
  bundle: true,
  external: ['obsidian', 'electron'],
  format: 'cjs',
  target: 'es2022',
  sourcemap: prod ? false : 'inline',
  minify: prod,
  logLevel: 'info',
  outfile: 'main.js',
});

if (prod) {
  await ctx.rebuild();
  await ctx.dispose();
} else {
  await ctx.watch();
}
