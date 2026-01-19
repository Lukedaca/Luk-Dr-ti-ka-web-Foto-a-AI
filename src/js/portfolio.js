/**
 * Portfolio Gallery module
 * Lazy loaded when portfolio section is visible
 */

const PORTFOLIO_DATA_URL = 'data/portfolio.json';
const PORTFOLIO_FALLBACK_IMAGE = 'assets/fallback.jpg';

let portfolioProjects = [];
let activeFilter = 'all';
let galleryKeyHandler = null;

const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const closeLightboxBtn = document.getElementById('closeLightbox');
const lightboxControls = document.getElementById('lightboxControls');
const lightboxPrev = document.getElementById('lightboxPrev');
const lightboxNext = document.getElementById('lightboxNext');
const filterBtns = document.querySelectorAll('.filter-btn');

function getPortfolioItems() {
  return Array.from(document.querySelectorAll('.portfolio-item'));
}

function setLightboxControls(visible) {
  lightboxControls?.classList.toggle('hidden', !visible);
}

function closeLightboxModal() {
  if (!lightbox) return;
  lightbox.classList.remove('active');
  setLightboxControls(false);
  if (galleryKeyHandler) {
    document.removeEventListener('keydown', galleryKeyHandler);
    galleryKeyHandler = null;
  }
}

function setLightboxImage(src, altText) {
  if (!lightboxImg) return;
  lightboxImg.src = src;
  lightboxImg.alt = altText || 'Fotografie';
}

function openSingleLightbox(src, altText) {
  if (!(lightbox && lightboxImg)) return;
  if (galleryKeyHandler) {
    document.removeEventListener('keydown', galleryKeyHandler);
    galleryKeyHandler = null;
  }
  setLightboxImage(src, altText);
  lightbox.classList.add('active');
  setLightboxControls(false);
}

function openGalleryLightbox(images, startIndex, altText) {
  if (!(lightbox && lightboxImg) || !images.length) return;
  let currentIndex = startIndex;
  const baseAlt = altText || 'Galerie';

  const setImage = () => {
    setLightboxImage(
      images[currentIndex],
      images.length > 1 ? `${baseAlt} (${currentIndex + 1}/${images.length})` : baseAlt
    );
  };

  const updateControls = () => {
    if (!lightboxPrev || !lightboxNext) return;
    lightboxPrev.classList.toggle('opacity-40', currentIndex === 0);
    lightboxPrev.classList.toggle('pointer-events-none', currentIndex === 0);
    lightboxNext.classList.toggle('opacity-40', currentIndex === images.length - 1);
    lightboxNext.classList.toggle('pointer-events-none', currentIndex === images.length - 1);
  };

  const handleKeyboard = (e) => {
    if (e.key === 'ArrowLeft' && currentIndex > 0) {
      currentIndex--; setImage(); updateControls();
    } else if (e.key === 'ArrowRight' && currentIndex < images.length - 1) {
      currentIndex++; setImage(); updateControls();
    }
  };

  if (galleryKeyHandler) document.removeEventListener('keydown', galleryKeyHandler);
  galleryKeyHandler = handleKeyboard;
  document.addEventListener('keydown', handleKeyboard);

  if (lightboxPrev && lightboxNext) {
    lightboxPrev.onclick = () => { if (currentIndex > 0) { currentIndex--; setImage(); updateControls(); } };
    lightboxNext.onclick = () => { if (currentIndex < images.length - 1) { currentIndex++; setImage(); updateControls(); } };
  }

  // Touch gestures
  let touchStartX = 0;
  lightbox.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
  lightbox.addEventListener('touchend', (e) => {
    const diff = touchStartX - e.changedTouches[0].screenX;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentIndex < images.length - 1) { currentIndex++; setImage(); updateControls(); }
      else if (diff < 0 && currentIndex > 0) { currentIndex--; setImage(); updateControls(); }
    }
  }, { passive: true });

  setImage();
  lightbox.classList.add('active');
  setLightboxControls(images.length > 1);
  updateControls();
}

function applyPortfolioFilter(filter) {
  getPortfolioItems().forEach(item => {
    item.style.display = (filter === 'all' || item.dataset.category === filter) ? 'block' : 'none';
  });
}

function attachPortfolioEvents() {
  getPortfolioItems().forEach(item => {
    if (item.dataset.lightboxBound === 'true') return;
    item.dataset.lightboxBound = 'true';

    item.addEventListener('click', () => {
      const fallbackTitle = item.querySelector('.portfolio-title')?.textContent?.trim() || 'Portfolio';
      const projectId = item.getAttribute('data-project-id');
      const projectIndex = parseInt(item.getAttribute('data-project-index') || '-1', 10);
      let project = projectId ? portfolioProjects.find(p => String(p.id) === projectId) : null;
      if (!project && projectIndex >= 0) project = portfolioProjects[projectIndex];

      if (project?.images?.length) {
        const projectTitle = project.name || fallbackTitle;
        if (project.type === 'gallery') {
          openGalleryLightbox(project.images, 0, projectTitle);
        } else {
          const mainImage = project.images[project.mainImageIndex] || project.images[0];
          openSingleLightbox(mainImage, projectTitle);
        }
        return;
      }

      const img = item.querySelector('img');
      if (img) openSingleLightbox(img.src, img.alt || fallbackTitle);
    });
  });
}

async function loadPortfolioData() {
  try {
    const response = await fetch(PORTFOLIO_DATA_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    portfolioProjects = await response.json();
  } catch (err) {
    console.warn('Portfolio data load failed:', err);
    portfolioProjects = [];
  }
  attachPortfolioEvents();
  applyPortfolioFilter(activeFilter);
}

// Event listeners
closeLightboxBtn?.addEventListener('click', closeLightboxModal);
lightbox?.addEventListener('click', (e) => { if (e.target === lightbox) closeLightboxModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightboxModal(); });

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    applyPortfolioFilter(activeFilter);
  });
});

// Init
const initialActiveFilter = document.querySelector('.filter-btn.active');
if (initialActiveFilter) activeFilter = initialActiveFilter.dataset.filter;
loadPortfolioData();
