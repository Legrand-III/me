// Braille glyph width differs between platform fonts
// Measure the real advance once and hand it to
// CSS so the ASCII background keeps the same proportions everywhere.
(function calibrateAsciiGlyphs() {
  const sample = document.querySelector('.ascii');
  if (!sample) return;

  const probe = document.createElement('span');
  probe.setAttribute('aria-hidden', 'true');
  probe.setAttribute('aria-hidden', 'true');
  probe.textContent = '⣿'.repeat(100);
  Object.assign(probe.style, {
    position: 'absolute',
    visibility: 'hidden',
    whiteSpace: 'pre',
    fontFamily: getComputedStyle(sample).fontFamily,
    fontSize: '100px',
    letterSpacing: '0',
  });

  document.body.appendChild(probe);
  const advance = probe.getBoundingClientRect().width / 100 / 100;
  probe.remove();

  if (advance > 0.2 && advance < 1.5) {
    document.documentElement.style.setProperty('--glyph-advance', advance.toFixed(4));
  }
})();

// Photo carousel: three slides visible (prev / current / next). Every tick the
// row shifts right: a new photo comes in on the left, the right one leaves.
(function initCarousel() {
  const INTERVAL_MS = 5000;
  const MIN_SLIDES = 5; // 3 visible + 1 each side

  const root = document.querySelector('[data-carousel]');
  if (!root) return;
  const track = root.querySelector('.carousel__track');
  const originals = Array.from(track.children);
  if (originals.length === 0) return;

  root.classList.add('is-ready');

  // One photo: just show it in the middle.
  if (originals.length === 1) {
    originals[0].classList.add('is-current');
    return;
  }

  // Small sets are repeated so a slide can leave on the right while its twin
  // enters on the left. Clones are hidden from assistive tech.
  const copies = Math.ceil(MIN_SLIDES / originals.length) - 1;
  for (let c = 0; c < copies; c++) {
    originals.forEach((slide) => {
      const clone = slide.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.classList.add('is-clone');
      track.appendChild(clone);
    });
  }

  const slides = Array.from(track.children);
  const total = slides.length;
  const offsets = new Array(total).fill(null);
  let current = 0;

  function positionClass(offset) {
    if (offset <= -2) return 'is-before';
    if (offset === -1) return 'is-prev';
    if (offset === 0) return 'is-current';
    if (offset === 1) return 'is-next';
    return 'is-after';
  }

  function render() {
    const wrapping = [];

    slides.forEach((slide, i) => {
      let offset = (((i - current) % total) + total) % total;
      if (offset > total / 2) offset -= total;

      // First placement, or a slide jumping from the far right back to the far
      // left (off-stage both times): move instantly, never sweep across.
      const previous = offsets[i];
      if (previous === null || offset < previous) {
        slide.classList.add('no-transition');
        wrapping.push(slide);
      }
      offsets[i] = offset;

      slide.classList.remove('is-before', 'is-prev', 'is-current', 'is-next', 'is-after');
      slide.classList.add(positionClass(offset));
    });

    if (wrapping.length) {
      void track.offsetWidth; // commit the instant move before re-enabling transitions
      wrapping.forEach((slide) => slide.classList.remove('no-transition'));
    }
  }

  function step() {
    // Decrementing moves every slide one place to the right.
    current = (current - 1 + total) % total;
    render();
  }

  // --- Auto-rotation with pause on hover/focus, hidden tab and reduced motion
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let timer = null;
  let hovered = false;
  let focused = false;

  function shouldRun() {
    return !reducedMotion.matches && !hovered && !focused && !document.hidden;
  }

  function sync() {
    if (shouldRun() && timer === null) {
      timer = window.setInterval(step, INTERVAL_MS);
    } else if (!shouldRun() && timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  root.addEventListener('mouseenter', () => { hovered = true; sync(); });
  root.addEventListener('mouseleave', () => { hovered = false; sync(); });
  root.addEventListener('focusin', () => { focused = true; sync(); });
  root.addEventListener('focusout', () => { focused = false; sync(); });
  document.addEventListener('visibilitychange', sync);
  reducedMotion.addEventListener('change', sync);

  render();
  sync();
})();

// Measurements typing effect: the first time the block scrolls into view it is
// typed out line by line with a caret. The full text stays in the DOM the whole
// time (only a CSS clip changes), so screen readers never hear partial words.
(function initTypewriter() {
  const CHAR_MS = 55;
  const LINE_PAUSE_MS = 250;

  const root = document.querySelector('[data-typewriter]');
  if (!root) return;

  const lines = Array.from(root.querySelectorAll('.type'));
  if (lines.length === 0) return;
  const firstBodyLine = root.querySelector('.code__body .type');

  const lengths = lines.map((line) => line.querySelector('.type__text').textContent.length);
  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  function setCursor(line) {
    lines.forEach((l) => l.classList.toggle('has-cursor', l === line));
  }

  function showAll() {
    lines.forEach((line, i) => line.style.setProperty('--n', lengths[i]));
    root.classList.add('is-body');
    setCursor(lines[lines.length - 1]);
  }

  root.classList.add('is-armed');
  lines.forEach((line) => line.style.setProperty('--n', 0));

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion || !('IntersectionObserver' in window)) {
    showAll();
    return;
  }

  async function type() {
    root.classList.add('is-typing');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const text = line.querySelector('.type__text').textContent;
      if (line === firstBodyLine) {
        root.classList.add('is-body');
        await wait(LINE_PAUSE_MS);
      }
      setCursor(line);
      for (let n = 1; n <= lengths[i]; n++) {
        line.style.setProperty('--n', n);
        // Runs of padding spaces go by instantly, like a tab
        if (text[n - 1] !== ' ') await wait(CHAR_MS);
      }
      await wait(LINE_PAUSE_MS);
    }
    root.classList.remove('is-typing');
  }

  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      observer.disconnect();
      type();
    }
  }, { threshold: 0.4 });

  observer.observe(root);
})();

// Gallery photos load last. They have no src until the window "load" event,
// which only fires once the carousel photos and the Amplify photo are done.
// After that, loading="lazy" + fetchpriority="low" fetch them as they scroll near.
(function deferGalleryPhotos() {
  const photos = document.querySelectorAll('.gallery img[data-src]');
  if (photos.length === 0) return;

  function start() {
    photos.forEach((img) => {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    });
  }

  if (document.readyState === 'complete') {
    start();
  } else {
    window.addEventListener('load', start, { once: true });
  }
})();
