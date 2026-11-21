'use strict';
const assert=require('node:assert/strict');
const {decide,run}=require('./deployment-gate.cjs');
const prod={VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:'main',VERCEL_GIT_COMMIT_SHA:'a'.repeat(40),VERCEL_GIT_PREVIOUS_SHA:'b'.repeat(40)};
let argumentsSeen;
const git=files=>args=>{argumentsSeen=args;return files};
assert.equal(run(prod,git('README.md\ndocs/PROGRESS.md\n')).code,0,'docs-only push must not use production build budget');
assert.deepEqual(argumentsSeen,['diff','--name-only','b'.repeat(40),'a'.repeat(40),'--']);
for(const file of ['web/index.html','web/api/paper-status.js','web/deployment-gate.cjs','vercel.json']){
  assert.equal(run(prod,git(file+'\n')).code,1,file+' must trigger production build');
}
assert.equal(run(prod,git('docs/BDD.md\nweb/site-browser.test.cjs\n')).code,1,'test change triggers build/QA');
assert.equal(run(prod,git('')).code,0,'verified empty diff may skip build');
assert.equal(run({...prod,VERCEL_ENV:'preview'},()=>{throw new Error('git must not run')}).code,0);
assert.equal(run({...prod,VERCEL_GIT_COMMIT_REF:'feature'},git('')).code,1,'unexpected production branch must fail open');
assert.equal(run({...prod,VERCEL_ENV:'development'},git('')).code,1,'unknown environment must fail open');
assert.equal(run({...prod,ATLAS_FORCE_BUILD:'1'},git('')).code,1,'force override always deploys');
assert.equal(run({...prod,VERCEL_GIT_PREVIOUS_SHA:'--malicious'},git('')).code,1,'no git option injection');
assert.equal(run(prod,()=>{throw new Error('shallow clone / missing parent')}).code,1,'git failure must not hide a site update');
assert.equal(run({...prod,VERCEL_GIT_PREVIOUS_SHA:''},git('docs/PROGRESS.md\n')).code,0,'fallback HEAD^ handles history when available');
assert.equal(decide(prod,null).code,1,'missing path diff must not skip');
console.log('PASS: R016 Vercel PAPER Production change gate: source deploy, docs skip, fail-open negative tests');
