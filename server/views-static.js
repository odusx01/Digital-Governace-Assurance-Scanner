'use strict';

const { esc, mpShell } = require('./views');

const legalCss = `
body{min-height:100vh;display:flex;flex-direction:column}
.legal-hero{background:linear-gradient(160deg,#0f172a 0%,#1e1b4b 60%,#312e81 100%);color:#fff;padding:clamp(56px,8vw,96px) 0 clamp(40px,6vw,72px)}
.legal-hero .sp-eyebrow{display:inline-flex;align-items:center;gap:8px;background:rgba(99,102,241,.2);border:1px solid rgba(129,140,248,.3);border-radius:100px;padding:4px 13px;font-size:11px;font-weight:700;color:#a5b4fc;letter-spacing:.06em;text-transform:uppercase;margin-bottom:16px}
.legal-hero h1{font-size:clamp(28px,4.5vw,50px);font-weight:800;letter-spacing:-.04em;margin:0 0 12px}
.legal-hero .legal-meta{color:rgba(255,255,255,.45);font-size:13px}
.legal-body{background:#f8fafc;flex:1;padding:clamp(48px,6vw,80px) 0}
.legal-inner{max-width:760px}
.legal-toc{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;margin-bottom:40px}
.legal-toc h3{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;margin:0 0 12px}
.legal-toc ol{margin:0;padding-left:18px;display:grid;gap:6px}
.legal-toc li a{color:#6366f1;font-size:14px;font-weight:600;text-decoration:none}
.legal-toc li a:hover{color:#4f46e5;text-decoration:underline}
.legal-section{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:28px 32px;margin-bottom:16px}
.legal-section h2{font-size:17px;font-weight:800;letter-spacing:-.02em;color:#0f172a;margin:0 0 12px;display:flex;align-items:center;gap:10px}
.legal-section h2 .sec-num{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:7px;background:#eef2ff;color:#6366f1;font-size:12px;font-weight:800;flex-shrink:0}
.legal-section p{color:#475569;line-height:1.8;font-size:15px;margin:0 0 12px}
.legal-section p:last-child{margin:0}
.legal-section ul{margin:10px 0 0;padding-left:20px;color:#475569;line-height:1.8;font-size:15px;display:grid;gap:4px}
.legal-section a{color:#6366f1;font-weight:600;text-decoration:none}
.legal-section a:hover{color:#4f46e5;text-decoration:underline}
.legal-highlight{background:#f0fdf4;border-left:3px solid #22c55e;border-radius:0 8px 8px 0;padding:14px 18px;margin-top:14px;color:#166534;font-size:14px;line-height:1.7}
.legal-warning{background:#fff7ed;border-left:3px solid #f59e0b;border-radius:0 8px 8px 0;padding:14px 18px;margin-top:14px;color:#92400e;font-size:14px;line-height:1.7}
.legal-contact-box{background:linear-gradient(135deg,#eef2ff,#f5f3ff);border:1px solid #c7d2fe;border-radius:14px;padding:24px;margin-top:8px;display:flex;align-items:flex-start;gap:16px}
.legal-contact-icon{width:40px;height:40px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:10px;display:grid;place-items:center;font-size:18px;flex-shrink:0}
.legal-contact-box h3{font-size:15px;font-weight:700;color:#0f172a;margin:0 0 4px}
.legal-contact-box p{color:#64748b;font-size:14px;margin:0;line-height:1.6}
.legal-contact-box a{color:#6366f1;font-weight:700;text-decoration:none}
.legal-contact-box a:hover{color:#4f46e5}
`;

function legalPage(slug, title, eyebrow, description, sections) {
  const toc = sections.filter(s => s.heading).map((s, i) =>
    `<li><a href="#s${i + 1}">${i + 1}. ${esc(s.heading)}</a></li>`
  ).join('');

  const content = sections.map((s, i) => {
    if (s.type === 'contact') return s.html;
    return `
    <div class="legal-section mp-reveal" id="s${i + 1}">
      <h2><span class="sec-num">${i + 1}</span>${esc(s.heading)}</h2>
      ${s.body}
    </div>`;
  }).join('');

  const body = `
  <section class="legal-hero">
    <div class="mp-inner">
      <div class="sp-eyebrow">${esc(eyebrow)}</div>
      <h1>${esc(title)}</h1>
      <p class="legal-meta">Last updated: September 2026 &nbsp;·&nbsp; ConsentLens</p>
    </div>
  </section>
  <section class="legal-body">
    <div class="mp-inner legal-inner">
      <div class="legal-toc">
        <h3>Contents</h3>
        <ol>${toc}</ol>
      </div>
      ${content}
    </div>
  </section>`;

  return mpShell(title, description, body, null, legalCss);
}

