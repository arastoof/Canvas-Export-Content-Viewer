/* global COURSE_DATA */
'use strict';

/**
 * Data maps and application state.
 */

let courseData = null;
const itemByExportId = new Map(); // exportId → { item, module }
const allNavItems = [];        // flat ordered list for prev/next

const state = {
  currentId: null,
  openModules: new Set(),
  completed: new Set(),
  theme: 'dark',
  sidebarOpen: true,
  query: '',
};

/**
 * Persistence helpers for localStorage.
 */
function storageKey(suffix) {
  const safe = (courseData?.title || 'canvas').replace(/\W+/g, '-');
  return `canvas-viewer:${safe}:${suffix}`;
}
function loadState() {
  state.theme = localStorage.getItem('canvas-viewer:theme') || 'dark';
  const comp = localStorage.getItem(storageKey('completed'));
  if (comp) {
    try {
      JSON.parse(comp).forEach(id => state.completed.add(id));
    } catch (err) {
      console.warn('Failed to parse completed state from localStorage:', err);
    }
  }
  // openModules is intentionally not restored — modules start collapsed by default.
}
function saveCompleted() {
  localStorage.setItem(storageKey('completed'), JSON.stringify([...state.completed]));
}
  // openModules is session-only (not persisted).

/**
 * Builds lookup maps for quick access to course data.
 */
function buildMaps() {
  courseData = window.COURSE_DATA;
  if (!courseData || !Array.isArray(courseData.modules)) {
    return;
  }

  // Clear any existing data for fresh initialization
  itemByExportId.clear();
  allNavItems.length = 0;

  for (const mod of courseData.modules) {
    for (const item of mod.items) {
      const id = item.exportId || item.id;
      if (id) {
        const idStr = String(id);
        itemByExportId.set(idStr, { item, module: mod });
        if (item.type !== 'ContextModuleSubHeader') {
          allNavItems.push({ item, module: mod });
        }
      }
    }
  }
}

/**
 * Layout and Shell building.
 */

function buildShell() {
  document.title = courseData.title || 'Canvas Viewer';
  document.documentElement.setAttribute('data-theme', state.theme);

  document.getElementById('app').innerHTML = `
    <div class="app${state.sidebarOpen ? '' : ' sidebar-hidden'}" id="app-root">
      <!-- Top bar -->
      <header class="topbar">
        <button class="icon-btn" id="btn-sidebar" title="Toggle sidebar (M)">☰</button>
        <span class="topbar-title"><a href="index.html"><strong>${escHtml(courseData.title)}</strong></a></span>
        <div class="topbar-right">
          <button class="icon-btn" id="btn-theme" title="Toggle theme">🌙</button>
          <button class="icon-btn" id="btn-shortcuts" title="Keyboard shortcuts (?)">⌨</button>
        </div>
      </header>

      <!-- Sidebar -->
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-search-wrap">
          <span class="sidebar-search-icon">🔍</span>
          <input
            class="sidebar-search"
            id="search-input"
            type="search"
            placeholder="Search modules and items… (/)"
            autocomplete="off"
          />
        </div>
        <nav class="module-list" id="module-list"></nav>
        <div class="sidebar-footer">
          <span id="progress-label">Loading…</span>
          <div class="progress-bar-wrap">
            <div class="progress-bar" id="progress-bar" style="width:0%"></div>
          </div>
        </div>
      </aside>

      <!-- Main -->
      <main class="main" id="main">
        <div class="content-topbar">
          <nav class="breadcrumb" id="breadcrumb" aria-label="Breadcrumb"></nav>
          <div style="margin-left:auto">
            <button class="complete-btn" id="btn-complete" style="display:none">☐ Mark complete</button>
          </div>
        </div>
        <div class="content-scroll" id="content-scroll">
          <div class="content-inner" id="content-inner"></div>
        </div>
      </main>
    </div>`;
}

/**
 * Sidebar and Module List rendering.
 */

