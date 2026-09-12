'use strict';

const { esc } = require('../views');

function footer({ currentPage = 'home' } = {}) {
  const legalLinks = [
    { href: '/privacy', label: 'Privacy Policy' },
    { href: '/terms', label: 'Terms of Service' },
    { href: '/security', label: 'Security' },
  ];

  const renderLink = (link) => {
    const targetAttr = link.external ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${esc(link.href)}"${targetAttr} class="site-footer-link">${esc(link.label)}</a>`;
  };

  return `<footer class="site-footer" role="contentinfo">
    <div class="site-footer-inner">
      <div class="site-footer-grid">
        <div class="site-footer-brand">
          <a href="/" class="site-footer-brand-link" aria-label="SPIDAC home">
            <span class="site-footer-brand-mark" aria-hidden="true">🛡</span>
            <span class="site-footer-brand-text">SPIDAC</span>
          </a>
          <p class="site-footer-brand-desc">
            Cookie compliance testing for modern teams.<br>
            Three scenarios. Plain-English findings. Local-first.
          </p>
        </div>

        <div class="site-footer-links">
          <div class="site-footer-col">
            <h4 class="site-footer-col-title">Product</h4>
            <div class="site-footer-col-list">
              <a href="/" class="site-footer-link">Home</a>
              <a href="/register" class="site-footer-link">Get Started</a>
              <a href="/login" class="site-footer-link">Sign in</a>
            </div>
          </div>
          <div class="site-footer-col">
            <h4 class="site-footer-col-title">Legal</h4>
            <div class="site-footer-col-list">
              ${legalLinks.map(renderLink).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="site-footer-bottom">
        <div class="site-footer-bottom-inner">
          <p class="site-footer-copyright">&copy; ${new Date().getFullYear()} SPIDAC - Digital Tech Assurance. All rights reserved.</p>
          <p class="site-footer-note">Built for privacy. Nothing leaves your machine.</p>
        </div>
      </div>
    </div>
  </footer>`;
}

module.exports = { footer };
