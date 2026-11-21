'use strict';
// R025: signed server-to-server cancellation of disposable synthetic PAPER holds.
// NOT a public order, trade, wallet or settlement API. No customer funds or keys.
const {authenticate}=require('./paper-balances.js');
const {checkId,cancelPaperHold}=require('../paper-reservations.cjs');

function parsePayload(body){
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).join(',')!=='id')
  throw Error('invalid payload');
 checkId(body.id);
 return {id:body.id};
}
async function releasePostgres(owner,payload,env){
 const {Client}=require('pg');
 const client=new Client({connectionString:env.PAPER_DATABASE_URL,connectionTimeoutMillis:2500,
  ssl:env.PAPER_PG_SSL==='require'?{rejectUnauthorized:true}:undefined});
 await client.connect();
 try{return await cancelPaperHold(client,{owner,id:payload.id})}
 finally{await client.end()}
}
function createHandler({env=process.env,now=()=>Date.now(),release=releasePostgres}={}){
 return async function paperReleaseHandler(req,res){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Vary','Authorization');
  res.setHeader('Allow','POST');
  const reply=(status,payload)=>{res.statusCode=status;res.end(JSON.stringify(payload))};
  const deny=(status,error)=>reply(status,{mode:'PAPER_SANDBOX',error});
  if(req.method!=='POST')return deny(405,'METHOD_NOT_ALLOWED');
  const secret=env.PAPER_SESSION_SECRET,db=env.PAPER_DATABASE_URL;
  if(env.PAPER_RESERVATIONS_WRITE_ENABLED!=='sandbox-only'
    ||typeof secret!=='string'||secret.length<32
    ||typeof db!=='string'||!/^postgres(?:ql)?:\/\//.test(db))
   return deny(503,'PAPER_RESERVATIONS_DISABLED');
  const headers=req.headers||{};
  if(headers.origin!==undefined&&headers.origin!==null)
   return deny(403,'BROWSER_RESERVATIONS_DISABLED');
  const owner=authenticate(headers.authorization,secret,Math.floor(now()/1000),
   'paper:reservations:write');
  if(!owner||!owner.startsWith('paper_'))return deny(401,'UNAUTHORIZED');
  if(typeof headers['content-type']!=='string'
   ||!/^application\/json(?:;\s*charset=utf-8)?$/i.test(headers['content-type']))
   return deny(415,'UNSUPPORTED_MEDIA_TYPE');
  let payload;
  try{payload=parsePayload(req.body)}catch(_){return deny(400,'INVALID_RELEASE')}
  try{
   const state=await release(owner,payload,env);
   if(!state||state.id!==payload.id||!['USDC','BTC'].includes(state.asset)
       ||state.state!=='RELEASED'||typeof state.replayed!=='boolean')
    throw Error('invalid release result');
   return reply(200,{mode:'PAPER_SANDBOX',synthetic:true,storage:'POSTGRES_PAPER_HOLDS',
    reservationOnly:true,orderEntryEnabled:false,realMoneyEnabled:false,
    id:state.id,asset:state.asset,state:'RELEASED',replayed:state.replayed});
  }catch(error){
   if(error&&['PAPER_HOLD_NOT_FOUND','PAPER_BAD_HOLD_STATE','PAPER_IDEMPOTENCY_CONFLICT'].includes(error.code))
    return deny(409,'PAPER_RELEASE_CONFLICT');
   return deny(503,'PAPER_RELEASE_UNAVAILABLE');
  }
 };
}
module.exports=createHandler();
module.exports.createHandler=createHandler;
module.exports.parsePayload=parsePayload;
module.exports.releasePostgres=releasePostgres;