function renderSidebar() {
  const q = state.query.toLowerCase();
  const list = document.getElementById('module-list');
  if (!list) return;

  const fragments = [];

  for (const mod of courseData.modules) {
    const navItems = mod.items.filter(i => i.type !== 'ContextModuleSubHeader' && i.exportId);
    const matches = q
      ? mod.items.filter(i => i.title.toLowerCase().includes(q))
      : mod.items;

    if (q && matches.length === 0) continue;

    const isOpen = q ? true : state.openModules.has(String(mod.exportId || mod.id));
    const done = navItems.filter(i => state.completed.has(String(i.exportId || i.id))).length;
    const total = navItems.length;
    const pct = total ? Math.round((done / total) * 100) : 0;

    fragments.push(`
      <div class="module-section" data-mod-id="${escHtml(mod.exportId || mod.id)}">
        <div class="module-header${isOpen ? ' open' : ''}"
             data-mod="${escHtml(mod.exportId || mod.id)}">
          <span class="module-name">${escHtml(mod.name)}</span>
          ${!isOpen ? `<span class="mod-progress">${pct}%</span>` : ''}
          <span class="chevron">▶</span>
        </div>
        <div class="module-items${isOpen ? ' open' : ''}">
          ${renderModuleItems(mod.items, q)}
        </div>
      </div>`);
  }

  if (fragments.length === 0) {
    list.innerHTML = `<div class="no-results">No results for "<em>${escHtml(q)}</em>"</div>`;
  } else {
    list.innerHTML = fragments.join('');
  }

  updateProgress();
}

function renderModuleItems(items, q) {
  return items.map(item => {
    if (item.type === 'ContextModuleSubHeader') {
      if (q && !item.title.toLowerCase().includes(q)) return '';
      return `<div class="nav-subheader">${escHtml(item.title)}</div>`;
    }
    const itemId = String(item.exportId || item.id);
    if (!itemId) return '';
    if (q && !item.title.toLowerCase().includes(q)) return '';

    const isActive = itemId === state.currentId;
    const isDone = state.completed.has(itemId);
    const indentClass = item.indent > 0 ? ` indent-${Math.min(item.indent, 2)}` : '';
    const icon = typeIcon(item.type);

    return `
      <a class="nav-item${indentClass}${isActive ? ' active' : ''}${isDone ? ' completed' : ''}"
         href="#!/content/${itemId}"
         data-id="${escHtml(itemId)}"
         title="${escHtml(item.title)}">
        <span class="item-check">${isDone ? '✓' : '○'}</span>
        <span class="item-icon">${icon}</span>
        <span class="item-title">${escHtml(item.title)}</span>
        ${item.locked ? '<span class="item-lock">🔒</span>' : ''}
      </a>`;
  }).join('');
}

function typeIcon(type) {
  switch (type) {
    case 'Assignment': return '📋';
    case 'WikiPage': return '📄';
    case 'Attachment': return '📎';
    case 'ExternalUrl': return '🔗';
    default: return '•';
  }
}

function updateProgress() {
  const total = allNavItems.length;
  const done = allNavItems.filter(n => state.completed.has(String(n.item.exportId || n.item.id))).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const label = document.getElementById('progress-label');
  const bar = document.getElementById('progress-bar');
  if (label) label.textContent = `${done} / ${total} items complete`;
  if (bar) bar.style.width = pct + '%';
}

/**
 * Router and Navigation.
 */

function setupRouter() {
  window.addEventListener('hashchange', onHashChange);
  onHashChange();
}

function onHashChange() {
  const hash = location.hash;
  if (hash.startsWith('#!/content/')) {
    const id = hash.slice('#!/content/'.length);
    navigateTo(id);
  } else if (hash.startsWith('#!/module/')) {
    const id = hash.slice('#!/module/'.length);
    navigateToModule(id);
  } else {
    showOverview();
  }
}

function navigateToModule(modId) {
  const mod = courseData.modules.find(m => String(m.exportId || m.id) === modId);
  if (!mod) { showOverview(); return; }

  state.currentId = null;
  state.openModules.add(modId);

  updateBreadcrumb({ item: { title: 'Overview' }, module: mod });
  renderSidebar();
  renderModuleContent(mod);
  
  const btn = document.getElementById('btn-complete');
  if (btn) btn.style.display = 'none';
  
  document.getElementById('content-scroll')?.scrollTo(0, 0);
}

