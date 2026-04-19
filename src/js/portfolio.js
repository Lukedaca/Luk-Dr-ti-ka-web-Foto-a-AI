/**
 * Portfolio module - lazy loaded on scroll
 * Gallery filtering and lightbox functionality
 */

const PORTFOLIO_DATA_URL = 'data/portfolio.json';
const PORTFOLIO_FALLBACK_IMAGE = 'assets/fallback.jpg';
const PORTFOLIO_ALT_TEXTS = {
    'portret-1': 'Portretni fotografie v prirozenem svetle',
    'sport-1': 'Sportovni fotografie - akcni zaber',
    'ai-chatbot': 'AI chatbot rozhrani',
    'produkt-1': 'Produktova fotografie v atelieru',
    'automatizace': 'Automatizace procesu s AI',
    'portret-2': 'Portretni fotografie s dramatickym svetlem'
};
const PORTFOLIO_NAME_TRANSLATIONS = {
    'sport-1': { en: 'Aerial duel' },
    'sport-2': { en: 'Battle for the ball' },
    'sport-3': { en: 'Goal celebration' },
    'sport-4': { en: 'Goalmouth action' },
    'sport-5': { en: 'First league' },
    'sport-8': { en: 'Prerov vs Brodek 14 Mar 2026' },
    'sport-9': { en: 'Prerov vs Postrelmov 28 Mar 2026' },
    'ai-1': { en: 'AI Assistant' },
    'ai-2': { en: 'Entertainment chatbot' },
    'portret-1': { en: 'Portrait with smoke' },
    'portret-3': { en: 'Blue smoke' }
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

function getLanguage() {
    return typeof window.ldGetLanguage === 'function' ? window.ldGetLanguage() : 'cs';
}

function translateProjectName(project) {
    const lang = getLanguage();
    const overrides = PORTFOLIO_NAME_TRANSLATIONS[String(project?.id || '')];
    if (lang === 'en' && overrides && overrides.en) {
        return overrides.en;
    }
    return project?.name || 'Project';
}

function getPortfolioLabel(category) {
    const lang = getLanguage();
    if (lang === 'en') {
        return category === 'ai' ? 'AI Project' : 'Photography';
    }
    return category === 'ai' ? 'AI Projekt' : 'Fotografie';
}

function getPortfolioItems() {
    return Array.from(document.querySelectorAll('.portfolio-item'));
}

function getOptimizedImageSources(imagePath) {
    const normalizedPath = String(imagePath || '').replace(/\\/g, '/');
    if (!normalizedPath.startsWith('assets/portfolio/')) return null;

    const relative = normalizedPath.slice('assets/portfolio/'.length);
    const pathParts = relative.split('/');
    const fileName = pathParts[pathParts.length - 1] || '';
    if (!fileName.includes('.')) return null;

    const baseName = fileName.replace(/\.[^.]+$/, '');
    const subPath = pathParts.slice(0, -1).join('/');
    const prefix = subPath ? `dist/images/portfolio/${subPath}` : 'dist/images/portfolio';

    return {
        avif: `${prefix}/${baseName}.avif`,
        webp: `${prefix}/${baseName}.webp`,
        jpg: `${prefix}/${baseName}.jpg`
    };
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

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightbox.classList.contains('active')) {
            closeLightboxModal();
        }
    });
}

function applyPortfolioFilter(filter) {
    getPortfolioItems().forEach((item) => {
        item.style.display = (filter === 'all' || item.dataset.category === filter) ? 'block' : 'none';
    });
}

if (filterBtns.length) {
    filterBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            filterBtns.forEach((button) => button.classList.remove('active'));
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
        console.warn('Nepodarilo se nacist portfolio data.', err);
        portfolioProjects = [];
    }
    renderPortfolio();
}

