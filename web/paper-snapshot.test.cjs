'use strict';
// R023 negative BDD: account isolation, fixed-point reconciliation, fail closed.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createHandler,verifySnapshot}=require('./api/paper-snapshot.js');
const {SQL:BALANCE_SQL}=require('./api/paper-balances.js');
const {SQL:HOLD_SQL}=require('./api/paper-holds.js');
const SECRET='r023-test-only-hmac-secret-never-deploy-0123456789';
const NOW=1795235400000;
const env={PAPER_SESSION_SECRET:SECRET,PAPER_DATABASE_URL:'postgresql://paper.invalid/test'};
function bearer(owner,scope='paper:snapshot:read',exp=Math.floor(NOW/1000)+120){
 const b=Buffer.from(JSON.stringify({sub:owner,scope,exp})).toString('base64url');
 return 'Bearer v1.'+b+'.'+crypto.createHmac('sha256',SECRET).update('v1.'+b).digest('base64url');
}
const good={
 balances:[{asset:'BTC',total:'2.000000',locked:'0.500000',available:'1.500000'},
  {asset:'USDC',total:'100.00',locked:'30.00',available:'70.00'}],
 holds:[{id:'a1',asset:'USDC',amount:'30.00',state:'ACTIVE'},
  {id:'a2',asset:'USDC',amount:'10.00',state:'RELEASED'},
  {id:'a3',asset:'BTC',amount:'0.500000',state:'ACTIVE'}]
};
async function invoke(handler,{authorization=bearer('alice'),method='GET',url='/api/paper-snapshot?account=bob'}={}){
 const headers={},res={statusCode:200,setHeader(k,v){headers[k.toLowerCase()]=v},
  end(raw){this.calls=(this.calls||0)+1;this.raw=raw}};
 await handler({method,url,headers:{authorization,origin:'https://evil.invalid'},
  body:{account:'treasury',privateKey:'do-not-echo'}},res);
 assert.equal(res.calls,1);assert.match(headers['cache-control'],/no-store/);
 assert.equal(headers.vary,'Authorization');assert.equal(headers['access-control-allow-origin'],undefined);
 assert.equal(headers['x-content-type-options'],'nosniff');
 assert.doesNotMatch(res.raw||'',/do-not-echo|privateKey|evil.invalid/);
 return {status:res.statusCode,body:res.raw?JSON.parse(res.raw):null};
}
(async()=>{
 assert.match(BALANCE_SQL,/a\.account_id=\$1/);assert.match(HOLD_SQL,/h\.account_id=\$1/);
 assert.match(HOLD_SQL,/LIMIT 101/);
 assert.deepEqual(verifySnapshot(good).balances,good.balances);
 let owners=[];
 const handler=createHandler({env,now:()=>NOW,lookup:async owner=>{owners.push(owner);return good}});
 const ok=await invoke(handler);
 assert.equal(ok.status,200);assert.equal(ok.body.consistentSnapshot,true);
 assert.equal(ok.body.storage,'POSTGRES_PAPER_READ_ONLY');
 assert.equal(ok.body.realMoneyEnabled,false);assert.equal(ok.body.orderEntryEnabled,false);
 const bob=await invoke(handler,{authorization:bearer('bob'),url:'/api/paper-snapshot?owner=alice'});
 assert.equal(bob.status,200);assert.deepEqual(owners,['alice','bob']);
 assert.equal((await invoke(handler,{method:'HEAD'})).body,null);
 for(const method of ['POST','PATCH','PUT','DELETE','OPTIONS'])
  assert.equal((await invoke(handler,{method})).status,405);
 for(const authorization of [null,'Bearer nonsense',bearer('treasury'),
  bearer('alice','paper:holds:read'),bearer('alice','paper:balances:read'),
  bearer('alice','paper:orders:write'),bearer('alice','paper:snapshot:read',Math.floor(NOW/1000)-1),
  bearer('alice','paper:snapshot:read',Math.floor(NOW/1000)+86400),
  bearer('a/b'),bearer('alice').replace(/.$/,'!')]){
  assert.equal((await invoke(handler,{authorization})).status,401);
 }
 assert.deepEqual(owners,['alice','bob','alice'],'unauthorized or method-rejected calls cannot access DB');
 const disabled=createHandler({env:{},now:()=>NOW,lookup:async()=>{throw Error('db should not be called')}});
 assert.equal((await invoke(disabled)).status,503);
 const broken=[
  {...good,holds:good.holds.slice(0,1)},
  {...good,holds:[{...good.holds[0],amount:'31.00'},...good.holds.slice(1)]},
  {...good,holds:[{...good.holds[0],state:'RELEASED'},...good.holds.slice(1)]},
  {...good,holds:[good.holds[0],good.holds[0]]},
  {...good,holds:[{...good.holds[0],amount:'30.001'},...good.holds.slice(1)]},
  {...good,holds:[...good.holds,...Array.from({length:101},(_,i)=>({id:'x'+i,asset:'USDC',amount:'1.00',state:'RELEASED'}))]},
  {...good,balances:good.balances.slice(0,1)},
  {...good,balances:good.balances.map((b,i)=>i===1?{...b,available:'71.00'}:b)}
 ];
 for(const snapshot of broken){
  assert.throws(()=>verifySnapshot(snapshot));
  const bad=createHandler({env,now:()=>NOW,lookup:async()=>snapshot});
  const result=await invoke(bad);
  assert.equal(result.status,503);assert.equal(result.body.balances,undefined);
  assert.equal(result.body.holds,undefined);
 }
 const brokenDb=createHandler({env,now:()=>NOW,lookup:async()=>{throw Error('secret DB password')}});
 const fail=await invoke(brokenDb);
 assert.equal(fail.status,503);assert.equal(fail.body.error,'PAPER_SNAPSHOT_UNAVAILABLE');
 assert.doesNotMatch(JSON.stringify(fail.body),/password/);
 console.log('PASS R023: owner-scoped atomic PAPER read, exact fixed-point reconciliation and negative 401/405/503 BDD');
})().catch(e=>{console.error(e);process.exitCode=1});
