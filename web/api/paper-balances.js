'use strict';
// R018: authenticated, READ-ONLY PostgreSQL PAPER balance snapshot boundary.
// This is NOT public sign-in, order entry, custody, real money, or a deployed database.
// Tokens can only be minted by a future trusted server (no public token issuer).
const crypto=require('node:crypto');
const ID=/^[A-Za-z0-9_:-]{1,96}$/;
const {verifyBalanceRows}=require('../paper-balance-invariants.cjs');
const SQL=`SELECT a.asset, a.balance::text AS total,
 COALESCE(SUM(h.amount) FILTER (WHERE h.state='ACTIVE'),0)::text AS locked,
 (a.balance-COALESCE(SUM(h.amount) FILTER (WHERE h.state='ACTIVE'),0))::text AS available
 FROM paper_ledger_accounts a
 LEFT JOIN paper_ledger_holds h ON h.asset=a.asset AND h.account_id=a.account_id
 WHERE a.account_id=$1 AND a.asset IN ('BTC','USDC')
 GROUP BY a.asset,a.balance ORDER BY a.asset`;
function authenticate(header,secret,nowSeconds) {
 if(typeof header!=='string'||header.length>4096||!header.startsWith('Bearer '))return null;
 const token=header.slice(7);
 const parts=token.split('.');
 if(parts.length!==3||parts[0]!=='v1'||!/^[A-Za-z0-9_-]{1,2048}$/.test(parts[1])||!/^[A-Za-z0-9_-]{43}$/.test(parts[2]))return null;
 const message='v1.'+parts[1];
 const expected=crypto.createHmac('sha256',secret).update(message).digest();
 let given;
 try{given=Buffer.from(parts[2],'base64url')}catch(_){return null}
 if(given.length!==expected.length||!crypto.timingSafeEqual(given,expected))return null;
 let claims;
 try{
   const payload=Buffer.from(parts[1],'base64url');
   if(payload.toString('base64url')!==parts[1])return null;
   claims=JSON.parse(payload.toString('utf8'));
 }catch(_){return null}
 if(!claims||typeof claims!=='object'||Array.isArray(claims)
    ||!ID.test(claims.sub||'')||claims.sub==='treasury'
    ||claims.scope!=='paper:balances:read'
    ||!Number.isSafeInteger(claims.exp)||claims.exp<=nowSeconds
    ||claims.exp>nowSeconds+3600)return null;
 return claims.sub;
}
async function lookupPostgres(owner,env) {
 // Dependencies and database connections are never initialized for unauthenticated requests.
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
function createHandler({env=process.env,now=()=>Date.now(),lookup=lookupPostgres}={}) {
 return async function paperBalanceHandler(req,res){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Vary','Authorization');
  res.setHeader('Allow','GET, HEAD');
  const reply=(status,body)=>{res.statusCode=status;res.end(req.method==='HEAD'?'':JSON.stringify(body))};
  if(req.method!=='GET'&&req.method!=='HEAD')return reply(405,{mode:'PAPER_SANDBOX',error:'METHOD_NOT_ALLOWED'});
  const secret=env.PAPER_SESSION_SECRET,db=env.PAPER_DATABASE_URL;
  if(typeof secret!=='string'||secret.length<32||typeof db!=='string'||!db.startsWith('postgres'))
   return reply(503,{mode:'PAPER_SANDBOX',error:'PAPER_BACKEND_NOT_CONFIGURED'});
  const owner=authenticate(req.headers&&req.headers.authorization,secret,Math.floor(now()/1000));
  if(!owner)return reply(401,{mode:'PAPER_SANDBOX',error:'UNAUTHORIZED'});
  try{
   const rows=await lookup(owner,env);
   const safeRows=verifyBalanceRows(rows);
   return reply(200,{mode:'PAPER_SANDBOX',storage:'POSTGRES_PAPER_READ_ONLY',synthetic:true,
    readOnly:true,realMoneyEnabled:false,orderEntryEnabled:false,
    balances:safeRows});
  }catch(_){return reply(503,{mode:'PAPER_SANDBOX',error:'PAPER_BALANCES_UNAVAILABLE'})}
 };
}
module.exports=createHandler();
module.exports.createHandler=createHandler;
module.exports.authenticate=authenticate;
module.exports.SQL=SQL;