function privacyPage() {
  const sections = [
    {
      heading: 'Who we are',
      body: `<p>ConsentLens is operated by Digital Tech Assurance. We provide a web-based privacy assurance platform that simulates visitor consent journeys and produces technical evidence for compliance review.</p>
      <p>This policy explains what personal data we collect when you use the platform, how we use it, and your rights.</p>`,
    },
    {
      heading: 'Information we collect',
      body: `<p>We collect the following categories of personal data:</p>
      <ul>
        <li><strong>Account data</strong> — your name, email address, organisation name and role when you register.</li>
        <li><strong>Authentication data</strong> — a bcrypt hash of your password. We never store passwords in plain text.</li>
        <li><strong>Scan data</strong> — URLs you submit for scanning, scan configuration, cookies and network requests detected, findings, and remediation notes you create. This data is stored in your private workspace.</li>
        <li><strong>Usage data</strong> — basic server logs (IP address, browser, pages visited) retained for up to 30 days for security and debugging purposes.</li>
        <li><strong>Communication data</strong> — emails you send us for support or enquiries.</li>
      </ul>
      <div class="legal-highlight">Scan results are stored in your private workspace only. They are not shared with third parties or used to train any models.</div>`,
    },
    {
      heading: 'How we use your information',
      body: `<p>We use personal data only for the following purposes:</p>
      <ul>
        <li>To create and authenticate your account</li>
        <li>To provide the platform services you have requested</li>
        <li>To send you transactional emails (verification, alerts, digests) that you have configured</li>
        <li>To investigate security incidents and prevent abuse</li>
        <li>To comply with legal obligations</li>
      </ul>
      <p>We do not use your data for advertising, profiling, or selling to third parties.</p>`,
    },
    {
      heading: 'Legal bases for processing (UK GDPR)',
      body: `<p>Where UK GDPR applies, we rely on the following legal bases:</p>
      <ul>
        <li><strong>Contract</strong> — processing necessary to provide the service you have signed up for.</li>
        <li><strong>Legitimate interests</strong> — security logging, abuse prevention, and product improvement, balanced against your interests.</li>
        <li><strong>Legal obligation</strong> — where required by UK law.</li>
        <li><strong>Consent</strong> — for any optional marketing communications (you can withdraw at any time).</li>
      </ul>`,
    },
    {
      heading: 'Data retention',
      body: `<p>We retain data only as long as necessary:</p>
      <ul>
        <li>Account data is retained while your account is active and for 30 days after deletion.</li>
        <li>Scan data is retained until you delete it or close your account.</li>
        <li>Server logs are retained for up to 30 days.</li>
        <li>Shared report links expire according to the expiry date you set (maximum 90 days).</li>
      </ul>
      <p>You can delete individual scans at any time from your workspace. To delete your account and all associated data, contact us at the address below.</p>`,
    },
    {
      heading: 'Data sharing and transfers',
      body: `<p>We do not sell your personal data. We share data only with:</p>
      <ul>
        <li><strong>Infrastructure providers</strong> — hosting and database services operating under data processing agreements.</li>
        <li><strong>Email delivery services</strong> — for sending transactional emails you configure (e.g. alert emails, digests).</li>
        <li><strong>Law enforcement</strong> — where required by a valid legal obligation.</li>
      </ul>
      <p>Where data is transferred outside the UK or EEA, we ensure appropriate safeguards are in place (standard contractual clauses or adequacy decisions).</p>`,
    },
    {
      heading: 'Your rights',
      body: `<p>Under UK GDPR you have the right to:</p>
      <ul>
        <li><strong>Access</strong> — request a copy of the personal data we hold about you.</li>
        <li><strong>Rectification</strong> — ask us to correct inaccurate data.</li>
        <li><strong>Erasure</strong> — ask us to delete your data (subject to legal retention requirements).</li>
        <li><strong>Restriction</strong> — ask us to pause processing while a dispute is resolved.</li>
        <li><strong>Portability</strong> — receive your data in a structured, machine-readable format.</li>
        <li><strong>Object</strong> — object to processing based on legitimate interests.</li>
      </ul>
      <p>To exercise any right, contact us at <a href="mailto:privacy@consentlens.io">privacy@consentlens.io</a>. We will respond within 30 days. You also have the right to lodge a complaint with the <a href="https://ico.org.uk" target="_blank" rel="noopener">Information Commissioner's Office (ICO)</a>.</p>`,
    },
    {
      heading: 'Cookies on this website',
      body: `<p>This website uses a small number of strictly necessary cookies:</p>
      <ul>
        <li><strong>Session cookie</strong> — keeps you signed in during your session. Expires when you close your browser or sign out.</li>
        <li><strong>CSRF token</strong> — protects form submissions from cross-site request forgery.</li>
      </ul>
      <p>We do not use analytics, advertising, or tracking cookies on this website. We don't load third-party tag managers or pixels.</p>`,
    },
    {
      heading: 'Changes to this policy',
      body: `<p>We may update this policy to reflect changes in the platform or legal requirements. We will notify you of material changes by email or by displaying a notice in the platform. The "last updated" date at the top of this page reflects the most recent revision.</p>`,
    },
    {
      type: 'contact',
      heading: 'Contact',
      html: `
      <div class="legal-section mp-reveal" id="s9">
        <h2><span class="sec-num">9</span>Contact us</h2>
        <p>For privacy questions, data subject requests, or to report a concern:</p>
        <div class="legal-contact-box">
          <div class="legal-contact-icon">&#9993;</div>
          <div>
            <h3>Data controller</h3>
            <p>Digital Tech Assurance<br>
            Email: <a href="mailto:privacy@consentlens.io">privacy@consentlens.io</a><br>
            For data subject requests, please include your name and the email address associated with your account.</p>
          </div>
        </div>
      </div>`,
    },
  ];
  return legalPage('privacy', 'Privacy Policy', 'Legal', 'How ConsentLens collects, uses, and protects your personal data.', sections);
}

