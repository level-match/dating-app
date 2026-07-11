/* ============================================================
   LEVEL — Loading helpers (ES module wrapper)
   ============================================================ */

const api = () => window.__levelLoader

export function showPageLoader(label) {
  api()?.showPageLoader(label)
}

export function hidePageLoader() {
  api()?.hidePageLoader()
}

export function showSectionLoader(host, label) {
  return api()?.showSectionLoader(host, label)
}

export function hideSectionLoader(host) {
  api()?.hideSectionLoader(host)
}

export async function withPageLoad(task, label) {
  showPageLoader(label)
  try {
    return await task()
  } finally {
    hidePageLoader()
  }
}

export async function withSectionLoad(host, task, label) {
  showSectionLoader(host, label)
  try {
    return await task()
  } finally {
    hideSectionLoader(host)
  }
}

export function bootPageLoader(label) {
  // On app shells, loading-init.js scopes this to .app-content (topbar stays visible).
  showPageLoader(label)
}

export function finishPageLoader() {
  hidePageLoader()
}
