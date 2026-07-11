/**
 * LEVEL — Loading bootstrap (sync, non-module)
 * Must load before page modules. Handles nav-click preloaders and
 * restoring the full-page loader after navigation.
 */
(function initLevelLoading() {
  const PAGE_LOADERS = new Set([
    'dashboard.html',
    'matches.html',
    'profile.html',
    'membership.html',
    'notifications.html',
  ])

  const SECTION_LOADERS = new Set(['chat.html'])

  const STORAGE_KEY = 'level_page_loading'

  /** Prefer main content shell so sidebar + topbar stay visible while data loads. */
  let _contentLoaderHost = null

  function getContentLoaderHost() {
    return document.querySelector('.app-content')
      || document.querySelector('.profile-wrapper')
  }

  function spinnerMarkup(size = 44) {
    return `<div class="level-spinner" style="width:${size}px;height:${size}px;" role="status" aria-label="Loading"></div>`
  }

  function ensurePageLoader() {
    let el = document.getElementById('levelPageLoader')
    if (el) return el

    el = document.createElement('div')
    el.id = 'levelPageLoader'
    el.className = 'level-page-loader is-hidden'
    el.setAttribute('role', 'status')
    el.setAttribute('aria-live', 'polite')
    el.setAttribute('aria-busy', 'false')
    el.innerHTML = `
      <div class="level-page-loader-card">
        ${spinnerMarkup(48)}
        <div class="level-page-loader-label">Loading</div>
      </div>`
    document.body.appendChild(el)
    return el
  }

  function resolveTargetPage(href) {
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return null
    if (href.startsWith('javascript:')) return null
    try {
      const url = new URL(href, window.location.href)
      if (url.origin !== window.location.origin) return null
      const page = url.pathname.split('/').filter(Boolean).pop() || 'index.html'
      return page
    } catch {
      return null
    }
  }

  function isModifiedClick(e) {
    return e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey
  }

  function showPageLoader(label) {
    const contentHost = getContentLoaderHost()
    if (contentHost) {
      _contentLoaderHost = contentHost
      contentHost.classList.add('level-content-loading')
      showSectionLoader(contentHost, label || 'Loading')
      return
    }

    _contentLoaderHost = null
    const el = ensurePageLoader()
    el.classList.remove('is-hidden')
    el.setAttribute('aria-busy', 'true')
    const textEl = el.querySelector('.level-page-loader-label')
    if (textEl) textEl.textContent = label || 'Loading'
    document.documentElement.classList.add('level-is-loading')
  }

  function hidePageLoader() {
    if (_contentLoaderHost) {
      hideSectionLoader(_contentLoaderHost)
      _contentLoaderHost.classList.remove('level-content-loading')
      _contentLoaderHost = null
    } else {
      const el = document.getElementById('levelPageLoader')
      if (el) {
        el.classList.add('is-hidden')
        el.setAttribute('aria-busy', 'false')
      }
      document.documentElement.classList.remove('level-is-loading')
    }
    sessionStorage.removeItem(STORAGE_KEY)
  }

  function showSectionLoader(host, label) {
    if (!host) return null
    const pos = window.getComputedStyle(host).position
    if (pos === 'static') host.style.position = 'relative'

    let overlay = host.querySelector(':scope > .level-section-loader')
    if (!overlay) {
      overlay = document.createElement('div')
      overlay.className = 'level-section-loader'
      overlay.setAttribute('role', 'status')
      overlay.setAttribute('aria-live', 'polite')
      overlay.innerHTML = `
        <div class="level-section-loader-inner">
          ${spinnerMarkup(36)}
          ${label ? `<div class="level-section-loader-label">${label}</div>` : ''}
        </div>`
      host.appendChild(overlay)
    } else if (label) {
      const labelEl = overlay.querySelector('.level-section-loader-label')
      if (labelEl) labelEl.textContent = label
    }

    overlay.classList.remove('is-hidden')
    overlay.setAttribute('aria-busy', 'true')
    host.setAttribute('aria-busy', 'true')
    return overlay
  }

  function hideSectionLoader(host) {
    if (!host) return
    const overlay = host.querySelector(':scope > .level-section-loader')
    if (overlay) {
      overlay.classList.add('is-hidden')
      overlay.setAttribute('aria-busy', 'false')
    }
    host.removeAttribute('aria-busy')
  }

  window.__levelLoader = {
    showPageLoader,
    hidePageLoader,
    showSectionLoader,
    hideSectionLoader,
    navigateWithLoader(href) {
      const page = resolveTargetPage(href)
      if (page && PAGE_LOADERS.has(page)) {
        sessionStorage.setItem(STORAGE_KEY, '1')
        showPageLoader()
      }
      window.location.href = href
    },
    PAGE_LOADERS,
    SECTION_LOADERS,
  }

  if (sessionStorage.getItem(STORAGE_KEY) === '1') {
    showPageLoader()
  }

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]')
    if (!link || isModifiedClick(e)) return
    if (link.target === '_blank' || link.hasAttribute('download')) return

    const page = resolveTargetPage(link.getAttribute('href'))
    if (!page) return

    const current = window.location.pathname.split('/').filter(Boolean).pop() || 'index.html'
    const sameDocument = page === current
      && link.pathname.replace(/^\//, '') === window.location.pathname.replace(/^\//, '')
      && link.search === window.location.search
    if (sameDocument) return

    if (PAGE_LOADERS.has(page)) {
      sessionStorage.setItem(STORAGE_KEY, '1')
      showPageLoader()
      return
    }

    if (SECTION_LOADERS.has(page)) {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  }, true)
})()