function termsPage() {
  const sections = [
    {
      heading: 'Acceptance of these terms',
      body: `<p>By accessing or using ConsentLens ("the platform"), you agree to be bound by these Terms of Service. If you do not agree, you must not use the platform.</p>
      <p>These terms form a binding agreement between you (or the organisation you represent) and Digital Tech Assurance, the operator of ConsentLens.</p>`,
    },
    {
      heading: 'Description of the service',
      body: `<p>ConsentLens is a privacy assurance platform that simulates real browser consent journeys on websites you specify and produces technical evidence reports. The platform includes:</p>
      <ul>
        <li>Automated consent journey scanning using a real browser engine</li>
        <li>Cookie classification, inventory, and severity-ranked findings</li>
        <li>Remediation tracking, scan comparison, and scheduled monitoring</li>
        <li>Evidence export, shared report links, and REST API access</li>
      </ul>
      <div class="legal-warning"><strong>Not legal advice.</strong> ConsentLens produces technical observations and risk interpretation. It is not a substitute for legal advice. Results should be reviewed by a qualified DPO or solicitor in the context of your specific legal obligations.</div>`,
    },
    {
      heading: 'Accounts and access',
      body: `<p>To use the platform you must create an account with a valid email address. You are responsible for:</p>
      <ul>
        <li>Maintaining the confidentiality of your login credentials</li>
        <li>All activity that occurs under your account</li>
        <li>Notifying us immediately of any unauthorised access at <a href="mailto:security@consentlens.io">security@consentlens.io</a></li>
      </ul>
      <p>We reserve the right to suspend or terminate accounts that violate these terms or that we reasonably believe are being used for harmful purposes.</p>`,
    },
    {
      heading: 'Acceptable use',
      body: `<p>You may use the platform only for lawful purposes. You must not:</p>
      <ul>
        <li>Scan websites you do not own or do not have explicit authorisation to test</li>
        <li>Use the platform to facilitate illegal surveillance, tracking, or data collection</li>
        <li>Attempt to reverse-engineer, decompile, or circumvent platform security measures</li>
        <li>Resell or sublicense access to the platform without written permission</li>
        <li>Use automated means to extract data from the platform beyond normal API usage</li>
      </ul>
      <p>Violations may result in immediate account termination and, where appropriate, reporting to relevant authorities.</p>`,
    },
    {
      heading: 'Intellectual property',
      body: `<p>All platform software, design, documentation, and branding is owned by or licensed to Digital Tech Assurance. Nothing in these terms transfers any intellectual property rights to you.</p>
      <p>Your scan data, findings, and reports remain yours. By using the platform you grant us a limited licence to process and store that data solely to provide the service.</p>`,
    },
    {
      heading: 'Pricing and payment',
      body: `<p>The Starter plan is free. Paid plans are billed as described on the pricing page at the time of subscription. Prices are in GBP and exclusive of VAT unless otherwise stated.</p>
      <ul>
        <li>Annual subscriptions are billed upfront and are non-refundable except where required by law.</li>
        <li>We reserve the right to change pricing with 30 days' notice to existing subscribers.</li>
        <li>Free plan features may change without notice.</li>
      </ul>`,
    },
    {
      heading: 'Limitation of liability',
      body: `<p>To the maximum extent permitted by applicable law:</p>
      <ul>
        <li>The platform is provided "as is" without warranties of any kind, express or implied.</li>
        <li>We do not warrant that scan results are complete, accurate, or legally sufficient for your compliance programme.</li>
        <li>Our total liability to you in any 12-month period shall not exceed the fees you paid to us in that period, or £100 if no fees were paid.</li>
        <li>We are not liable for indirect, incidental, special, consequential, or punitive damages.</li>
      </ul>
      <p>Nothing in these terms limits liability for death or personal injury caused by negligence, fraud, or any other liability that cannot lawfully be excluded.</p>`,
    },
    {
      heading: 'Termination',
      body: `<p>You may stop using the platform and delete your account at any time from your account settings or by contacting us.</p>
      <p>We may suspend or terminate your access if you breach these terms, with or without notice depending on the severity of the breach. On termination, your right to access the platform ceases immediately. We will delete your data within 30 days, subject to any legal retention obligations.</p>`,
    },
    {
      heading: 'Governing law',
      body: `<p>These terms are governed by and construed in accordance with the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.</p>`,
    },
    {
      heading: 'Changes to these terms',
      body: `<p>We may revise these terms from time to time. We will give at least 14 days' notice of material changes by email or platform notification. Continued use after the effective date constitutes acceptance of the revised terms.</p>`,
    },
    {
      type: 'contact',
      heading: 'Contact',
      html: `
      <div class="legal-section mp-reveal" id="s10">
        <h2><span class="sec-num">10</span>Contact us</h2>
        <p>For legal enquiries or to report a terms violation:</p>
        <div class="legal-contact-box">
          <div class="legal-contact-icon">&#9993;</div>
          <div>
            <h3>Digital Tech Assurance</h3>
            <p>Email: <a href="mailto:legal@consentlens.io">legal@consentlens.io</a><br>
            For support queries, please use <a href="mailto:support@consentlens.io">support@consentlens.io</a>.</p>
          </div>
        </div>
      </div>`,
    },
  ];
  return legalPage('terms', 'Terms of Service', 'Legal', 'The terms that govern your use of the ConsentLens platform.', sections);
}

