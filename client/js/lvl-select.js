/* ============================================================
   LEVEL — Custom Premium Select Enhancer
   Replaces native <select> popup chrome with a dark-themed
   dropdown. The native <select> stays in the DOM so form values
   continue to post normally and the `change` event still fires.
   ============================================================ */

(function () {
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  function closeAll() {
    document.querySelectorAll('.lvl-select-menu.open').forEach(m => m.classList.remove('open', 'open-up'));
    document.querySelectorAll('.lvl-select-button[aria-expanded="true"]')
      .forEach(b => b.setAttribute('aria-expanded', 'false'));
  }

  function enhance(sel) {
    if (sel.dataset.lvlEnhanced === '1') return;
    if (sel.multiple) return;                 // native multi-select left alone
    sel.dataset.lvlEnhanced = '1';

    /* Wrapper */
    const wrapper = document.createElement('div');
    wrapper.className = 'lvl-select-wrapper';
    sel.parentNode.insertBefore(wrapper, sel);
    wrapper.appendChild(sel);

    /* Button */
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lvl-select-button';
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = `
      <span class="lvl-select-label"></span>
      <svg class="lvl-select-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    `;
    wrapper.appendChild(button);

    /* Menu */
    const menu = document.createElement('div');
    menu.className = 'lvl-select-menu';
    menu.setAttribute('role', 'listbox');
    wrapper.appendChild(menu);

    const labelEl = button.querySelector('.lvl-select-label');

    function syncLabel() {
      const opt = sel.options[sel.selectedIndex];
      if (!opt) {
        labelEl.textContent = sel.getAttribute('placeholder') || 'Select…';
        labelEl.classList.add('is-placeholder');
        return;
      }
      const isPlaceholder = !opt.value && opt.disabled;
      labelEl.textContent = opt.text;
      labelEl.classList.toggle('is-placeholder', isPlaceholder);
    }

    function renderOptions() {
      menu.innerHTML = '';
      Array.from(sel.options).forEach((opt, i) => {
        const item = document.createElement('div');
        item.className = 'lvl-select-option';
        item.setAttribute('role', 'option');
        if (i === sel.selectedIndex) item.classList.add('is-selected');
        if (!opt.value && opt.disabled) item.dataset.placeholder = 'true';
        item.dataset.index = String(i);
        item.innerHTML = `<span>${escapeHtml(opt.text)}</span>`;
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          if (opt.disabled) return;
          sel.selectedIndex = i;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          syncLabel();
          close();
        });
        menu.appendChild(item);
      });
    }

    function positionMenu() {
      menu.classList.remove('open-up');
      const rect = wrapper.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // If less than 240px below, open upwards
      if (spaceBelow < 240 && rect.top > 240) {
        menu.classList.add('open-up');
      }
    }

    let activeIdx = -1;
    function setActive(i) {
      activeIdx = i;
      menu.querySelectorAll('.lvl-select-option').forEach((el, idx) => {
        el.classList.toggle('is-active', idx === i);
      });
      const target = menu.children[i];
      if (target) target.scrollIntoView({ block: 'nearest' });
    }

    function open() {
      closeAll();
      renderOptions();
      positionMenu();
      menu.classList.add('open');
      button.setAttribute('aria-expanded', 'true');
      activeIdx = Math.max(0, sel.selectedIndex);
      setActive(activeIdx);
    }
    function close() {
      menu.classList.remove('open', 'open-up');
      button.setAttribute('aria-expanded', 'false');
      activeIdx = -1;
    }

    button.addEventListener('click', (e) => {
      e.stopPropagation();
      if (button.getAttribute('aria-expanded') === 'true') close();
      else open();
    });

    /* Keyboard a11y */
    button.addEventListener('keydown', (e) => {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        open();
      }
    });
    wrapper.addEventListener('keydown', (e) => {
      if (!menu.classList.contains('open')) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive(Math.min(menu.children.length - 1, activeIdx + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive(Math.max(0, activeIdx - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const target = menu.children[activeIdx];
        if (target) target.click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
        button.focus();
      }
    });

    /* Reflect external value changes (e.g. set programmatically) */
    sel.addEventListener('change', syncLabel);

    syncLabel();
  }

  function enhanceAll(root = document) {
    root.querySelectorAll('select.form-select, select.lvl-select').forEach(enhance);
  }

  // Initial pass
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => enhanceAll());
  } else {
    enhanceAll();
  }

  // Watch for selects added dynamically (e.g. modals, async forms)
  const mo = new MutationObserver(muts => {
    for (const m of muts) {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.matches?.('select.form-select, select.lvl-select')) enhance(node);
        node.querySelectorAll?.('select.form-select, select.lvl-select').forEach(enhance);
      });
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });

  /* Outside click + Esc close all */
  document.addEventListener('click', closeAll);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAll();
  });

  /* Reposition open menus on resize / scroll */
  window.addEventListener('resize', closeAll);
  window.addEventListener('scroll', closeAll, true);
})();
