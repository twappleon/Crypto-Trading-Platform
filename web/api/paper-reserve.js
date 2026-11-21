'use strict';
// R024: opt-in, server-to-server only, synthetic PostgreSQL PAPER holds.
// No exchange orders, fills, custody, token issuer, actual funds or browser persistence.
const {authenticate}=require('./paper-balances.js');
const {checkId,normalizeAmount,reservePaperHold}=require('../paper-reservations.cjs');

function parsePayload(body){
 if(!body||typeof body!=='object'||Array.isArray(body))throw Error('invalid payload');
 if(Object.keys(body).sort().join(',')!=='amount,asset,id')throw Error('invalid payload fields');
 checkId(body.id); // Treasury and path-like identifiers are invalid.
 normalizeAmount(body.asset,body.amount); // Exact BigInt; no floats or exponents.
 return {id:body.id,asset:body.asset,amount:body.amount};
}
async function reservePostgres(owner,payload,env){
 const {Client}=require('pg');
 const client=new Client({connectionString:env.PAPER_DATABASE_URL,connectionTimeoutMillis:2500,
  ssl:env.PAPER_PG_SSL==='require'?{rejectUnauthorized:true}:undefined});
 await client.connect();
 try{return await reservePaperHold(client,{owner,...payload})}
 finally{await client.end()}
}
function createHandler({env=process.env,now=()=>Date.now(),reserve=reservePostgres}={}){
 return async function reserveHandler(req,res){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Vary','Authorization');
  res.setHeader('Allow','POST');
  const reply=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body))};
  const denied=(status,error)=>reply(status,{mode:'PAPER_SANDBOX',error});
  if(req.method!=='POST')return denied(405,'METHOD_NOT_ALLOWED');
  const secret=env.PAPER_SESSION_SECRET,db=env.PAPER_DATABASE_URL;
  if(env.PAPER_RESERVATIONS_WRITE_ENABLED!=='sandbox-only'
     ||typeof secret!=='string'||secret.length<32
     ||typeof db!=='string'||!/^postgres(?:ql)?:\/\//.test(db))
   return denied(503,'PAPER_RESERVATIONS_DISABLED');
  const headers=req.headers||{};
  // No browser/cookie authentication, no CORS and no client-provided owner.
  if(headers.origin!==undefined&&headers.origin!==null)
   return denied(403,'BROWSER_RESERVATIONS_DISABLED');
  const owner=authenticate(headers.authorization,secret,Math.floor(now()/1000),
   'paper:reservations:write');
  if(!owner||!owner.startsWith('paper_'))return denied(401,'UNAUTHORIZED');
  if(typeof headers['content-type']!=='string'
     ||!/^application\/json(?:;\s*charset=utf-8)?$/i.test(headers['content-type']))
   return denied(415,'UNSUPPORTED_MEDIA_TYPE');
  let payload;
  try{payload=parsePayload(req.body)}catch(_){return denied(400,'INVALID_RESERVATION')}
  try{
   const outcome=await reserve(owner,payload,env);
   if(!outcome||outcome.id!==payload.id||outcome.asset!==payload.asset
      ||!['ACTIVE','RELEASED'].includes(outcome.state)
      ||typeof outcome.replayed!=='boolean')throw Error('bad reservation outcome');
   return reply(outcome.replayed?200:201,{
    mode:'PAPER_SANDBOX',synthetic:true,storage:'POSTGRES_PAPER_HOLDS',
    reservationOnly:true,orderEntryEnabled:false,realMoneyEnabled:false,
    id:outcome.id,asset:outcome.asset,state:outcome.state,replayed:outcome.replayed
   });
  }catch(error){
   if(error&&['PAPER_INSUFFICIENT_FUNDS','PAPER_IDEMPOTENCY_CONFLICT'].includes(error.code))
    return denied(409,'PAPER_RESERVATION_CONFLICT');
   return denied(503,'PAPER_RESERVATION_UNAVAILABLE');
  }
 };
}
module.exports=createHandler();
module.exports.createHandler=createHandler;
module.exports.parsePayload=parsePayload;
module.exports.reservePostgres=reservePostgres;
