'use strict';
const assert=require('node:assert/strict');
const handler=require('./api/paper-status.js');
function invoke(method,extra={}) {
 const headers={};let text=null,calls=0;
 const res={statusCode:200,setHeader(k,v){headers[k.toLowerCase()]=v},
   end(s=''){text=s;calls++}};
 handler({method,url:'/api/paper-status?secret=sensitive-token',
   headers:{cookie:'sensitive-cookie'},body:{privateKey:'sensitive-key',...extra}},res);
 assert.equal(calls,1);assert.match(headers['cache-control'],/no-store/);
 assert.equal(headers['content-type'],'application/json; charset=utf-8');
 assert.equal(headers['x-content-type-options'],'nosniff');
 assert.equal(headers.allow,'GET, HEAD');
 assert.equal(headers['access-control-allow-origin'],undefined);
 assert.doesNotMatch(text,/sensitive-cookie|sensitive-key|sensitive-token/);
 return {statusCode:res.statusCode,headers,text};
}
const result=invoke('GET');assert.equal(result.statusCode,200);
const body=JSON.parse(result.text);
assert.equal(body.mode,'PAPER_SANDBOX');assert.equal(body.readiness,'NOT_READY');
assert.equal(body.storage,'BROWSER_MEMORY_ONLY');assert.equal(body.synthetic,true);
for(const key of ['durablePostgresConnected','publicAuthenticatedApi','orderEntryEnabled','realMoneyEnabled','custodyEnabled'])assert.equal(body[key],false);
assert.equal(invoke('GET',{order:'malicious'}).text,result.text);
assert.equal(invoke('HEAD').text,'');
for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS']){
 const denied=invoke(method,{amount:'100',wallet:'sensitive-wallet'});
 assert.equal(denied.statusCode,405);assert.equal(JSON.parse(denied.text).error,'METHOD_NOT_ALLOWED');
}
console.log('PASS: R014 read-only PAPER readiness, no-store, no credentials reflected, forbidden methods fail closed');
