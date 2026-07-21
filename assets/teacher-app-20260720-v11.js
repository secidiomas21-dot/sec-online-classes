(() => {
  const catalog = window.SEC_CATALOG;
  const levels = catalog?.levels || {};
  const listPage = document.querySelector('#teacher-list-page');
  const viewerPage = document.querySelector('#teacher-viewer-page');
  const sections = document.querySelector('#teacher-sections');
  const mediaStack = document.querySelector('#teacher-media-stack');
  const backButton = document.querySelector('#teacher-back');

  const PDFJS_MODULE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/legacy/build/pdf.min.mjs';
  const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/legacy/build/pdf.worker.min.mjs';
  let pdfJsPromise = null;

  function applyTheme(levelKey) {
    const level = levels[levelKey];
    if (!level) return;
    document.documentElement.style.setProperty('--level', level.color);
    document.documentElement.style.setProperty('--level-bg1', level.gradient[0]);
    document.documentElement.style.setProperty('--level-bg2', level.gradient[1]);
  }

  function show(page) {
    listPage.classList.toggle('active', page === 'list');
    viewerPage.classList.toggle('active', page === 'viewer');
    window.scrollTo(0, 0);
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
          const context = canvas.getContext('2d', { alpha: false });

          canvas.className = 'pdf-canvas';
          canvas.setAttribute('aria-label', `${title}, page ${pageNumber}`);
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
      container.innerHTML = '<div class="pdf-error"><strong>Preview unavailable.</strong><span>Use the Open PDF button above.</span></div>';
    }
  }

  function createPdfCard(label, path, title) {
    const card = document.createElement('section');
    card.className = 'media-card teacher-media-card';
    card.innerHTML = `<h2>${label}</h2><div class="pdf-actions"><a class="primary-link" href="${path}" target="_blank" rel="noopener">Open PDF ↗</a></div>`;

    const viewer = document.createElement('div');
    viewer.className = 'pdfjs-viewer';
    viewer.setAttribute('aria-label', `${label}: ${title}`);
    card.appendChild(viewer);
    mountPdfViewer(viewer, path, `${label}: ${title}`);
    return card;
  }

  function createAudioCard(path) {
    const card = document.createElement('section');
    card.className = 'media-card teacher-media-card teacher-audio-card';
    card.innerHTML = `<h2>Audio</h2><audio class="audio-player" controls preload="metadata" src="${path}"></audio>`;
    return card;
  }

  function getListening(levelKey, id) {
    const items = levels[levelKey]?.categories?.listening?.items || [];
    return items.find((item) => String(item.id) === String(id) && item.hasTeacherGuide);
  }

  function teacherGuidePath(item) {
    const studentPdf = item.media.find((media) => media.type === 'pdf');
    if (!studentPdf) return null;
    return `${studentPdf.path.slice(0, studentPdf.path.lastIndexOf('/') + 1)}teacher-guide.pdf`;
  }

  function buildTeacherList() {
    sections.innerHTML = '';

    ['intermediate', 'advanced'].forEach((levelKey) => {
      const level = levels[levelKey];
      const items = (level?.categories?.listening?.items || []).filter((item) => item.available && item.hasTeacherGuide);
      if (!level || !items.length) return;

      const section = document.createElement('section');
      section.className = 'teacher-section';
      section.innerHTML = `<span class="badge" style="--level:${level.color}">${level.label}</span><h2>${level.label} Listening</h2>`;

      const grid = document.createElement('div');
      grid.className = 'teacher-grid';
      items.forEach((item) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'teacher-link teacher-listening-card';
        button.style.setProperty('--teacher-level', level.color);
        button.innerHTML = `<span>Listening ${String(item.number).padStart(2, '0')}</span>${item.title}`;
        button.addEventListener('click', () => {
          location.hash = `#/${levelKey}/${item.id}`;
        });
        grid.appendChild(button);
      });

      section.appendChild(grid);
      sections.appendChild(section);
    });
  }

  function openTeacherItem(levelKey, id) {
    const level = levels[levelKey];
    const item = getListening(levelKey, id);
    if (!level || !item) {
      location.hash = '#/';
      return;
    }

    applyTheme(levelKey);
    cleanupPdfViewers();
    document.querySelector('#teacher-viewer-badge').textContent = `${level.label} · Listening ${String(item.number).padStart(2, '0')}`;
    document.querySelector('#teacher-viewer-title').textContent = item.title;
    mediaStack.innerHTML = '';

    const studentPdf = item.media.find((media) => media.type === 'pdf');
    const audio = item.media.find((media) => media.type === 'audio');
    const guide = teacherGuidePath(item);

    if (audio) mediaStack.appendChild(createAudioCard(audio.path));
    if (studentPdf) mediaStack.appendChild(createPdfCard('Listening PDF', studentPdf.path, item.title));
    if (guide) mediaStack.appendChild(createPdfCard("Teacher's Guide", guide, item.title));

    show('viewer');
  }

  function route() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (parts.length >= 2) {
      openTeacherItem(parts[0], parts[1]);
    } else {
      cleanupPdfViewers();
      document.documentElement.style.setProperty('--level', '#fbbf24');
      show('list');
    }
  }

  backButton.addEventListener('click', () => {
    location.hash = '#/';
  });
  window.addEventListener('hashchange', route);

  buildTeacherList();
  route();
})();
