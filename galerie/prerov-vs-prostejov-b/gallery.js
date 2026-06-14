const galleryImages = [
    'IMG_0605', 'IMG_0607', 'IMG_0611', 'IMG_0615', 'IMG_0616',
    'IMG_0617', 'IMG_0622', 'IMG_0626', 'IMG_0634', 'IMG_0638',
    'IMG_0640', 'IMG_0642', 'IMG_0651', 'IMG_0654', 'IMG_0667',
    'IMG_0680', 'IMG_0683', 'IMG_0692', 'IMG_0694', 'IMG_0698',
    'IMG_0715', 'IMG_0724', 'IMG_0732', 'IMG_0742', 'IMG_0744',
    'IMG_0750', 'IMG_0753', 'IMG_0754', 'IMG_0763', 'IMG_0776',
    'IMG_0788', 'IMG_0791', 'IMG_0804', 'IMG_0807', 'IMG_0810',
    'IMG_0821', 'IMG_0823', 'IMG_0829', 'IMG_0836', 'IMG_0838',
    'IMG_0840', 'IMG_0843', 'IMG_0848', 'IMG_0852', 'IMG_0854',
    'IMG_0856', 'IMG_0861', 'IMG_0864', 'IMG_0872'
].map((name, index) => ({
    thumb: `/dist/images/portfolio/prerov-prostejov-b/${name}-thumb.jpg`,
    full: `/dist/images/portfolio/prerov-prostejov-b/${name}.jpg`,
    fullWebp: `/dist/images/portfolio/prerov-prostejov-b/${name}.webp`,
    fullAvif: `/dist/images/portfolio/prerov-prostejov-b/${name}.avif`,
    alt: `FC Přerov vs Prostějov B – fotka ${index + 1}`
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
