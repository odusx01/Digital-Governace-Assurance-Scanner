'use strict';

const { esc, layout } = require('./views');

function adminBlogPage(posts, user, editId = null) {
    const rows = posts.length
        ? posts.map(post => `
      <tr>
        <td><strong>${esc(post.title)}</strong><small>${esc(post.slug)}</small></td>
        <td>${esc(post.category)}</td>
        <td><span class="status status-${esc(post.status)}">${esc(post.status)}</span></td>
        <td>${esc(post.author_email || user.email)}</td>
        <td>
          <div class="row-actions">
            <a href="/admin/blog?edit=${encodeURIComponent(post.id)}">Edit</a>
            ${post.status === 'published' ? `<a href="/blog/${encodeURIComponent(post.slug)}" target="_blank" rel="noopener">View</a>` : ''}
            <form method="POST" action="/admin/blog/${encodeURIComponent(post.id)}/delete" onsubmit="return confirm('Delete this post?')"><button type="submit">Delete</button></form>
          </div>
        </td>
      </tr>`).join('')
        : '<tr><td colspan="5" class="empty">No blog posts yet. Create your first draft.</td></tr>';

    const editing = posts.find(post => String(post.id) === String(editId));
    const post = editing || { title: '', slug: '', excerpt: '', body: '', category: 'Privacy technology', status: 'draft' };

    const css = `
.admin-page { background:#f8fafc; min-height:calc(100vh - 64px); padding:42px 0 76px; }
.admin-heading { display:flex; align-items:flex-end; justify-content:space-between; gap:18px; margin-bottom:28px; }
.admin-eyebrow { color:#6366f1; font-size:11px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; }
.admin-heading h1 { margin-top:7px; font-size:32px; letter-spacing:-.04em; }
.admin-heading p { margin-top:5px; color:#64748b; }
.admin-layout { display:grid; grid-template-columns:minmax(0,1.25fr) minmax(280px,.75fr); gap:18px; align-items:start; }
.admin-card { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:22px; box-shadow:0 8px 20px rgba(15,23,42,.04); }
.admin-card h2 { font-size:18px; letter-spacing:-.025em; }
.admin-form { display:grid; gap:14px; margin-top:18px; }
.admin-form label { display:grid; gap:6px; color:#475569; font-size:12px; font-weight:800; letter-spacing:.05em; text-transform:uppercase; }
.admin-form input,.admin-form select,.admin-form textarea { width:100%; padding:10px 12px; border:1px solid #cbd5e1; border-radius:7px; color:#0f172a; background:#fff; font:inherit; font-size:14px; }
.admin-form textarea { min-height:130px; resize:vertical; line-height:1.6; }
.admin-form input:focus,.admin-form select:focus,.admin-form textarea:focus { outline:3px solid #e0e7ff; border-color:#6366f1; }
.admin-form .hint { color:#64748b; font-size:12px; font-weight:400; letter-spacing:0; text-transform:none; }
.admin-actions { display:flex; gap:9px; flex-wrap:wrap; margin-top:4px; }
.admin-btn { border:0; border-radius:7px; padding:10px 15px; background:#6366f1; color:#fff; cursor:pointer; font:inherit; font-size:13px; font-weight:800; }
.admin-btn-secondary { background:#eef2ff; color:#4338ca; }
.admin-table-wrap { margin-top:18px; overflow-x:auto; }
.admin-table { width:100%; border-collapse:collapse; font-size:13px; }
.admin-table th { padding:10px 8px; border-bottom:2px solid #e2e8f0; color:#64748b; font-size:10px; letter-spacing:.07em; text-align:left; text-transform:uppercase; }
.admin-table td { padding:13px 8px; border-bottom:1px solid #e2e8f0; vertical-align:top; }
.admin-table td strong,.admin-table td small { display:block; }
.admin-table td small { margin-top:3px; color:#94a3b8; font-family:monospace; }
.status { display:inline-block; padding:3px 7px; border-radius:4px; font-size:10px; font-weight:800; letter-spacing:.05em; text-transform:uppercase; }
.status-published { background:#dcfce7; color:#166534; }.status-draft { background:#f1f5f9; color:#475569; }
.row-actions { display:flex; align-items:center; gap:9px; white-space:nowrap; }.row-actions a { color:#4f46e5; font-weight:700; }.row-actions button { padding:0; border:0; background:none; color:#be123c; cursor:pointer; font:inherit; font-weight:700; }
.empty { padding:26px 8px !important; color:#64748b; text-align:center; }
.admin-note { margin-top:14px; padding:12px 14px; border-left:3px solid #818cf8; background:#eef2ff; color:#475569; font-size:12px; line-height:1.55; }
.admin-nav { display:flex; gap:12px; margin-bottom:24px; }
.admin-nav a { padding:7px 14px; border-radius:7px; font-size:13px; font-weight:700; text-decoration:none; color:#475569; background:#f1f5f9; }
.admin-nav a.active { background:#e0e7ff; color:#3730a3; }
@media (max-width:800px) { .admin-layout { grid-template-columns:1fr; }.admin-heading { align-items:flex-start; flex-direction:column; } }
`;

    return layout('Admin — Blog', `
<div class="admin-page"><div class="inner">
  <div class="admin-heading"><div><span class="admin-eyebrow">Admin console</span><h1>Blog publishing</h1><p>Create drafts, publish updates, and keep the public Blog current.</p></div><a class="admin-btn admin-btn-secondary" href="/blog">View public blog</a></div>
  <div class="admin-nav"><a href="/admin/blog" class="active">Blog</a><a href="/admin/users">Users</a></div>
  <div class="admin-layout">
    <section class="admin-card"><h2>${editing ? 'Edit post' : 'Create a post'}</h2>
      <form class="admin-form" method="POST" action="/admin/blog${editing ? `/${esc(editing.id)}` : ''}">
        <label>Title<input name="title" required maxlength="255" value="${esc(post.title)}" placeholder="e.g. What a consent scan can prove"></label>
        <label>Slug<input name="slug" maxlength="180" value="${esc(post.slug)}" placeholder="what-a-consent-scan-can-prove"><span class="hint">Lowercase URL slug. Leave blank to generate it from the title.</span></label>
        <label>Category<input name="category" required maxlength="80" value="${esc(post.category)}"></label>
        <label>Excerpt<textarea name="excerpt" required maxlength="500" rows="3" placeholder="Short summary shown on the blog index.">${esc(post.excerpt)}</textarea></label>
        <label>Body<textarea name="body" required rows="12" placeholder="Write the article body. Plain text paragraphs are supported.">${esc(post.body)}</textarea></label>
        <label>Status<select name="status"><option value="draft"${post.status === 'draft' ? ' selected' : ''}>Draft</option><option value="published"${post.status === 'published' ? ' selected' : ''}>Published</option></select></label>
        <div class="admin-actions"><button class="admin-btn" type="submit">${editing ? 'Save changes' : 'Create post'}</button>${editing ? '<a class="admin-btn admin-btn-secondary" href="/admin/blog">Cancel</a>' : ''}</div>
      </form>
    </section>
    <section class="admin-card"><h2>Posts</h2><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Post</th><th>Category</th><th>Status</th><th>Author</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div><p class="admin-note"><strong>Publishing rule:</strong> only posts marked Published appear on the public Blog. Drafts remain visible here for editing.</p></section>
  </div>
</div></div>`, `<style>${css}</style>`, user);
}