function securityPage() {
  const sections = [
    {
      heading: 'Our approach to security',
      body: `<p>Security is a core part of how ConsentLens is designed, not an afterthought. Because the platform handles scan data, credentials, and evidence reports, we apply defence-in-depth across every layer of the stack.</p>
      <div class="legal-highlight">If you discover a security vulnerability, please report it responsibly before public disclosure. We commit to responding within 72 hours and to crediting researchers who report valid issues.</div>`,
    },
    {
      heading: 'Authentication and access control',
      body: `<ul>
        <li>Passwords are hashed with <strong>bcrypt</strong> (cost factor 12). We never store or log plain-text passwords.</li>
        <li>Sessions are managed with signed, HTTP-only, SameSite cookies. Sessions expire after inactivity.</li>
        <li>All API endpoints require Bearer token authentication. Tokens are generated with cryptographically secure random bytes.</li>
        <li>Email verification is required before account activation. Verification tokens are single-use and expire after 24 hours.</li>
        <li>CSRF protection is applied to all state-changing form endpoints.</li>
      </ul>`,
    },
    {
      heading: 'Data isolation',
      body: `<p>Every scan, report, remediation record, and monitor belongs to a specific user account. The platform enforces row-level access controls on all data queries — you can only access data associated with your account.</p>
      <ul>
        <li>Shared report links use a cryptographically random token and can be set to expire.</li>
        <li>API access is scoped to the authenticated user's workspace.</li>
        <li>Scan results are never visible across accounts or to unauthenticated users.</li>
      </ul>`,
    },
    {
      heading: 'Infrastructure security',
      body: `<ul>
        <li>The platform runs behind TLS 1.2+ with HSTS enforced. All data in transit is encrypted.</li>
        <li>Databases are encrypted at rest. Credentials are injected via environment variables, never hard-coded.</li>
        <li>Dependency vulnerabilities are monitored and patched on a regular cadence.</li>
        <li>Browser-based scanning uses isolated Playwright/Chromium instances that are destroyed after each scan.</li>
        <li>Input validation and parameterised queries are used throughout to prevent SQL injection and XSS.</li>
      </ul>`,
    },
    {
      heading: 'The scanning engine',
      body: `<p>ConsentLens scans websites by launching a real Chromium browser via Playwright. Each scan runs in an isolated browser context with no persistent state between scans.</p>
      <ul>
        <li>Browser processes run with reduced privileges and are terminated after scan completion.</li>
        <li>Network requests made during scanning are observed, not modified — ConsentLens does not inject scripts into scanned websites.</li>
        <li>Scanned website content is never stored permanently; only the structured findings and metadata are saved.</li>
      </ul>`,
    },
    {
      heading: 'Audit logging',
      body: `<p>All significant account actions are recorded in an audit log accessible to the account owner:</p>
      <ul>
        <li>Scan creation and deletion</li>
        <li>Monitor creation and deletion</li>
        <li>Scan comparison creation</li>
        <li>API key generation</li>
        <li>Report sharing</li>
      </ul>
      <p>Audit logs are available in your account settings under <strong>Data &amp; Activity</strong>.</p>`,
    },
    {
      heading: 'Responsible disclosure',
      body: `<p>We operate a responsible disclosure policy. If you believe you have found a security vulnerability in ConsentLens, please:</p>
      <ul>
        <li>Email <a href="mailto:security@consentlens.io">security@consentlens.io</a> with a clear description of the issue</li>
        <li>Include steps to reproduce, potential impact, and any proof-of-concept</li>
        <li>Allow us reasonable time to investigate and remediate before public disclosure</li>
      </ul>
      <p>We will acknowledge receipt within 72 hours and provide regular updates. We will not take legal action against researchers who report vulnerabilities in good faith and follow this process.</p>`,
    },
    {
      type: 'contact',
      heading: 'Security contact',
      html: `
      <div class="legal-section mp-reveal" id="s7">
        <h2><span class="sec-num">7</span>Security contact</h2>
        <p>To report a vulnerability or security concern:</p>
        <div class="legal-contact-box">
          <div class="legal-contact-icon">&#128274;</div>
          <div>
            <h3>Security team</h3>
            <p>Email: <a href="mailto:security@consentlens.io">security@consentlens.io</a><br>
            Please encrypt sensitive reports using PGP if possible. We aim to respond within 72 hours.</p>
          </div>
        </div>
      </div>`,
    },
  ];
  return legalPage('security', 'Security', 'Security', 'How ConsentLens protects your data and the platform itself.', sections);
}

