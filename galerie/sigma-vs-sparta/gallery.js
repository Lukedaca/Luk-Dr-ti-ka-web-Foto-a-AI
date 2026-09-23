const galleryImages = [
    'IMG_7112', 'IMG_7119', 'IMG_7127', 'IMG_7129', 'IMG_7138',
    'IMG_7149', 'IMG_7161', 'IMG_7166', 'IMG_7169', 'IMG_7181',
    'IMG_7244', 'IMG_7274', 'IMG_7284', 'IMG_7301', 'IMG_7327',
    'IMG_7343', 'IMG_7354', 'IMG_7394', 'IMG_7398', 'IMG_7405',
    'IMG_7430', 'IMG_7460', 'IMG_7494', 'IMG_7496', 'IMG_7517',
    'IMG_7523', 'IMG_7533', 'IMG_7552'
].map((name, index) => ({
    thumb: `/dist/images/portfolio/sigma-sparta/${name}-thumb.jpg`,
    full: `/dist/images/portfolio/sigma-sparta/${name}.jpg`,
    alt: `SK Sigma Olomouc vs AC Sparta Praha – fotka ${index + 1}`
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
