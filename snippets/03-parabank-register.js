/* ===========================================================================
   ParaBank — fill the registration form
   ---------------------------------------------------------------------------
   Target: https://parabank.parasoft.com/parabank/register.htm
   Run in the DevTools Console:

       pbRegister();                  // fill with valid data
       pbRegister({ submit: true });  // fill and submit
       pbRegister({ preset: 'uk' });  // UK address and phone format
       pbRegister({ preset: 'max' }); // maximum-length values
       pbRegister({ preset: 'xss' }); // script payload in the name fields

   ParaBank's field ids are namespaced (customer.firstName and so on), which
   makes them stable but tedious to type. Registering a fresh customer is the
   precondition for almost every other test on the site, so this is the
   snippet I use most.

   The selectors were verified on the date recorded in the repository README.
   ParaBank is a live demo and can change — if a field is reported as missing
   below, inspect it and update the map. The snippet tells you which one
   rather than failing silently.
   =========================================================================== */

(function () {
  'use strict';

  const stamp = Date.now().toString().slice(-6);

  const PRESETS = {
    valid: {
      'customer.firstName': 'Naga',
      'customer.lastName': 'Tester',
      'customer.address.street': '1 Test Street',
      'customer.address.city': 'Coventry',
      'customer.address.state': 'West Midlands',
      'customer.address.zipCode': '12345',
      'customer.phoneNumber': '02476000000',
      'customer.ssn': '123456789',
      'customer.username': 'ntest' + stamp,
      'customer.password': 'TestPass123!',
      'repeatedPassword': 'TestPass123!'
    },
    // Non-US formats. A five-digit-only zip validation excludes every UK
    // customer, which on a real product is a revenue defect not a cosmetic one.
    uk: {
      'customer.firstName': "Siobhán",
      'customer.lastName': "O'Brien-Smith",
      'customer.address.street': 'Flat 2b, 14 Corporation Street',
      'customer.address.city': 'Coventry',
      'customer.address.state': 'West Midlands',
      'customer.address.zipCode': 'CV1 2TT',
      'customer.phoneNumber': '+44 7700 900123',
      'customer.ssn': 'QQ123456C',
      'customer.username': 'uktest' + stamp,
      'customer.password': 'TestPass123!',
      'repeatedPassword': 'TestPass123!'
    },
    max: {
      'customer.firstName': 'A'.repeat(256),
      'customer.lastName': 'B'.repeat(256),
      'customer.address.street': 'C'.repeat(256),
      'customer.address.city': 'D'.repeat(256),
      'customer.address.state': 'E'.repeat(256),
      'customer.address.zipCode': '9'.repeat(50),
      'customer.phoneNumber': '9'.repeat(50),
      'customer.ssn': '9'.repeat(50),
      'customer.username': 'max' + stamp,
      'customer.password': 'P'.repeat(128),
      'repeatedPassword': 'P'.repeat(128)
    },
    xss: {
      'customer.firstName': '<script>alert(1)</script>',
      'customer.lastName': '"><img src=x onerror=alert(2)>',
      'customer.address.street': "'; DROP TABLE customers;--",
      'customer.address.city': 'Coventry',
      'customer.address.state': 'West Midlands',
      'customer.address.zipCode': '12345',
      'customer.phoneNumber': '02476000000',
      'customer.ssn': '123456789',
      'customer.username': 'xss' + stamp,
      'customer.password': 'TestPass123!',
      'repeatedPassword': 'TestPass123!'
    },
    // Password and confirmation deliberately differ.
    mismatch: null
  };

  function setValue(el, value) {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype, 'value'
    ).set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  window.pbRegister = function pbRegister(options) {
    const opts = Object.assign({ preset: 'valid', submit: false }, options);

    let data = PRESETS[opts.preset];
    if (opts.preset === 'mismatch') {
      data = Object.assign({}, PRESETS.valid, {
        'customer.username': 'mis' + stamp,
        'repeatedPassword': 'DifferentPass123!'
      });
    }
    if (!data) {
      console.error('Unknown preset. Available:', Object.keys(PRESETS).join(', '));
      return;
    }

    const filled = [];
    const missing = [];

    Object.entries(data).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (!el) {
        missing.push(id);
        return;
      }
      setValue(el, value);
      filled.push({
        field: id.replace('customer.', ''),
        value: value.length > 40 ? value.slice(0, 37) + '…' : value
      });
    });

    console.log(`%cParaBank register — preset "${opts.preset}"`, 'font-weight:bold');
    console.table(filled);

    if (missing.length) {
      console.warn('Fields not found on the page — the form has changed, update the ' +
        'map in this snippet:', missing);
    }

    // Record what to put in the execution log. The username is the only way
    // to re-check a result later, so print it prominently.
    if (data['customer.username']) {
      console.log(`%cRecord in your execution log — username: ` +
        `${data['customer.username']} / password: ${data['customer.password']}`,
        'color:#1c6b4f;font-weight:bold');
    }

    if (opts.submit) {
      const button = document.querySelector('input[value="Register"], form input[type=submit]');
      if (button) {
        console.log('Submitting…');
        button.click();
      } else {
        console.warn('Register button not found. Submit manually.');
      }
    }

    return { filled: filled.length, missing };
  };

  console.log('%cpbRegister() ready.', 'color:#1c6b4f;font-weight:bold');
  console.log('  presets: valid | uk | max | xss | mismatch');
  console.log('  pbRegister({ preset: "uk", submit: true })');
})();