function navigateTo(exportId) {
  const entry = itemByExportId.get(exportId);
  if (!entry) { showOverview(); return; }

  state.currentId = exportId;

  // Open the parent module in sidebar
  const modId = String(entry.module.exportId || entry.module.id);
  if (modId && !state.openModules.has(modId)) {
    state.openModules.add(modId);
  }

  updateBreadcrumb(entry);
  renderSidebar();
  scrollSidebarToActive();
  renderContent(entry);
  updateCompleteBtn(exportId);
  document.getElementById('content-scroll')?.scrollTo(0, 0);
}

function scrollSidebarToActive() {
  setTimeout(() => {
    const el = document.querySelector('.nav-item.active');
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, 50);
}

/**
 * Content rendering logic for various item types.
 */

function renderContent({ item, module: mod }) {
  const inner = document.getElementById('content-inner');
  if (!inner) return;

  if (item.locked && !item.content) {
    inner.innerHTML = renderLocked(item);
    return;
  }

  if (item.type === 'Assignment') {
    inner.innerHTML = renderAssignment(item, mod);
    return;
  }

  if (item.type === 'Attachment' && item.content) {
    inner.innerHTML = renderAttachmentItem(item, mod);
    return;
  }

  if (item.type === 'ExternalUrl' && item.content) {
    inner.innerHTML = renderExternalUrlItem(item, mod);
    return;
  }

  const titleHtml = `
    <h1 class="page-title">${escHtml(item.title)}</h1>
    <div class="page-meta">
      <span class="page-badge badge-wiki">${item.type}</span>
      <span>${escHtml(mod.name)}</span>
    </div>`;

  let bodyHtml = '';
  if (item.content) {
    const { html, pdfLinks } = processContent(item.content);
    bodyHtml = `<div class="content-body">${html}</div>`;

    if (pdfLinks.length > 0) {
      bodyHtml += pdfLinks.map(pdf => renderPdfCard(pdf)).join('');
    }
  } else {
    bodyHtml = `<p style="color:var(--clr-txt-dim)">No content available for this item.</p>`;
  }

  inner.innerHTML = titleHtml + bodyHtml + renderPrevNext(String(item.exportId || item.id)) + renderModuleMiniList(mod, item);
}

/**
 * HTML processing and link rewriting for offline viewing.
 */
function processContent(rawHtml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  // Rewrite image/file src
  doc.querySelectorAll('img[src]').forEach(img => {
    img.src = rewriteFilePath(img.getAttribute('src'));
    img.style.maxWidth = '100%';
  });

  // Rewrite anchors
  const pdfLinks = [];
  doc.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href') || '';

    if (isPdfUrl(href)) {
      const fixed = rewriteFilePath(href);
      a.setAttribute('href', fixed);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
      pdfLinks.push({ href: fixed, label: a.textContent.trim(), filename: extractFilename(href) });

    } else if (isCanvasInternalLink(href)) {
      const exportId = extractExportId(href, doc);
      if (exportId) {
        a.setAttribute('href', `#!/content/${exportId}`);
        a.removeAttribute('target');
      } else {
        a.style.color = 'var(--clr-txt-faint)';
        a.title = 'Link not available in offline export';
      }

    } else if (href.startsWith('viewer/files/') || href.startsWith('./viewer/files/')) {
      a.setAttribute('href', rewriteFilePath(href));
      a.setAttribute('target', '_blank');

    } else if (href.startsWith('http://') || href.startsWith('https://')) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');

    } else if (!href.startsWith('#') && !href.startsWith('mailto:')) {
      // Canvas relative link with no known mapping — disable
      a.removeAttribute('href');
      a.style.cursor = 'default';
      a.style.color = 'var(--clr-txt-faint)';
    }
  });

  // Strip Canvas-specific classes that add unwanted styling
  doc.querySelectorAll('[class]').forEach(el => {
    if (el.classList.contains('inline_disabled')) el.classList.remove('inline_disabled');
  });

  return { html: doc.body.innerHTML, pdfLinks };
}

function isPdfUrl(href) {
  return /\.pdf(\?|$)/i.test(href);
}

function isCanvasInternalLink(href) {
  return href.startsWith('pages/') || href.startsWith('assignments/') ||
    href.startsWith('/pages/') || href.startsWith('/courses/');
}

function extractExportId(href, doc) {
  // href like: pages/ge839f957c2d8142fd8bdd8798cb6c656?module_item_id=...
  const m = href.match(/pages\/(g[0-9a-f]+)/i);
  if (m) return m[1];
  return null;
}

