/* Shared UI helpers for admin panels */

export function toast(message, type = 'info') {
  const container = document.getElementById('admToasts')
  const el = document.createElement('div')
  el.className = `adm-toast adm-toast-${type}`
  el.innerHTML = `
    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      ${type === 'success' ? '<path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke-linecap="round"/><polyline points="22 4 12 14.01 9 11.01"/>'
      : type === 'error'   ? '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'
      :                       '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'}
    </svg>
    ${esc(message)}`
  container.appendChild(el)
  requestAnimationFrame(() => el.classList.add('visible'))
  setTimeout(() => {
    el.classList.remove('visible')
    el.addEventListener('transitionend', () => el.remove(), { once: true })
  }, 3500)
}

export function modal(html) {
  const portal = document.getElementById('admModals')
  const backdrop = document.createElement('div')
  backdrop.className = 'adm-modal-backdrop'
  backdrop.innerHTML = `<div class="adm-modal">${html}</div>`
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) portal.innerHTML = ''
  })
  portal.innerHTML = ''
  portal.appendChild(backdrop)
}

export function badge(text, statusKey) {
  const cls = `adm-badge adm-badge-${(statusKey || text || '').toLowerCase().replace(/[^a-z_]/g, '_')}`
  return `<span class="${cls}">${esc(text ?? '—')}</span>`
}

export function avatar(name, size = 32) {
  const initials = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const hue = [...(name || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return `<div class="adm-avatar" style="width:${size}px;height:${size}px;background:hsl(${hue},25%,22%);color:hsl(${hue},60%,70%);font-size:${size*0.3}px">${initials}</div>`
}

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }
