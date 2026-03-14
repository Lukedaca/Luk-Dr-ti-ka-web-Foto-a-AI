/**
 * Portfolio module - lazy loaded on scroll
 * Gallery filtering and lightbox functionality
 */

const PORTFOLIO_DATA_URL = 'data/portfolio.json';
const PORTFOLIO_FALLBACK_IMAGE = 'assets/fallback.jpg';
const PORTFOLIO_ROUTE_PARAM = 'gallery';
const PORTFOLIO_SECTION_HASH = '#portfolio';
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
let galleryTouchStartHandler = null;
let galleryTouchEndHandler = null;

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

function slugifyPortfolioValue(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function getProjectSlug(project, index = 0) {
    if (project && typeof project.slug === 'string' && project.slug.trim()) {
        return slugifyPortfolioValue(project.slug);
    }

    const nameSlug = slugifyPortfolioValue(project?.name);
    if (nameSlug) return nameSlug;

    const idSlug = slugifyPortfolioValue(project?.id);
    if (idSlug) return idSlug;

    return `portfolio-${index}`;
}

function getGalleryStartIndex(project) {
    return Number.isInteger(project?.mainImageIndex)
        && project.mainImageIndex >= 0
        && project.mainImageIndex < project.images.length
        ? project.mainImageIndex
        : 0;
}

function updatePortfolioUrl(project = null, options = {}) {
    const { replace = false } = options;
    if (!(window.history && window.location)) return;

    const url = new URL(window.location.href);

    if (project) {
        url.searchParams.set(PORTFOLIO_ROUTE_PARAM, getProjectSlug(project));
    } else {
        url.searchParams.delete(PORTFOLIO_ROUTE_PARAM);
    }

    url.hash = PORTFOLIO_SECTION_HASH;

    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const method = replace ? 'replaceState' : 'pushState';
    window.history[method](window.history.state, '', nextUrl);
}

function getRequestedGallerySlug() {
    return slugifyPortfolioValue(new URLSearchParams(window.location.search).get(PORTFOLIO_ROUTE_PARAM));
}

function findProjectBySlug(slug) {
    return portfolioProjects.find((project, index) => getProjectSlug(project, index) === slug) || null;
}

function openProjectLightbox(project, fallbackTitle, options = {}) {
    const { syncUrl = false, replaceUrl = false } = options;
    if (!(project && Array.isArray(project.images) && project.images.length)) return false;

    const projectTitle = project.name || fallbackTitle || 'Portfolio';
    const projectAlt = PORTFOLIO_ALT_TEXTS[String(project.id || '')] || projectTitle;

    if (project.type === 'gallery') {
        openGalleryLightbox(project.images, getGalleryStartIndex(project), projectAlt);
        if (syncUrl) {
            updatePortfolioUrl(project, { replace: replaceUrl });
        }
        return true;
    }

    const mainImage = project.images[getGalleryStartIndex(project)] || project.images[0];
    openSingleLightbox(mainImage, projectAlt);
    return true;
}

function syncPortfolioFilterButtons(filter) {
    filterBtns.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
}

function handlePortfolioRouteChange() {
    const requestedSlug = getRequestedGallerySlug();
    if (!requestedSlug) {
        if (lightbox?.classList.contains('active')) {
            closeLightboxModal({ syncUrl: false });
        }
        return;
    }

    const requestedProject = findProjectBySlug(requestedSlug);
    if (!requestedProject) return;

    if (activeFilter !== 'all' && activeFilter !== requestedProject.category) {
        activeFilter = requestedProject.category;
        syncPortfolioFilterButtons(activeFilter);
        applyPortfolioFilter(activeFilter);
    }

    openProjectLightbox(requestedProject, requestedProject.name, { syncUrl: false });
}

function closeLightboxModal(options = {}) {
    const { syncUrl = true, replaceUrl = true } = options;
    if (!lightbox) return;
    lightbox.classList.remove('active');
    setLightboxControls(false);
    if (galleryKeyHandler) {
        document.removeEventListener('keydown', galleryKeyHandler);
        galleryKeyHandler = null;
    }
    if (galleryTouchStartHandler) {
        lightbox.removeEventListener('touchstart', galleryTouchStartHandler);
        galleryTouchStartHandler = null;
    }
    if (galleryTouchEndHandler) {
        lightbox.removeEventListener('touchend', galleryTouchEndHandler);
        galleryTouchEndHandler = null;
    }
    if (syncUrl) {
        updatePortfolioUrl(null, { replace: replaceUrl });
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
    handlePortfolioRouteChange();
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
                openProjectLightbox(project, fallbackTitle, {
                    syncUrl: project.type === 'gallery'
                });
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

    if (galleryTouchStartHandler) {
        lightbox.removeEventListener('touchstart', galleryTouchStartHandler);
    }
    if (galleryTouchEndHandler) {
        lightbox.removeEventListener('touchend', galleryTouchEndHandler);
    }

    // Swipe gestures for mobile
    let touchStartX = 0;

    galleryTouchStartHandler = (e) => {
        touchStartX = e.changedTouches[0].screenX;
    };

    galleryTouchEndHandler = (e) => {
        const touchEndX = e.changedTouches[0].screenX;
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
    };

    lightbox.addEventListener('touchstart', galleryTouchStartHandler, { passive: true });
    lightbox.addEventListener('touchend', galleryTouchEndHandler, { passive: true });

    setImage();
    lightbox.classList.add('active');
    setLightboxControls(images.length > 1);
    updateControls();
}

window.addEventListener('popstate', handlePortfolioRouteChange);

// Initialize portfolio
loadPortfolioData();
