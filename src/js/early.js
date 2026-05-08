(function () {
  function activateStylesheet(link) {
    if (!link || link.dataset.asyncStylesheetLoaded === 'true') return;
    link.dataset.asyncStylesheetLoaded = 'true';
    link.media = 'all';
  }

  function activateAsyncStylesheets() {
    document.querySelectorAll('link[data-async-stylesheet]').forEach(activateStylesheet);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', activateAsyncStylesheets, { once: true });
  } else {
    activateAsyncStylesheets();
  }
}());