function renderPortfolio() {
    const portfolioGrid = document.getElementById('portfolioGrid');
    if (!portfolioGrid) return;

    const projects = Array.isArray(portfolioProjects) ? portfolioProjects : [];

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
        const categoryLabel = getPortfolioLabel(category);
        const type = project.type === 'gallery' ? 'gallery' : 'single';
        const projectName = translateProjectName(project);
        const optimizedImage = getOptimizedImageSources(mainImage);
        const fallbackImage = optimizedImage?.jpg || mainImage || PORTFOLIO_FALLBACK_IMAGE;
        const metaText = type === 'gallery'
            ? (getLanguage() === 'en'
                ? `Match gallery | ${images.length} photos`
                : `${categoryLabel} | ${images.length} fotek`)
            : categoryLabel;
        const projectId = project.id ? String(project.id) : `portfolio-${index}`;
        const altText = PORTFOLIO_ALT_TEXTS[projectId] || projectName || 'Portfolio';
        const hrefAttr = project.pageUrl ? ` data-project-link="${project.pageUrl}"` : '';

        return `
            <div class="portfolio-item rounded-xl overflow-hidden" data-category="${category}" data-project-id="${projectId}" data-project-index="${index}"${hrefAttr}>
                <picture>
                    ${optimizedImage ? `<source srcset="${optimizedImage.avif}" type="image/avif">` : ''}
                    ${optimizedImage ? `<source srcset="${optimizedImage.webp}" type="image/webp">` : ''}
                    <img src="${fallbackImage}" alt="${altText}" class="w-full h-80 object-cover" loading="lazy" decoding="async" fetchpriority="low" width="600" height="320" onerror="this.onerror=null;this.src='${PORTFOLIO_FALLBACK_IMAGE}';">
                </picture>
                <div class="portfolio-overlay">
                    <div class="text-center">
                        <div class="portfolio-title">${projectName}</div>
                        <div class="portfolio-meta">${metaText}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    attachPortfolioEvents();
    applyPortfolioFilter(activeFilter);
}

function getGalleryStartIndex(project) {
    return Number.isInteger(project?.mainImageIndex)
        && project.mainImageIndex >= 0
        && project.mainImageIndex < project.images.length
        ? project.mainImageIndex
        : 0;
}

function attachPortfolioEvents() {
    getPortfolioItems().forEach((item) => {
        if (item.dataset.lightboxBound === 'true') return;
        item.dataset.lightboxBound = 'true';
        item.addEventListener('click', () => {
            const fallbackTitle = item.querySelector('.portfolio-title')?.textContent?.trim() || 'Portfolio';
            const projectId = item.getAttribute('data-project-id');
            const projectIndex = parseInt(item.getAttribute('data-project-index') || '-1', 10);
            let project = null;

            if (projectId) {
                project = portfolioProjects.find((entry) => String(entry.id) === projectId);
            }
            if (!project && projectIndex >= 0) {
                project = portfolioProjects[projectIndex];
            }

            if (project?.pageUrl) {
                window.location.href = project.pageUrl;
                return;
            }

            if (project && Array.isArray(project.images) && project.images.length) {
                const projectTitle = project.name || fallbackTitle;
                const projectAlt = PORTFOLIO_ALT_TEXTS[String(project.id || '')] || projectTitle;
                if (project.type === 'gallery') {
                    openGalleryLightbox(project.images, getGalleryStartIndex(project), projectAlt);
                } else {
                    const mainImage = project.images[getGalleryStartIndex(project)] || project.images[0];
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
                    console.warn('Neplatna galerie v atributu.', e);
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
            currentIndex -= 1;
            setImage();
            updateControls();
        } else if (e.key === 'ArrowRight' && currentIndex < images.length - 1) {
            currentIndex += 1;
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
                currentIndex -= 1;
                setImage();
                updateControls();
            }
        };
        lightboxNext.onclick = () => {
            if (currentIndex < images.length - 1) {
                currentIndex += 1;
                setImage();
                updateControls();
            }
        };
    }

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
                currentIndex += 1;
                setImage();
                updateControls();
            } else if (diff < 0 && currentIndex > 0) {
                currentIndex -= 1;
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

window.addEventListener('ld:languagechange', () => {
    if (portfolioProjects.length) {
        renderPortfolio();
    }
});

loadPortfolioData();
