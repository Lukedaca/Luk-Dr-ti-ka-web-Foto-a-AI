const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputDir = path.join(__dirname, '..', 'assets', 'portfolio');
const outputDir = path.join(__dirname, '..', 'dist', 'images', 'portfolio');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const MAX_WIDTH = 1100;
const CARD_WIDTH = 760;
const LIGHTBOX_WIDTH = 1920;
const JPEG_QUALITY = 82;
const WEBP_QUALITY = 72;
const AVIF_QUALITY = 50;
const CARD_JPEG_QUALITY = 78;
const CARD_WEBP_QUALITY = 60;
const CARD_AVIF_QUALITY = 42;
const LIGHTBOX_WEBP_QUALITY = 78;
const LIGHTBOX_AVIF_QUALITY = 55;
const BLUR_SIZE = 20;

const CONCURRENCY = Math.max(2, Math.min(6, require('os').cpus().length));

let totalOriginal = 0;
let totalOptimized = 0;
let skipped = 0;

function outputsFresh(inputPath, outputs) {
  try {
    const inputMtime = fs.statSync(inputPath).mtimeMs;
    return outputs.every(p => fs.existsSync(p) && fs.statSync(p).mtimeMs >= inputMtime);
  } catch {
    return false;
  }
}

async function processFile(inputPath, outDir, baseName, { lightbox = false } = {}) {
  const originalSize = fs.statSync(inputPath).size;

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const avifPath = path.join(outDir, `${baseName}.avif`);
  const webpPath = path.join(outDir, `${baseName}.webp`);
  const jpegPath = path.join(outDir, `${baseName}.jpg`);
  const blurPath = lightbox ? null : path.join(outDir, `${baseName}-blur.jpg`);
  const cardAvifPath = lightbox ? null : path.join(outDir, `${baseName}-card.avif`);
  const cardWebpPath = lightbox ? null : path.join(outDir, `${baseName}-card.webp`);
  const cardJpegPath = lightbox ? null : path.join(outDir, `${baseName}-card.jpg`);
  const requiredOutputs = [avifPath, webpPath, jpegPath].concat(
    blurPath ? [blurPath, cardAvifPath, cardWebpPath, cardJpegPath] : []
  );

  if (outputsFresh(inputPath, requiredOutputs)) {
    totalOriginal += originalSize;
    totalOptimized += fs.statSync(avifPath).size;
    skipped++;
    return 'skip';
  }

  totalOriginal += originalSize;

  const image = sharp(inputPath).rotate();
  const metadata = await image.metadata();
  const targetWidth = lightbox ? LIGHTBOX_WIDTH : MAX_WIDTH;
  const resizeOptions = metadata.width > targetWidth ? { width: targetWidth } : {};

  await image.clone().resize(resizeOptions)
    .avif({ quality: lightbox ? LIGHTBOX_AVIF_QUALITY : AVIF_QUALITY, effort: 7 })
    .toFile(avifPath);
  totalOptimized += fs.statSync(avifPath).size;

  await image.clone().resize(resizeOptions)
    .webp({ quality: lightbox ? LIGHTBOX_WEBP_QUALITY : WEBP_QUALITY, effort: 6 })
    .toFile(webpPath);

  await image.clone().resize(resizeOptions)
    .jpeg({ quality: JPEG_QUALITY, progressive: true, mozjpeg: true })
    .toFile(jpegPath);

  if (blurPath) {
    await image.clone().resize({ width: BLUR_SIZE }).blur(5)
      .jpeg({ quality: 30 }).toFile(blurPath);
  }

  if (cardAvifPath && cardWebpPath && cardJpegPath) {
    const cardResizeOptions = metadata.width > CARD_WIDTH ? { width: CARD_WIDTH } : {};

    await image.clone().resize(cardResizeOptions)
      .avif({ quality: CARD_AVIF_QUALITY, effort: 7 })
      .toFile(cardAvifPath);

    await image.clone().resize(cardResizeOptions)
      .webp({ quality: CARD_WEBP_QUALITY, effort: 6 })
      .toFile(cardWebpPath);

    await image.clone().resize(cardResizeOptions)
      .jpeg({ quality: CARD_JPEG_QUALITY, progressive: true, mozjpeg: true })
      .toFile(cardJpegPath);
  }

  const webpSize = fs.statSync(webpPath).size;
  return ((1 - webpSize / originalSize) * 100).toFixed(1);
}

async function runInParallel(tasks, limit) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      try {
        results[idx] = await tasks[idx]();
      } catch (err) {
        results[idx] = { error: err };
      }
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

async function optimizeImages() {
  if (!fs.existsSync(inputDir)) {
    console.log('No portfolio images directory found, skipping optimization...');
    return;
  }

  const entries = fs.readdirSync(inputDir, { withFileTypes: true });

  const topLevelFiles = entries
    .filter(e => e.isFile() && /\.(jpg|jpeg|png|webp)$/i.test(e.name))
    .map(e => e.name);

  console.log(`Optimizing ${topLevelFiles.length} top-level images (main max ${MAX_WIDTH}px, card max ${CARD_WIDTH}px, concurrency=${CONCURRENCY})...\n`);
  const topTasks = topLevelFiles.map(file => async () => {
    try {
      const savings = await processFile(
        path.join(inputDir, file),
        outputDir,
        path.parse(file).name
      );
      console.log(savings === 'skip' ? `↷ ${file} (up to date)` : `✓ ${file} → WebP (${savings}% smaller)`);
    } catch (err) {
      console.error(`Error optimizing ${file}:`, err.message);
    }
  });
  await runInParallel(topTasks, CONCURRENCY);

  const subDirs = entries.filter(e => e.isDirectory() && e.name !== 'thumbs').map(e => e.name);

  for (const dir of subDirs) {
    const subInput = path.join(inputDir, dir);
    const subOutput = path.join(outputDir, dir);
    const files = fs.readdirSync(subInput).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
    if (files.length === 0) continue;

    console.log(`\nOptimizing gallery "${dir}" — ${files.length} images (lightbox ${LIGHTBOX_WIDTH}px)...`);
    const tasks = files.map(file => async () => {
      try {
        const savings = await processFile(
          path.join(subInput, file),
          subOutput,
          path.parse(file).name,
          { lightbox: true }
        );
        console.log(savings === 'skip' ? `  ↷ ${dir}/${file} (up to date)` : `  ✓ ${dir}/${file} → WebP (${savings}% smaller)`);
      } catch (err) {
        console.error(`  Error optimizing ${dir}/${file}:`, err.message);
      }
    });
    await runInParallel(tasks, CONCURRENCY);
  }

  const totalSavings = totalOriginal > 0 ? ((1 - totalOptimized / totalOriginal) * 100).toFixed(1) : '0';
  console.log(`\nTotal: ${(totalOriginal / 1024 / 1024).toFixed(2)} MB → ${(totalOptimized / 1024 / 1024).toFixed(2)} MB (${totalSavings}% AVIF savings, ${skipped} skipped)`);
}

optimizeImages().catch(console.error);
