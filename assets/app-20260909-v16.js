(() => {
  const catalog = window.SEC_CATALOG;
  const levels = catalog.levels;
  const $ = (selector) => document.querySelector(selector);
  const pages = [...document.querySelectorAll('.page')];
  let current = { level: null, category: null, item: null, query: '' };

  const PDFJS_MODULE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/legacy/build/pdf.min.mjs';
  const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/legacy/build/pdf.worker.min.mjs';
  let pdfJsPromise = null;

  function icon(name) {
    const icons = { back: '←', book: '▣', audio: '▶', video: '▸', open: '↗' };
    return icons[name] || '';
  }

  function show(id) {
    pages.forEach((page) => page.classList.toggle('active', page.id === id));
    window.scrollTo(0, 0);
  }

  function applyTheme(levelKey) {
    const level = levels[levelKey];
    if (!level) return;
    document.documentElement.style.setProperty('--level', level.color);
    document.documentElement.style.setProperty('--level-bg1', level.gradient[0]);
    document.documentElement.style.setProperty('--level-bg2', level.gradient[1]);
  }

  async function getPdfJs() {
    if (!pdfJsPromise) {
      pdfJsPromise = import(PDFJS_MODULE).then((pdfjsLib) => {
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        return pdfjsLib;
      });
    }
    return pdfJsPromise;
  }

  function cleanupPdfViewers() {
    document.querySelectorAll('.pdfjs-viewer').forEach((viewer) => {
      if (typeof viewer._cleanupPdf === 'function') viewer._cleanupPdf();
    });
  }

  async function mountPdfViewer(container, url, title) {
    container.innerHTML = '<div class="pdf-loading">Loading PDF…</div>';
    let observer = null;
    let loadingTask = null;
    let destroyed = false;

    container._cleanupPdf = () => {
      destroyed = true;
      if (observer) observer.disconnect();
      if (loadingTask && typeof loadingTask.destroy === 'function') loadingTask.destroy();
    };

    try {
      const pdfjsLib = await getPdfJs();
      if (destroyed) return;

      loadingTask = pdfjsLib.getDocument({ url });
      const pdf = await loadingTask.promise;
      if (destroyed) return;

      container.innerHTML = '';
      const summary = document.createElement('div');
      summary.className = 'pdf-summary';
      summary.textContent = `${pdf.numPages} page${pdf.numPages === 1 ? '' : 's'}`;
      container.appendChild(summary);

      const wrappers = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const wrapper = document.createElement('div');
        wrapper.className = 'pdf-page';
        wrapper.dataset.pageNumber = String(pageNumber);
        wrapper.innerHTML = `<div class="pdf-page-placeholder">Page ${pageNumber}</div>`;
        container.appendChild(wrapper);
        wrappers.push(wrapper);
      }

      const renderPage = async (wrapper) => {
        if (destroyed || wrapper.dataset.rendered === 'true' || wrapper.dataset.rendering === 'true') return;
        wrapper.dataset.rendering = 'true';

        try {
          const pageNumber = Number(wrapper.dataset.pageNumber);
          const page = await pdf.getPage(pageNumber);
          if (destroyed) return;

          const baseViewport = page.getViewport({ scale: 1 });
          const availableWidth = Math.max(260, Math.min(container.clientWidth - 20, 1080));
          const scale = availableWidth / baseViewport.width;
          const viewport = page.getViewport({ scale });
          const outputScale = Math.min(window.devicePixelRatio || 1, 2);

          const canvas = document.createElement('canvas');
          canvas.className = 'pdf-canvas';
          canvas.setAttribute('aria-label', `${title}, page ${pageNumber}`);
          const context = canvas.getContext('2d', { alpha: false });
          canvas.width = Math.floor(viewport.width * outputScale);
          canvas.height = Math.floor(viewport.height * outputScale);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;

          await page.render({
            canvasContext: context,
            viewport,
            transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null,
            background: '#ffffff'
          }).promise;

          if (destroyed) return;
          wrapper.innerHTML = '';
          wrapper.appendChild(canvas);
          wrapper.dataset.rendered = 'true';
        } catch (error) {
          wrapper.innerHTML = '<div class="pdf-page-error">Could not render this page.</div>';
          console.error('PDF page rendering failed:', error);
        } finally {
          wrapper.dataset.rendering = 'false';
        }
      };

      if ('IntersectionObserver' in window) {
        observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              renderPage(entry.target);
              observer.unobserve(entry.target);
            }
          });
        }, { rootMargin: '900px 0px' });
        wrappers.forEach((wrapper) => observer.observe(wrapper));
      } else {
        wrappers.forEach((wrapper) => renderPage(wrapper));
      }

      if (wrappers[0]) renderPage(wrappers[0]);
    } catch (error) {
      if (destroyed) return;
      console.error('PDF loading failed:', error);
      container.innerHTML = `<div class="pdf-error"><strong>Preview unavailable.</strong><span>Use the Open PDF button above.</span></div>`;
    }
  }

  function buildHome() {
    const grid = $('#levels-grid');
    grid.innerHTML = '';
    Object.entries(levels).forEach(([key, level]) => {
      const button = document.createElement('button');
      button.className = 'level-card';
      button.style.setProperty('--c1', level.gradient[0]);
      button.style.setProperty('--c2', level.gradient[1]);
      button.style.setProperty('--level', level.color);
      button.disabled = !level.available;
      const labels = Object.values(level.categories).map((category) => category.label).join(' · ');
      button.innerHTML = `<div class="level-icon">${icon('book')}</div><h2>${level.label}</h2><p>${labels}</p>`;
      if (level.available) button.onclick = () => openLevel(key);
      grid.appendChild(button);
    });
  }

  function openLevel(levelKey, category) {
    cleanupPdfViewers();
    const level = levels[levelKey];
    if (!level || !level.available) return;
    applyTheme(levelKey);
    current.level = levelKey;
    current.category = category && level.categories[category] ? category : Object.keys(level.categories)[0];
    current.item = null;
    current.query = '';
    $('#level-badge').textContent = level.label;
    $('#level-title').textContent = level.label;

    const tabs = $('#category-tabs');
    tabs.innerHTML = '';
    Object.entries(level.categories).forEach(([key, categoryData]) => {
      const button = document.createElement('button');
      button.className = `tab${key === current.category ? ' active' : ''}`;
      button.textContent = categoryData.label;
      button.onclick = () => {
        current.category = key;
        current.query = '';
        renderLevel();
        location.hash = `#/${levelKey}/${key}`;
      };
      tabs.appendChild(button);
    });

    renderLevel();
    show('library-page');
    const desired = `#/${levelKey}/${current.category}`;
    if (location.hash !== desired) location.hash = desired;
  }

  function renderLevel() {
    const level = levels[current.level];
    applyTheme(current.level);
    [...document.querySelectorAll('.tab')].forEach((button, index) => {
      button.classList.toggle('active', Object.keys(level.categories)[index] === current.category);
    });

    const resource = $('#resource-slot');
    resource.innerHTML = '';

    const input = $('#search-input');
    input.value = '';
    input.placeholder = `Search ${level.categories[current.category].label.toLowerCase()}...`;
    input.oninput = () => {
      current.query = input.value;
      renderCards(current.query);
    };
    renderCards('');
  }

  function renderCards(query) {
    const category = levels[current.level].categories[current.category];
    const normalizedQuery = query.trim().toLowerCase();
    const visibleItems = category.items.filter((item) => {
      return !normalizedQuery || `${item.number} ${item.title}`.toLowerCase().includes(normalizedQuery);
    });

    const grid = $('#items-grid');
    grid.innerHTML = '';
    visibleItems.forEach((item) => {
      const button = document.createElement('button');
      button.className = 'item-card';
      button.disabled = !item.available;
      button.innerHTML = `<span class="item-kicker">${item.label}</span><span class="item-number">${String(item.number).padStart(2, '0')}</span><span class="item-title">${item.title}</span>${!item.available ? '<span class="pending">Unavailable</span>' : ''}`;
      if (item.available) button.onclick = () => openItem(current.level, current.category, item.id);
      grid.appendChild(button);
    });
    if (!visibleItems.length) grid.innerHTML = '<div class="empty-state">No results.</div>';
  }

  function openItem(levelKey, category, id) {
    cleanupPdfViewers();
    const level = levels[levelKey];
    const categoryData = level?.categories[category];
    const item = categoryData?.items.find((entry) => String(entry.id) === String(id));
    if (!item) return;

    applyTheme(levelKey);
    current.level = levelKey;
    current.category = category;
    current.item = item;
    $('#viewer-badge').textContent = `${level.label} · ${item.label} ${String(item.number).padStart(2, '0')}`;
    $('#viewer-title').textContent = item.title;

    const stack = $('#media-stack');
    stack.innerHTML = '';

    const orderedMedia = [
      ...item.media.filter((media) => media.type === 'audio'),
      ...item.media.filter((media) => media.type === 'video'),
      ...item.media.filter((media) => media.type === 'pdf'),
      ...item.media.filter((media) => !['audio', 'video', 'pdf'].includes(media.type))
    ];

    orderedMedia.forEach((media) => {
      if (media.type === 'audio') {
        const card = document.createElement('section');
        card.className = 'media-card';
        card.innerHTML = `<h2>${media.label}</h2><audio class="audio-player" controls preload="metadata" src="${media.path}"></audio>`;
        stack.appendChild(card);
        return;
      }

      if (media.type === 'video') {
        const card = document.createElement('section');
        card.className = 'media-card';
        card.innerHTML = `<h2>${media.label}</h2><video class="video-player" controls preload="metadata" playsinline src="${media.path}"></video>`;
        stack.appendChild(card);
        return;
      }

      if (media.type === 'pdf') {
        const card = document.createElement('section');
        card.className = 'media-card';
        card.innerHTML = `<h2>${media.label}</h2><div class="pdf-actions"><a class="primary-link" href="${media.path}" target="_blank" rel="noopener">Open PDF ${icon('open')}</a></div>`;
        const viewer = document.createElement('div');
        viewer.className = 'pdfjs-viewer';
        viewer.setAttribute('aria-label', `${item.title} PDF preview`);
        card.appendChild(viewer);
        stack.appendChild(card);
        mountPdfViewer(viewer, media.path, item.title);
      }
    });

    if (!item.media.length) stack.innerHTML = '<div class="empty-state">Unavailable.</div>';
    show('viewer-page');
    const desired = `#/${levelKey}/${category}/${id}`;
    if (location.hash !== desired) location.hash = desired;
  }

  function route() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (!parts.length) {
      cleanupPdfViewers();
      show('home-page');
      return;
    }
    const [level, category, id] = parts;
    if (id) openItem(level, category, id);
    else openLevel(level, category);
  }

  $('#home-back').onclick = () => { location.hash = '#/'; };
  $('#viewer-back').onclick = () => { location.hash = `#/${current.level}/${current.category}`; };
  window.addEventListener('hashchange', route);
  buildHome();
  route();
})();
