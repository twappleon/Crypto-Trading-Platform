'use strict';
// R019: fail-closed conservation gate for isolated synthetic PostgreSQL balance reads.
// The PostgreSQL schema stores NUMERIC(38,18); never round with Number.
// A snapshot without both paper assets is not a complete account snapshot.
const SCALE=10n**18n;
const DECIMAL=/^(0|[1-9][0-9]{0,19})(?:\.([0-9]{1,18}))?$/;
function units(input){
 if(typeof input!=='string')throw new Error('non-numeric balance');
 const match=DECIMAL.exec(input);
 if(!match)throw new Error('invalid balance decimal');
 return BigInt(match[1])*SCALE+BigInt((match[2]||'').padEnd(18,'0'));
}
function verifyBalanceRows(rows){
 if(!Array.isArray(rows)||rows.length!==2)throw new Error('incomplete paper snapshot');
 const assets=new Set();
 const clean=[];
 for(const r of rows){
  if(!r||typeof r!=='object'||!['BTC','USDC'].includes(r.asset)||assets.has(r.asset))throw new Error('duplicate/invalid paper asset');
  const total=units(r.total),locked=units(r.locked),available=units(r.available);
  if(locked>total||available!==total-locked)throw new Error('paper conservation violation');
  assets.add(r.asset);
  clean.push({asset:r.asset,total:r.total,locked:r.locked,available:r.available});
 }
 if(!assets.has('BTC')||!assets.has('USDC'))throw new Error('paper asset missing');
 return clean;
}
module.exports={units,verifyBalanceRows};
