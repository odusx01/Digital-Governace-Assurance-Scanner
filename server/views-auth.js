'use strict';

const { esc, mpShell } = require('./views');

const authCss = `
body{min-height:100vh;display:flex;flex-direction:column}
.auth-wrap{flex:1;display:flex;align-items:center;justify-content:center;padding:clamp(48px,8vw,96px) 24px;background:#f8fafc}
.auth-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:clamp(28px,4vw,40px);width:100%;max-width:420px;box-shadow:0 4px 24px rgba(15,23,42,.07)}
.auth-logo{display:flex;align-items:center;gap:9px;font-weight:800;font-size:16px;color:#0f172a;text-decoration:none;margin-bottom:28px}
.auth-logo-mark{width:34px;height:34px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:10px;display:grid;place-items:center;font-size:16px;flex-shrink:0}
.auth-card h1{font-size:22px;font-weight:800;letter-spacing:-.03em;margin:0 0 6px;color:#0f172a}
.auth-card .auth-sub{color:#64748b;font-size:14px;margin:0 0 26px;line-height:1.6}
.auth-group{margin-bottom:16px}
.auth-group label{display:block;font-size:12px;font-weight:700;color:#475569;margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em}
.auth-group input{width:100%;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:9px;font-size:14px;font-family:inherit;outline:none;transition:border-color .15s,box-shadow .15s;background:#fff;color:#0f172a}
.auth-group input:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.15)}
.auth-group input::placeholder{color:#94a3b8}
.auth-btn{width:100%;padding:11px;background:#6366f1;color:#fff;border:none;border-radius:9px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:background .15s,transform .1s,box-shadow .15s;box-shadow:0 2px 8px rgba(99,102,241,.3);margin-top:4px}
.auth-btn:hover{background:#4f46e5;transform:translateY(-1px);box-shadow:0 4px 14px rgba(99,102,241,.4)}
.auth-btn:disabled{background:#94a3b8;cursor:not-allowed;transform:none;box-shadow:none}
.auth-error{background:#fff1f2;border:1px solid #fda4af;border-radius:8px;padding:10px 14px;color:#e11d48;font-size:13.5px;margin-bottom:16px;display:none;line-height:1.5;font-weight:500}
.auth-switch{text-align:center;margin-top:20px;font-size:13px;color:#64748b}
.auth-switch a{color:#6366f1;font-weight:700;text-decoration:none}
.auth-switch a:hover{color:#4f46e5}
.auth-divider{display:flex;align-items:center;gap:12px;margin:20px 0;color:#94a3b8;font-size:12px}
.auth-divider::before,.auth-divider::after{content:'';flex:1;height:1px;background:#e2e8f0}
`;

function loginPage() {
  const body = `
  <div class="auth-wrap">
    <div class="auth-card">
      <a class="auth-logo" href="/">
        <span class="auth-logo-mark">&#128737;</span>
        ConsentLens
      </a>
      <h1>Sign in</h1>
      <p class="auth-sub">Welcome back. Sign in to your workspace.</p>
      <div id="error-box" class="auth-error" role="alert"></div>
      <form id="auth-form" autocomplete="on">
        <div class="auth-group">
          <label for="email">Email address</label>
          <input type="email" id="email" name="email" required autofocus autocomplete="email" placeholder="you@company.com">
        </div>
        <div class="auth-group">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" required autocomplete="current-password" placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;">
        </div>
        <button type="submit" class="auth-btn" id="submit-btn">Sign in</button>
      </form>
      <div class="auth-switch">No account yet? <a href="/register">Create one free</a></div>
    </div>
  </div>
  <script>
  (function(){
    var form=document.getElementById('auth-form'),btn=document.getElementById('submit-btn'),err=document.getElementById('error-box');
    form.addEventListener('submit',function(e){
      e.preventDefault();err.style.display='none';btn.disabled=true;btn.textContent='Signing in...';
      fetch('/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.getElementById('email').value.trim(),password:document.getElementById('password').value})})
        .then(function(r){return r.json();})
        .then(function(d){if(d.error){err.style.display='block';err.textContent=d.error;btn.disabled=false;btn.textContent='Sign in';return;}window.location.href='/app';})
        .catch(function(){err.style.display='block';err.textContent='Could not reach the server.';btn.disabled=false;btn.textContent='Sign in';});
    });
  })();
  </script>`;
  return mpShell('Sign in', 'Sign in to your ConsentLens workspace.', body, null, authCss);
}

