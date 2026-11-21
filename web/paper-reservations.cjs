'use strict';
// R020: server-only, durable PostgreSQL reservation primitives for disposable PAPER accounts.
// Not a public order endpoint; there is no token issuer, live exchange, deposit or execution.
// Every mutation holds an account row lock, preserving available >= 0 across concurrent holds.
const {units}=require('./paper-balance-invariants.cjs');
const SAFE_ID=/^[A-Za-z0-9_:-]{1,96}$/;
const ASSET_PRECISION={USDC:2,BTC:6};
function fail(code){const e=new Error('PAPER_'+code);e.code='PAPER_'+code;return e}
function checkId(value,allowTreasury=false){
 if(typeof value!=='string'||!SAFE_ID.test(value)||(!allowTreasury&&value==='treasury'))throw fail('BAD_ID');
 return value;
}
function normalizeAmount(asset,amount){
 if(!Object.hasOwn(ASSET_PRECISION,asset)||typeof amount!=='string')throw fail('BAD_AMOUNT');
 const precision=ASSET_PRECISION[asset];
 const pattern=new RegExp('^(0|[1-9][0-9]{0,19})(?:\\.([0-9]{1,'+precision+'}))?$');
 const match=pattern.exec(amount);
 if(!match)throw fail('BAD_AMOUNT');
 const parsed=units(amount);
 if(parsed===0n)throw fail('BAD_AMOUNT');
 return parsed;
}
async function transaction(client,operation){
 await client.query('BEGIN');
 try{
  const result=await operation();
  await client.query('COMMIT');
  return result;
 }catch(e){
  try{await client.query('ROLLBACK')}catch(_){}
  throw e;
 }
}
async function accountLock(client,owner,asset){
 const r=await client.query('SELECT balance::text AS total FROM paper_ledger_accounts WHERE account_id=$1 AND asset=$2 FOR UPDATE',[owner,asset]);
 if(r.rowCount!==1)throw fail('ACCOUNT_NOT_FOUND');
 return units(r.rows[0].total);
}
async function getHold(client,id){
 const r=await client.query('SELECT id,account_id,asset,amount::text AS amount,state FROM paper_ledger_holds WHERE id=$1',[id]);
 return r.rows[0]||null;
}
function compareHold(row,owner,asset,amountUnits){
 return row && row.account_id===owner && row.asset===asset && units(row.amount)===amountUnits;
}
async function reservePaperHold(client,{id,owner,asset,amount}){
 checkId(id,true);checkId(owner);
 const requested=normalizeAmount(asset,amount);
 return transaction(client,async()=>{
  // A concurrent cancellation may be uncommitted when the first replay read sees
  // ACTIVE. Serialize *all* replays against the same owner/asset account lock,
  // then read again under READ COMMITTED before returning the durable state.
  const prior=await getHold(client,id);
  if(prior&&!compareHold(prior,owner,asset,requested))throw fail('IDEMPOTENCY_CONFLICT');
  const total=await accountLock(client,owner,asset);
  const afterLock=await getHold(client,id);
  if(prior&&!afterLock)throw fail('IDEMPOTENCY_CONFLICT'); // Never resurrect a vanished ID.
  if(afterLock){
   if(!compareHold(afterLock,owner,asset,requested))throw fail('IDEMPOTENCY_CONFLICT');
   if(afterLock.state!=='ACTIVE'&&afterLock.state!=='RELEASED')throw fail('BAD_HOLD_STATE');
   return {id,asset,state:afterLock.state,replayed:true};
  }
  const lockedResult=await client.query("SELECT COALESCE(SUM(amount),0)::text AS locked FROM paper_ledger_holds WHERE account_id=$1 AND asset=$2 AND state='ACTIVE'",[owner,asset]);
  const locked=units(lockedResult.rows[0].locked);
  if(locked>total)throw fail('ACCOUNT_INVARIANT');
  if(requested>total-locked)throw fail('INSUFFICIENT_FUNDS');
  try{
   await client.query("INSERT INTO paper_ledger_holds(id,account_id,asset,amount,state) VALUES ($1,$2,$3,$4,'ACTIVE')",
     [id,owner,asset,amount]);
  }catch(e){if(e.code==='23505')throw fail('IDEMPOTENCY_CONFLICT');throw e}
  return {id,asset,state:'ACTIVE',replayed:false};
 });
}
async function cancelPaperHold(client,{id,owner}){
 checkId(id,true);checkId(owner);
 return transaction(client,async()=>{
  const previous=await client.query('SELECT asset FROM paper_ledger_holds WHERE id=$1 AND account_id=$2',[id,owner]);
  if(previous.rowCount!==1)throw fail('HOLD_NOT_FOUND');
  const asset=previous.rows[0].asset;
  await accountLock(client,owner,asset);
  const found=await client.query('SELECT state FROM paper_ledger_holds WHERE id=$1 AND account_id=$2 FOR UPDATE',[id,owner]);
  if(found.rowCount!==1)throw fail('HOLD_NOT_FOUND');
  if(found.rows[0].state==='RELEASED')return {id,asset,state:'RELEASED',replayed:true};
  if(found.rows[0].state!=='ACTIVE')throw fail('BAD_HOLD_STATE');
  await client.query("UPDATE paper_ledger_holds SET state='RELEASED' WHERE id=$1 AND account_id=$2",[id,owner]);
  return {id,asset,state:'RELEASED',replayed:false};
 });
}
module.exports={reservePaperHold,cancelPaperHold,normalizeAmount,checkId};
