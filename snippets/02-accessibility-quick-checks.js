/* ===========================================================================
   Accessibility quick checks — console only, no extensions, no build
   ---------------------------------------------------------------------------
   Paste into the DevTools Console on any page and run:

       a11y();            // run every check
       a11y.labels();     // form controls with no accessible name
       a11y.images();     // images missing a text alternative
       a11y.headings();   // heading structure and skipped levels
       a11y.contrast();   // text below the AA contrast ratio
       a11y.targets();    // interactive targets below 24x24 (WCAG 2.2)
       a11y.focus();      // controls with the focus indicator suppressed
       a11y.tabOrder();   // the tab sequence, in order
       a11y.live();       // live regions present on the page

   This is not a replacement for axe or WAVE, and it is not an audit. It is
   the set of checks I want in the first thirty seconds on a page I have never
   seen, when I am deciding where to spend the next hour. Everything here
   still needs a person to judge — a11y.images() finds a missing alt, but only
   you can tell whether "image123.png" is a useful alternative.
   =========================================================================== */

(function () {
  'use strict';

  const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex], ' +
    '[contenteditable="true"]';

  function group(title, rows, emptyMessage) {
    if (!rows.length) {
      console.log(`%c✓ ${title} — ${emptyMessage}`, 'color:#1c6b4f');
      return [];
    }
    console.log(`%c${rows.length} — ${title}`, 'color:#b3261e;font-weight:bold');
    console.table(rows);
    return rows;
  }

  function shortSelector(el) {
    if (el.id) return `#${el.id}`;
    const cls = (el.className || '').toString().trim().split(/\s+/)[0];
    return el.tagName.toLowerCase() + (cls ? `.${cls}` : '');
  }

  function accessibleName(el) {
    const aria = el.getAttribute('aria-label');
    if (aria && aria.trim()) return aria.trim();

    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const text = labelledBy.split(/\s+/)
        .map(id => document.getElementById(id))
        .filter(Boolean)
        .map(n => n.textContent.trim())
        .join(' ');
      if (text) return text;
    }

    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label && label.textContent.trim()) return label.textContent.trim();
    }

    const wrapping = el.closest('label');
    if (wrapping && wrapping.textContent.trim()) return wrapping.textContent.trim();

    if (el.tagName === 'BUTTON' && el.textContent.trim()) return el.textContent.trim();
    if (el.tagName === 'A' && el.textContent.trim()) return el.textContent.trim();
    if (el.title && el.title.trim()) return el.title.trim();

    return '';
  }

  // --- contrast ------------------------------------------------------------

  function toRgb(colour) {
    const match = colour.match(/rgba?\(([^)]+)\)/);
    if (!match) return null;
    const parts = match[1].split(',').map(n => parseFloat(n));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  }

  function relativeLuminance(rgb) {
    const channel = v => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
  }

  /** Walk up until an ancestor has a non-transparent background. */
  function effectiveBackground(el) {
    let node = el;
    while (node && node !== document.documentElement) {
      const bg = toRgb(getComputedStyle(node).backgroundColor);
      if (bg && bg.a > 0) return bg;
      node = node.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  }

  function ratio(fg, bg) {
    const l1 = relativeLuminance(fg);
    const l2 = relativeLuminance(bg);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  // --- checks --------------------------------------------------------------

  const api = {};

  api.labels = function () {
    const rows = [];
    document.querySelectorAll('input, select, textarea').forEach(el => {
      if (el.type === 'hidden' || el.disabled) return;
      const name = accessibleName(el);
      if (!name) {
        rows.push({
          element: shortSelector(el),
          type: el.type || el.tagName.toLowerCase(),
          placeholderOnly: el.placeholder || '—',
          sc: '1.3.1 / 3.3.2'
        });
      }
    });
    // A placeholder is not a label: it disappears on input and support for
    // announcing it varies. Flagged separately because it is the most common
    // near-miss on forms that look fine.
    return group('form controls with no accessible name', rows,
      'every visible control has a name');
  };

  api.images = function () {
    const rows = [];
    document.querySelectorAll('img').forEach(el => {
      const alt = el.getAttribute('alt');
      if (alt === null) {
        rows.push({ element: shortSelector(el), src: (el.currentSrc || el.src).slice(-45),
          issue: 'no alt attribute at all', sc: '1.1.1' });
      } else if (alt.trim() && /\.(png|jpe?g|gif|svg|webp)$/i.test(alt.trim())) {
        rows.push({ element: shortSelector(el), src: (el.currentSrc || el.src).slice(-45),
          issue: `alt looks like a filename: "${alt}"`, sc: '1.1.1' });
      }
    });

    document.querySelectorAll('svg').forEach(el => {
      const isDecorative = el.getAttribute('aria-hidden') === 'true';
      const hasName = el.getAttribute('aria-label') || el.querySelector('title');
      if (!isDecorative && !hasName && el.closest('a, button')) {
        rows.push({ element: shortSelector(el), src: 'inline svg',
          issue: 'interactive svg with no name and not aria-hidden', sc: '1.1.1' });
      }
    });

    console.log('%cNote: alt="" is correct for decorative images and is not flagged. ' +
      'Whether existing alt text is MEANINGFUL needs a person.', 'color:#4a5872');
    return group('images with a text-alternative problem', rows,
      'no missing or filename-shaped alt text');
  };

  api.headings = function () {
    const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'));
    const rows = [];
    let previous = 0;

    headings.forEach(el => {
      const level = Number(el.tagName[1]);
      const text = el.textContent.trim().slice(0, 60);
      if (previous && level > previous + 1) {
        rows.push({ heading: `h${level}`, text, issue: `skipped from h${previous}`,
          sc: '1.3.1' });
      }
      previous = level;
    });

    const h1s = headings.filter(el => el.tagName === 'H1');
    if (h1s.length === 0) {
      rows.push({ heading: '—', text: '—', issue: 'no h1 on the page', sc: '1.3.1' });
    } else if (h1s.length > 1) {
      rows.push({ heading: 'h1', text: `${h1s.length} found`,
        issue: 'more than one h1', sc: '1.3.1' });
    }

    console.log('Heading outline:');
    console.log(headings.map(el =>
      '  '.repeat(Number(el.tagName[1]) - 1) + el.tagName + ' ' +
      el.textContent.trim().slice(0, 70)).join('\n') || '  (none)');

    return group('heading structure problems', rows, 'heading structure is sound');
  };

  api.contrast = function () {
    const rows = [];
    const seen = new Set();

    document.querySelectorAll('*').forEach(el => {
      if (!el.childNodes.length) return;
      const text = Array.from(el.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent.trim())
        .join(' ')
        .trim();
      if (!text) return;

      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return;

      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.opacity === '0') return;

      const fg = toRgb(style.color);
      if (!fg) return;
      const bg = effectiveBackground(el);
      const r = ratio(fg, bg);

      const size = parseFloat(style.fontSize);
      const bold = Number(style.fontWeight) >= 700;
      const large = size >= 24 || (bold && size >= 18.66);
      const required = large ? 3 : 4.5;

      if (r < required) {
        const key = `${style.color}|${text.slice(0, 20)}`;
        if (seen.has(key)) return;
        seen.add(key);
        rows.push({
          text: text.slice(0, 40),
          colour: style.color,
          ratio: r.toFixed(2),
          required: required.toFixed(1),
          sc: '1.4.3'
        });
      }
    });

    console.log('%cCaveat: background is resolved by walking up the DOM. Text over an ' +
      'image or a gradient will be wrong — check those by eye.', 'color:#4a5872');
    return group('text below the AA contrast ratio', rows,
      'all sampled text meets AA contrast');
  };

  api.targets = function () {
    const rows = [];
    document.querySelectorAll(FOCUSABLE).forEach(el => {
      if (el.disabled || el.type === 'hidden') return;
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return;
      // Inline links in a paragraph are exempt under SC 2.5.8.
      if (el.tagName === 'A' && el.closest('p, li')) return;

      if (box.width < 24 || box.height < 24) {
        rows.push({
          element: shortSelector(el),
          name: accessibleName(el).slice(0, 30) || '(no name)',
          size: `${Math.round(box.width)}x${Math.round(box.height)}`,
          sc: '2.5.8'
        });
      }
    });
    return group('interactive targets below 24x24', rows,
      'all targets meet the 24px minimum');
  };

  api.focus = function () {
    const rows = [];
    const controls = Array.from(document.querySelectorAll(FOCUSABLE))
      .filter(el => !el.disabled && el.getBoundingClientRect().width > 0);

    const active = document.activeElement;

    controls.slice(0, 40).forEach(el => {
      el.focus({ preventScroll: true });
      const style = getComputedStyle(el);
      const hasOutline = style.outlineStyle !== 'none' &&
        parseFloat(style.outlineWidth) > 0;
      const hasShadow = style.boxShadow && style.boxShadow !== 'none';
      const hasBorderChange = style.borderStyle !== 'none';

      if (!hasOutline && !hasShadow && !hasBorderChange) {
        rows.push({
          element: shortSelector(el),
          name: accessibleName(el).slice(0, 30) || '(no name)',
          sc: '2.4.7'
        });
      }
    });

    if (active && active.focus) active.focus({ preventScroll: true });

    console.log('%cThis focuses each control in turn — the page will jump. It checks ' +
      'only that SOMETHING changes visually; whether the indicator is actually ' +
      'perceivable is SC 2.4.13 and needs your eyes.', 'color:#4a5872');
    return group('controls with no detectable focus indicator', rows,
      'every sampled control shows a focus change');
  };

  api.tabOrder = function () {
    const order = Array.from(document.querySelectorAll(FOCUSABLE))
      .filter(el => !el.disabled && el.tabIndex >= 0 &&
        el.getBoundingClientRect().width > 0)
      .map((el, i) => ({
        stop: i + 1,
        element: shortSelector(el),
        name: accessibleName(el).slice(0, 35) || '(no name)',
        tabindex: el.tabIndex
      }));

    console.log(`%cTab sequence — ${order.length} stop(s)`, 'font-weight:bold');
    console.table(order);

    const positive = order.filter(o => o.tabindex > 0);
    if (positive.length) {
      console.log('%cPositive tabindex values found. These override document order ' +
        'and are almost always a mistake.', 'color:#a55a00');
      console.table(positive);
    }

    console.log('%cCompare this against the visual reading order of the page. A ' +
      'sequence that jumps around the screen is a real defect that no scanner ' +
      'will report.', 'color:#4a5872');
    return order;
  };

  api.live = function () {
    const regions = Array.from(
      document.querySelectorAll('[aria-live], [role=alert], [role=status], [role=log]')
    ).map(el => ({
      element: shortSelector(el),
      role: el.getAttribute('role') || '—',
      ariaLive: el.getAttribute('aria-live') || '—',
      currentlyEmpty: !el.textContent.trim()
    }));

    if (!regions.length) {
      console.log('%c⚠ No live regions on this page.', 'color:#a55a00;font-weight:bold');
      console.log('  If this page shows validation errors, search results or a status ' +
        'message, a screen-reader user will not be told. SC 4.1.3.');
      console.log('  Check by submitting the form with it invalid and re-running.');
      return [];
    }

    console.log(`%c${regions.length} live region(s)`, 'font-weight:bold');
    console.table(regions);
    console.log('%cA live region must exist in the DOM BEFORE its content is inserted. ' +
      'Regions added at the same moment as their text are often not announced — ' +
      'the empty ones above are the good sign.', 'color:#4a5872');
    return regions;
  };

  // --- runner --------------------------------------------------------------

  const a11y = function () {
    console.log('%c=== Accessibility quick checks ===',
      'font-weight:bold;font-size:14px');
    console.log(`${location.href}\n${new Date().toISOString()}\n`);

    const results = {
      labels: api.labels().length,
      images: api.images().length,
      headings: api.headings().length,
      contrast: api.contrast().length,
      targets: api.targets().length,
      liveRegions: api.live().length
    };

    console.log('%c=== Summary ===', 'font-weight:bold');
    console.table(results);
    console.log('%cNot an audit. These are the automatable checks only — run ' +
      'a11y.tabOrder() and a11y.focus() separately, then test with a keyboard and ' +
      'a screen reader. That is where the blocking issues usually are.',
      'color:#4a5872;font-style:italic');

    return results;
  };

  Object.assign(a11y, api);
  window.a11y = a11y;

  console.log('%ca11y() ready.', 'color:#1c6b4f;font-weight:bold');
  console.log('  a11y()            run every automatable check');
  console.log('  a11y.labels()     unlabelled form controls');
  console.log('  a11y.images()     missing or filename-shaped alt text');
  console.log('  a11y.headings()   structure and skipped levels');
  console.log('  a11y.contrast()   text below AA ratio');
  console.log('  a11y.targets()    targets under 24x24 (WCAG 2.2)');
  console.log('  a11y.focus()      suppressed focus indicators');
  console.log('  a11y.tabOrder()   the tab sequence in order');
  console.log('  a11y.live()       live regions present');
})();
