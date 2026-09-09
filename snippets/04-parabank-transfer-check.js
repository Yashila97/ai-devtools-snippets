/* ===========================================================================
   ParaBank — capture balances before and after a transfer
   ---------------------------------------------------------------------------
   The check that matters on a money-movement journey is that BOTH sides moved
   by the same amount and the total across accounts is unchanged. Doing that by
   hand means writing four numbers on paper and doing arithmetic, which is
   exactly the sort of step people skip when they are tired.

   Usage — on the Accounts Overview page:

       pbSnapshot('before');    // record all balances
       // ... perform the transfer through the UI ...
       pbSnapshot('after');     // record again
       pbCompare(100.00);       // check the movement was exactly 100.00

   Supports test cases TC-FT-014 to TC-FT-018 in the manual test suite.
   =========================================================================== */

(function () {
  'use strict';

  const store = {};

  function readBalances() {
    // Accounts Overview renders a table of account number / balance /
    // available amount. Read it from the DOM rather than trusting the eye.
    const rows = Array.from(document.querySelectorAll('#accountTable tbody tr'));
    const balances = {};

    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 2) return;
      const account = cells[0].textContent.trim();
      const raw = cells[1].textContent.trim();
      if (!/^\d+$/.test(account)) return;             // skip the Total row
      const value = parseFloat(raw.replace(/[^0-9.\-]/g, ''));
      if (!Number.isNaN(value)) balances[account] = value;
    });

    return balances;
  }

  window.pbSnapshot = function pbSnapshot(label) {
    const balances = readBalances();
    const accounts = Object.keys(balances);

    if (!accounts.length) {
      console.error('No account rows found. Run this on the Accounts Overview page.');
      return null;
    }

    store[label] = { balances, at: new Date().toISOString() };

    const total = accounts.reduce((sum, a) => sum + balances[a], 0);
    console.log(`%cSnapshot "${label}" — ${accounts.length} account(s), ` +
      `total ${total.toFixed(2)}`, 'font-weight:bold');
    console.table(accounts.map(a => ({ account: a, balance: balances[a].toFixed(2) })));

    return store[label];
  };

  window.pbCompare = function pbCompare(expectedAmount) {
    const before = store.before;
    const after = store.after;

    if (!before || !after) {
      console.error('Take both snapshots first: pbSnapshot("before") then ' +
        'pbSnapshot("after").');
      return null;
    }

    const accounts = new Set([
      ...Object.keys(before.balances),
      ...Object.keys(after.balances)
    ]);

    const movements = [];
    accounts.forEach(account => {
      const b = before.balances[account];
      const a = after.balances[account];
      if (b === undefined || a === undefined) {
        movements.push({ account, before: b ?? '—', after: a ?? '—',
          change: 'account appeared or disappeared' });
        return;
      }
      const change = Number((a - b).toFixed(2));
      if (change !== 0) {
        movements.push({ account, before: b.toFixed(2), after: a.toFixed(2),
          change: (change > 0 ? '+' : '') + change.toFixed(2) });
      }
    });

    console.log('%cMovements', 'font-weight:bold');
    console.table(movements);

    const totalBefore = Object.values(before.balances).reduce((s, v) => s + v, 0);
    const totalAfter = Object.values(after.balances).reduce((s, v) => s + v, 0);
    const drift = Number((totalAfter - totalBefore).toFixed(2));

    const results = [];

    // 1. An internal transfer must not change the sum across accounts.
    results.push({
      check: 'Total across accounts unchanged',
      expected: '0.00',
      actual: drift.toFixed(2),
      pass: drift === 0
    });

    // 2. Exactly one debit and one credit.
    const debits = movements.filter(m => String(m.change).startsWith('-'));
    const credits = movements.filter(m => String(m.change).startsWith('+'));
    results.push({
      check: 'Exactly one debit and one credit',
      expected: '1 / 1',
      actual: `${debits.length} / ${credits.length}`,
      pass: debits.length === 1 && credits.length === 1
    });

    // 3. Both sides moved by the expected amount.
    if (expectedAmount !== undefined) {
      const debited = debits.length === 1 ? Math.abs(parseFloat(debits[0].change)) : null;
      const credited = credits.length === 1 ? parseFloat(credits[0].change) : null;
      results.push({
        check: 'Debit equals the expected amount',
        expected: expectedAmount.toFixed(2),
        actual: debited === null ? '—' : debited.toFixed(2),
        pass: debited === Number(expectedAmount.toFixed(2))
      });
      results.push({
        check: 'Credit equals the debit',
        expected: expectedAmount.toFixed(2),
        actual: credited === null ? '—' : credited.toFixed(2),
        pass: credited === Number(expectedAmount.toFixed(2))
      });
    }

    console.log('%cChecks', 'font-weight:bold');
    console.table(results);

    const failed = results.filter(r => !r.pass);
    if (failed.length) {
      console.log('%c✗ ' + failed.length + ' check(s) failed — this is a defect, ' +
        'capture evidence now', 'color:#b3261e;font-weight:bold');
    } else {
      console.log('%c✓ All checks passed', 'color:#1c6b4f;font-weight:bold');
    }

    return { movements, results, drift };
  };

  console.log('%cpbSnapshot() / pbCompare() ready.', 'color:#1c6b4f;font-weight:bold');
  console.log('  1. pbSnapshot("before")   on Accounts Overview');
  console.log('  2. perform the transfer through the UI');
  console.log('  3. pbSnapshot("after")    back on Accounts Overview');
  console.log('  4. pbCompare(100.00)      check the movement');
})();
