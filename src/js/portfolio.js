/**
 * Portfolio module - lazy loaded on scroll
 * Gallery filtering and lightbox functionality
 */

const PORTFOLIO_DATA_URL = 'data/portfolio.json';
const PORTFOLIO_FALLBACK_IMAGE = 'assets/fallback.jpg';
const PORTFOLIO_ALT_TEXTS = {
    'portret-1': 'Portrétní fotografie v přirozeném světle',
    'sport-1': 'Sportovní fotografie - akční záběr',
    'ai-chatbot': 'AI chatbot rozhraní',
    'produkt-1': 'Produktová fotografie v ateliéru',
    'automatizace': 'Automatizace procesu s AI',
    'portret-2': 'Portrétní fotografie s dramatickým světlem'
};

let portfolioProjects = [];
let activeFilter = 'all';
let galleryKeyHandler = null;

const filterBtns = document.querySelectorAll('.filter-btn');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const closeLightboxBtn = document.getElementById('closeLightbox');
const lightboxControls = document.getElementById('lightboxControls');
const lightboxPrev = document.getElementById('lightboxPrev');
const lightboxNext = document.getElementById('lightboxNext');

function getPortfolioItems() {
    return Array.from(document.querySelectorAll('.portfolio-item'));
}

function setLightboxControls(visible) {
    if (!lightboxControls) return;
    lightboxControls.classList.toggle('hidden', !visible);
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

if (closeLightboxBtn) {
    closeLightboxBtn.addEventListener('click', closeLightboxModal);
}
if (lightbox) {
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightboxModal();
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightbox.classList.contains('active')) {
            closeLightboxModal();
        }
    });
}

function applyPortfolioFilter(filter) {
    getPortfolioItems().forEach(item => {
        item.style.display = (filter === 'all' || item.dataset.category === filter) ? 'block' : 'none';
    });
}

if (filterBtns.length) {
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.dataset.filter;
            applyPortfolioFilter(activeFilter);
        });
    });
}

const initialActiveFilter = document.querySelector('.filter-btn.active');
if (initialActiveFilter) {
    activeFilter = initialActiveFilter.dataset.filter;
}

