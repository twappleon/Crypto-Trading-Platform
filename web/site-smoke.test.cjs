const fs=require('node:fs');const assert=require('node:assert/strict');
const s=fs.readFileSync(__dirname+'/index.html','utf8');
for(const x of ['PAPER / SANDBOX','Local browser simulation','Place Demo Order','Open Demo Orders','Insufficient available demo balance.','Demo order canceled','Reset demo balances & orders','Simulation Notice','aria-live="polite"','@media(max-width:520px)'])assert.ok(s.includes(x),'missing: '+x);
assert.ok(!/fetch\(|XMLHttpRequest|WebSocket\(|localStorage|sessionStorage/.test(s),'site must not transmit or persist simulated money');
assert.ok(s.includes("orders=orders.filter"),'cancel must exist');
assert.ok(s.includes('render();calc();'),'initial paint must exist');
console.log('PASS: static safety, responsive layout, order entry and cancellation smoke checks');
