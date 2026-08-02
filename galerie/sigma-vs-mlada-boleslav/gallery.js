const galleryImages = [
    'IMG_1011', 'IMG_1016', 'IMG_1028', 'IMG_1037', 'IMG_1043',
    'IMG_1046', 'IMG_1054', 'IMG_1075', 'IMG_1097', 'IMG_1129',
    'IMG_1131', 'IMG_1143', 'IMG_1157', 'IMG_1187', 'IMG_1196',
    'IMG_1202', 'IMG_1209', 'IMG_1227'
].map((name, index) => ({
    thumb: `/dist/images/portfolio/sigma-mlada-boleslav/${name}-thumb.jpg`,
    full: `/dist/images/portfolio/sigma-mlada-boleslav/${name}.jpg`,
    fullWebp: `/dist/images/portfolio/sigma-mlada-boleslav/${name}.webp`,
    fullAvif: `/dist/images/portfolio/sigma-mlada-boleslav/${name}.avif`,
    alt: `SK Sigma Olomouc vs FK Mladá Boleslav – fotka ${index + 1}`
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