function registerPage() {
  const body = `
  <div class="auth-wrap">
    <div class="auth-card">
      <a class="auth-logo" href="/">
        <span class="auth-logo-mark">&#128737;</span>
        ConsentLens
      </a>
      <h1>Create account</h1>
      <p class="auth-sub">Get a private privacy-testing workspace. Free, no credit card needed.</p>
      <div id="error-box" class="auth-error" role="alert"></div>
      <form id="auth-form" autocomplete="on">
        <div class="auth-group">
          <label for="email">Work email</label>
          <input type="email" id="email" name="email" required autofocus autocomplete="email" placeholder="you@company.com">
        </div>
        <div class="auth-group">
          <label for="full-name">Full name</label>
          <input type="text" id="full-name" name="fullName" required autocomplete="name" placeholder="Your full name">
        </div>
        <div class="auth-group">
          <label for="organization-name">Organization</label>
          <input type="text" id="organization-name" name="organizationName" required autocomplete="organization" placeholder="Company or organization">
        </div>
        <div class="auth-group">
          <label for="organization-role">Your role</label>
          <input type="text" id="organization-role" name="organizationRole" required autocomplete="organization-title" placeholder="e.g. Privacy manager">
        </div>
        <div class="auth-group">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" required minlength="6" autocomplete="new-password" placeholder="At least 6 characters">
        </div>
        <div class="auth-group">
          <label for="confirm">Confirm password</label>
          <input type="password" id="confirm" name="confirm" required minlength="6" autocomplete="new-password" placeholder="Repeat your password">
        </div>
        <button type="submit" class="auth-btn" id="submit-btn">Create account</button>
      </form>
      <div class="auth-switch">Already have an account? <a href="/login">Sign in</a></div>
    </div>
  </div>
  <script>
  (function(){
    var form=document.getElementById('auth-form'),btn=document.getElementById('submit-btn'),err=document.getElementById('error-box');
    form.addEventListener('submit',function(e){
      e.preventDefault();
      var pw=document.getElementById('password').value,conf=document.getElementById('confirm').value;
      if(pw!==conf){err.style.display='block';err.textContent='Passwords do not match.';return;}
      err.style.display='none';btn.disabled=true;btn.textContent='Creating account...';
      fetch('/register',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.getElementById('email').value.trim(),password:pw,fullName:document.getElementById('full-name').value.trim(),organizationName:document.getElementById('organization-name').value.trim(),organizationRole:document.getElementById('organization-role').value.trim()})})
        .then(function(r){return r.json();})
        .then(function(d){if(d.error){err.style.display='block';err.textContent=d.error;btn.disabled=false;btn.textContent='Create account';return;}window.location.href='/verification-pending';})
        .catch(function(){err.style.display='block';err.textContent='Could not reach the server.';btn.disabled=false;btn.textContent='Create account';});
    });
  })();
  </script>`;
  return mpShell('Create account', 'Create your free ConsentLens workspace.', body, null, authCss);
}

function verificationPendingPage() {
  return simpleVerificationPage('Check your inbox', 'We created your account. Open the verification email we sent to complete registration before signing in.', 'The verification link expires in 24 hours.');
}

function verificationResultPage(success, message) {
  return simpleVerificationPage(
    success ? 'Email verified' : 'Verification failed',
    message,
    success ? 'Your workspace is ready when you are.' : 'Request a new registration email by signing up again.'
  );
}

function simpleVerificationPage(title, message, note) {
  const css = `
body{min-height:100vh;display:flex;flex-direction:column}
.vp-wrap{flex:1;display:flex;align-items:center;justify-content:center;padding:clamp(48px,8vw,96px) 24px;background:#f8fafc}
.vp-card{max-width:480px;padding:clamp(28px,4vw,40px);background:#fff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 4px 24px rgba(15,23,42,.07)}
.vp-card h1{font-size:26px;font-weight:800;letter-spacing:-.04em;margin:0 0 14px;color:#0f172a}
.vp-card p{color:#64748b;line-height:1.75;margin:0 0 10px;font-size:15px}
.vp-card a{display:inline-flex;align-items:center;margin-top:22px;padding:11px 22px;border-radius:9px;background:#6366f1;color:#fff;font-weight:700;text-decoration:none;font-size:14px;transition:background .15s}
.vp-card a:hover{background:#4f46e5}
`;
  const body = `
  <div class="vp-wrap">
    <div class="vp-card">
      <h1>${esc(title)}</h1>
      <p>${esc(message)}</p>
      <p>${esc(note)}</p>
      <a href="/login">Go to sign in</a>
    </div>
  </div>`;
  return mpShell(title, message, body, null, css);
}

module.exports = { loginPage, registerPage, verificationPendingPage, verificationResultPage };