function legalIndexPage() {
  const extraCss = `
body{min-height:100vh;display:flex;flex-direction:column}
.li-hero{background:linear-gradient(160deg,#0f172a 0%,#1e1b4b 60%,#312e81 100%);color:#fff;padding:clamp(72px,10vw,120px) 0 clamp(56px,7vw,88px)}
.li-hero .sp-eyebrow{display:inline-flex;align-items:center;gap:8px;background:rgba(99,102,241,.2);border:1px solid rgba(129,140,248,.3);border-radius:100px;padding:5px 14px;font-size:12px;font-weight:700;color:#a5b4fc;letter-spacing:.06em;text-transform:uppercase;margin-bottom:20px}
.li-hero h1{font-size:clamp(32px,5vw,58px);font-weight:800;letter-spacing:-.04em;margin:0 0 16px}
.li-hero p{color:rgba(255,255,255,.6);font-size:17px;line-height:1.75;max-width:580px;margin:0}
.li-body{background:#f8fafc;flex:1;padding:clamp(48px,7vw,88px) 0}
.li-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;margin-bottom:48px}
.li-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;text-decoration:none;color:inherit;display:flex;flex-direction:column;transition:box-shadow .18s,transform .18s}
.li-card:hover{box-shadow:0 8px 32px rgba(15,23,42,.1);transform:translateY(-3px)}
.li-card-icon{width:48px;height:48px;border-radius:12px;display:grid;place-items:center;font-size:22px;margin-bottom:20px;flex-shrink:0}
.li-card h2{font-size:18px;font-weight:800;letter-spacing:-.025em;margin:0 0 10px;color:#0f172a}
.li-card p{color:#64748b;font-size:14px;line-height:1.7;margin:0;flex:1}
.li-card .li-card-link{margin-top:20px;color:#6366f1;font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px}
.li-card:hover .li-card-link{color:#4f46e5}
.li-contact{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:36px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px}
.li-contact-item h3{font-size:14px;font-weight:800;color:#0f172a;margin:0 0 6px}
.li-contact-item p{color:#64748b;font-size:14px;line-height:1.7;margin:0}
.li-contact-item a{color:#6366f1;font-weight:700;text-decoration:none}
.li-contact-item a:hover{color:#4f46e5}
.li-section-label{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:#94a3b8;margin:0 0 16px}
@media(max-width:760px){.li-grid{grid-template-columns:1fr}.li-contact{grid-template-columns:1fr}}
`;

  const body = `
  <section class="li-hero">
    <div class="mp-inner">
      <div class="sp-eyebrow">Legal</div>
      <h1>Legal &amp; compliance</h1>
      <p>Everything you need to understand how ConsentLens works, what we do with your data, and how we keep the platform secure.</p>
    </div>
  </section>
  <section class="li-body">
    <div class="mp-inner">
      <p class="li-section-label">Documents</p>
      <div class="li-grid">
        <a class="li-card mp-reveal" href="/privacy">
          <div class="li-card-icon" style="background:#eef2ff">&#128274;</div>
          <h2>Privacy Policy</h2>
          <p>What personal data we collect, why we collect it, your rights under UK GDPR, and how to contact us with a data request.</p>
          <span class="li-card-link">Read privacy policy &#8594;</span>
        </a>
        <a class="li-card mp-reveal" href="/terms">
          <div class="li-card-icon" style="background:#f0fdf4">&#128221;</div>
          <h2>Terms of Service</h2>
          <p>The rules governing your use of the platform, acceptable use policy, liability limits, and how the agreement can be changed or ended.</p>
          <span class="li-card-link">Read terms &#8594;</span>
        </a>
        <a class="li-card mp-reveal" href="/security">
          <div class="li-card-icon" style="background:#fff7ed">&#128737;</div>
          <h2>Security</h2>
          <p>How we protect your account and data: authentication, data isolation, infrastructure hardening, and our responsible disclosure policy.</p>
          <span class="li-card-link">Read security page &#8594;</span>
        </a>
      </div>

      <p class="li-section-label">Contact</p>
      <div class="li-contact mp-reveal">
        <div class="li-contact-item">
          <h3>Privacy &amp; data requests</h3>
          <p>For GDPR requests, data deletion, or questions about how we use your personal data.</p>
          <p><a href="mailto:privacy@consentlens.io">privacy@consentlens.io</a></p>
        </div>
        <div class="li-contact-item">
          <h3>Legal &amp; compliance</h3>
          <p>For terms of service queries, contractual matters, or compliance documentation requests.</p>
          <p><a href="mailto:legal@consentlens.io">legal@consentlens.io</a></p>
        </div>
        <div class="li-contact-item">
          <h3>Security vulnerabilities</h3>
          <p>To report a security issue or vulnerability responsibly before public disclosure.</p>
          <p><a href="mailto:security@consentlens.io">security@consentlens.io</a></p>
        </div>
      </div>
    </div>
  </section>`;

  return mpShell('Legal', 'Privacy policy, terms of service, and security information for ConsentLens.', body, null, extraCss);
}

module.exports = { privacyPage, termsPage, securityPage, legalIndexPage };
