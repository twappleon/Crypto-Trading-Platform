'use strict';
// R022: unit / negative BDD — signed owner-only PAPER hold inspection; no mutation.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createHandler,verifyHoldRows,SQL}=require('./api/paper-holds.js');
const SECRET='ci-only-r22-hmac-not-for-any-production-use-0123456789';
const NOW=1795235400000;
const env={PAPER_SESSION_SECRET:SECRET,PAPER_DATABASE_URL:'postgresql://paper.invalid/only-test'};
function token(owner,scope='paper:holds:read',exp=Math.floor(NOW/1000)+120){
 const payload=Buffer.from(JSON.stringify({sub:owner,scope,exp})).toString('base64url');
 return 'Bearer v1.'+payload+'.'+crypto.createHmac('sha256',SECRET).update('v1.'+payload).digest('base64url');
}
async function call(handler,{method='GET',authorization,url='/api/paper-holds?account=bob',body={account:'bob',privateKey:'never-reflect-me'}}={}){
 const headers={},response={statusCode:200,setHeader(k,v){headers[k.toLowerCase()]=v},
  end(data){this.ends=(this.ends||0)+1;this.body=data}};
 await handler({method,headers:{authorization,origin:'https://malicious.invalid'},url,body},response);
 assert.equal(response.ends,1);
 assert.match(headers['cache-control'],/no-store/);
 assert.equal(headers['access-control-allow-origin'],undefined);
 assert.equal(headers.vary,'Authorization');
 assert.equal(headers['x-content-type-options'],'nosniff');
 assert.doesNotMatch(response.body||'',/privateKey|never-reflect-me|malicious.invalid/);
 return {status:response.statusCode,body:response.body?JSON.parse(response.body):null};
}
(async()=>{
 let owners=[];
 const rows=[{id:'hold-a',asset:'USDC',amount:'30.000000000000000000',state:'ACTIVE'},
  {id:'hold-b',asset:'BTC',amount:'0.500000000000000000',state:'RELEASED'}];
 const handler=createHandler({env,now:()=>NOW,lookup:async owner=>{owners.push(owner);return rows}});
 assert.match(SQL,/h\.account_id=\$1/,'owner is a bound PostgreSQL parameter');
 assert.match(SQL,/LIMIT 101/);
 assert.doesNotMatch(SQL,/\$\{owner\}|\+\s*owner/,'never string interpolate account input');
 const result=await call(handler,{authorization:token('alice')});
 assert.equal(result.status,200);assert.equal(result.body.mode,'PAPER_SANDBOX');
 assert.equal(result.body.storage,'POSTGRES_PAPER_READ_ONLY');
 assert.equal(result.body.recordsAre,'PAPER_RESERVATIONS_NOT_TRADES');
 assert.equal(result.body.orderEntryEnabled,false);assert.equal(result.body.realMoneyEnabled,false);
 assert.equal(result.body.holds.length,2);
 assert.deepEqual(owners,['alice'],'query/body must never select identity');
 const other=await call(handler,{authorization:token('bob'),url:'/api/paper-holds?owner=alice'});
 assert.equal(other.status,200);assert.deepEqual(owners,['alice','bob']);
 const head=await call(handler,{method:'HEAD',authorization:token('alice')});
 assert.equal(head.status,200);assert.equal(head.body,null);
 for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS']){
  const rejected=await call(handler,{method,authorization:token('alice')});
  assert.equal(rejected.status,405);assert.equal(rejected.body.error,'METHOD_NOT_ALLOWED');
 }
 const bad=[undefined,token('alice','paper:balances:read'),
  token('alice','paper:orders:write'),token('alice','paper:holds:read',Math.floor(NOW/1000)-1),
  token('alice','paper:holds:read',Math.floor(NOW/1000)+86400),
  token('treasury'),token('alice;DROP TABLE foo'),
  token('alice').replace(/.$/,'~')];
 for(const authorization of bad)assert.equal((await call(handler,{authorization})).status,401);
 assert.deepEqual(owners,['alice','bob','alice'],'invalid tokens and writes cannot access database');
 const disabled=createHandler({env:{},now:()=>NOW,lookup:async()=>{throw Error('database accessed without config')}});
 assert.equal((await call(disabled,{authorization:token('alice')})).status,503);
 const broken=createHandler({env,now:()=>NOW,lookup:async()=>{throw Error('secret postgres password')}});
 const unavailable=await call(broken,{authorization:token('alice')});
 assert.equal(unavailable.status,503);assert.equal(unavailable.body.error,'PAPER_HOLDS_UNAVAILABLE');
 assert.doesNotMatch(JSON.stringify(unavailable.body),/password/);
 assert.deepEqual(verifyHoldRows([]),[],'valid empty owner snapshot is allowed');
 for(const invalid of [
  [{...rows[0],id:'../../escape'}],
  [{...rows[0],amount:'-1.00'}],
  [{...rows[0],amount:'0.00'}],
  [{...rows[0],amount:'0.001'}],
  [{...rows[1],amount:'0.0000001'}],
  [{...rows[0],state:'FILLED'}],
  [{...rows[0],asset:'ETH'}],
  [rows[0],rows[0]],
  Array.from({length:101},(_,i)=>({...rows[0],id:'unique-'+i}))
 ]) {
  assert.throws(()=>verifyHoldRows(invalid),'malformed data must be rejected');
  const badRows=createHandler({env,now:()=>NOW,lookup:async()=>invalid});
  assert.equal((await call(badRows,{authorization:token('alice')})).status,503);
 }
 console.log('PASS R022: HMAC scoped PAPER holds, owner isolation, 401/405/503, no data leakage, precision and limit negative BDD');
})().catch(e=>{console.error(e);process.exitCode=1});
