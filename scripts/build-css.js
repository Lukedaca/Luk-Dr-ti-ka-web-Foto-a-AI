const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const tempFile = path.join(rootDir, 'dist', 'css', 'tailwind.tmp.css');
const outputFile = path.join(rootDir, 'dist', 'css', 'styles.min.css');

// Jen Tailwind (+ font a hlasový orb z main.css). Vzhled stránek nese
// assets/personal.css (homepage) a assets/gallery.css (galerie).
const tailwindCss = fs.readFileSync(tempFile, 'utf8');

const result = esbuild.transformSync(tailwindCss, {
  loader: 'css',
  minify: true,
  target: 'es2020'
});

fs.writeFileSync(outputFile, result.code);
fs.unlinkSync(tempFile);

console.log(`Combined CSS: ${Buffer.byteLength(result.code)} bytes (minified)`);
