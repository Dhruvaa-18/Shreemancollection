/* Panther hero — scroll-driven canvas sequence, scoped to #pantherSection only */
(function () {
  const TOTAL       = 300;
  const EARLY_START = 25;

  const section = document.getElementById('pantherSection');
  if (!section) return;

  const canvasEl        = document.getElementById('animation-canvas');
  const preloader       = document.getElementById('preloader');
  const preloaderFill   = document.getElementById('preloader-fill');
  const preloaderPct    = document.getElementById('preloader-pct');
  const preloaderStatus = document.getElementById('preloader-status');
  const scrubberCont    = document.getElementById('scrubber-container');
  const scrubberFill    = document.getElementById('scrubber-fill');
  const scrubberThumb   = document.getElementById('scrubber-thumb');
  const chapterLabel    = document.getElementById('timeline-chapter-label');
  const chapterBtns     = document.querySelectorAll('.chapter-btn');
  const cards           = document.querySelectorAll('.editorial-card');

  let targetFrame  = 0;
  let displayFrame = 0;
  let isReady      = false;

  const baseUrl = location.href.replace(/\/[^/?#]*(\?.*)?$/, '/');

  const WORKER_SRC = `
const TOTAL   = 300;
const bitmaps = new Array(TOTAL).fill(null);
let canvas, ctx, pendingIdx = 0, drawBusy = false;

self.onmessage = async (e) => {
  const d = e.data;
  if (d.type === 'init') {
    canvas = d.canvas;
    ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    canvas.width = d.w;
    canvas.height = d.h;
  } else if (d.type === 'resize') {
    if (canvas) { canvas.width = d.w; canvas.height = d.h; }
    paint(pendingIdx);
  } else if (d.type === 'frame') {
    pendingIdx = d.idx;
    paint(pendingIdx);
  } else if (d.type === 'load') {
    await loadAll(d.urls);
    self.postMessage({ type: 'done' });
  }
};

const paint = (idx) => {
  if (drawBusy) return;
  drawBusy = true;
  setTimeout(() => {
    drawBusy = false;
    let bmp = bitmaps[idx];
    if (!bmp) {
      for (let d = 1; d < 30 && !bmp; d++) {
        bmp = bitmaps[Math.max(0, idx - d)] || bitmaps[Math.min(TOTAL - 1, idx + d)];
      }
    }
    if (!bmp || !canvas) return;
    const sw = canvas.width, sh = canvas.height;
    const sc = Math.max(sw / bmp.width, sh / bmp.height);
    const dw = bmp.width * sc;
    const dh = bmp.height * sc;
    const dx = (sw - dw) / 2;
    // Anchor top headroom: never crop the top on widescreen so the character's head and eyes have full clearance
    let dy = 0;
    if (dh > sh) {
      dy = 0;
    } else {
      dy = (sh - dh) / 2;
    }
    ctx.drawImage(bmp, dx, dy, dw, dh);
  }, 0);
};

const loadAll = async (urls) => {
  let i = 0, loaded = 0;
  const CONCURRENCY = 15;

  const run = async () => {
    while (i < urls.length) {
      const { url, idx } = urls[i++];
      try {
        const blob = await fetch(url).then(r => r.blob());
        bitmaps[idx] = await createImageBitmap(blob);
        loaded++;
        self.postMessage({ type: 'progress', loaded });
        if (Math.abs(idx - pendingIdx) <= 10) paint(pendingIdx);
      } catch (_) {
        loaded++;
        self.postMessage({ type: 'progress', loaded });
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, run));
};
`;

  const worker = new Worker(
    URL.createObjectURL(new Blob([WORKER_SRC], { type: 'application/javascript' }))
  );

  if (canvasEl.transferControlToOffscreen) {
    const offscreen = canvasEl.transferControlToOffscreen();
    worker.postMessage(
      { type: 'init', canvas: offscreen, w: window.innerWidth, h: window.innerHeight },
      [offscreen]
    );
  } else {
    canvasEl.width  = window.innerWidth;
    canvasEl.height = window.innerHeight;
  }

  window.addEventListener('resize', () => {
    worker.postMessage({ type: 'resize', w: window.innerWidth, h: window.innerHeight });
  });

  const buildLoadOrder = () => {
    const order = [], seen = new Set();
    for (const step of [10, 5, 2, 1]) {
      for (let i = 0; i < TOTAL; i += step) {
        if (!seen.has(i)) { order.push(i); seen.add(i); }
      }
    }
    return order;
  };

  const loadOrder = buildLoadOrder();
  const urls = loadOrder.map(i => ({
    idx: i,
    url: baseUrl + 'panther-hero/ezgif-frame-' + String(i + 1).padStart(3, '0') + '.webp'
  }));
  worker.postMessage({ type: 'load', urls });

  worker.onmessage = (e) => {
    if (e.data.type === 'progress') {
      const n   = e.data.loaded;
      const pct = Math.round((n / TOTAL) * 100);
      preloaderFill.style.width = pct + '%';
      preloaderPct.textContent  = pct + '%';
      if (!isReady && n >= EARLY_START) launchExperience();
    } else if (e.data.type === 'done') {
      if (!isReady) launchExperience();
    }
  };

  const launchExperience = () => {
    isReady = true;
    preloaderStatus.textContent = 'Experience Ready';
    preloaderFill.style.width   = '100%';
    preloaderPct.textContent    = '100%';
    worker.postMessage({ type: 'frame', idx: 0 });
    setTimeout(() => {
      preloader.style.opacity    = '0';
      preloader.style.transition = 'opacity 1s ease';
      setTimeout(() => { preloader.style.display = 'none'; }, 1050);
    }, 500);
  };

  let lastSentFrame = -1;

  const tick = () => {
    requestAnimationFrame(tick);
    if (!isReady) return;

    const diff = targetFrame - displayFrame;

    if (Math.abs(diff) < 0.15) {
      if (lastSentFrame !== Math.round(displayFrame)) {
        lastSentFrame = Math.round(displayFrame);
        worker.postMessage({ type: 'frame', idx: lastSentFrame });
      }
      return;
    }

    displayFrame += diff * 0.12;

    const fi = Math.round(displayFrame);
    if (fi !== lastSentFrame) {
      lastSentFrame = fi;
      worker.postMessage({ type: 'frame', idx: fi });
    }
  };
  requestAnimationFrame(tick);

  /* ---- Section-scoped scroll math (the only real logic change) ---- */
  function sectionBounds() {
    return {
      top: section.offsetTop,
      scrollable: Math.max(1, section.offsetHeight - window.innerHeight)
    };
  }

  const onScroll = () => {
    const rect = section.getBoundingClientRect();
    const scrollable = Math.max(1, section.offsetHeight - window.innerHeight);
    const scrolled = -rect.top;
    const fraction = Math.min(1, Math.max(0, scrolled / scrollable));
    targetFrame = Math.min(TOTAL - 1, Math.floor(fraction * TOTAL));

    if (scrubberFill)  scrubberFill.style.width = (fraction * 100) + '%';
    if (scrubberThumb) scrubberThumb.style.left  = (fraction * 100) + '%';
    updateChapterUI(targetFrame);
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  const chapters = [
    { start: 0,   end: 74,  label: 'CHAPTER 01 — THE CANVAS',  cardIdx: 0 },
    { start: 75,  end: 149, label: 'CHAPTER 02 — THE ATELIER', cardIdx: 1 },
    { start: 150, end: 224, label: 'CHAPTER 03 — SILHOUETTE',  cardIdx: 2 },
    { start: 225, end: 299, label: 'CHAPTER 04 — CELEBRATION', cardIdx: 3 },
  ];

  let lastChIdx = -1;
  const updateChapterUI = (frame) => {
    const ci = chapters.findIndex(c => frame >= c.start && frame <= c.end);
    if (ci === lastChIdx) return;
    lastChIdx = ci;
    const ch = chapters[ci] ?? chapters[0];
    if (chapterLabel) chapterLabel.textContent = ch.label;
    chapterBtns.forEach((b, i) => b.classList.toggle('active', i === ci));
    cards.forEach((c, i) => c.classList.toggle('active', i === ch.cardIdx));
  };

  if (scrubberCont) {
    const scrubTo = (cx) => {
      const r = scrubberCont.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (cx - r.left) / r.width));
      const { top, scrollable } = sectionBounds();
      window.scrollTo({ top: top + fraction * scrollable, behavior: 'instant' });
    };
    let drag = false;
    scrubberCont.addEventListener('mousedown',  (e) => { drag = true;  scrubTo(e.clientX); });
    window.addEventListener('mousemove',        (e) => { if (drag) scrubTo(e.clientX); });
    window.addEventListener('mouseup',          ()  => { drag = false; });
    scrubberCont.addEventListener('touchstart', (e) => { drag = true;  scrubTo(e.touches[0].clientX); }, { passive: true });
    window.addEventListener('touchmove',        (e) => { if (drag) scrubTo(e.touches[0].clientX); },   { passive: true });
    window.addEventListener('touchend',         ()  => { drag = false; });
  }

  chapterBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      const fraction = chapters[i].start / (TOTAL - 1);
      const { top, scrollable } = sectionBounds();
      window.scrollTo({ top: top + fraction * scrollable, behavior: 'smooth' });
    });
  });
})();