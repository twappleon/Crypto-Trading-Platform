'use strict';
// Vercel Ignored Build Step: exit 0 means SKIP, exit 1 means BUILD.
// Only a documented source diff may justify skipping Production.
// Missing Git history or malformed metadata MUST fail open to a build.
const {execFileSync} = require('node:child_process');
const SOURCE_PATHS = ['web/', 'vercel.json'];
function decide(env, changedPaths) {
  if (env.ATLAS_FORCE_BUILD === '1') return {code:1, reason:'forced'};
  if (env.VERCEL_ENV === 'preview') return {code:0, reason:'preview disabled'};
  if (env.VERCEL_ENV !== 'production' || env.VERCEL_GIT_COMMIT_REF !== 'main')
    return {code:1, reason:'unexpected deployment context'};
  if (!Array.isArray(changedPaths)) return {code:1, reason:'git change set not verified'};
  // Empty changes are valid only when git diff exited successfully.
  const requiresBuild = changedPaths.some(p => SOURCE_PATHS.some(x => x.endsWith('/') ? p.startsWith(x) : p === x));
  return {code:requiresBuild ? 1 : 0, reason:requiresBuild ? 'web source changed' : 'documentation-only commit'};
}
function run(env=process.env, git=(args)=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']})) {
  if (env.ATLAS_FORCE_BUILD === '1' || env.VERCEL_ENV === 'preview' ||
      env.VERCEL_ENV !== 'production' || env.VERCEL_GIT_COMMIT_REF !== 'main') return decide(env,null);
  const base = env.VERCEL_GIT_PREVIOUS_SHA || 'HEAD^';
  const head = env.VERCEL_GIT_COMMIT_SHA || 'HEAD';
  const valid = x => x==='HEAD'||x==='HEAD^'||/^[a-fA-F0-9]{40}$/.test(x);
  if (!valid(base)||!valid(head)) return {code:1,reason:'untrusted git metadata'};
  try {
    const names=git(['diff','--name-only',base,head,'--']).split(/\r?\n/).filter(Boolean);
    return decide(env,names);
  } catch (_) { return {code:1, reason:'git unavailable or shallow history'}; }
}
if(require.main===module){
  const result=run();
  console.log('Atlas PAPER release gate:',result.reason,'=>',result.code===0?'SKIP':'BUILD');
  process.exitCode=result.code;
}
module.exports={decide,run};
