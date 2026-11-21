'use strict';
// R018 executable BDD: signed account-scoped read only, no false public readiness.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createHandler,authenticate,SQL}=require('./api/paper-balances.js');
const SECRET='test-only-fixed-hmac-secret-DO-NOT-DEPLOY-0123456789';
const NOW=1795235400000;
const env={PAPER_SESSION_SECRET:SECRET,PAPER_DATABASE_URL:'postgresql://paper-db-test.invalid/fake'};
const sign=(claims,secret=SECRET)=>{
 const body=Buffer.from(JSON.stringify(claims)).toString('base64url');
 return 'v1.'+body+'.'+crypto.createHmac('sha256',secret).update('v1.'+body).digest('base64url');
};
const good=owner=>sign({sub:owner,scope:'paper:balances:read',exp:Math.floor(NOW/1000)+120});
async function invoke(handler,method='GET',authorization){
 const headers={};let ended=0,text;
 const res={statusCode:200,setHeader(k,v){headers[k.toLowerCase()]=v},end(s){ended++;text=s}};
 await handler({method,headers:{authorization,origin:'https://evil.example'},body:{privateKey:'secret-never-reflects'},url:'/api/paper-balances?account=attacker'},res);
 assert.equal(ended,1,'exactly one response');
 assert.match(headers['cache-control'],/no-store/);assert.equal(headers['access-control-allow-origin'],undefined);
 assert.equal(headers['x-content-type-options'],'nosniff');assert.equal(headers.vary,'Authorization');
 assert.doesNotMatch(text||'',/secret-never-reflects|privateKey|attacker|test-only-fixed/);
 return {status:res.statusCode,body:text?JSON.parse(text):null,headers};
}
(async()=>{
 let seen=[];
 const handler=createHandler({env,now:()=>NOW,lookup:async owner=>{
  seen.push(owner);
  return [{asset:'USDC',total:'100.00',locked:'30.00',available:'70.00'},
          {asset:'BTC',total:'2.000000',locked:'1.250000',available:'0.750000'}];
 }});
 // Given a trusted signed account credential, the SQL can only select that account.
 assert.match(SQL,/a\.account_id=\$1/);
 assert.doesNotMatch(SQL,/\$\{owner\}|\+\s*owner/);
 const alice=await invoke(handler,'GET','Bearer '+good('alice'));
 assert.equal(alice.status,200);assert.equal(alice.body.mode,'PAPER_SANDBOX');
 assert.equal(alice.body.storage,'POSTGRES_PAPER_READ_ONLY');
 assert.equal(alice.body.orderEntryEnabled,false);assert.equal(alice.body.realMoneyEnabled,false);
 assert.deepEqual([...alice.body.balances.map(x=>x.asset)].sort(),['BTC','USDC']);
 assert.equal(alice.body.balances[0].available,'70.00');
 assert.deepEqual(seen,['alice']);
 const bob=await invoke(handler,'GET','Bearer '+good('bob'));assert.equal(bob.status,200);
 assert.deepEqual(seen,['alice','bob'],'identity must be derived from signed header, not a URL/body');
 const head=await invoke(handler,'HEAD','Bearer '+good('alice'));
 assert.equal(head.status,200);assert.equal(head.body,null);
 for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS']){
  assert.equal((await invoke(handler,method,'Bearer '+good('alice'))).status,405);
 }
 const invalid=[
  undefined,'',good('alice'),'Bearer v1.a.b',
  'Bearer '+good('treasury'),
  'Bearer '+good('alice')+'x',
  'Bearer '+sign({sub:'alice',scope:'paper:orders:write',exp:Math.floor(NOW/1000)+120}),
  'Bearer '+sign({sub:'alice',scope:'paper:balances:read',exp:Math.floor(NOW/1000)-1}),
  'Bearer '+sign({sub:'alice',scope:'paper:balances:read',exp:Math.floor(NOW/1000)+86400}),
  'Bearer '+sign({sub:'alice;DROP TABLE paper_ledger_accounts',scope:'paper:balances:read',exp:Math.floor(NOW/1000)+120}),
  'Bearer '+good('alice').replace(/.$/,'Z'),
  'Bearer '+sign({sub:'alice',scope:'paper:balances:read',exp:Math.floor(NOW/1000)+120},'different-secret-012345678901234567890')
 ];
 for(const h of invalid){assert.equal((await invoke(handler,'GET',h)).status,401,'bad token must reject');}
 assert.deepEqual(seen,['alice','bob','alice'],'negative auth must never query database');
 assert.equal(authenticate('Bearer '+good('alice'),SECRET,Math.floor(NOW/1000)),'alice');
 const missing=createHandler({env:{},now:()=>NOW,lookup:async()=>{throw Error('should not query')}});
 assert.equal((await invoke(missing,'GET','Bearer '+good('alice'))).status,503,'missing config fails closed');
 const failing=createHandler({env,now:()=>NOW,lookup:async()=>{throw Error('database password secret')}});
 const fail=await invoke(failing,'GET','Bearer '+good('alice'));
 assert.equal(fail.status,503);assert.equal(fail.body.error,'PAPER_BALANCES_UNAVAILABLE');
 assert.doesNotMatch(JSON.stringify(fail.body),/database password/);
 const malformed=createHandler({env,now:()=>NOW,lookup:async()=>[{asset:'BTC',total:'1',locked:'-2',available:'3'}]});
 assert.equal((await invoke(malformed,'GET','Bearer '+good('alice'))).status,503);
 console.log('PASS: R018 account-scoped HMAC read-only PostgreSQL API BDD, 401/405/503, SQL parameter, no data leaks');
})().catch(e=>{console.error(e);process.exitCode=1});
