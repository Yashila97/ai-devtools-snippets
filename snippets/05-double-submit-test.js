/* ===========================================================================
   Double-submission test helper
   ---------------------------------------------------------------------------
   The highest-severity defect on most payment journeys is a duplicate
   transaction from a single user action, and it is nearly impossible to
   trigger by hand — you cannot click twice fast enough to beat a disabled
   button, and you cannot click slowly enough to be sure you didn't.

   This does it deterministically.

       doubleSubmit();              // click the submit control twice, 0ms apart
       doubleSubmit({ gap: 50 });   // 50ms apart
       doubleSubmit({ count: 5 });  // five times
       watchRequests();             // log every POST the page sends

   Then check the account activity or transaction list. One user action must
   produce one transaction.

   Supports TC-FT-019 and TC-BP-013 in the manual test suite.
   =========================================================================== */

(function () {
  'use strict';

  window.doubleSubmit = function doubleSubmit(options) {
    const opts = Object.assign({ gap: 0, count: 2, selector: null }, options);

    const button = opts.selector
      ? document.querySelector(opts.selector)
      : document.querySelector(
          '[type=submit], button:not([type=button]):not([type=reset])'
        );

    if (!button) {
      console.error('No submit control found. Pass one: ' +
        'doubleSubmit({ selector: "#confirm" })');
      return;
    }

    console.log(`%cClicking ${button.outerHTML.slice(0, 80)} ` +
      `${opts.count} times, ${opts.gap}ms apart`, 'font-weight:bold');

    for (let i = 0; i < opts.count; i++) {
      setTimeout(() => {
        // Click even if the handler disabled the control — that is the point.
        // A button disabled in the browser proves nothing about whether the
        // server will accept a second request.
        const wasDisabled = button.disabled;
        button.disabled = false;
        button.click();
        button.disabled = wasDisabled;
        console.log(`  click ${i + 1} sent at +${i * opts.gap}ms` +
          (wasDisabled ? ' (control was disabled — forced)' : ''));
      }, i * opts.gap);
    }

    console.log('%cNow check the transaction list. One action must produce one ' +
      'transaction. If the button was disabled after the first click, note that ' +
      'the protection is client-side only — worth raising separately.',
      'color:#4a5872');
  };

  window.watchRequests = function watchRequests() {
    const seen = [];

    // fetch
    const originalFetch = window.fetch;
    window.fetch = function (...args) {
      const url = typeof args[0] === 'string' ? args[0] : args[0].url;
      const method = (args[1] && args[1].method) || 'GET';
      if (method !== 'GET') {
        seen.push({ at: Date.now(), method, url, via: 'fetch' });
        console.log(`%c→ ${method} ${url}`, 'color:#0b4a8f');
      }
      return originalFetch.apply(this, args);
    };

    // XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      if (method && method.toUpperCase() !== 'GET') {
        seen.push({ at: Date.now(), method, url, via: 'xhr' });
        console.log(`%c→ ${method} ${url}`, 'color:#0b4a8f');
      }
      return originalOpen.apply(this, arguments);
    };

    // Classic form submission
    document.addEventListener('submit', e => {
      const form = e.target;
      seen.push({ at: Date.now(), method: (form.method || 'GET').toUpperCase(),
        url: form.action, via: 'form' });
      console.log(`%c→ FORM ${form.method} ${form.action}`, 'color:#0b4a8f');
    }, true);

    window.requestLog = function () {
      if (!seen.length) {
        console.log('No non-GET requests captured yet.');
        return [];
      }
      const first = seen[0].at;
      const rows = seen.map((r, i) => ({
        '#': i + 1,
        method: r.method,
        url: String(r.url).slice(-60),
        'at (ms)': r.at - first,
        via: r.via
      }));
      console.table(rows);

      // Duplicate detection: same method and url within 2 seconds.
      const dupes = [];
      for (let i = 1; i < seen.length; i++) {
        for (let j = 0; j < i; j++) {
          if (seen[i].method === seen[j].method &&
              seen[i].url === seen[j].url &&
              seen[i].at - seen[j].at < 2000) {
            dupes.push({ request: `${seen[i].method} ${String(seen[i].url).slice(-40)}`,
              gap: `${seen[i].at - seen[j].at}ms` });
            break;
          }
        }
      }
      if (dupes.length) {
        console.log('%cDuplicate requests detected', 'color:#b3261e;font-weight:bold');
        console.table(dupes);
        console.log('Duplicate requests are not themselves a defect. Duplicate ' +
          'TRANSACTIONS are. Check the account activity to see whether the server ' +
          'processed both.');
      }
      return seen;
    };

    console.log('%cWatching for non-GET requests. Call requestLog() to see them.',
      'color:#1c6b4f;font-weight:bold');
  };

  console.log('%cdoubleSubmit() / watchRequests() ready.',
    'color:#1c6b4f;font-weight:bold');
  console.log('  watchRequests()  then  doubleSubmit()  then  requestLog()');
})();
