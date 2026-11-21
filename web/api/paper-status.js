'use strict';
// PAPER-only read-only diagnostic; never an order endpoint or database readiness attestation.
const status = Object.freeze({service:'atlas-paper-api-boundary-v1',mode:'PAPER_SANDBOX',
 readiness:'NOT_READY',synthetic:true,storage:'BROWSER_MEMORY_ONLY',
 durablePostgresConnected:false,publicAuthenticatedApi:false,orderEntryEnabled:false,
 realMoneyEnabled:false,custodyEnabled:false,
 note:'Read-only diagnostic. No persistent orders, trading, deposits, withdrawals, accounts or KYC.'});
module.exports = function handler(req,res) {
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','no-store, max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Allow','GET, HEAD');
 if (req.method!=='GET' && req.method!=='HEAD') {
   res.statusCode=405;res.end(JSON.stringify({error:'METHOD_NOT_ALLOWED',mode:'PAPER_SANDBOX'}));return;
 }
 res.statusCode=200;res.end(req.method==='HEAD'?'':JSON.stringify(status));
};
