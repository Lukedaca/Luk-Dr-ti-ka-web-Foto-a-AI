const galleryImages = [
    'IMG_2320', 'IMG_2324', 'IMG_2329', 'IMG_2332', 'IMG_2337', 'IMG_2340',
    'IMG_2347', 'IMG_2355', 'IMG_2357', 'IMG_2369', 'IMG_2376', 'IMG_2380',
    'IMG_2414', 'IMG_2420', 'IMG_2440', 'IMG_2444', 'IMG_2453', 'IMG_2457',
    'IMG_2472', 'IMG_2477', 'IMG_2482', 'IMG_2483', 'IMG_2490', 'IMG_2493',
    'IMG_2504', 'IMG_2508', 'IMG_2513', 'IMG_2531', 'IMG_2540', 'IMG_2567'
].map((name, index) => ({
    thumb: `/dist/images/portfolio/prerov-litovel/${name}-thumb.jpg`,
    full: `/dist/images/portfolio/prerov-litovel/${name}.jpg`,
    alt: `Přerov vs Litovel – fotka ${index + 1}`
}));

const galleryRoot = document.getElementById('matchGallery');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const closeLightboxBtn = document.getElementById('closeLightbox');
const lightboxPrev = document.getElementById('lightboxPrev');
const lightboxNext = document.getElementById('lightboxNext');
const lightboxControls = document.getElementById('lightboxControls');

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
    if (event.target === lightbox) closeLightbox();
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