function adminUsersPage(users, currentUser) {
  const roleBadge = r => r === 'admin'
    ? `<span class="status" style="background:#e0e7ff;color:#3730a3">admin</span>`
    : `<span class="status status-draft">user</span>`;

  const rows = users.map(u => `<tr>
    <td>
      <strong>${esc(u.email)}</strong>
      <small>${esc(u.full_name || '—')}</small>
    </td>
    <td style="font-size:12px;color:#64748b">${esc(u.organization_name || '—')}</td>
    <td>${roleBadge(u.role)}</td>
    <td style="font-size:12px">${u.email_verified ? '<span style="color:#166534">✓ Verified</span>' : '<span style="color:#92400e">Unverified</span>'}</td>
    <td style="font-size:12px;color:#64748b">${u.scan_count}</td>
    <td style="font-size:12px;color:#94a3b8">${u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB') : '—'}</td>
    <td>
      <div class="row-actions">
        ${u.id !== currentUser.id ? `
          <form method="POST" action="/admin/users/${u.id}/role">
            <select name="role" onchange="this.form.submit()" style="font-size:12px;padding:3px 6px;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer">
              <option value="user"${u.role !== 'admin' ? ' selected' : ''}>user</option>
              <option value="admin"${u.role === 'admin' ? ' selected' : ''}>admin</option>
            </select>
          </form>
          <form method="POST" action="/admin/users/${u.id}/delete" onsubmit="return confirm('Delete ${esc(u.email)}? This will remove all their scans.')">
            <button type="submit">Delete</button>
          </form>
        ` : '<span style="color:#94a3b8;font-size:12px">(you)</span>'}
      </div>
    </td>
  </tr>`).join('');

  const css = `
.admin-page { background:#f8fafc; min-height:calc(100vh - 64px); padding:42px 0 76px; }
.admin-heading { display:flex; align-items:flex-end; justify-content:space-between; gap:18px; margin-bottom:28px; }
.admin-eyebrow { color:#6366f1; font-size:11px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; }
.admin-heading h1 { margin-top:7px; font-size:32px; letter-spacing:-.04em; }
.admin-heading p { margin-top:5px; color:#64748b; }
.admin-card { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:22px; box-shadow:0 8px 20px rgba(15,23,42,.04); }
.admin-table-wrap { margin-top:18px; overflow-x:auto; }
.admin-table { width:100%; border-collapse:collapse; font-size:13px; }
.admin-table th { padding:10px 8px; border-bottom:2px solid #e2e8f0; color:#64748b; font-size:10px; letter-spacing:.07em; text-align:left; text-transform:uppercase; }
.admin-table td { padding:13px 8px; border-bottom:1px solid #e2e8f0; vertical-align:top; }
.admin-table td strong,.admin-table td small { display:block; }
.admin-table td small { margin-top:3px; color:#94a3b8; font-family:monospace; }
.status { display:inline-block; padding:3px 7px; border-radius:4px; font-size:10px; font-weight:800; letter-spacing:.05em; text-transform:uppercase; }
.status-published { background:#dcfce7; color:#166534; }.status-draft { background:#f1f5f9; color:#475569; }
.row-actions { display:flex; align-items:center; gap:9px; white-space:nowrap; }.row-actions a { color:#4f46e5; font-weight:700; }.row-actions button { padding:0; border:0; background:none; color:#be123c; cursor:pointer; font:inherit; font-weight:700; }
.admin-nav { display:flex; gap:12px; margin-bottom:24px; }
.admin-nav a { padding:7px 14px; border-radius:7px; font-size:13px; font-weight:700; text-decoration:none; color:#475569; background:#f1f5f9; }
.admin-nav a.active { background:#e0e7ff; color:#3730a3; }
`;

  return layout('Admin — Users', `
<div class="admin-page"><div class="inner">
  <div class="admin-heading">
    <div>
      <span class="admin-eyebrow">Admin console</span>
      <h1>User management</h1>
      <p>View all registered users, change roles, and remove accounts.</p>
    </div>
  </div>
  <div class="admin-nav">
    <a href="/admin/blog">Blog</a>
    <a href="/admin/users" class="active">Users</a>
  </div>
  <div class="admin-card">
    <h2 style="font-size:18px;letter-spacing:-.025em">${users.length} registered user${users.length !== 1 ? 's' : ''}</h2>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr><th>Email / Name</th><th>Organisation</th><th>Role</th><th>Verified</th><th>Scans</th><th>Joined</th><th>Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>
</div></div>`, `<style>${css}</style>`, currentUser);
}

module.exports = { adminBlogPage, adminUsersPage };
