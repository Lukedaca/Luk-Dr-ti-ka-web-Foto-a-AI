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
const LIGHTBOX_WIDTH = 1920;
const JPEG_QUALITY = 82;
const WEBP_QUALITY = 72;
const AVIF_QUALITY = 50;
const LIGHTBOX_WEBP_QUALITY = 78;
const LIGHTBOX_AVIF_QUALITY = 55;
const BLUR_SIZE = 20;

let totalOriginal = 0;
let totalOptimized = 0;

async function processFile(inputPath, outDir, baseName, { lightbox = false } = {}) {
  const originalSize = fs.statSync(inputPath).size;
  totalOriginal += originalSize;

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const image = sharp(inputPath).rotate();
  const metadata = await image.metadata();
  const targetWidth = lightbox ? LIGHTBOX_WIDTH : MAX_WIDTH;
  const resizeOptions = metadata.width > targetWidth ? { width: targetWidth } : {};

  const avifPath = path.join(outDir, `${baseName}.avif`);
  await image.clone().resize(resizeOptions)
    .avif({ quality: lightbox ? LIGHTBOX_AVIF_QUALITY : AVIF_QUALITY, effort: 7 })
    .toFile(avifPath);
  totalOptimized += fs.statSync(avifPath).size;

  const webpPath = path.join(outDir, `${baseName}.webp`);
  await image.clone().resize(resizeOptions)
    .webp({ quality: lightbox ? LIGHTBOX_WEBP_QUALITY : WEBP_QUALITY, effort: 6 })
    .toFile(webpPath);

  const jpegPath = path.join(outDir, `${baseName}.jpg`);
  await image.clone().resize(resizeOptions)
    .jpeg({ quality: JPEG_QUALITY, progressive: true, mozjpeg: true })
    .toFile(jpegPath);

  if (!lightbox) {
    const blurPath = path.join(outDir, `${baseName}-blur.jpg`);
    await image.clone().resize({ width: BLUR_SIZE }).blur(5)
      .jpeg({ quality: 30 }).toFile(blurPath);
  }

  const webpSize = fs.statSync(webpPath).size;
  const savings = ((1 - webpSize / originalSize) * 100).toFixed(1);
  return savings;
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

  console.log(`Optimizing ${topLevelFiles.length} top-level images (max ${MAX_WIDTH}px)...\n`);
  for (const file of topLevelFiles) {
    try {
      const savings = await processFile(
        path.join(inputDir, file),
        outputDir,
        path.parse(file).name
      );
      console.log(`✓ ${file} → WebP (${savings}% smaller)`);
    } catch (err) {
      console.error(`Error optimizing ${file}:`, err.message);
    }
  }

  const subDirs = entries.filter(e => e.isDirectory() && e.name !== 'thumbs').map(e => e.name);

  for (const dir of subDirs) {
    const subInput = path.join(inputDir, dir);
    const subOutput = path.join(outputDir, dir);
    const files = fs.readdirSync(subInput).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
    if (files.length === 0) continue;

    console.log(`\nOptimizing gallery "${dir}" — ${files.length} images (lightbox ${LIGHTBOX_WIDTH}px)...`);
    for (const file of files) {
      try {
        const savings = await processFile(
          path.join(subInput, file),
          subOutput,
          path.parse(file).name,
          { lightbox: true }
        );
        console.log(`  ✓ ${dir}/${file} → WebP (${savings}% smaller)`);
      } catch (err) {
        console.error(`  Error optimizing ${dir}/${file}:`, err.message);
      }
    }
  }

  const totalSavings = ((1 - totalOptimized / totalOriginal) * 100).toFixed(1);
  console.log(`\nTotal: ${(totalOriginal / 1024 / 1024).toFixed(2)} MB → ${(totalOptimized / 1024 / 1024).toFixed(2)} MB (${totalSavings}% AVIF savings)`);
}

optimizeImages().catch(console.error);
