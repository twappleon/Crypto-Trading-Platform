'use strict';
// R022: strictly account-scoped, server-only PostgreSQL PAPER hold inspection.
// Not exchange order history, not an order-entry endpoint, no token issuer and no real funds.
const {authenticate}=require('./paper-balances.js');
const {units}=require('../paper-balance-invariants.cjs');
const ID=/^[A-Za-z0-9_:-]{1,96}$/;
const PRECISION={BTC:6,USDC:2};
const MAX_HOLDS=100;
const SQL=`SELECT h.id, h.asset, h.amount::text AS amount, h.state
 FROM paper_ledger_holds h
 WHERE h.account_id=$1 AND h.asset IN ('BTC','USDC')
 ORDER BY h.asset, h.id LIMIT 101`;
function verifyHoldRows(rows){
 if(!Array.isArray(rows)||rows.length>MAX_HOLDS)throw Error('incomplete paper hold snapshot');
 const ids=new Set();
 return rows.map(row=>{
  if(!row||typeof row!=='object'||typeof row.id!=='string'||!ID.test(row.id)
     ||ids.has(row.id)||!Object.hasOwn(PRECISION,row.asset)
     ||!['ACTIVE','RELEASED'].includes(row.state))throw Error('invalid paper hold record');
  const value=units(row.amount),quantum=10n**BigInt(18-PRECISION[row.asset]);
  if(value<=0n||value%quantum!==0n)throw Error('invalid paper hold precision');
  ids.add(row.id);
  return {id:row.id,asset:row.asset,amount:row.amount,state:row.state};
 });
}
async function lookupPostgres(owner,env){
 const {Client}=require('pg');
 const client=new Client({connectionString:env.PAPER_DATABASE_URL,connectionTimeoutMillis:2500,
  ssl:env.PAPER_PG_SSL==='require'?{rejectUnauthorized:true}:undefined});
 await client.connect();
 try{
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const result=await client.query(SQL,[owner]);
  await client.query('COMMIT');
  return result.rows;
 }catch(error){
  try{await client.query('ROLLBACK')}catch(_){}
  throw error;
 }finally{await client.end()}
}
function createHandler({env=process.env,now=()=>Date.now(),lookup=lookupPostgres}={}){
 return async function paperHoldHandler(req,res){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Vary','Authorization');
  res.setHeader('Allow','GET, HEAD');
  const reply=(status,body)=>{res.statusCode=status;res.end(req.method==='HEAD'?'':JSON.stringify(body))};
  if(req.method!=='GET'&&req.method!=='HEAD')return reply(405,{mode:'PAPER_SANDBOX',error:'METHOD_NOT_ALLOWED'});
  const secret=env.PAPER_SESSION_SECRET,db=env.PAPER_DATABASE_URL;
  if(typeof secret!=='string'||secret.length<32||typeof db!=='string'||!/^postgres(?:ql)?:\/\//.test(db))
   return reply(503,{mode:'PAPER_SANDBOX',error:'PAPER_BACKEND_NOT_CONFIGURED'});
  const owner=authenticate(req.headers&&req.headers.authorization,secret,Math.floor(now()/1000),'paper:holds:read');
  if(!owner)return reply(401,{mode:'PAPER_SANDBOX',error:'UNAUTHORIZED'});
  try{
   const holds=verifyHoldRows(await lookup(owner,env));
   return reply(200,{mode:'PAPER_SANDBOX',storage:'POSTGRES_PAPER_READ_ONLY',
    synthetic:true,readOnly:true,orderEntryEnabled:false,realMoneyEnabled:false,
    recordsAre:'PAPER_RESERVATIONS_NOT_TRADES',holds});
  }catch(_){
   return reply(503,{mode:'PAPER_SANDBOX',error:'PAPER_HOLDS_UNAVAILABLE'});
  }
 };
}
module.exports=createHandler();
module.exports.createHandler=createHandler;
module.exports.verifyHoldRows=verifyHoldRows;
module.exports.SQL=SQL;
