const galleryImages = [
    'IMG_0002', 'IMG_0007', 'IMG_0011', 'IMG_0012', 'IMG_0013',
    'IMG_0018', 'IMG_0021', 'IMG_0026', 'IMG_0028', 'IMG_0029',
    'IMG_0047', 'IMG_0062', 'IMG_0066', 'IMG_0069', 'IMG_0081',
    'IMG_0088', 'IMG_0090', 'IMG_0091', 'IMG_0100', 'IMG_0114',
    'IMG_0115', 'IMG_0127', 'IMG_0128', 'IMG_0133', 'IMG_0151',
    'IMG_0153', 'IMG_0172', 'IMG_0174', 'IMG_0176', 'IMG_0183',
    'IMG_0186', 'IMG_0188', 'IMG_0207', 'IMG_0211', 'IMG_0215',
    'IMG_0217', 'IMG_0218', 'IMG_0229'
].map((name, index) => ({
    thumb: `/dist/images/portfolio/prerov-zelatovice/${name}-thumb.jpg`,
    full: `/dist/images/portfolio/prerov-zelatovice/${name}.jpg`,
    fullWebp: `/dist/images/portfolio/prerov-zelatovice/${name}.webp`,
    fullAvif: `/dist/images/portfolio/prerov-zelatovice/${name}.avif`,
    alt: `FC Přerov vs Želatovice – fotka ${index + 1}`
}));

const galleryRoot = document.getElementById('matchGallery');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const closeLightboxBtn = document.getElementById('closeLightbox');
const lightboxPrev = document.getElementById('lightboxPrev');
const lightboxNext = document.getElementById('lightboxNext');
const lightboxControls = document.getElementById('lightboxControls');
const lightboxSourceAvif = document.getElementById('lightboxSourceAvif');
const lightboxSourceWebp = document.getElementById('lightboxSourceWebp');

let currentIndex = 0;

function renderGallery() {
    galleryRoot.innerHTML = galleryImages.map((image, index) => `
        <button class="gallery-card" type="button" data-index="${index}" aria-label="Otevřít fotku ${index + 1}">
            <img src="${image.thumb}" alt="${image.alt}" loading="${index < 6 ? 'eager' : 'lazy'}">
            <span>Fotka ${index + 1}</span>
        </button>
    `).join('');

    galleryRoot.querySelectorAll('.gallery-card').forEach((card) => {
        card.addEventListener('click', () => openLightbox(Number(card.dataset.index)));
    });
}

function updateLightbox() {
    const image = galleryImages[currentIndex];
    if (lightboxSourceAvif) lightboxSourceAvif.srcset = image.fullAvif || '';
    if (lightboxSourceWebp) lightboxSourceWebp.srcset = image.fullWebp || '';
    lightboxImg.src = image.full;
    lightboxImg.alt = `${image.alt} (${currentIndex + 1}/${galleryImages.length})`;
    lightboxPrev.classList.toggle('opacity-40', currentIndex === 0);
    lightboxPrev.classList.toggle('pointer-events-none', currentIndex === 0);
    lightboxNext.classList.toggle('opacity-40', currentIndex === galleryImages.length - 1);
    lightboxNext.classList.toggle('pointer-events-none', currentIndex === galleryImages.length - 1);
    lightboxControls.classList.toggle('hidden', galleryImages.length <= 1);
}

function openLightbox(index) {
    currentIndex = index;
    updateLightbox();
    lightbox.classList.add('active');
}

function closeLightbox() {
    lightbox.classList.remove('active');
}

function moveLightbox(step) {
    const nextIndex = currentIndex + step;
    if (nextIndex < 0 || nextIndex >= galleryImages.length) return;
    currentIndex = nextIndex;
    updateLightbox();
}

closeLightboxBtn.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) {
        closeLightbox();
    }
});
lightboxPrev.addEventListener('click', () => moveLightbox(-1));
lightboxNext.addEventListener('click', () => moveLightbox(1));

document.addEventListener('keydown', (event) => {
    if (!lightbox.classList.contains('active')) return;
    if (event.key === 'Escape') closeLightbox();
    if (event.key === 'ArrowLeft') moveLightbox(-1);
    if (event.key === 'ArrowRight') moveLightbox(1);
});

renderGallery();
