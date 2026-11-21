'use strict';
// R023: atomic authenticated PAPER-only wallet snapshot; no public writes or token issuer.
const {authenticate,SQL:BALANCE_SQL}=require('./paper-balances.js');
const {SQL:HOLD_SQL,verifyHoldRows}=require('./paper-holds.js');
const {verifyBalanceRows,units}=require('../paper-balance-invariants.cjs');
function verifySnapshot(snapshot){
 if(!snapshot||typeof snapshot!=='object')throw Error('missing PAPER snapshot');
 const balances=verifyBalanceRows(snapshot.balances);
 const holds=verifyHoldRows(snapshot.holds);
 const sums={BTC:0n,USDC:0n};
 for(const h of holds)if(h.state==='ACTIVE')sums[h.asset]+=units(h.amount);
 for(const b of balances)if(units(b.locked)!==sums[b.asset])
  throw Error('PAPER holds vs locked mismatch');
 return {balances,holds};
}
async function lookupPostgres(owner,env){
 const {Client}=require('pg');
 const client=new Client({connectionString:env.PAPER_DATABASE_URL,connectionTimeoutMillis:2500,
  ssl:env.PAPER_PG_SSL==='require'?{rejectUnauthorized:true}:undefined});
 await client.connect();
 try{
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const b=await client.query(BALANCE_SQL,[owner]);
  const h=await client.query(HOLD_SQL,[owner]);
  await client.query('COMMIT');
  return {balances:b.rows,holds:h.rows};
 }catch(error){
  try{await client.query('ROLLBACK')}catch(_){}
  throw error;
 }finally{await client.end()}
}
function createHandler({env=process.env,now=()=>Date.now(),lookup=lookupPostgres}={}){
 return async function paperSnapshotHandler(req,res){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Vary','Authorization');res.setHeader('Allow','GET, HEAD');
  const reply=(status,body)=>{res.statusCode=status;res.end(req.method==='HEAD'?'':JSON.stringify(body))};
  if(req.method!=='GET'&&req.method!=='HEAD')
   return reply(405,{mode:'PAPER_SANDBOX',error:'METHOD_NOT_ALLOWED'});
  const secret=env.PAPER_SESSION_SECRET,db=env.PAPER_DATABASE_URL;
  if(typeof secret!=='string'||secret.length<32||typeof db!=='string'||!/^postgres(?:ql)?:\/\//.test(db))
   return reply(503,{mode:'PAPER_SANDBOX',error:'PAPER_BACKEND_NOT_CONFIGURED'});
  const owner=authenticate(req.headers&&req.headers.authorization,secret,
   Math.floor(now()/1000),'paper:snapshot:read');
  if(!owner)return reply(401,{mode:'PAPER_SANDBOX',error:'UNAUTHORIZED'});
  try{
   const {balances,holds}=verifySnapshot(await lookup(owner,env));
   return reply(200,{mode:'PAPER_SANDBOX',storage:'POSTGRES_PAPER_READ_ONLY',synthetic:true,
    readOnly:true,orderEntryEnabled:false,realMoneyEnabled:false,consistentSnapshot:true,
    recordsAre:'PAPER_RESERVATIONS_NOT_TRADES',balances,holds});
  }catch(_){return reply(503,{mode:'PAPER_SANDBOX',error:'PAPER_SNAPSHOT_UNAVAILABLE'})}
 };
}
module.exports=createHandler();
module.exports.createHandler=createHandler;
module.exports.verifySnapshot=verifySnapshot;
module.exports.lookupPostgres=lookupPostgres;
