(function () {
  const page = window.location.pathname.split('/').pop() || 'dashboard.html';

  // Read unread notification count from the store (localStorage-backed).
  // Falls back gracefully if storage is empty or unavailable.
  function unreadCount() {
    try {
      const raw = localStorage.getItem('level_notifications');
      if (!raw) return 5; // seed value before first load
      const arr = JSON.parse(raw);
      return arr.filter(n => !n.read).length;
    } catch { return 0; }
  }
  const unread = unreadCount();

  const nav = [
    {
      section: 'Discover',
      items: [
        {
          label: 'Dashboard', href: 'dashboard.html', key: 'dashboard.html',
          badge: null,
          icon: `<path d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" stroke-linecap="round" stroke-linejoin="round"/>`,
        },
        {
          label: 'Match Dashboard', href: 'matches.html', key: 'matches.html',
          badge: '7',
          icon: `<path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" stroke-linecap="round" stroke-linejoin="round"/>`,
        },
        {
          label: 'Experiences', href: 'restaurants.html', key: 'restaurants.html',
          badge: null,
          icon: `<path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" stroke-linecap="round" stroke-linejoin="round"/>`,
        },
      ],
    },
    {
      section: 'Connect',
      items: [
        {
          label: 'Messages', href: 'chat.html', key: 'chat.html',
          badge: '3',
          icon: `<path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" stroke-linecap="round" stroke-linejoin="round"/>`,
        },
        {
          label: 'Reservations', href: 'reservations.html', key: 'reservations.html',
          badge: null,
          icon: `<path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round"/>`,
        },
        {
          label: 'Notifications', href: 'notifications.html', key: 'notifications.html',
          badge: unread > 0 ? String(unread) : null,
          icon: `<path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" stroke-linecap="round" stroke-linejoin="round"/>`,
        },
      ],
    },
    {
      section: 'Account',
      items: [
        // 'My Profile' intentionally omitted — profile access lives in the
        // avatar dropdown (View / Edit profile) to keep the nav clean and
        // avoid a duplicate, executive-friendly minimal sidebar.
        {
          label: 'Membership', href: 'membership.html', key: 'membership.html',
          badge: null,
          icon: `<path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" stroke-linecap="round" stroke-linejoin="round"/>`,
        },
        {
          label: 'Settings', href: 'settings.html', key: 'settings.html',
          badge: null,
          icon: `<path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke-linecap="round" stroke-linejoin="round"/>`,
        },
      ],
    },
  ];

  function svgIcon(paths) {
    return `<svg class="sidebar-icon" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">${paths}</svg>`;
  }

  /* ─── Collapse / minimize behaviour ───────────────────────── */
  const COLLAPSED_KEY = 'level_sidebar_collapsed';
  const isCollapsedInitial = (() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; }
  })();

  // Inject the collapse-mode CSS once. We override --sidebar-width so any
  // page using `margin-left: var(--sidebar-width)` reflows automatically.
  if (!document.getElementById('sidebar-collapse-styles')) {
    const style = document.createElement('style');
    style.id = 'sidebar-collapse-styles';
    style.textContent = `
      :root { --sidebar-width-expanded: 280px; --sidebar-width-collapsed: 76px; }
      html.sidebar-collapsed { --sidebar-width: var(--sidebar-width-collapsed) !important; }

      .app-sidebar { transition: width 0.35s cubic-bezier(0.16,1,0.3,1); }
      .app-main    { transition: margin-left 0.35s cubic-bezier(0.16,1,0.3,1); }

      /* Toggle button — always visible at the bottom of the sidebar */
      .sidebar-collapse-toggle {
        margin-top: auto;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 14px;
        border-radius: 12px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        color: rgba(255,255,255,0.65);
        font-family: var(--font-sans), 'Inter', sans-serif;
        font-size: 0.78rem;
        letter-spacing: 0.06em;
        cursor: pointer;
        transition: all 0.25s ease;
        width: 100%;
      }
      .sidebar-collapse-toggle:hover {
        background: rgba(212,168,67,0.10);
        border-color: rgba(212,168,67,0.32);
        color: var(--gold-300, #E0BE6A);
      }
      .sidebar-collapse-toggle svg {
        flex-shrink: 0;
        transition: transform 0.4s cubic-bezier(0.16,1,0.3,1);
      }
      html.sidebar-collapsed .sidebar-collapse-toggle {
        justify-content: center;
        padding: 12px 0;
      }
      html.sidebar-collapsed .sidebar-collapse-toggle svg {
        transform: rotate(180deg);
      }
      html.sidebar-collapsed .sidebar-collapse-toggle-label { display: none; }

      /* Hide labels / badges / section headers when collapsed */
      html.sidebar-collapsed .sidebar-section-label { display: none; }
      html.sidebar-collapsed .sidebar-badge { display: none; }
      html.sidebar-collapsed .sidebar-item {
        justify-content: center;
        padding-left: 0;
        padding-right: 0;
        font-size: 0;            /* hide the label text */
        gap: 0;
      }
      html.sidebar-collapsed .sidebar-item .sidebar-icon { margin: 0; }

      /* Logo image sizing + collapse → swap wordmark for the compact 'L' mark */
      .sidebar-logo-img  { height: 22px; width: auto; display: block; }
      .sidebar-logo-mark { height: 26px; width: auto; display: none; }
      html.sidebar-collapsed .sidebar-logo-img  { display: none; }
      html.sidebar-collapsed .sidebar-logo-mark { display: block; }
      html.sidebar-collapsed .sidebar-logo {
        justify-content: center;
      }
    `;
    document.head.appendChild(style);
  }

  if (isCollapsedInitial) document.documentElement.classList.add('sidebar-collapsed');

  /* ─── Build sidebar HTML ──────────────────────────────────── */
  let html = `
    <div class="sidebar-logo">
      <img class="sidebar-logo-img" src="assets/level-wordmark.png" alt="LEVEL">
      <img class="sidebar-logo-mark" src="assets/level-mark.png" alt="LEVEL">
    </div>
    <nav class="sidebar-nav">
  `;

  nav.forEach(({ section, items }) => {
    html += `<div class="sidebar-section-label">${section}</div>`;
    items.forEach(({ label, href, key, badge, icon }) => {
      const isActive = key && page === key;
      html += `
        <a href="${href}" class="sidebar-item${isActive ? ' active' : ''}" title="${label}">
          ${svgIcon(icon)}
          ${label}
          ${badge ? `<span class="sidebar-badge">${badge}</span>` : ''}
        </a>
      `;
    });
  });

  // Collapse toggle replaces the old user footer
  html += `
    </nav>
    <button class="sidebar-collapse-toggle" id="sidebarCollapseBtn" type="button" aria-label="Toggle sidebar">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
      <span class="sidebar-collapse-toggle-label">Collapse</span>
    </button>
  `;

  const sidebar = document.querySelector('.app-sidebar');
  if (sidebar) {
    sidebar.innerHTML = html;

    const btn = document.getElementById('sidebarCollapseBtn');
    if (btn) {
      btn.addEventListener('click', () => {
        const next = !document.documentElement.classList.contains('sidebar-collapsed');
        document.documentElement.classList.toggle('sidebar-collapsed', next);
        try { localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0'); } catch {}
      });
    }
  }

  /* ─── Mobile sidebar: hamburger + overlay ─────────────────── */
  (function () {
    // Only set up once
    if (document.getElementById('lvl-sidebar-overlay')) return;

    const ICON_HAMBURGER = `<svg fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/></svg>`;
    const ICON_CLOSE     = `<svg fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>`;

    // Inject overlay element
    const overlay = document.createElement('div');
    overlay.id = 'lvl-sidebar-overlay';
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    function getMenuBtn() {
      return document.querySelector('.mobile-menu-btn');
    }

    // Inject hamburger button into the topbar (left side)
    // Supports .app-topbar (most pages) and .chat-topbar (chat.html)
    function injectHamburger() {
      const topbar = document.querySelector('.app-topbar, .chat-topbar');
      if (!topbar || topbar.querySelector('.mobile-menu-btn')) return;

      const menuBtn = document.createElement('button');
      menuBtn.className = 'mobile-menu-btn';
      menuBtn.setAttribute('aria-label', 'Open navigation menu');
      menuBtn.setAttribute('type', 'button');
      menuBtn.innerHTML = ICON_HAMBURGER;
      topbar.insertBefore(menuBtn, topbar.firstChild);

      menuBtn.addEventListener('click', toggleSidebar);
    }

    function toggleSidebar() {
      if (document.documentElement.classList.contains('sidebar-open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    }

    function openSidebar() {
      document.documentElement.classList.add('sidebar-open');
      overlay.classList.add('active');
      const btn = getMenuBtn();
      if (btn) { btn.innerHTML = ICON_CLOSE; btn.setAttribute('aria-label', 'Close navigation menu'); }
    }

    function closeSidebar() {
      document.documentElement.classList.remove('sidebar-open');
      overlay.classList.remove('active');
      const btn = getMenuBtn();
      if (btn) { btn.innerHTML = ICON_HAMBURGER; btn.setAttribute('aria-label', 'Open navigation menu'); }
    }

    overlay.addEventListener('click', closeSidebar);
    overlay.addEventListener('touchend', function (e) { e.preventDefault(); closeSidebar(); });

    // Close when a nav link is tapped on mobile/tablet (while sidebar is overlay)
    document.addEventListener('click', function (e) {
      const link = e.target.closest('.sidebar-item');
      if (link && window.innerWidth <= 1024) {
        closeSidebar();
      }
    });

    // Try immediately, then observe for topbar injection
    injectHamburger();
    const obs = new MutationObserver(injectHamburger);
    obs.observe(document.body, { childList: true, subtree: true });
  })();
})();

/* ──────────────────────────────────────────────────────────────
   Topbar — make every icon clickable on every page.
   - 🔍 Search → opens a centered search modal
   - 💬 Messages, 🔔 Bell, Avatar → wraps as <a> if not already
   ────────────────────────────────────────────────────────────── */
(function () {
  // Search pool — name + role + tags from the same data the rest of the app uses
  const SEARCH_POOL = [
    { name: 'James T.',     role: 'Founder & CEO',           location: 'New York City', score: 96, href: 'chat.html',     bg: 'linear-gradient(135deg,#1A2F4A,#0D1E35)' },
    { name: 'Mia Santos',   role: 'Pediatric surgeon',       location: 'Madrid',        score: 94, href: 'matches.html',  bg: 'linear-gradient(135deg,#1A1330,#0F0820)' },
    { name: 'Sarah M.',     role: 'IP Partner · Law firm',   location: 'London',        score: 91, href: 'matches.html',  bg: 'linear-gradient(135deg,#101A2A,#1A1018)' },
    { name: 'Adrian Reyes', role: 'Cardiothoracic surgeon',  location: 'Toronto',       score: 92, href: 'matches.html',  bg: 'linear-gradient(135deg,#161024,#0A0814)' },
    { name: 'Daniel Cruz',  role: 'Creative director',       location: 'Mexico City',   score: 89, href: 'matches.html',  bg: 'linear-gradient(135deg,#1A1230,#0A0816)' },
    { name: 'Oliver H.',    role: 'Investment director',     location: 'London',        score: 86, href: 'matches.html',  bg: 'linear-gradient(135deg,#1A2030,#070E18)' },
    { name: 'Marcus L.',    role: 'Senior Partner · Attorney', location: 'New York City', score: 91, href: 'chat.html',   bg: 'linear-gradient(135deg,#12180A,#1A1208)' },
    { name: 'Ryan M.',      role: 'Cardiologist',            location: 'Boston',        score: 88, href: 'chat.html',     bg: 'linear-gradient(135deg,#1A2030,#101520)' },
    { name: 'David K.',     role: 'CTO',                     location: 'San Francisco', score: 91, href: 'chat.html',     bg: 'linear-gradient(135deg,#0F1D38,#06080F)' },
    { name: 'Thomas K.',    role: 'Managing Director',       location: 'New York City', score: 79, href: 'matches.html',  bg: 'linear-gradient(135deg,#0F1D38,#1A2F4A)' },
    { name: 'Daniel P.',    role: 'Neurosurgeon',            location: 'Boston',        score: 91, href: 'matches.html',  bg: 'linear-gradient(135deg,#0E1523,#1A0F08)' },
  ];

  // Inject the modal + styles once
  if (!document.getElementById('topbar-search-modal')) {
    const style = document.createElement('style');
    style.id = 'topbar-search-styles';
    style.textContent = `
      #topbar-search-modal {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 1500;
        background: rgba(1,15,36,0.78);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        align-items: flex-start;
        justify-content: center;
        padding: 14vh 24px 24px;
      }
      #topbar-search-modal.active { display: flex; animation: fadeUp 0.25s cubic-bezier(0.16,1,0.3,1) both; }

      .tbs-card {
        width: 100%;
        max-width: 580px;
        background: linear-gradient(155deg,#040810 0%,#08132B 50%,#0A1830 100%);
        border: 1px solid rgba(212,168,67,0.22);
        border-radius: 22px;
        box-shadow: 0 32px 80px rgba(0,0,0,0.55), 0 0 60px rgba(4,150,199,0.10);
        overflow: hidden;
      }
      .tbs-input-row {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 18px 22px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .tbs-input-row svg { flex-shrink: 0; color: rgba(255,255,255,0.50); }
      .tbs-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        color: #FDFCF8;
        font-family: 'Fraunces',Georgia,serif;
        font-size: 1.45rem;
        font-weight: 300;
        letter-spacing: -0.01em;
      }
      .tbs-input::placeholder { color: rgba(255,255,255,0.32); }
      .tbs-hint {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px;
        border-radius: 6px;
        font-family: 'Inter',sans-serif;
        font-size: 0.66rem;
        letter-spacing: 0.12em;
        color: rgba(255,255,255,0.42);
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.08);
      }

      .tbs-results {
        max-height: 56vh;
        overflow-y: auto;
        padding: 8px 6px 14px;
      }
      .tbs-empty {
        padding: 38px 28px;
        text-align: center;
        font-family: 'Inter',sans-serif;
        font-size: 0.88rem;
        color: rgba(255,255,255,0.45);
      }
      .tbs-section-label {
        padding: 14px 22px 6px;
        font-family: 'Inter',sans-serif;
        font-size: 0.62rem;
        font-weight: 600;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: rgba(212,168,67,0.85);
      }
      .tbs-result {
        display: grid;
        grid-template-columns: 44px 1fr auto;
        gap: 14px;
        align-items: center;
        padding: 12px 18px;
        margin: 0 8px;
        border-radius: 14px;
        cursor: pointer;
        text-decoration: none;
        transition: background 0.2s;
      }
      .tbs-result:hover,
      .tbs-result.is-active {
        background: rgba(212,168,67,0.08);
      }
      .tbs-result-avatar {
        width: 44px; height: 44px;
        border-radius: 50%;
        border: 1.5px solid rgba(212,168,67,0.30);
        background-size: cover;
        background-position: center;
        flex-shrink: 0;
      }
      .tbs-result-name {
        font-family: 'Fraunces',Georgia,serif;
        font-size: 1.02rem;
        color: #FDFCF8;
        font-weight: 400;
        letter-spacing: -0.005em;
      }
      .tbs-result-sub {
        font-family: 'Inter',sans-serif;
        font-size: 0.74rem;
        color: rgba(255,255,255,0.50);
        margin-top: 2px;
      }
      .tbs-result-score {
        font-family: 'Inter',sans-serif;
        font-size: 0.72rem;
        font-weight: 500;
        letter-spacing: 0.04em;
        color: var(--gold-300, #E0BE6A);
        padding: 4px 9px;
        border-radius: 999px;
        background: rgba(212,168,67,0.08);
        border: 1px solid rgba(212,168,67,0.30);
      }
      .tbs-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 18px;
        border-top: 1px solid rgba(255,255,255,0.06);
        font-family: 'Inter',sans-serif;
        font-size: 0.7rem;
        color: rgba(255,255,255,0.40);
        letter-spacing: 0.04em;
      }
      .tbs-footer kbd {
        font-family: 'Inter',sans-serif;
        font-size: 0.65rem;
        padding: 2px 7px;
        border-radius: 5px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.10);
        color: rgba(255,255,255,0.70);
      }
    `;
    document.head.appendChild(style);

    const modal = document.createElement('div');
    modal.id = 'topbar-search-modal';
    modal.innerHTML = `
      <div class="tbs-card">
        <div class="tbs-input-row">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <input class="tbs-input" id="tbsInput" type="text" placeholder="Search members, matches, conversations…" autocomplete="off" />
          <span class="tbs-hint">esc</span>
        </div>
        <div class="tbs-results" id="tbsResults"></div>
        <div class="tbs-footer">
          <span>Navigate with <kbd>↑</kbd> <kbd>↓</kbd></span>
          <span><kbd>Enter</kbd> to open</span>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Render results
    const resultsEl = document.getElementById('tbsResults');
    const inputEl   = document.getElementById('tbsInput');
    let activeIdx = 0;
    let filtered  = SEARCH_POOL.slice();

    function render(q) {
      const query = (q || '').toLowerCase().trim();
      filtered = !query
        ? SEARCH_POOL.slice(0, 8)
        : SEARCH_POOL.filter(p =>
            p.name.toLowerCase().includes(query) ||
            p.role.toLowerCase().includes(query) ||
            p.location.toLowerCase().includes(query)
          );
      activeIdx = 0;

      if (!filtered.length) {
        resultsEl.innerHTML = `<div class="tbs-empty">No members or conversations match “${query}”.</div>`;
        return;
      }

      const heading = query
        ? `<div class="tbs-section-label">Top matches</div>`
        : `<div class="tbs-section-label">Suggested</div>`;

      resultsEl.innerHTML = heading + filtered.map((p, i) => `
        <a class="tbs-result ${i === 0 ? 'is-active' : ''}" data-idx="${i}" href="${p.href}">
          <div class="tbs-result-avatar" style="background:${p.bg};"></div>
          <div>
            <div class="tbs-result-name">${p.name}</div>
            <div class="tbs-result-sub">${p.role} · ${p.location}</div>
          </div>
          <div class="tbs-result-score">${p.score}%</div>
        </a>
      `).join('');

      // Hover sets active
      resultsEl.querySelectorAll('.tbs-result').forEach(el => {
        el.addEventListener('mousemove', () => setActive(+el.dataset.idx));
      });
    }

    function setActive(i) {
      activeIdx = i;
      resultsEl.querySelectorAll('.tbs-result').forEach((el, idx) => {
        el.classList.toggle('is-active', idx === i);
      });
    }

    function open() {
      modal.classList.add('active');
      render('');
      inputEl.value = '';
      setTimeout(() => inputEl.focus(), 50);
    }
    function close() {
      modal.classList.remove('active');
    }

    inputEl.addEventListener('input', e => render(e.target.value));
    inputEl.addEventListener('keydown', e => {
      const items = resultsEl.querySelectorAll('.tbs-result');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive(Math.min(items.length - 1, activeIdx + 1));
        items[activeIdx]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive(Math.max(0, activeIdx - 1));
        items[activeIdx]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        const target = items[activeIdx];
        if (target?.href) window.location.href = target.href;
      } else if (e.key === 'Escape') {
        close();
      }
    });

    modal.addEventListener('click', e => {
      if (e.target === modal) close();
    });

    // Expose globally + bind Cmd/Ctrl+K
    window.openTopbarSearch = open;
    window.closeTopbarSearch = close;
    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        modal.classList.contains('active') ? close() : open();
      }
    });
  }

  /* Wire every topbar icon-button that *looks* like a search button.
     We detect the magnifying-glass SVG path. */
  function wireTopbarIcons() {
    document.querySelectorAll('.topbar-icon-btn').forEach(btn => {
      // Skip if it's already inside a link or already wired
      if (btn.dataset.tbsWired) return;
      const path = btn.querySelector('svg path')?.getAttribute('d') || '';
      const isSearch = path.includes('M21 21l-6-6');
      const inAnchor = btn.closest('a');

      if (isSearch && !inAnchor) {
        btn.style.cursor = 'pointer';
        btn.setAttribute('title', 'Search (⌘K)');
        btn.addEventListener('click', () => window.openTopbarSearch?.());
        btn.dataset.tbsWired = '1';
      }
    });
  }
  wireTopbarIcons();
  // Also wire after DOM mutations (e.g. chat.html dynamically rebuilds its topbar)
  const mo = new MutationObserver(wireTopbarIcons);
  mo.observe(document.body, { childList: true, subtree: true });
})();

/* ──────────────────────────────────────────────────────────────
   Topbar popovers — Messages, Notifications, and Profile each open
   a small summary card under their icon. Inside each popover is a
   "View all" link to the full page.
   ────────────────────────────────────────────────────────────── */
(function () {
  /* ── Data sources (read from localStorage where available) ── */
  function readLS(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }

  const MESSAGE_PREVIEWS = [
    { id: 1, name: 'James T.',  preview: 'That sounds wonderful — I know a great place in Tribeca…', time: '2:21 PM', bg: 'linear-gradient(135deg,#1A2F4A,#0D1E35)', unread: true },
    { id: 2, name: 'David K.',  preview: 'Happy to share more! The deals are fascinating but…',     time: '9:15 AM', bg: 'linear-gradient(135deg,#0F1D38,#06080F)', unread: true },
    { id: 3, name: 'Oliver H.', preview: 'Your profile is exceptional. Would you be open to…',      time: 'Yesterday', bg: 'linear-gradient(135deg,#1A2030,#070E18)', unread: false },
  ];

  function getNotificationsPreview() {
    const notifs = readLS('level_notifications', null);
    if (!notifs || !notifs.length) {
      return [
        { type: 'match',     title: 'New high-compatibility match',          body: 'James T. — 96% alignment.', time: '35m', read: false },
        { type: 'message',   title: 'New message from James T.',             body: '"Friday works for me."',    time: '2h',  read: false },
        { type: 'concierge', title: 'Your concierge confirmed Friday',       body: 'Tribeca · 7:30 PM.',        time: '1d',  read: true  },
      ];
    }
    return notifs.slice(0, 4).map(n => ({
      type: n.type,
      title: n.title,
      body: n.body,
      time: relTime(n.timeISO),
      read: n.read,
    }));
  }

  function relTime(iso) {
    if (!iso) return ''
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.round(diff / 60000);
    if (m < 1) return 'now';
    if (m < 60) return m + 'm';
    const h = Math.round(m / 60);
    if (h < 24) return h + 'h';
    return Math.round(h / 24) + 'd';
  }

  function getUser() {
    return readLS('level_user', {
      firstName: '', lastName: '',
      role: '',
      tier: 'base', profileComplete: 0,
      matches: 0, messages: 0, views: 0,
    });
  }

  /* ── Styles + popover container ─────────────────────────── */
  if (!document.getElementById('topbar-popover-styles')) {
    const style = document.createElement('style');
    style.id = 'topbar-popover-styles';
    style.textContent = `
      .tbp-pop {
        position: fixed;
        z-index: 1400;
        width: 340px;
        max-width: calc(100vw - 24px);
        background: linear-gradient(155deg,#040810 0%,#08132B 50%,#0A1830 100%);
        border: 1px solid rgba(212,168,67,0.22);
        border-radius: 18px;
        box-shadow: 0 24px 70px rgba(0,0,0,0.55), 0 0 50px rgba(4,150,199,0.10);
        overflow: hidden;
        opacity: 0;
        transform: translateY(-6px);
        transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.16,1,0.3,1);
        pointer-events: none;
      }
      .tbp-pop.active { opacity: 1; transform: translateY(0); pointer-events: auto; }
      .tbp-pop::before {
        content: '';
        position: absolute; top: 0; left: 22px; right: 22px;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(212,168,67,0.40), transparent);
      }

      .tbp-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 16px 20px 12px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .tbp-title {
        font-family: 'Fraunces',Georgia,serif;
        font-size: 1.05rem; color: #FDFCF8; font-weight: 400;
        letter-spacing: -0.005em;
      }
      .tbp-meta {
        font-family: 'Inter',sans-serif;
        font-size: 0.66rem;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--gold-300,#E0BE6A);
        font-weight: 500;
      }
      .tbp-body { padding: 6px 8px 10px; max-height: 60vh; overflow-y: auto; }

      .tbp-item {
        display: grid;
        grid-template-columns: 40px 1fr auto;
        gap: 12px;
        align-items: center;
        padding: 10px 12px;
        border-radius: 12px;
        cursor: pointer;
        text-decoration: none;
        transition: background 0.2s;
      }
      .tbp-item:hover { background: rgba(212,168,67,0.06); }

      .tbp-avatar {
        width: 40px; height: 40px;
        border-radius: 50%;
        background-size: cover; background-position: center;
        border: 1.5px solid rgba(212,168,67,0.30);
        flex-shrink: 0;
        position: relative;
      }
      .tbp-avatar .dot {
        position: absolute; bottom: -1px; right: -1px;
        width: 10px; height: 10px; border-radius: 50%;
        background: #55E2E9;
        border: 2px solid #0A1830;
      }

      .tbp-name {
        font-family: 'Fraunces',Georgia,serif;
        font-size: 0.96rem; color: #FDFCF8; font-weight: 400;
        letter-spacing: -0.005em;
      }
      .tbp-sub {
        font-family: 'Inter',sans-serif;
        font-size: 0.78rem;
        color: rgba(255,255,255,0.55);
        font-weight: 300;
        margin-top: 2px;
        line-height: 1.4;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
      }
      .tbp-time {
        font-family: 'Inter',sans-serif;
        font-size: 0.7rem;
        color: rgba(255,255,255,0.42);
        white-space: nowrap;
      }

      .tbp-empty {
        padding: 28px 22px; text-align: center;
        font-family: 'Inter',sans-serif;
        font-size: 0.86rem; color: rgba(255,255,255,0.45);
      }

      .tbp-footer {
        padding: 10px 14px;
        border-top: 1px solid rgba(255,255,255,0.06);
        text-align: center;
      }
      .tbp-footer a {
        display: inline-block;
        font-family: 'Inter',sans-serif;
        font-size: 0.72rem;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--gold-300,#E0BE6A);
        text-decoration: none;
        padding: 6px 14px;
        border-radius: 999px;
        transition: background 0.2s;
      }
      .tbp-footer a:hover { background: rgba(212,168,67,0.08); }

      /* Notification icon swatches */
      .tbp-nicon {
        width: 36px; height: 36px;
        border-radius: 10px;
        display: flex; align-items: center; justify-content: center;
        font-size: 14px;
        flex-shrink: 0;
      }
      .tbp-nicon.match     { background: rgba(212,168,67,0.18); color: var(--gold-300,#E0BE6A); border: 1px solid rgba(212,168,67,0.32); }
      .tbp-nicon.message   { background: rgba(4,150,199,0.18); color: #55E2E9; border: 1px solid rgba(85,226,233,0.32); }
      .tbp-nicon.request   { background: rgba(180,140,220,0.20); color: #C8B0E8; border: 1px solid rgba(180,140,220,0.32); }
      .tbp-nicon.view      { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.85); border: 1px solid rgba(255,255,255,0.12); }
      .tbp-nicon.concierge { background: rgba(123,181,155,0.20); color: #9BCBB4; border: 1px solid rgba(123,181,155,0.32); }
      .tbp-nicon.system    { background: rgba(212,168,67,0.16); color: var(--gold-200,#EDD490); border: 1px solid rgba(212,168,67,0.28); }
      .tbp-item.unread .tbp-name::after {
        content: ''; display: inline-block;
        width: 6px; height: 6px; border-radius: 50%;
        background: #55E2E9; margin-left: 8px;
        box-shadow: 0 0 8px #55E2E9;
        vertical-align: middle;
      }

      /* Profile popover */
      .tbp-profile-head {
        display: flex; gap: 14px; align-items: center;
        padding: 22px 22px 18px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .tbp-profile-avatar {
        width: 56px; height: 56px; border-radius: 50%;
        border: 2px solid rgba(212,168,67,0.55);
        background: linear-gradient(135deg,#1A2F4A,#0D1E35);
      }
      .tbp-profile-name {
        font-family: 'Fraunces',Georgia,serif;
        font-size: 1.25rem; color: #FDFCF8;
        letter-spacing: -0.01em; font-weight: 400;
      }
      .tbp-profile-tier {
        display: inline-flex; align-items: center; gap: 6px;
        margin-top: 4px;
        font-family: 'Inter',sans-serif;
        font-size: 0.7rem; letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--gold-300,#E0BE6A);
      }
      .tbp-profile-tier::before {
        content: '✦'; color: var(--gold-300,#E0BE6A);
      }

      .tbp-profile-stats {
        display: grid; grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        padding: 14px 18px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .tbp-profile-stat {
        text-align: center;
        padding: 10px 6px;
        border-radius: 10px;
        background: rgba(255,255,255,0.03);
      }
      .tbp-profile-stat .v {
        font-family: 'Fraunces',serif;
        font-size: 1.2rem; font-weight: 400;
        color: #FDFCF8;
        letter-spacing: -0.01em;
      }
      .tbp-profile-stat .l {
        font-family: 'Inter',sans-serif;
        font-size: 0.6rem;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: rgba(255,255,255,0.45);
        margin-top: 3px;
      }

      .tbp-progress-row {
        padding: 12px 18px 16px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .tbp-progress-labels {
        display: flex; justify-content: space-between;
        font-family: 'Inter',sans-serif;
        font-size: 0.7rem;
        color: rgba(255,255,255,0.55);
        margin-bottom: 7px;
      }
      .tbp-progress-labels strong {
        color: var(--gold-300,#E0BE6A);
        font-weight: 600;
      }
      .tbp-progress-track {
        height: 4px; border-radius: 999px;
        background: rgba(255,255,255,0.06); overflow: hidden;
      }
      .tbp-progress-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--ocean-500,#0496C7), var(--gold-300,#E0BE6A));
        border-radius: 999px;
        transition: width 0.6s;
      }

      .tbp-profile-actions {
        display: flex; flex-direction: column;
        padding: 6px;
      }
      .tbp-profile-actions a {
        display: flex; align-items: center; gap: 12px;
        padding: 11px 14px;
        border-radius: 10px;
        font-family: 'Inter',sans-serif;
        font-size: 0.86rem; color: rgba(255,255,255,0.78);
        text-decoration: none;
        transition: background 0.2s, color 0.2s;
      }
      .tbp-profile-actions a:hover {
        background: rgba(212,168,67,0.08);
        color: #FDFCF8;
      }
      .tbp-profile-actions a.danger:hover { color: #FCA5A5; background: rgba(239,68,68,0.07); }
      .tbp-profile-actions a svg { flex-shrink: 0; color: rgba(255,255,255,0.55); }
    `;
    document.head.appendChild(style);
  }

  /* ── Popover element factory ─────────────────────────────── */
  function ensurePopover(id) {
    let el = document.getElementById(id);
    if (el) return el;
    el = document.createElement('div');
    el.id = id;
    el.className = 'tbp-pop';
    document.body.appendChild(el);
    return el;
  }

  let currentlyOpen = null;
  function closeAll() {
    if (!currentlyOpen) return;
    currentlyOpen.classList.remove('active');
    currentlyOpen = null;
  }

  function positionPop(pop, anchor) {
    const rect = anchor.getBoundingClientRect();
    const popWidth = 340;
    let right = window.innerWidth - rect.right;
    if (right < 12) right = 12;
    pop.style.right = right + 'px';
    pop.style.left  = 'auto';
    pop.style.top   = (rect.bottom + 10) + 'px';
  }

  function togglePop(id, anchor, contentFn) {
    const pop = ensurePopover(id);
    if (currentlyOpen === pop) { closeAll(); return; }
    closeAll();
    pop.innerHTML = contentFn();
    positionPop(pop, anchor);
    requestAnimationFrame(() => pop.classList.add('active'));
    currentlyOpen = pop;
  }

  // Re-position on resize/scroll if open
  window.addEventListener('resize', () => {
    if (currentlyOpen && currentlyOpen._anchor) positionPop(currentlyOpen, currentlyOpen._anchor);
  });

  // Close on outside click
  document.addEventListener('mousedown', e => {
    if (!currentlyOpen) return;
    if (currentlyOpen.contains(e.target)) return;
    // Don't close if user clicked the anchor again (it'll toggle)
    if (currentlyOpen._anchor && currentlyOpen._anchor.contains(e.target)) return;
    closeAll();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAll();
  });

  /* ── Content builders ────────────────────────────────────── */
  function messagesHTML() {
    const unreadCt = MESSAGE_PREVIEWS.filter(m => m.unread).length;
    return `
      <div class="tbp-header">
        <span class="tbp-title">Messages</span>
        <span class="tbp-meta">${unreadCt} unread</span>
      </div>
      <div class="tbp-body">
        ${MESSAGE_PREVIEWS.map(m => `
          <a class="tbp-item" href="chat.html">
            <div class="tbp-avatar" style="background:${m.bg};">
              ${m.unread ? '<div class="dot"></div>' : ''}
            </div>
            <div>
              <div class="tbp-name">${m.name}</div>
              <div class="tbp-sub">${m.preview}</div>
            </div>
            <div class="tbp-time">${m.time}</div>
          </a>
        `).join('')}
      </div>
      <div class="tbp-footer"><a href="chat.html">View all messages →</a></div>
    `;
  }

  function notificationsHTML() {
    const items = getNotificationsPreview();
    const unreadCt = items.filter(i => !i.read).length;
    const ICON = { match: '◆', message: '✉', request: '↗', view: '◉', concierge: '✦', system: '✺' };
    return `
      <div class="tbp-header">
        <span class="tbp-title">Notifications</span>
        <span class="tbp-meta">${unreadCt} new</span>
      </div>
      <div class="tbp-body">
        ${items.length ? items.map(n => `
          <a class="tbp-item ${n.read ? '' : 'unread'}" href="notifications.html">
            <div class="tbp-nicon ${n.type || 'system'}">${ICON[n.type] || '✶'}</div>
            <div>
              <div class="tbp-name">${escapeText(n.title)}</div>
              <div class="tbp-sub">${escapeText(n.body || '')}</div>
            </div>
            <div class="tbp-time">${n.time || ''}</div>
          </a>
        `).join('') : `<div class="tbp-empty">You're all caught up.</div>`}
      </div>
      <div class="tbp-footer"><a href="notifications.html">See all activity →</a></div>
    `;
  }

  function getUserPhoto() {
    const u = getUser();
    const fromPhotos = Array.isArray(u.photos)
      ? (u.photos[0]?.src || (typeof u.photos[0] === 'string' ? u.photos[0] : null))
      : null;
    return u.mainPhoto || u.avatarUrl || fromPhotos || null;
  }

  function getUserInitials() {
    const u = getUser();
    const a = (u.firstName || '').trim().charAt(0);
    const b = (u.lastName || '').trim().charAt(0);
    return (a + b).toUpperCase() || (u.email || '?').charAt(0).toUpperCase();
  }

  /** Topbar avatar anchors — accept both legacy href and ?me=1. */
  function topbarAvatarLinks() {
    return [...document.querySelectorAll('a.topbar-avatar-link, a[href="profile.html?me=1"], a[href="profile.html"]')]
      .filter(a => {
        const child = a.firstElementChild;
        if (!child) return false;
        const style = child.getAttribute('style') || '';
        return /border-radius:\s*50%/.test(style) && /40px/.test(style);
      });
  }

  /** Ensure every app topbar has a clickable avatar for the account menu. */
  function ensureTopbarAvatar() {
    const topbar = document.querySelector('.app-topbar');
    if (!topbar) return;

    const existing = topbarAvatarLinks().find(a => topbar.contains(a));
    if (existing) {
      existing.setAttribute('href', 'profile.html?me=1');
      existing.classList.add('topbar-avatar-link');
      existing.setAttribute('aria-label', 'Account menu');
      return;
    }

    let actions = topbar.querySelector('.topbar-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'topbar-actions';
      actions.style.cssText = 'display:flex;align-items:center;gap:12px;margin-left:auto;';
      topbar.appendChild(actions);
    }

    const a = document.createElement('a');
    a.href = 'profile.html?me=1';
    a.className = 'topbar-avatar-link';
    a.setAttribute('aria-label', 'Account menu');
    a.innerHTML =
      '<div style="width:40px;height:40px;border-radius:50%;overflow:hidden;border:2px solid var(--border-gold);cursor:pointer;">' +
      '<div style="width:100%;height:100%;background:linear-gradient(135deg,#1A2F4A,#0D1E35);"></div>' +
      '</div>';
    actions.appendChild(a);
  }

  async function handleSignOut(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    try {
      const { signOut } = await import('/js/sso.js');
      await signOut();
    } catch {
      try { localStorage.removeItem('level_user'); } catch {}
    }
    window.location.href = 'auth.html';
  }

  // Sign-out lives inside popover HTML that is re-rendered each open —
  // use delegation so the listener always works.
  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-action="sign-out"]');
    if (!btn) return;
    handleSignOut(ev);
  });

  function profileHTML() {
    const u = getUser();
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Your profile';
    const tier = u.tier || 'Select';
    const complete = u.profileComplete ?? 72;
    const photo = getUserPhoto();
    const initials = getUserInitials();
    const avatarBg = photo
      ? `background:url(${photo}) center/cover no-repeat;`
      : `background:linear-gradient(135deg,#1A2F4A,#0D1E35);display:flex;align-items:center;justify-content:center;font-family:var(--font-sans),sans-serif;font-size:0.95rem;font-weight:500;color:rgba(224,190,106,0.95);letter-spacing:0.04em;`;
    const avatarInner = photo ? '' : escapeText(initials);
    return `
      <div class="tbp-profile-head">
        <div class="tbp-profile-avatar" style="${avatarBg}">${avatarInner}</div>
        <div>
          <div class="tbp-profile-name">${escapeText(name)}</div>
          <div class="tbp-profile-tier">${escapeText(tier)} member</div>
        </div>
      </div>

      <!-- Verification badges -->
      <div style="display:flex;flex-wrap:wrap;gap:5px;padding:14px 18px 6px;border-bottom:1px solid rgba(255,255,255,0.06);">
        <span class="lvl-vbadge lvl-vbadge--id lvl-vbadge--sm" title="ID Verified">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2"/>
            <circle cx="9" cy="12" r="2"/>
            <path d="M14 11h4M14 14h3"/>
          </svg>ID
        </span>
        <span class="lvl-vbadge lvl-vbadge--career lvl-vbadge--sm" title="Career Verified">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 7h18v12H3z"/>
            <path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2"/>
          </svg>Career
        </span>
        <span class="lvl-vbadge lvl-vbadge--photo lvl-vbadge--sm" title="Photo Verified">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="13" r="3"/>
            <path d="M5 7h3l2-3h4l2 3h3v12H5z"/>
          </svg>Photo
        </span>
        <span class="lvl-vbadge lvl-vbadge--premium lvl-vbadge--sm" title="Premium tier">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.5 7.1 18.2 8 12.7 4 8.8 9.5 8z"/>
          </svg>Premium
        </span>
      </div>
      <div class="tbp-profile-stats">
        <div class="tbp-profile-stat">
          <div class="v">${u.matches ?? 7}</div>
          <div class="l">Matches</div>
        </div>
        <div class="tbp-profile-stat">
          <div class="v">${u.messages ?? 3}</div>
          <div class="l">Messages</div>
        </div>
        <div class="tbp-profile-stat">
          <div class="v">${u.views ?? 12}</div>
          <div class="l">Views</div>
        </div>
      </div>
      <div class="tbp-progress-row">
        <div class="tbp-progress-labels">
          <span>Profile complete</span>
          <strong>${complete}%</strong>
        </div>
        <div class="tbp-progress-track">
          <div class="tbp-progress-fill" style="width:${complete}%;"></div>
        </div>
      </div>
      <div class="tbp-profile-actions">
        <a href="profile.html?me=1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke-linecap="round" stroke-linejoin="round"/></svg>
          View full profile
        </a>
        <a href="profile-setup.html">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Edit profile
        </a>
        <a href="reservations.html">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round"/></svg>
          My reservations
        </a>
        <a href="auth.html" class="danger" data-action="sign-out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Sign out
        </a>
      </div>
    `;
  }

  function escapeText(s) {
    return String(s || '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[ch]));
  }

  /* ── Wire topbar icons to popovers ───────────────────────── */
  function wirePopovers() {
    // Pattern: each icon is either inside an <a> wrapper or is the round avatar div.
    document.querySelectorAll('.topbar-icon-btn').forEach(btn => {
      if (btn.dataset.tbpWired) return;
      const path = btn.querySelector('svg path')?.getAttribute('d') || '';
      const isMessage = path.includes('M8 12h.01');
      const isBell    = path.includes('M15 17h5');

      const handler = (id, builder) => (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const pop = ensurePopover(id);
        pop._anchor = btn;
        togglePop(id, btn, builder);
      };

      // Intercept the surrounding <a> click and use the popover instead
      const anchor = btn.closest('a');
      const target = anchor || btn;

      if (isMessage) {
        target.addEventListener('click', handler('tbpMessages', messagesHTML));
        btn.style.cursor = 'pointer';
        btn.dataset.tbpWired = '1';
      } else if (isBell) {
        target.addEventListener('click', handler('tbpNotifications', notificationsHTML));
        btn.style.cursor = 'pointer';
        btn.dataset.tbpWired = '1';
      }
    });

    // Avatar: round 40x40 gold-bordered circle → account dropdown
    topbarAvatarLinks().forEach(a => {
      if (a.dataset.tbpWired) return;
      a.setAttribute('href', 'profile.html?me=1');
      a.classList.add('topbar-avatar-link');
      a.setAttribute('aria-label', 'Account menu');

      a.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const pop = ensurePopover('tbpProfile');
        pop._anchor = a;
        togglePop('tbpProfile', a, profileHTML);
      });
      a.dataset.tbpWired = '1';
    });
  }
  // Expose so profile-setup.js / dashboard can re-hydrate after load or upload
  window.__hydrateTopbarAvatars = function () {
    ensureTopbarAvatar();
    hydrateTopbarAvatars();
    wirePopovers();
  };

  // Inject the user's main photo (or initials) into every topbar avatar circle
  function hydrateTopbarAvatars() {
    const photo = getUserPhoto();
    const initials = getUserInitials();
    topbarAvatarLinks().forEach(a => {
      const outer = a.firstElementChild;
      if (!outer) return;
      const inner = outer.firstElementChild;
      if (!inner) return;
      if (photo) {
        inner.textContent = '';
        inner.style.cssText = `width:100%;height:100%;background:url(${photo}) center/cover no-repeat;`;
      } else {
        inner.textContent = initials;
        inner.style.cssText =
          'width:100%;height:100%;background:linear-gradient(135deg,#1A2F4A,#0D1E35);' +
          'display:flex;align-items:center;justify-content:center;' +
          'font-family:var(--font-sans),sans-serif;font-size:0.78rem;font-weight:500;' +
          'color:rgba(224,190,106,0.95);letter-spacing:0.04em;';
      }
    });
  }

  ensureTopbarAvatar();
  wirePopovers();
  hydrateTopbarAvatars();
  const mo2 = new MutationObserver(() => {
    ensureTopbarAvatar();
    wirePopovers();
    hydrateTopbarAvatars();
  });
  mo2.observe(document.body, { childList: true, subtree: true });
})();
