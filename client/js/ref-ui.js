/**
 * Shared helpers to render ref_* lookup data into onboarding / profile-setup UI.
 */

export function fillSelect(selectEl, items, { placeholder = '— Select —', selected } = {}) {
  if (!selectEl) return
  const keep = selected || selectEl.value
  selectEl.innerHTML = ''
  const ph = document.createElement('option')
  ph.value = ''
  ph.textContent = placeholder
  selectEl.appendChild(ph)
  for (const item of items || []) {
    if (item.id === 99) continue
    const opt = document.createElement('option')
    opt.value = item.label
    opt.textContent = item.label
    selectEl.appendChild(opt)
  }
  if (keep) selectEl.value = keep
}

export function renderChipGrid(container, items, { multi = true, onRender } = {}) {
  if (!container) return
  container.innerHTML = ''
  const click = multi ? 'toggleChip(this)' : 'selectSingle(this)'
  for (const item of items || []) {
    if (item.id === 99) continue
    const el = document.createElement('div')
    el.className = multi ? 'ob-chip' : 'ob-option'
    el.dataset.label = item.label
    if (item.category_slug) el.dataset.intent = item.category_slug
    el.setAttribute('onclick', click)
    el.textContent = item.label
    container.appendChild(el)
    onRender?.(el, item)
  }
}

export function renderOptionGrid(container, items, { withCustom = false, customKey = 'value' } = {}) {
  if (!container) return
  container.innerHTML = ''
  for (const item of items || []) {
    if (item.id === 99) continue
    const el = document.createElement('div')
    el.className = 'ob-option'
    if (item.category_slug) {
      el.dataset.intent = item.category_slug
      if (['legacy_builder', 'intentional_partner'].includes(item.category_slug)) {
        el.classList.add('ob-option--preferred')
      }
    }
    el.setAttribute('onclick', 'selectSingle(this)')
    el.innerHTML = `
      <div class="ob-option-check">✓</div>
      <span class="ob-option-label">${escapeHtml(item.label)}</span>`
    container.appendChild(el)
  }
  if (withCustom) {
    const custom = document.createElement('div')
    custom.className = 'ob-option custom'
    custom.setAttribute('onclick', `selectCustom(this, '${customKey}')`)
    custom.innerHTML = `
      <div class="ob-option-check"></div>
      <span class="ob-option-label">Add your own</span>
      <input type="text" class="ob-custom-input" placeholder="Type and press enter"
        style="display:none;margin-top:10px;width:100%;background:transparent;border:none;border-bottom:1px solid rgba(184,168,212,0.5);color:#FBF7EE;padding:6px 0;font-family:Inter,sans-serif;font-size:0.92rem;outline:none;"/>`
    container.appendChild(custom)
  }
}

export function renderProfileChips(container, items, { group, selected = [] } = {}) {
  if (!container) return
  container.innerHTML = ''
  const sel = new Set((selected || []).map(s => s.trim().toLowerCase()))
  for (const item of items || []) {
    if (item.id === 99) continue
    const el = document.createElement('div')
    el.className = 'interest-chip' + (sel.has(item.label.toLowerCase()) ? ' selected' : '')
    if (group) el.dataset.group = group
    el.setAttribute('onclick', 'toggleInterest(this)')
    el.textContent = item.label
    container.appendChild(el)
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]))
}

export function labelsFromAnswers(arr) {
  if (!arr) return []
  return Array.isArray(arr) ? arr.filter(Boolean) : [arr].filter(Boolean)
}

export function firstLabel(arr) {
  const a = labelsFromAnswers(arr)
  return a[0] || ''
}