async function loadPortfolioData() {
    try {
        const response = await fetch(PORTFOLIO_DATA_URL, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        portfolioProjects = Array.isArray(data) ? data : [];
    } catch (err) {
        console.warn('Nepodařilo se načíst portfolio data.', err);
        portfolioProjects = [];
    }
    renderPortfolio();
}

function renderPortfolio() {
    const portfolioGrid = document.getElementById('portfolioGrid');
    if (!portfolioGrid) return;

    const projects = Array.isArray(portfolioProjects) ? portfolioProjects : [];

    // Skip re-rendering if HTML already has real images (not fallback)
    const existingImages = portfolioGrid.querySelectorAll('img[src*="portfolio/"]');
    if (existingImages.length > 0 && !existingImages[0].src.includes('fallback')) {
        attachPortfolioEvents();
        applyPortfolioFilter(activeFilter);
        return;
    }

    if (projects.length === 0) {
        attachPortfolioEvents();
        applyPortfolioFilter(activeFilter);
        return;
    }

    portfolioGrid.innerHTML = projects.map((project, index) => {
        const images = Array.isArray(project.images) ? project.images : [];
        const mainIndex = Number.isInteger(project.mainImageIndex) ? project.mainImageIndex : 0;
        const mainImage = images[mainIndex] || images[0] || PORTFOLIO_FALLBACK_IMAGE;
        const category = project.category === 'ai' ? 'ai' : 'foto';
        const categoryLabel = category === 'ai' ? 'AI Projekt' : 'Fotografie';
        const type = project.type === 'gallery' ? 'gallery' : 'single';
        const metaText = type === 'gallery'
            ? `${categoryLabel} | ${images.length} fotek`
            : categoryLabel;
        const projectId = project.id ? String(project.id) : `portfolio-${index}`;
        const altText = PORTFOLIO_ALT_TEXTS[projectId] || project.name || 'Portfolio';

        return `
            <div class="portfolio-item rounded-xl overflow-hidden" data-category="${category}" data-project-id="${projectId}" data-project-index="${index}">
                <img src="${mainImage}" alt="${altText}" class="w-full h-80 object-cover" loading="lazy" onerror="this.onerror=null;this.src='${PORTFOLIO_FALLBACK_IMAGE}';">
                <div class="portfolio-overlay">
                    <div class="text-center">
                        <div class="portfolio-title">${project.name || 'Projekt'}</div>
                        <div class="portfolio-meta">${metaText}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    attachPortfolioEvents();
    applyPortfolioFilter(activeFilter);
}

function attachPortfolioEvents() {
    getPortfolioItems().forEach(item => {
        if (item.dataset.lightboxBound === 'true') return;
        item.dataset.lightboxBound = 'true';
        item.addEventListener('click', () => {
            const fallbackTitle = item.querySelector('.portfolio-title')?.textContent?.trim() || 'Portfolio';
            const projectId = item.getAttribute('data-project-id');
            const projectIndex = parseInt(item.getAttribute('data-project-index') || '-1', 10);
            let project = null;

            if (projectId) {
                project = portfolioProjects.find(p => String(p.id) === projectId);
            }
            if (!project && projectIndex >= 0) {
                project = portfolioProjects[projectIndex];
            }

            if (project && Array.isArray(project.images) && project.images.length) {
                const projectTitle = project.name || fallbackTitle;
                const projectAlt = PORTFOLIO_ALT_TEXTS[String(project.id || '')] || projectTitle;
                if (project.type === 'gallery') {
                    const galleryStartIndex = Number.isInteger(project.mainImageIndex)
                        && project.mainImageIndex >= 0
                        && project.mainImageIndex < project.images.length
                        ? project.mainImageIndex
                        : 0;
                    openGalleryLightbox(project.images, galleryStartIndex, projectAlt);
                } else {
                    const mainImage = project.images[project.mainImageIndex] || project.images[0];
                    openSingleLightbox(mainImage, projectAlt);
                }
                return;
            }

            const galleryData = item.getAttribute('data-gallery');
            if (galleryData) {
                try {
                    const images = JSON.parse(galleryData);
                    openGalleryLightbox(images, 0, fallbackTitle);
                    return;
                } catch (e) {
                    console.warn('Neplatná galerie v atributu.', e);
                }
            }

            const img = item.querySelector('img');
            if (img) openSingleLightbox(img.src, img.alt || fallbackTitle);
        });
    });
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
            currentIndex--;
            setImage();
            updateControls();
        } else if (e.key === 'ArrowRight' && currentIndex < images.length - 1) {
            currentIndex++;
            setImage();
            updateControls();
        }
    };

    if (galleryKeyHandler) {
        document.removeEventListener('keydown', galleryKeyHandler);
    }
    galleryKeyHandler = handleKeyboard;
    document.addEventListener('keydown', handleKeyboard);

    if (lightboxPrev && lightboxNext) {
        lightboxPrev.onclick = () => {
            if (currentIndex > 0) {
                currentIndex--;
                setImage();
                updateControls();
            }
        };
        lightboxNext.onclick = () => {
            if (currentIndex < images.length - 1) {
                currentIndex++;
                setImage();
                updateControls();
            }
        };
    }

    // Swipe gestures for mobile
    let touchStartX = 0;
    let touchEndX = 0;

    lightbox.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    lightbox.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;

        if (Math.abs(diff) > 50) {
            if (diff > 0 && currentIndex < images.length - 1) {
                currentIndex++;
                setImage();
                updateControls();
            } else if (diff < 0 && currentIndex > 0) {
                currentIndex--;
                setImage();
                updateControls();
            }
        }
    }, { passive: true });

    setImage();
    lightbox.classList.add('active');
    setLightboxControls(images.length > 1);
    updateControls();
}

// Initialize portfolio
loadPortfolioData();