function rewriteFilePath(href) {
  // Strip Canvas query params. viewer/files/ paths are relative to the root
  // index.html which sits alongside the viewer/ folder — no prefix needed.
  return href
    .replace(/\?canvas_=1[^"']*/g, '')
    .replace(/\?canvas_qs_wrap=1[^"']*/g, '');
}

function extractFilename(href) {
  const parts = href.split('/').pop().split('?')[0];
  try { return decodeURIComponent(parts); } catch { return parts; }
}

/**
 * Renders an embedded PDF viewer.
 */
function renderPdfCard({ href, label, filename }) {
  const id = 'pdf-' + Math.random().toString(36).slice(2);
  return `
    <div class="pdf-card">
      <div class="pdf-card-header">
        <span class="pdf-card-icon">📄</span>
        <span class="pdf-card-name" title="${escHtml(filename)}">${escHtml(filename)}</span>
        ${label && label !== filename
      ? `<span class="pdf-card-label" title="${escHtml(label)}">${escHtml(label)}</span>`
      : ''}
        <a class="pdf-open-btn" href="${escHtml(href)}" target="_blank" rel="noopener">Open ↗</a>
      </div>
      <div class="pdf-iframe-wrap">
        <iframe
          class="pdf-iframe"
          id="${id}"
          src="${escHtml(href)}"
          title="${escHtml(filename)}"
          loading="lazy"
        ></iframe>
        <div class="pdf-fallback" id="${id}-fallback">
          Your browser can't display this PDF inline.
          <a href="${escHtml(href)}" target="_blank" rel="noopener">Open PDF ↗</a>
        </div>
      </div>
    </div>`;
}

/**
 * Renders assignment-specific metadata.
 */
function renderAssignment(item, mod) {
  const fmt = ts => ts ? new Date(ts).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A';
  return `
    <h1 class="page-title">${escHtml(item.title)}</h1>
    <div class="page-meta">
      <span class="page-badge badge-assign">Assignment</span>
      <span>${escHtml(mod.name)}</span>
    </div>
    <div class="assignment-card">
      <h3>📋 Assignment Details</h3>
      <dl class="assignment-meta-grid">
        <dt>Submission type</dt><dd>${escHtml(item.submissionTypes || 'N/A')}</dd>
        <dt>Points possible</dt><dd>${item.pointsPossible ?? 'N/A'}</dd>
        <dt>Due date</dt><dd>${fmt(item.dueAt)}</dd>
        <dt>Opens</dt><dd>${fmt(item.unlockAt)}</dd>
        <dt>Closes</dt><dd>${fmt(item.lockAt)}</dd>
        ${item.locked ? '<dt>Status</dt><dd>🔒 Locked in offline export</dd>' : ''}
      </dl>
    </div>
    ${renderPrevNext(String(item.exportId || item.id))}
    ${renderModuleMiniList(mod, item)}`;
}

/**
 * Renders a placeholder for items locked in the export.
 */
function renderLocked(item) {
  return `
    <div class="locked-notice">
      <span class="lock-icon">🔒</span>
      <h2>${escHtml(item.title)}</h2>
      <p>This item was locked at the time of export.</p>
    </div>`;
}

/**
 * Renders previous and next navigation buttons.
 */
function renderPrevNext(currentId) {
  const idx = allNavItems.findIndex(n => String(n.item.exportId || n.item.id) === currentId);
  const prev = allNavItems[idx - 1];
  const next = allNavItems[idx + 1];
  if (!prev && !next) return '';

  const prevId = prev ? String(prev.item.exportId || prev.item.id) : null;
  const nextId = next ? String(next.item.exportId || next.item.id) : null;

  return `
    <div class="content-nav">
      ${prev
      ? `<a class="nav-btn" href="#!/content/${prevId}">
             <span class="nav-btn-label">← Previous</span>
             <span class="nav-btn-title">${escHtml(prev.item.title)}</span>
           </a>`
      : '<div></div>'}
      ${next
      ? `<a class="nav-btn nav-next" href="#!/content/${nextId}">
             <span class="nav-btn-label">Next →</span>
             <span class="nav-btn-title">${escHtml(next.item.title)}</span>
           </a>`
      : '<div></div>'}
    </div>`;
}

/**
 * Updates the breadcrumb navigation in the top bar.
 */
function updateBreadcrumb({ item, module: mod }) {
  const bc = document.getElementById('breadcrumb');
  if (bc) {
    bc.innerHTML = `
      <span class="bc-mod">${escHtml(mod.name)}</span>
      <span class="bc-sep">›</span>
      <span class="bc-item">${escHtml(item.title)}</span>`;
  }
}

/**
 * Completion status management.
 */
function updateCompleteBtn(exportId) {
  const btn = document.getElementById('btn-complete');
  if (!btn) return;
  btn.style.display = 'inline-flex';
  const done = state.completed.has(exportId);
  btn.className = `complete-btn${done ? ' done' : ''}`;
  btn.innerHTML = done ? '✓ Completed' : '☐ Mark complete';
  btn.onclick = () => toggleComplete(exportId);
}

function toggleComplete(exportId) {
  if (state.completed.has(exportId)) {
    state.completed.delete(exportId);
  } else {
    state.completed.add(exportId);
  }
  saveCompleted();
  updateCompleteBtn(exportId);
  renderSidebar();          // re-render to update checkmarks
}

/**
 * Overview page rendering with module grid.
 */

function showOverview() {
  state.currentId = null;
  const inner = document.getElementById('content-inner');
  const bc = document.getElementById('breadcrumb');
  const btn = document.getElementById('btn-complete');
  if (bc) bc.innerHTML = '';
  if (btn) btn.style.display = 'none';
  if (!inner) return;

  const total = allNavItems.length;
  const done = allNavItems.filter(n => state.completed.has(n.item.exportId)).length;
  const mods = courseData?.modules?.length || 0;

  const cards = (courseData?.modules || []).map(mod => {
    const modId = String(mod.exportId || mod.id);
    const items = mod.items.filter(i => (i.exportId || i.id) && i.type !== 'ContextModuleSubHeader');
    const wikis = items.filter(i => i.type === 'WikiPage');
    const modDone = items.filter(i => state.completed.has(String(i.exportId || i.id))).length;
    const pct = items.length ? Math.round((modDone / items.length) * 100) : 0;
    
    // Link to first WikiPage if it exists, else use the Module Overview
    const firstWiki = wikis[0];
    const href = firstWiki 
      ? `#!/content/${String(firstWiki.exportId || firstWiki.id)}`
      : `#!/module/${modId}`;

    const previewItems = items.slice(0, 5).map(i => `
      <div class="mc-preview-item">
        <span class="mc-preview-icon">${typeIcon(i.type)}</span>
        <span class="mc-preview-title">${escHtml(i.title)}</span>
      </div>`).join('');
    
    const moreCount = items.length - 5;
    const moreHtml = moreCount > 0 ? `<div class="mc-preview-more">View ${moreCount} more items…</div>` : '';

    return `
      <div class="module-card" onclick="location.hash='${href}'">
        <h3>${escHtml(mod.name)}</h3>
        <p class="module-card-meta">${items.length} items · ${modDone} complete</p>
        <div class="module-card-progress">
          <div class="module-card-progress-fill" style="width:${pct}%"></div>
        </div>
        <div class="module-card-preview">
          <div class="mc-preview-list">
            ${previewItems}
          </div>
          ${moreHtml}
        </div>
      </div>`;
  }).join('');

  inner.innerHTML = `
    <div class="overview-hero">
      <h1>${escHtml(courseData.title)}</h1>
      <p>Canvas Course Export · Last downloaded ${escHtml(courseData.lastDownload ? new Date(courseData.lastDownload).toLocaleDateString('en-GB') : 'unknown')}</p>
      <div class="hero-stats">
        <div class="hero-stat"><span class="num">${mods}</span><span class="lbl">Modules</span></div>
        <div class="hero-stat"><span class="num">${total}</span><span class="lbl">Items</span></div>
        <div class="hero-stat"><span class="num">${done}</span><span class="lbl">Complete</span></div>
      </div>
    </div>
    <div class="modules-grid">${cards}</div>`;

  renderSidebar();
}

/**
 * Renders the content of a module view (list of items).
 */
function renderModuleContent(mod) {
  const inner = document.getElementById('content-inner');
  if (!inner) return;

  const itemsHtml = mod.items.map(item => {
    if (item.type === 'ContextModuleSubHeader') {
      return `<h3 class="mv-subheader">${escHtml(item.title)}</h3>`;
    }
    const id = String(item.exportId || item.id);
    if (!id) return '';
    
    const icon = typeIcon(item.type);
    const isDone = state.completed.has(id);
    const indent = item.indent > 0 ? ` style="margin-left:${item.indent * 20}px"` : '';
    
    return `
      <a class="mv-item${isDone ? ' done' : ''}" href="#!/content/${id}"${indent}>
        <div class="mv-item-icon">${icon}</div>
        <div class="mv-item-body">
          <div class="mv-item-title">${escHtml(item.title)}</div>
          <div class="mv-item-meta">${item.type}</div>
        </div>
        <div class="mv-item-check">${isDone ? '✓' : '○'}</div>
      </a>`;
  }).join('');

  inner.innerHTML = `
    <div class="mv-header">
      <span class="page-badge badge-wiki">Module</span>
      <h1 class="page-title">${escHtml(mod.name)}</h1>
      <p class="page-meta">${mod.items.filter(i => i.exportId || i.id).length} items in this module</p>
    </div>
    <div class="mv-list">
      ${itemsHtml}
    </div>`;
}

/**
 * Renders an attachment item (e.g. a PDF file).
 */
function renderAttachmentItem(item, mod) {
  const isPdf = /\.pdf(\?|$)/i.test(item.content);
  const fileUrl = rewriteFilePath(item.content);
  const filename = extractFilename(item.content) || item.title;

  let bodyHtml = '';
  if (isPdf) {
    bodyHtml = renderPdfCard({ href: fileUrl, filename: filename });
  } else {
    bodyHtml = `
      <div class="file-card">
        <div class="file-card-icon">📎</div>
        <div class="file-card-info">
          <h3>${escHtml(item.title)}</h3>
          <p>${escHtml(filename)}</p>
        </div>
        <a href="${escHtml(fileUrl)}" class="pdf-open-btn" target="_blank" rel="noopener">Download File</a>
      </div>`;
  }

  return `
    <h1 class="page-title">${escHtml(item.title)}</h1>
    <div class="page-meta">
      <span class="page-badge badge-wiki">Attachment</span>
      <span>${escHtml(mod.name)}</span>
    </div>
    <div class="content-body">
      ${bodyHtml}
    </div>
    ${renderPrevNext(String(item.exportId || item.id))}
    ${renderModuleMiniList(mod, item)}`;
}

/**
 * Renders an external URL item as a card.
 */
function renderExternalUrlItem(item, mod) {
  return `
    <h1 class="page-title">${escHtml(item.title)}</h1>
    <div class="page-meta">
      <span class="page-badge badge-wiki">External Link</span>
      <span>${escHtml(mod.name)}</span>
    </div>
    <div class="content-body">
      <div class="file-card">
        <div class="file-card-icon">🔗</div>
        <div class="file-card-info">
          <h3>${escHtml(item.title)}</h3>
          <p>${escHtml(item.content)}</p>
        </div>
        <a href="${escHtml(item.content)}" class="pdf-open-btn" target="_blank" rel="noopener">Open Link ↗</a>
      </div>
    </div>
    ${renderPrevNext(String(item.exportId || item.id))}
    ${renderModuleMiniList(mod, item)}`;
}

/**
 * Renders a compact version of the module list for the bottom of pages.
 */
function renderModuleMiniList(mod, currentItem) {
  const items = mod.items.filter(i => (i.exportId || i.id) && i.type !== 'ContextModuleSubHeader');
  if (items.length <= 1) return '';

  const itemsHtml = mod.items.map(item => {
    if (item.type === 'ContextModuleSubHeader') {
      return `<div class="mini-subheader">${escHtml(item.title)}</div>`;
    }
    const id = String(item.exportId || item.id);
    const isActive = id === String(currentItem.exportId || currentItem.id);
    const icon = typeIcon(item.type);
    const isDone = state.completed.has(id);
    
    return `
      <a class="mini-item${isActive ? ' active' : ''}${isDone ? ' done' : ''}" href="#!/content/${id}">
        <span class="mini-icon">${icon}</span>
        <span class="mini-title">${escHtml(item.title)}</span>
        <span class="mini-check">${isDone ? '✓' : ''}</span>
      </a>`;
  }).join('');

  return `
    <div class="module-mini-explorer">
      <div class="mini-header">
        <h4>In this module</h4>
        <a href="#!/module/${String(mod.exportId || mod.id)}" class="mini-all-link">View all items →</a>
      </div>
      <div class="mini-list">
        ${itemsHtml}
      </div>
    </div>`;
}

/**
 * Theme management.
 */

function setTheme(t) {
  state.theme = t;
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('canvas-viewer:theme', t);
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = t === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  setTheme(state.theme === 'dark' ? 'light' : 'dark');
}

/**
 * Sidebar visibility toggle.
 */

function toggleSidebar() {
  state.sidebarOpen = !state.sidebarOpen;
  document.getElementById('app-root')?.classList.toggle('sidebar-hidden', !state.sidebarOpen);
}

/**
 * Keyboard shortcut handling.
 */

function setupKeyboard() {
  document.addEventListener('keydown', e => {
    const tag = document.activeElement.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA';

    if (e.key === 'Escape') {
      closeShortcuts();
      if (typing) document.activeElement.blur();
      return;
    }
    if (e.key === '?') { showShortcuts(); return; }
    if (typing) return;

    switch (e.key) {
      case '/':
        e.preventDefault();
        document.getElementById('search-input')?.focus();
        break;
      case 'm': case 'M':
        toggleSidebar();
        break;
      case 'j': case 'ArrowRight':
        navigate(1); break;
      case 'k': case 'ArrowLeft':
        navigate(-1); break;
      case 'c': case 'C':
        if (state.currentId) toggleComplete(state.currentId);
        break;
    }
  });
}

function navigate(dir) {
  const idx = allNavItems.findIndex(n => String(n.item.exportId || n.item.id) === state.currentId);
  const next = allNavItems[idx + dir];
  if (next) {
    const nextId = String(next.item.exportId || next.item.id);
    location.hash = `#!/content/${nextId}`;
  }
}

function showShortcuts() {
  document.getElementById('shortcuts-modal')?.classList.remove('hidden');
}
function closeShortcuts() {
  document.getElementById('shortcuts-modal')?.classList.add('hidden');
}

/**
 * Event listener registration.
 */

function wireEvents() {
  // Sidebar toggle
  document.getElementById('btn-sidebar')?.addEventListener('click', toggleSidebar);

  // Theme toggle
  const themeBtn = document.getElementById('btn-theme');
  if (themeBtn) {
    themeBtn.textContent = state.theme === 'dark' ? '☀️' : '🌙';
    themeBtn.addEventListener('click', toggleTheme);
  }

  // Shortcuts modal
  document.getElementById('btn-shortcuts')?.addEventListener('click', showShortcuts);
  document.getElementById('close-shortcuts')?.addEventListener('click', closeShortcuts);
  document.getElementById('shortcuts-modal')?.addEventListener('click', e => {
    if (e.target.id === 'shortcuts-modal') closeShortcuts();
  });

  // Module accordion (delegated)
  document.getElementById('module-list')?.addEventListener('click', e => {
    const header = e.target.closest('.module-header');
    if (header) {
      const id = header.dataset.mod;
      if (state.openModules.has(id)) {
        state.openModules.delete(id);
      } else {
        state.openModules.add(id);
      }
      renderSidebar();
    }
  });

  // Search
  document.getElementById('search-input')?.addEventListener('input', e => {
    state.query = e.target.value;
    renderSidebar();
  });
}

/**
 * Utility functions.
 */

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Application initialization.
 */

function init() {
  if (!window.COURSE_DATA) {
    document.getElementById('app').innerHTML = `
      <div class="boot-screen">
        <p style="color:var(--clr-danger);font-size:15px">⚠️ Could not load course data.</p>
        <p style="color:var(--clr-txt-dim);font-size:13px;margin-top:8px">
          Make sure your Canvas export <code>viewer</code> folder (containing
          <code>course-data.js</code>) is placed next to <code>index.html</code>.
        </p>
      </div>`;
    return;
  }

  buildMaps();
  loadState();
  buildShell();
  wireEvents();
  setupKeyboard();
  setupRouter();
}

document.addEventListener('DOMContentLoaded', init);
