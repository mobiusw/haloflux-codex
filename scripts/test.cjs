const fs=require('node:fs'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..');
const tests=fs.readdirSync(root).filter(name=>name==='test.cjs'||name==='test-skills.cjs'||name.endsWith('.test.cjs')).sort();
for(const file of tests){
 const result=spawnSync(process.execPath,[path.join(root,file)],{cwd:root,stdio:'inherit'});
 if(result.error){console.error(result.error.message);process.exit(1)}
 if(result.status!==0)process.exit(result.status||1);
}
console.log(`PASS: ${tests.length} test files`);
