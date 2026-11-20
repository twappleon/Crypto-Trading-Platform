const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/);
assert.ok(script, 'inline order-interaction script exists');
const nodes = new Map();
function element(id) {
  if (!nodes.has(id)) {
    const x = {
      id, value: '', textContent: '', innerHTML: '', className: '', dataset: {},
      listeners: {},
      addEventListener(kind, fn) { (this.listeners[kind] ||= []).push(fn); },
      click() { for (const fn of this.listeners.click || []) fn(); },
      input() { for (const fn of this.listeners.input || []) fn(); }
    };
    nodes.set(id, x);
  }
  return nodes.get(id);
}
let cachedMarkup = null;
let cachedButtons = [];
const document = {
  getElementById: element,
  querySelectorAll(selector) {
    assert.equal(selector, '[data-id]');
    if (cachedMarkup === element('orders').innerHTML) return cachedButtons;
    cachedMarkup = element('orders').innerHTML;
    cachedButtons = [...cachedMarkup.matchAll(/data-id="(\d+)"/g)]
      .map(m => {
        const x = { dataset: { id: m[1] }, listeners: {}, addEventListener(kind, fn) {
          (this.listeners[kind] ||= []).push(fn);
        }, click() { for (const fn of this.listeners.click || []) fn(); } };
        return x;
      });
    return cachedButtons;
  }
};
element('price').value = '64275';
vm.runInNewContext(script[1], { document, console }, { timeout: 3000 });
const click = id => element(id).click();
const set = (id, value) => { element(id).value = value; element(id).input(); };
const text = id => element(id).textContent;
const markup = id => element(id).innerHTML;
assert.equal(text('usdc'), '100,000.00');
assert.equal(text('btc'), '2.000000');
assert.match(markup('history'), /No orders/);
// Given a synthetic balance, when placing a buy, its quote collateral must be unavailable.
set('amount', '1'); click('submit');
assert.equal(text('count'), '1 open');
assert.equal(text('usdc'), '35,725.00');
assert.equal(text('usdcLocked'), 'Locked: 64,275.00');
assert.match(markup('history'), /OPEN/);
assert.doesNotMatch(markup('history'), /FILLED|EXECUTED/);
// Given insufficient available quote funds, a second order must not be accepted.
click('submit');
assert.match(text('message'), /Insufficient available/);
assert.equal(text('count'), '1 open');
assert.equal((markup('history').match(/<tr>/g) || []).length, 1);
// Given an OPEN buy, cancel releases collateral exactly once and retains honest status.
const staleCancel = document.querySelectorAll('[data-id]')[0];
staleCancel.click();
assert.equal(text('usdc'), '100,000.00');
assert.equal(text('usdcLocked'), 'Locked: 0.00');
assert.equal(text('count'), '0 open');
assert.match(markup('history'), /CANCELED/);
staleCancel.click();
assert.equal(text('usdc'), '100,000.00');
assert.equal(text('count'), '0 open');
// Given SELL and insufficient base asset, reject without recording an order.
click('sellTab'); set('amount', '3'); click('submit');
assert.match(text('message'), /Insufficient available/);
assert.equal(text('count'), '0 open');
// Given valid SELL, reserve BTC and display both OPEN and CANCELED in session history.
set('amount', '1.5'); click('submit');
assert.equal(text('btc'), '0.500000');
assert.equal(text('btcLocked'), 'Locked: 1.500000');
assert.match(markup('history'), /OPEN/);
assert.match(markup('history'), /CANCELED/);
// Given invalid price, precision, or nonnumeric input, do not mutate the order book.
set('price', '0'); click('submit');
assert.match(text('message'), /positive price/);
set('price', '64275'); set('amount', '0.0000001'); click('submit');
assert.match(text('message'), /positive price/);
set('amount', '<img src=x onerror=alert(1)>'); click('submit');
assert.match(text('message'), /positive price/);
assert.equal(text('count'), '1 open');
assert.equal((markup('history').match(/<tr>/g) || []).length, 2);
// Given Reset, all synthetic funds and local session records reset.
click('reset');
assert.equal(text('usdc'), '100,000.00');
assert.equal(text('btc'), '2.000000');
assert.equal(text('count'), '0 open');
assert.match(markup('history'), /No orders/);

// Round 010: stale DOM cancel handler from before reset must not target a new order
// with a recycled ID. Order IDs remain monotonic for the browser lifetime.
click('buyTab'); set('price', '64275'); set('amount', '1'); click('submit');
assert.equal(text('count'), '1 open');
assert.equal(text('usdcLocked'), 'Locked: 64,275.00');
staleCancel.click();
assert.equal(text('count'), '1 open', 'stale cancel must not remove a new order');
assert.equal(text('usdcLocked'), 'Locked: 64,275.00', 'stale cancel must not release a new hold');
click('sellTab'); set('amount', '1'); click('submit');
assert.equal(text('count'), '2 open');
assert.equal(text('btcLocked'), 'Locked: 1.000000');
// Cancel-all preserves honest CANCELED history and restores both balances.
click('cancelAll');
assert.equal(text('count'), '0 open');
assert.equal(text('usdc'), '100,000.00');
assert.equal(text('btc'), '2.000000');
assert.equal(text('usdcLocked'), 'Locked: 0.00');
assert.equal(text('btcLocked'), 'Locked: 0.000000');
assert.equal((markup('history').match(/CANCELED/g) || []).length, 2);
click('cancelAll'); // idempotent empty-state action
assert.equal(text('count'), '0 open');
assert.equal((markup('history').match(/CANCELED/g) || []).length, 2);
click('reset');
assert.match(markup('history'), /No orders/);
console.log('PASS: 010 stale cancel across reset, cancel-all reserve release, no duplicate mutation');
console.log('PASS: browser-script BDD buy/sell holds, history statuses, duplicate cancel, overdraft, validation and reset');
