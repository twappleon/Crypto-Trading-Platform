'use strict';
// R025 negative API BDD — scoped, opt-in, never a browser trading endpoint.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createHandler,parsePayload}=require('./api/paper-release.js');
const NOW=1795252800000;
const SECRET='r025-synthetic-only-hmac-secret-0123456789';
const env={PAPER_RESERVATIONS_WRITE_ENABLED:'sandbox-only',
 PAPER_DATABASE_URL:'postgresql://paper.invalid/isolated',PAPER_SESSION_SECRET:SECRET};
function token(owner='paper_alice_r25',scope='paper:reservations:write',exp=Math.floor(NOW/1000)+120){
 const claim=Buffer.from(JSON.stringify({sub:owner,scope,exp})).toString('base64url');
 return 'Bearer v1.'+claim+'.'+crypto.createHmac('sha256',SECRET).update('v1.'+claim).digest('base64url');
}
async function invoke(handler,{method='POST',authorization=token(),headers={},body={id:'r25_hold_1'}}={}){
 const sent={};
 const res={statusCode:200,setHeader(key,value){sent[key.toLowerCase()]=value},
  end(raw){this.calls=(this.calls||0)+1;this.raw=raw}};
 await handler({method,headers:{authorization,'content-type':'application/json',...headers},
  body,url:'/api/paper-release?owner=paper_bob_r25',cookies:{session:'forged'}},res);
 assert.equal(res.calls,1);
 assert.match(sent['cache-control'],/no-store/);
 assert.equal(sent['access-control-allow-origin'],undefined);
 assert.equal(sent.vary,'Authorization');
 assert.equal(sent.allow,'POST');
 assert.doesNotMatch(res.raw,/secret|password|treasury|paper_bob|session|privateKey|postgresql/);
 return {status:res.statusCode,body:JSON.parse(res.raw)};
}
(async()=>{
 assert.deepEqual(parsePayload({id:'r25_hold_1'}),{id:'r25_hold_1'});
 for(const body of [null,[],{},'r25_hold_1',{id:'r25_hold_1',owner:'paper_bob'},
  {id:'../bad'},{id:'treasury'},{id:'bad!'}, {id:'x'.repeat(97)}])
  assert.throws(()=>parsePayload(body));
 let count=0;const owners=[];
 const release=async(owner,payload)=>{count++;owners.push(owner);return {
  id:payload.id,asset:'USDC',state:'RELEASED',replayed:false}};
 const h=createHandler({env,now:()=>NOW,release});
 for(const method of ['GET','HEAD','PUT','PATCH','DELETE','OPTIONS'])
  assert.equal((await invoke(h,{method})).status,405);
 assert.equal(count,0);
 const off=createHandler({env:{...env,PAPER_RESERVATIONS_WRITE_ENABLED:'off'},now:()=>NOW,release});
 assert.equal((await invoke(off)).status,503);assert.equal(count,0);
 for(const authorization of ['', 'Bearer invalid',token('treasury'),token('alice'),
   token('paper_alice_r25','paper:snapshot:read'),
   token('paper_alice_r25','paper:reservations:write',Math.floor(NOW/1000)-1),
   token().replace(/.$/,'!')])
  assert.equal((await invoke(h,{authorization})).status,401);
 for(const origin of ['https://evil.invalid','https://crypto-trading-platform-demo.vercel.app'])
  assert.equal((await invoke(h,{headers:{origin}})).status,403);
 assert.equal((await invoke(h,{headers:{'content-type':'text/plain'}})).status,415);
 for(const body of [null,{}, {id:'bad/1'}, {id:'r25_hold_1',owner:'paper_bob_r25'}])
  assert.equal((await invoke(h,{body})).status,400);
 assert.equal(count,0,'all invalid requests fail before database connection');
 const first=await invoke(h);assert.equal(first.status,200);
 assert.equal(first.body.state,'RELEASED');assert.equal(first.body.realMoneyEnabled,false);
 assert.equal(first.body.orderEntryEnabled,false);
 assert.deepEqual(owners,['paper_alice_r25'],'owner comes only from HMAC claim');
 const retry=createHandler({env,now:()=>NOW,release:async(owner,payload)=>({
  id:payload.id,asset:'BTC',state:'RELEASED',replayed:true})});
 assert.equal((await invoke(retry)).body.replayed,true);
 const missing=createHandler({env,now:()=>NOW,release:async()=>{throw Object.assign(
  Error('private account does not exist'),{code:'PAPER_HOLD_NOT_FOUND'})}});
 const denied=await invoke(missing);assert.equal(denied.status,409);
 assert.equal(denied.body.error,'PAPER_RELEASE_CONFLICT','unknown vs foreign hold must be indistinguishable');
 const crash=createHandler({env,now:()=>NOW,release:async()=>{throw Error('db password=secret')}});
 const unavailable=await invoke(crash);assert.equal(unavailable.status,503);
 assert.equal(unavailable.body.error,'PAPER_RELEASE_UNAVAILABLE');
 console.log('PASS R025: signed scope, owner isolation, default disabled, no browser, duplicate release and negative API BDD');
})().catch(e=>{console.error(e);process.exitCode=1});
