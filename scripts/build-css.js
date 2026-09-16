const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const tempFile = path.join(rootDir, 'dist', 'css', 'tailwind.tmp.css');
const customFile = path.join(rootDir, 'assets', 'styles.css');
const swissFile = path.join(rootDir, 'assets', 'swiss-redesign.css');
const techStackFixFile = path.join(rootDir, 'assets', 'remove-tech-stack.css');
const outputFile = path.join(rootDir, 'dist', 'css', 'styles.min.css');

const tailwindCss = fs.readFileSync(tempFile, 'utf8');
const customCss = fs.readFileSync(customFile, 'utf8');
const swissCss = fs.existsSync(swissFile) ? fs.readFileSync(swissFile, 'utf8') : '';
const techStackFixCss = fs.existsSync(techStackFixFile) ? fs.readFileSync(techStackFixFile, 'utf8') : '';
const combinedCss = `${tailwindCss}\n${customCss}\n${swissCss}\n${techStackFixCss}`;

const result = esbuild.transformSync(combinedCss, {
  loader: 'css',
  minify: true,
  target: 'es2020'
});

fs.writeFileSync(outputFile, result.code);
fs.unlinkSync(tempFile);

console.log(`Combined CSS: ${Buffer.byteLength(result.code)} bytes (minified)`);
