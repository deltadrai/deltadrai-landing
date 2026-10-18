// Static build: copy src → _site, expand includes, copy vendor ESM + fonts.
// CSS is compiled separately by the Tailwind CLI (see package.json).
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, watch, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const src = join(root, 'src');
const out = join(root, '_site');
const nm = join(root, 'node_modules');
const watching = process.argv.includes('--watch');

// Fonts are the Google Fonts files, shipped by @fontsource; copied rather than committed
// because the pre-commit hook rejects binary blobs.
const FONT_WEIGHTS = [400, 600, 700, 800];

const skip = (path) => path.startsWith(join(src, '_includes')) || path === join(src, 'css', 'app.css');

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

/** Includes resolve relative to src/_includes/, are one level deep and take no parameters. */
const expand = (html) =>
  html.replace(/<!--\s*@include\s+(\S+)\s*-->/g, (_, file) =>
    readFileSync(resolve(src, '_includes', file), 'utf8'),
  );

function copySource() {
  cpSync(src, out, { recursive: true, filter: (path) => !skip(path) });
  for (const file of walk(out).filter((f) => f.endsWith('.html'))) {
    writeFileSync(file, expand(readFileSync(file, 'utf8')));
  }
}

function copyVendor() {
  const copy = (from, to) => {
    mkdirSync(dirname(join(out, to)), { recursive: true });
    cpSync(join(nm, from), join(out, to));
  };
  copy('alpinejs/dist/module.esm.js', 'vendor/alpinejs/module.esm.js');
  copy('htmx.org/dist/htmx.esm.js', 'vendor/htmx/htmx.esm.js');
  for (const file of readdirSync(join(nm, 'gsap')).filter((f) => f.endsWith('.js'))) {
    copy(`gsap/${file}`, `vendor/gsap/${file}`);
  }
  for (const weight of FONT_WEIGHTS) {
    const file = `poppins-latin-${weight}-normal.woff2`;
    copy(`@fontsource/poppins/files/${file}`, `fonts/${file}`);
  }
}

if (!watching) rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
copySource();
copyVendor();

if (watching) {
  // Never delete _site/css/app.css here: the Tailwind watcher owns it.
  watch(src, { recursive: true }, () => copySource());
}
