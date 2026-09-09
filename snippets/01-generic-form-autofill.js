/* ===========================================================================
   Generic form autofill — works on any form, no configuration
   ---------------------------------------------------------------------------
   Paste into the DevTools Console on any page with a form and run:

       fillForm();                    // fill the first form on the page
       fillForm({ index: 1 });        // fill the second form
       fillForm({ submit: true });    // fill and submit
       fillForm({ mode: 'boundary' }); // fill with maximum-length values

   Why this one first: a site-specific snippet saves you time on one form. This
   one saves you time on every form, including the one you have never seen. It
   introspects each field and picks a plausible value from the input type, the
   name, the id, the label text and the placeholder — in that order of trust.

   Written for manual exploratory testing, where the tedious part is not
   deciding what to test but retyping fifteen fields for the ninth time.
   =========================================================================== */

(function () {
  'use strict';

  // --- test data -----------------------------------------------------------

  const stamp = Date.now().toString().slice(-6);

  const DATA = {
    firstName: 'Naga',
    lastName: 'Tester',
    fullName: 'Naga Tester',
    email: `ntest${stamp}@example.com`,
    username: `ntest${stamp}`,
    password: 'TestPass123!',
    phone: '+447700900123',
    mobile: '07700900123',
    street: '1 Test Street',
    address: '1 Test Street',
    city: 'Coventry',
    county: 'West Midlands',
    state: 'West Midlands',
    postcode: 'CV1 2TT',
    zip: 'CV1 2TT',
    country: 'United Kingdom',
    company: 'Test Ltd',
    ssn: '123456789',
    cardNumber: '4111111111111111',
    cardName: 'NAGA TESTER',
    cvv: '123',
    amount: '100.00',
    number: '42',
    date: '2026-11-01',
    time: '14:30',
    url: 'https://example.com',
    search: 'test',
    comment: 'Automated fill for exploratory testing.',
    generic: `test-${stamp}`
  };

  // Maximum-length / boundary values, for mode: 'boundary'
  const BOUNDARY = {
    text: 'A'.repeat(256),
    email: 'a'.repeat(64) + '@' + 'b'.repeat(180) + '.com',
    number: '999999999999',
    tel: '9'.repeat(30),
    password: 'A'.repeat(128)
  };

  // --- field identification ------------------------------------------------

  /** Everything we can learn about a field, lowercased, as one haystack. */
  function describe(el) {
    const bits = [el.name, el.id, el.placeholder, el.getAttribute('aria-label')];

    // Associated label, which is often the only human-readable clue.
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) bits.push(label.textContent);
    }
    const wrapping = el.closest('label');
    if (wrapping) bits.push(wrapping.textContent);

    return bits.filter(Boolean).join(' ').toLowerCase();
  }

  /** Ordered rules — first match wins, so put the specific ones first. */
  const RULES = [
    [/confirm|repeat|verify|again/, ctx => ctx.lastPasswordOrValue],
    [/first.?name|forename|given/, () => DATA.firstName],
    [/last.?name|surname|family/, () => DATA.lastName],
    [/full.?name|^name$|your name/, () => DATA.fullName],
    [/e-?mail/, () => DATA.email],
    [/user.?name|login|userid/, () => DATA.username],
    [/pass.?word|passwd/, () => DATA.password],
    [/mobile|cell/, () => DATA.mobile],
    [/phone|tel/, () => DATA.phone],
    [/post.?code|zip/, () => DATA.postcode],
    [/street|address.?1|addr/, () => DATA.street],
    [/town|city/, () => DATA.city],
    [/county|state|province|region/, () => DATA.county],
    [/country/, () => DATA.country],
    [/company|organisation|organization|employer/, () => DATA.company],
    [/ssn|social.?security|nino|national.?insurance/, () => DATA.ssn],
    [/card.?number|cc.?num|pan/, () => DATA.cardNumber],
    [/card.?name|name.?on.?card/, () => DATA.cardName],
    [/cvv|cvc|security.?code/, () => DATA.cvv],
    [/amount|price|total|payment|deposit|transfer/, () => DATA.amount],
    [/comment|message|note|description|feedback|remark/, () => DATA.comment],
    [/search|query|keyword/, () => DATA.search],
    [/url|website|homepage/, () => DATA.url]
  ];

  function valueFor(el, ctx, mode) {
    const type = (el.type || 'text').toLowerCase();

    if (mode === 'boundary') {
      return BOUNDARY[type] || BOUNDARY.text;
    }

    // Type wins where the browser constrains the format, because a name-based
    // guess will just be rejected by the input.
    if (type === 'date') return DATA.date;
    if (type === 'time') return DATA.time;
    if (type === 'number') return DATA.number;
    if (type === 'url') return DATA.url;
    if (type === 'color') return '#123a5c';

    const haystack = describe(el);
    for (const [pattern, produce] of RULES) {
      if (pattern.test(haystack)) return produce(ctx);
    }

    // Fall back on type, then on a generic marker so it is obvious in the
    // database which values came from this snippet.
    if (type === 'email') return DATA.email;
    if (type === 'password') return DATA.password;
    if (type === 'tel') return DATA.phone;
    return DATA.generic;
  }

  // --- setting values so frameworks notice ---------------------------------

  /**
   * React, Vue and Angular track their own state and ignore a plain
   * `el.value = x`. Setting through the native property descriptor and then
   * dispatching input and change is what makes the framework update.
   * This is the single thing most hand-written fill snippets get wrong.
   */
  function setValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;

    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function visible(el) {
    if (el.disabled || el.readOnly) return false;
    if (el.type === 'hidden') return false;
    const box = el.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  }

  // --- main ----------------------------------------------------------------

  window.fillForm = function fillForm(options) {
    const opts = Object.assign({ index: 0, submit: false, mode: 'valid' }, options);

    const forms = Array.from(document.forms);
    const scope = forms[opts.index] || document.body;
    if (!forms.length) {
      console.warn('No <form> found — filling every field on the page instead.');
    }

    const fields = Array.from(
      scope.querySelectorAll('input, textarea, select')
    ).filter(visible);

    const ctx = { lastPasswordOrValue: DATA.password };
    const filled = [];
    const skipped = [];
    const radioGroupsDone = new Set();

    fields.forEach(el => {
      const type = (el.tagName === 'SELECT' ? 'select' : el.type || 'text').toLowerCase();

      try {
        if (type === 'select') {
          // First non-empty option. Deliberately not a random one — a repeatable
          // fill matters more than variety when you are comparing two runs.
          const option = Array.from(el.options).find(o => o.value && !o.disabled);
          if (option) {
            el.value = option.value;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            filled.push([el.name || el.id || 'select', option.text]);
          } else {
            skipped.push([el.name || el.id, 'no selectable option']);
          }
          return;
        }

        if (type === 'checkbox') {
          if (!el.checked) el.click();
          filled.push([el.name || el.id || 'checkbox', 'checked']);
          return;
        }

        if (type === 'radio') {
          if (radioGroupsDone.has(el.name)) return;
          el.click();
          radioGroupsDone.add(el.name);
          filled.push([el.name || 'radio', el.value]);
          return;
        }

        if (['submit', 'button', 'reset', 'image', 'file'].includes(type)) {
          skipped.push([el.name || el.id || type, `type=${type}`]);
          return;
        }

        const value = valueFor(el, ctx, opts.mode);
        setValue(el, value);
        if (type === 'password') ctx.lastPasswordOrValue = value;
        filled.push([el.name || el.id || el.placeholder || type, value]);
      } catch (err) {
        skipped.push([el.name || el.id || type, err.message]);
      }
    });

    console.log(`%cFilled ${filled.length} field(s) — mode: ${opts.mode}`,
      'font-weight:bold');
    console.table(filled.map(([field, value]) => ({ field, value })));

    if (skipped.length) {
      console.log('%cSkipped:', 'color:#a55a00');
      console.table(skipped.map(([field, reason]) => ({ field, reason })));
    }

    // File inputs cannot be set programmatically, by design. Say so rather
    // than letting the tester wonder why the form still fails validation.
    const files = Array.from(scope.querySelectorAll('input[type=file]')).filter(visible);
    if (files.length) {
      console.warn(`${files.length} file input(s) must be filled by hand — browsers ` +
        'do not allow scripts to set them.');
    }

    if (opts.submit) {
      const button = scope.querySelector(
        '[type=submit], button:not([type=button]):not([type=reset])'
      );
      if (button) {
        console.log('Submitting via', button);
        button.click();
      } else {
        console.warn('No submit control found. Submit manually.');
      }
    }

    return { filled: filled.length, skipped: skipped.length };
  };

  console.log('%cfillForm() ready.', 'color:#1c6b4f;font-weight:bold');
  console.log('  fillForm()                      fill the first form');
  console.log('  fillForm({ submit: true })      fill and submit');
  console.log('  fillForm({ mode: "boundary" })  fill with max-length values');
  console.log('  fillForm({ index: 1 })          target the second form');
})();
