'use strict';
// R015: hostile-response and stale-readiness replay BDD for public read-only status.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
(async()=>{
 const html=fs.readFileSync(__dirname+'/index.html','utf8');
 const match=html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/);
 assert.ok(match,'inline site script present');
 const nodes=new Map(),queue=[],requests=[];
 function el(id){if(!nodes.has(id))nodes.set(id,{id,value:'',textContent:'',innerHTML:'',className:'',dataset:{},listeners:{},addEventListener(k,fn){(this.listeners[k]||=[]).push(fn)}});return nodes.get(id)}
 const document={getElementById:el,querySelectorAll(selector){assert.equal(selector,'[data-id]');return[]},createElement(){throw Error('no download requested')}};
 const fetch=(url,options)=>{requests.push({url,options});const fn=queue.shift();assert.ok(fn,'unexpected network');return fn()};
 vm.runInNewContext(match[1],{document,console,fetch},{timeout:3000});
 const click=()=>Promise.all((el('checkApi').listeners.click||[]).map(fn=>fn()));
 const label=()=>el('apiCheckResult').textContent;
 const safe={mode:'PAPER_SANDBOX',readiness:'NOT_READY',storage:'BROWSER_MEMORY_ONLY',synthetic:true,
  durablePostgresConnected:false,publicAuthenticatedApi:false,orderEntryEnabled:false,realMoneyEnabled:false,custodyEnabled:false};
 const response=(body,status=200,type='application/json')=>({status,headers:{get:()=>type},json:async()=>body});
 assert.match(label(),/Not checked/);
 queue.push(async()=>response(safe));await click();
 assert.match(label(),/API reachable \(NOT_READY\)/);
 assert.equal(requests[0].url,'/api/paper-status');
 assert.equal(requests[0].options.method,'GET');
 assert.equal(requests[0].options.credentials,'omit');
 assert.equal(requests[0].options.cache,'no-store');
 assert.equal(requests[0].options.redirect,'error');
 queue.push(async()=>response({...safe,readiness:'READY',orderEntryEnabled:true,note:'<img src=x onerror=alert(1)>'}));await click();
 assert.match(label(),/Unverified API state/);
 assert.doesNotMatch(label(),/img|READY/,'untrusted server strings never rendered');
 queue.push(async()=>response(safe,200,'text/html'));await click();assert.match(label(),/unavailable or invalid/);
 queue.push(async()=>response(safe,503));await click();assert.match(label(),/unavailable or invalid/);
 queue.push(async()=>{throw Error('network unavailable')});await click();assert.match(label(),/unavailable or invalid/);
 let resolveOld;
 queue.push(()=>new Promise(resolve=>{resolveOld=resolve}));
 const old=click();
 queue.push(async()=>response(safe,503));await click();
 resolveOld(response(safe));await old;
 assert.match(label(),/unavailable or invalid/,'stale success cannot overwrite newer error');
 assert.equal(el('count').textContent,'0 open','diagnostic never creates orders');
 assert.equal(el('usdc').textContent,'100,000.00','diagnostic never changes local funds');
 console.log('PASS: R015 visible API diagnostic, rejected forged READY, HTML/503/network, stale response and no balance mutation');
})().catch(e=>{console.error(e);process.exitCode=1});
