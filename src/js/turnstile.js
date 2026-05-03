/**
 * turnstile.js — invisible Cloudflare Turnstile loader.
 * Exposes window.lukasTurnstile.getToken() returning a promise<string|null>.
 * Degrades gracefully when site key is missing (returns null).
 */
;(function turnstileIIFE() {
  'use strict';

  var TURNSTILE_SITE_KEY = (window.LUKAS_TURNSTILE_SITE_KEY || '').trim();
  var TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  var TURNSTILE_CONFIG_URL = '/.netlify/functions/public-config';
  var TURNSTILE_TOKEN_TTL_MS = 4 * 60 * 1000;
  var turnstileConfigPromise = null;

  var turnstileState = {
    scriptLoaded: false,
    scriptLoading: false,
    scriptError: false,
    widgetId: null,
    container: null,
    cachedToken: null,
    cachedAt: 0,
    pendingResolvers: [],
  };

  function turnstileIsEnabled() {
    return !!TURNSTILE_SITE_KEY;
  }

  function turnstileSetSiteKey(siteKey) {
    TURNSTILE_SITE_KEY = String(siteKey || '').trim();
    return TURNSTILE_SITE_KEY;
  }

  function turnstileLoadConfig() {
    if (TURNSTILE_SITE_KEY) return Promise.resolve(TURNSTILE_SITE_KEY);
    if (turnstileConfigPromise) return turnstileConfigPromise;
    turnstileConfigPromise = fetch(TURNSTILE_CONFIG_URL, { method: 'GET', cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) return '';
        return res.json().catch(function () { return {}; });
      })
      .then(function (data) {
        return turnstileSetSiteKey(data && data.turnstile_site_key);
      })
      .catch(function () {
        return '';
      });
    return turnstileConfigPromise;
  }

  function turnstileEnsureContainer() {
    if (turnstileState.container) return turnstileState.container;
    var el = document.createElement('div');
    el.id = 'turnstile-widget';
    el.setAttribute('aria-hidden', 'true');
    el.style.position = 'fixed';
    el.style.bottom = '-100px';
    el.style.left = '-100px';
    el.style.width = '0';
    el.style.height = '0';
    el.style.overflow = 'hidden';
    el.style.pointerEvents = 'none';
    document.body.appendChild(el);
    turnstileState.container = el;
    return el;
  }

  function turnstileLoadScript() {
    if (turnstileState.scriptLoaded) return Promise.resolve(true);
    if (turnstileState.scriptError) return Promise.resolve(false);
    if (turnstileState.scriptLoading) {
      return new Promise(function (resolve) {
        var check = setInterval(function () {
          if (turnstileState.scriptLoaded || turnstileState.scriptError) {
            clearInterval(check);
            resolve(turnstileState.scriptLoaded);
          }
        }, 100);
      });
    }
    turnstileState.scriptLoading = true;
    return new Promise(function (resolve) {
      var script = document.createElement('script');
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = function () {
        turnstileState.scriptLoaded = true;
        turnstileState.scriptLoading = false;
        resolve(true);
      };
      script.onerror = function () {
        turnstileState.scriptError = true;
        turnstileState.scriptLoading = false;
        console.warn('Turnstile script failed to load');
        resolve(false);
      };
      document.head.appendChild(script);
    });
  }

  function turnstileWaitForApi() {
    return new Promise(function (resolve) {
      var attempts = 0;
      var check = setInterval(function () {
        attempts += 1;
        if (window.turnstile && typeof window.turnstile.render === 'function') {
          clearInterval(check);
          resolve(true);
        } else if (attempts > 50) {
          clearInterval(check);
          resolve(false);
        }
      }, 100);
    });
  }

  function turnstileRender() {
    if (turnstileState.widgetId !== null) return Promise.resolve(true);
    var container = turnstileEnsureContainer();
    return new Promise(function (resolve) {
      try {
        turnstileState.widgetId = window.turnstile.render(container, {
          sitekey: TURNSTILE_SITE_KEY,
          size: 'invisible',
          appearance: 'interaction-only',
          callback: function (token) {
            turnstileState.cachedToken = token;
            turnstileState.cachedAt = Date.now();
            var resolvers = turnstileState.pendingResolvers.splice(0);
            resolvers.forEach(function (r) { r(token); });
          },
          'error-callback': function (err) {
            console.warn('Turnstile error:', err);
            var resolvers = turnstileState.pendingResolvers.splice(0);
            resolvers.forEach(function (r) { r(null); });
          },
          'expired-callback': function () {
            turnstileState.cachedToken = null;
            turnstileState.cachedAt = 0;
          },
        });
        resolve(true);
      } catch (err) {
        console.warn('Turnstile render failed:', err);
        resolve(false);
      }
    });
  }

  function turnstileTokenCachedAndFresh() {
    if (!turnstileState.cachedToken) return false;
    return (Date.now() - turnstileState.cachedAt) < TURNSTILE_TOKEN_TTL_MS;
  }

  function turnstileGetToken() {
    return turnstileLoadConfig().then(function (siteKey) {
      if (!siteKey) return null;
      if (turnstileTokenCachedAndFresh()) {
        return turnstileState.cachedToken;
      }
      return turnstileLoadScript().then(function (loaded) {
        if (!loaded) return null;
        return turnstileWaitForApi().then(function (apiOk) {
          if (!apiOk) return null;
          return turnstileRender().then(function (rendered) {
            if (!rendered) return null;
            return new Promise(function (resolve) {
              turnstileState.pendingResolvers.push(resolve);
              try {
                window.turnstile.execute(turnstileState.container);
              } catch (err) {
                console.warn('Turnstile execute failed:', err);
                resolve(null);
              }
              setTimeout(function () {
                var idx = turnstileState.pendingResolvers.indexOf(resolve);
                if (idx >= 0) {
                  turnstileState.pendingResolvers.splice(idx, 1);
                  resolve(null);
                }
              }, 8000);
            });
          });
        });
      });
    });
  }

  function turnstileReset() {
    turnstileState.cachedToken = null;
    turnstileState.cachedAt = 0;
    if (turnstileState.widgetId !== null && window.turnstile) {
      try { window.turnstile.reset(turnstileState.widgetId); } catch (err) { /* noop */ }
    }
  }

  window.lukasTurnstile = {
    enabled: turnstileIsEnabled(),
    isEnabled: turnstileIsEnabled,
    configure: turnstileSetSiteKey,
    getToken: turnstileGetToken,
    reset: turnstileReset,
  };
})();
