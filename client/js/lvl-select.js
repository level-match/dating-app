/* ============================================================
   LEVEL — Custom Premium Select Enhancer
   Replaces native <select> popup chrome with a dark-themed
   dropdown. The native <select> stays in the DOM so form values
   continue to post normally and the `change` event still fires.
   ============================================================ */

(function () {
  const DEFAULT_SEARCH_MIN = 8

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]))
  }

  function closeAll() {
    document.querySelectorAll('.lvl-select-menu.open').forEach(m => m.classList.remove('open', 'open-up'))
    document.querySelectorAll('.lvl-select-button[aria-expanded="true"]')
      .forEach(b => b.setAttribute('aria-expanded', 'false'))
  }

  function enhance(sel) {
    if (sel.dataset.lvlEnhanced === '1') return
    if (sel.multiple) return
    sel.dataset.lvlEnhanced = '1'

    const searchMin = Number(sel.dataset.lvlSearchMin || DEFAULT_SEARCH_MIN)
    const searchPlaceholder = sel.dataset.lvlSearchPlaceholder || 'Search…'

    const wrapper = document.createElement('div')
    wrapper.className = 'lvl-select-wrapper'
    sel.parentNode.insertBefore(wrapper, sel)
    wrapper.appendChild(sel)

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'lvl-select-button'
    button.setAttribute('aria-haspopup', 'listbox')
    button.setAttribute('aria-expanded', 'false')
    button.innerHTML = `
      <span class="lvl-select-label"></span>
      <svg class="lvl-select-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    `
    wrapper.appendChild(button)

    const menu = document.createElement('div')
    menu.className = 'lvl-select-menu'
    menu.setAttribute('role', 'listbox')

    const searchWrap = document.createElement('div')
    searchWrap.className = 'lvl-select-search-wrap'
    searchWrap.hidden = true
    const searchInput = document.createElement('input')
    searchInput.type = 'search'
    searchInput.className = 'lvl-select-search'
    searchInput.placeholder = searchPlaceholder
    searchInput.autocomplete = 'off'
    searchInput.setAttribute('aria-label', searchPlaceholder)
    searchWrap.appendChild(searchInput)

    const list = document.createElement('div')
    list.className = 'lvl-select-list'

    menu.appendChild(searchWrap)
    menu.appendChild(list)
    wrapper.appendChild(menu)

    const labelEl = button.querySelector('.lvl-select-label')
    let filterQuery = ''
    let activeVisibleIdx = -1

    function wantsSearch() {
      if (sel.dataset.lvlSearch === 'true') return true
      if (sel.dataset.lvlSearch === 'false') return false
      return sel.options.length >= searchMin
    }

    function syncLabel() {
      const opt = sel.options[sel.selectedIndex]
      if (!opt) {
        labelEl.textContent = sel.getAttribute('placeholder') || 'Select…'
        labelEl.classList.add('is-placeholder')
        return
      }
      const isPlaceholder = !opt.value && opt.disabled
      labelEl.textContent = opt.text
      labelEl.classList.toggle('is-placeholder', isPlaceholder)
    }

    function getVisibleItems() {
      return Array.from(list.querySelectorAll('.lvl-select-option'))
    }

    function setActiveVisible(idx, { scroll = true } = {}) {
      const items = getVisibleItems()
      if (!items.length) {
        activeVisibleIdx = -1
        return
      }
      const clamped = Math.max(0, Math.min(idx, items.length - 1))
      activeVisibleIdx = clamped
      items.forEach((el, i) => el.classList.toggle('is-active', i === clamped))
      if (scroll) {
        items[clamped].scrollIntoView({ block: 'nearest' })
      }
    }

    function renderOptions() {
      list.innerHTML = ''
      const q = filterQuery.trim().toLowerCase()
      const showSearch = wantsSearch()
      searchWrap.hidden = !showSearch

      let visibleCount = 0
      Array.from(sel.options).forEach((opt, i) => {
        const isPlaceholder = !opt.value && opt.disabled
        if (isPlaceholder) return
        if (q && !opt.text.toLowerCase().includes(q)) return

        const item = document.createElement('div')
        item.className = 'lvl-select-option'
        item.setAttribute('role', 'option')
        if (i === sel.selectedIndex) item.classList.add('is-selected')
        item.dataset.index = String(i)
        item.innerHTML = `<span>${escapeHtml(opt.text)}</span>`
        item.addEventListener('click', (e) => {
          e.stopPropagation()
          sel.selectedIndex = i
          sel.dispatchEvent(new Event('change', { bubbles: true }))
          syncLabel()
          close()
        })
        list.appendChild(item)
        visibleCount++
      })

      if (!visibleCount) {
        const empty = document.createElement('div')
        empty.className = 'lvl-select-empty'
        empty.textContent = q ? 'No matches' : 'No options'
        list.appendChild(empty)
        activeVisibleIdx = -1
        return
      }

      const items = getVisibleItems()
      const selectedVisible = items.findIndex(el => Number(el.dataset.index) === sel.selectedIndex)
      setActiveVisible(selectedVisible >= 0 ? selectedVisible : 0, { scroll: false })
    }

    function positionMenu() {
      menu.classList.remove('open-up')
      const rect = wrapper.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      if (spaceBelow < 280 && rect.top > 280) {
        menu.classList.add('open-up')
      }
    }

    function open() {
      closeAll()
      filterQuery = ''
      searchInput.value = ''
      renderOptions()
      positionMenu()
      menu.classList.add('open')
      button.setAttribute('aria-expanded', 'true')
      if (!searchWrap.hidden) {
        requestAnimationFrame(() => searchInput.focus())
      }
    }

    function close() {
      menu.classList.remove('open', 'open-up')
      button.setAttribute('aria-expanded', 'false')
      filterQuery = ''
      searchInput.value = ''
      activeVisibleIdx = -1
    }

    button.addEventListener('click', (e) => {
      e.stopPropagation()
      if (button.getAttribute('aria-expanded') === 'true') close()
      else open()
    })

    button.addEventListener('keydown', (e) => {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault()
        open()
      }
    })

    searchInput.addEventListener('input', () => {
      filterQuery = searchInput.value
      renderOptions()
    })

    searchInput.addEventListener('click', (e) => e.stopPropagation())

    searchInput.addEventListener('keydown', (e) => {
      e.stopPropagation()
      const items = getVisibleItems()
      if (!items.length) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveVisible(activeVisibleIdx < 0 ? 0 : activeVisibleIdx + 1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveVisible(activeVisibleIdx < 0 ? 0 : activeVisibleIdx - 1)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        items[activeVisibleIdx >= 0 ? activeVisibleIdx : 0]?.click()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        close()
        button.focus()
      }
    })

    wrapper.addEventListener('keydown', (e) => {
      if (!menu.classList.contains('open')) return
      if (e.target === searchInput) return

      const items = getVisibleItems()
      if (!items.length) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveVisible(activeVisibleIdx < 0 ? 0 : activeVisibleIdx + 1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveVisible(activeVisibleIdx < 0 ? 0 : activeVisibleIdx - 1)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        items[activeVisibleIdx >= 0 ? activeVisibleIdx : 0]?.click()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        close()
        button.focus()
      }
    })

    sel.addEventListener('change', syncLabel)

    syncLabel()
    sel._lvlSelectRefresh = () => {
      syncLabel()
      if (menu.classList.contains('open')) renderOptions()
    }
  }

  function enhanceAll(root = document) {
    root.querySelectorAll('select.form-select, select.lvl-select').forEach(enhance)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => enhanceAll())
  } else {
    enhanceAll()
  }

  const mo = new MutationObserver(muts => {
    for (const m of muts) {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return
        if (node.matches?.('select.form-select, select.lvl-select')) enhance(node)
        node.querySelectorAll?.('select.form-select, select.lvl-select').forEach(enhance)
      })
    }
  })
  mo.observe(document.body, { childList: true, subtree: true })

  document.addEventListener('click', closeAll)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAll()
  })

  window.addEventListener('resize', closeAll)
  window.addEventListener('scroll', (e) => {
    const t = e.target
    if (t instanceof Element && t.closest('.lvl-select-wrapper')) return
    closeAll()
  }, true)

  window.lvlSelectRefresh = (sel) => {
    if (!sel) return
    if (typeof sel._lvlSelectRefresh === 'function') sel._lvlSelectRefresh()
  }
})()
