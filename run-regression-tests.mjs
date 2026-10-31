import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const tests=readdirSync('.').filter(f=>f.endsWith('.test.mjs')).sort();
let passed=0,failed=0;
for(const file of tests){
 const result=spawnSync(process.execPath,[file],{cwd:process.cwd(),encoding:'utf8',maxBuffer:8*1024*1024});
 if(result.status===0){passed++;console.log(`✓ ${file}`)}
 else{failed++;console.error(`✗ ${file}\n${result.stdout||''}${result.stderr||''}`)}
}
console.log(`Regression tests: ${passed}/${tests.length} passed, ${failed} failed.`);
if(failed)process.exitCode=1;
