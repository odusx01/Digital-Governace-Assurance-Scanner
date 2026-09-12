'use strict';

const { esc } = require('../views');

function header({ user, currentPage = 'home' } = {}) {
  const isLoggedIn = !!(user && user.id);
  const navItems = isLoggedIn
    ? [{ href: '/app', label: 'Dashboard', page: 'app' }]
    : [
      { href: '/', label: 'Home', page: 'home' },
      { href: '/trainings', label: 'Trainings', page: 'trainings' },
      { href: '/blog', label: 'Blog', page: 'blog' },
    ];

  const authSection = isLoggedIn
    ? `<div class="site-header-user" data-user-id="${esc(String(user.id || ''))}">
        <button class="site-header-user-trigger" id="user-menu-trigger" aria-haspopup="true" aria-expanded="false" type="button">
          <span class="site-header-user-avatar">${esc(String(user && user.email ? user.email[0] : 'U'))}</span>
          <span class="site-header-user-email">${esc(String(user.email || ''))}</span>
          <svg class="site-header-user-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="site-header-user-menu" id="user-menu" role="menu">
          <a href="/app" class="site-header-user-menu-item" role="menuitem">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 5.5A2.5 2.5 0 014.5 3h2.172a2.5 2.5 0 012.328 1.5L10 6.5H13.5A1.5 1.5 0 0115 8v6.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 14.5V8a1.5 1.5 0 011.5-1.5H2V5.5z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Dashboard
          </a>
          ${user.role === 'admin' ? '<a href="/admin/blog" class="site-header-user-menu-item" role="menuitem">Blog admin</a>' : ''}
          <form method="POST" action="/logout" class="site-header-user-menu-form">
            <button type="submit" class="site-header-user-menu-item site-header-user-menu-item--danger" role="menuitem">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 2h5.5A2.5 2.5 0 0111 4.5v2.172a2 2 0 01-.586 1.414l-.414.414V13.5a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 012 13.5V4.5A1.5 1.5 0 013.5 3H3v-.5A.5.5 0 012.5 2h0a.5.5 0 01.5.5V2z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.5 7.5a3 3 0 116 0" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
              Logout
            </button>
          </form>
        </div>
      </div>`
    : `<div class="site-header-auth">
        <a href="/login" class="site-header-cta site-header-cta-ghost">Sign in</a>
        <a href="/register" class="site-header-cta site-header-cta-primary">Get Started</a>
      </div>`;

  const navLinks = navItems.map(link => {
    const activeClass = currentPage === link.page ? 'site-header-nav-link--active' : '';
    const targetAttr = link.external ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${esc(link.href)}" class="site-header-nav-link ${activeClass}"${targetAttr}>${esc(link.label)}</a>`;
  }).join('');

  return `<header class="site-header" role="banner">
    <div class="site-header-inner">
      <a href="/" class="site-header-brand" aria-label="SPIDAC home">
        <span class="site-header-brand-mark" aria-hidden="true">🛡</span>
        <span class="site-header-brand-text">SPIDAC</span>
      </a>

      <nav class="site-header-nav" aria-label="Primary">
        ${navLinks}
      </nav>

      <div class="site-header-actions">
        ${authSection}
      </div>

      <button class="site-header-mobile-toggle" id="mobile-menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-menu" aria-label="Toggle menu">
        <span class="site-header-mobile-toggle-bar"></span>
        <span class="site-header-mobile-toggle-bar"></span>
        <span class="site-header-mobile-toggle-bar"></span>
      </button>
    </div>

    <div class="site-header-mobile-menu" id="mobile-menu" hidden>
      <nav class="site-header-mobile-nav" aria-label="Mobile">
        ${navLinks}
      </nav>
      <div class="site-header-mobile-auth">
        ${isLoggedIn
      ? `<form method="POST" action="/logout" class="site-header-mobile-auth-form">
              <button type="submit" class="site-header-mobile-auth-btn site-header-mobile-auth-btn--danger">Logout</button>
            </form>`
      : `<a href="/login" class="site-header-mobile-auth-btn site-header-mobile-auth-btn--ghost">Sign in</a>
             <a href="/register" class="site-header-mobile-auth-btn site-header-mobile-auth-btn--primary">Get Started</a>`
    }
      </div>
    </div>
  </header>

  <script>
    (function() {
      'use strict';
      const trigger = document.getElementById('mobile-menu-toggle');
      const menu = document.getElementById('mobile-menu');
      if (!trigger || !menu) return;

      function open() {
        menu.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        trigger.classList.add('is-open');
        menu.classList.add('is-open');
        document.body.style.overflow = 'hidden';
      }

      function close() {
        menu.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        trigger.classList.remove('is-open');
        menu.classList.remove('is-open');
        document.body.style.overflow = '';
      }

      trigger.addEventListener('click', function() {
        if (menu.hidden) open(); else close();
      });

      menu.querySelectorAll('a').forEach(function(link) {
        link.addEventListener('click', close);
      });

      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && !menu.hidden) close();
      });

      document.addEventListener('click', function(e) {
        if (!menu.contains(e.target) && !trigger.contains(e.target) && !menu.hidden) close();
      });
    })();
  </script>

  <script>
    (function() {
      'use strict';
      const trigger = document.getElementById('user-menu-trigger');
      const menu = document.getElementById('user-menu');
      if (!trigger || !menu) return;

      function open() {
        menu.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
      }

      function close() {
        menu.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
      }

      trigger.addEventListener('click', function(e) {
        e.stopPropagation();
        if (menu.classList.contains('is-open')) close(); else open();
      });

      document.addEventListener('click', function(e) {
        if (!menu.contains(e.target) && !trigger.contains(e.target)) close();
      });

      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') close();
      });
    })();
  </script>`;
}

module.exports = { header };
