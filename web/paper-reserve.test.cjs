'use strict';
// R024 negative BDD: default-disabled, no browser writes, no owner override, no leaked secrets.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createHandler,parsePayload}=require('./api/paper-reserve.js');
const NOW=1795252800000;
const SECRET='r024-sandbox-only-hmac-secret-never-deploy-0123456789';
const env={PAPER_RESERVATIONS_WRITE_ENABLED:'sandbox-only',
 PAPER_DATABASE_URL:'postgresql://paper.invalid/isolated',PAPER_SESSION_SECRET:SECRET};
function token(owner='paper_alice_r24',scope='paper:reservations:write',exp=Math.floor(NOW/1000)+120){
 const p=Buffer.from(JSON.stringify({sub:owner,scope,exp})).toString('base64url');
 return 'Bearer v1.'+p+'.'+crypto.createHmac('sha256',SECRET).update('v1.'+p).digest('base64url');
}
const valid={id:'r24_001',asset:'USDC',amount:'1.01'};
async function invoke(handler,{method='POST',headers={},body=valid}={}){
 const responseHeaders={};
 const res={statusCode:200,setHeader(k,v){responseHeaders[k.toLowerCase()]=v},
  end(raw){this.calls=(this.calls||0)+1;this.raw=raw}};
 await handler({method,headers:{authorization:token(),'content-type':'application/json',...headers},
  body,url:'/api/paper-reserve?owner=treasury',cookies:{session:'untrusted'}},res);
 assert.equal(res.calls,1);assert.match(responseHeaders['cache-control'],/no-store/);
 assert.equal(responseHeaders['access-control-allow-origin'],undefined);
 assert.equal(responseHeaders.vary,'Authorization');assert.equal(responseHeaders.allow,'POST');
 assert.doesNotMatch(res.raw,/postgres|secret|treasury|session|password|privateKey/);
 return {status:res.statusCode,body:JSON.parse(res.raw)};
}
(async()=>{
 assert.deepEqual(parsePayload(valid),valid);
 for(const body of [null,[],{},'not-json',{...valid,owner:'paper_bob_r24'},
  {...valid,amount:1.01},{...valid,id:'../private'}, {...valid,id:'treasury'},
  {...valid,asset:'ETH'},{...valid,amount:'1e-6'}, {...valid,amount:'0.001'},
  {...valid,amount:'0'},{...valid,amount:'999999999999999999999'}]){
  assert.throws(()=>parsePayload(body));
 }
 let calls=0,owners=[];
 const reserve=async(owner,payload)=>{calls++;owners.push(owner);return {
  id:payload.id,asset:payload.asset,state:'ACTIVE',replayed:false}};
 const handler=createHandler({env,now:()=>NOW,reserve});
 for(const method of ['GET','HEAD','PUT','PATCH','DELETE','OPTIONS'])
  assert.equal((await invoke(handler,{method})).status,405);
 assert.equal(calls,0);
 const disabled=createHandler({env:{...env,PAPER_RESERVATIONS_WRITE_ENABLED:'false'},
  now:()=>NOW,reserve});
 assert.equal((await invoke(disabled)).status,503);
 assert.equal(calls,0,'disabled configuration must not access database');
 for(const auth of ['', 'Bearer broken',token('treasury'),token('qa_alice'),
  token('paper_alice_r24','paper:snapshot:read'),
  token('paper_alice_r24','paper:reservations:write',Math.floor(NOW/1000)-5),
  token('paper_alice_r24').replace(/.$/,'!')]){
  assert.equal((await invoke(handler,{headers:{authorization:auth}})).status,401);
 }
 assert.equal((await invoke(handler,{headers:{origin:'https://evil.invalid'}})).status,403);
 assert.equal((await invoke(handler,{headers:{origin:'https://crypto-trading-platform-demo.vercel.app'}})).status,403);
 assert.equal((await invoke(handler,{headers:{'content-type':'text/plain'}})).status,415);
 for(const body of [null,{...valid,owner:'paper_bob_r24'}, {...valid,amount:'-1'},
   {...valid,amount:'0.001'}, {...valid,id:'bad!'}, {...valid,asset:'ETH'}])
  assert.equal((await invoke(handler,{body})).status,400);
 assert.equal(calls,0,'negative inputs must not touch PostgreSQL');
 const ok=await invoke(handler);
 assert.equal(ok.status,201);assert.equal(ok.body.id,valid.id);
 assert.equal(ok.body.reservationOnly,true);assert.equal(ok.body.orderEntryEnabled,false);
 assert.equal(ok.body.realMoneyEnabled,false);
 assert.deepEqual(owners,['paper_alice_r24'],'owner from signed subject only');
 const replay=createHandler({env,now:()=>NOW,reserve:async(owner,payload)=>({
  id:payload.id,asset:payload.asset,state:'RELEASED',replayed:true})});
 const rep=await invoke(replay);assert.equal(rep.status,200);assert.equal(rep.body.state,'RELEASED');
 for(const code of ['PAPER_IDEMPOTENCY_CONFLICT','PAPER_INSUFFICIENT_FUNDS']){
  const conflict=createHandler({env,now:()=>NOW,reserve:async()=>{throw Object.assign(Error('sensitive'),{code})}});
  assert.equal((await invoke(conflict)).status,409);
 }
 const fail=createHandler({env,now:()=>NOW,reserve:async()=>{throw Error('db password=abc')}});
 const bad=await invoke(fail);assert.equal(bad.status,503);
 assert.equal(bad.body.error,'PAPER_RESERVATION_UNAVAILABLE');
 console.log('PASS R024: strict sandbox reservation auth/opt-in/owner/precision/negative/idempotent API');
})().catch(e=>{console.error(e);process.exitCode=1});
