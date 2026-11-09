const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {once}=require('node:events');
const {createDashboard}=require('./server.cjs');
async function run(){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'haloflux-test-'));
 const id='00000000-0000-4000-8000-000000000001';
 const sessionDir=path.join(directory,'sessions');fs.mkdirSync(sessionDir);
 const file=path.join(sessionDir,'rollout-'+id+'.jsonl');
 const line=payload=>JSON.stringify({type:'response_item',timestamp:new Date().toISOString(),payload})+'\n';
 fs.writeFileSync(file,line({type:'message',role:'user',id:'user',content:[{type:'input_text',text:'合成测试会话'}]}));
 const server=createDashboard({codexHome:directory});
 let empty;
 try{
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  const sessions=await (await fetch(base+'/api/sessions')).json();
  assert.equal(sessions[0].id,id,'不依赖 session_index 也能发现日志');
  assert.equal(sessions[0].title,'合成测试会话');
  const command=line({type:'function_call',call_id:'one',name:'exec',arguments:JSON.stringify({cmd:'python -m unittest tests.example',private:'DO_NOT_PUBLISH_RAW_ARGUMENTS'})});
  fs.appendFileSync(file,command+line({type:'function_call_output',call_id:'one',output:JSON.stringify({exit_code:0,output:'Ran 3 tests in 0.1s\nOK\nDO_NOT_PUBLISH_RAW_OUTPUT'})}));
  const state=await (await fetch(base+'/api/state?id='+id)).json();
  assert.equal(state.tools[0].result,'3 项测试通过');assert.equal(state.calls,1);
  assert.ok(!JSON.stringify(state).includes('DO_NOT_PUBLISH'));
  const same=await (await fetch(base+'/api/state?id='+id)).json();assert.equal(same.calls,1);
  const partial=Buffer.from(line({type:'message',role:'assistant',id:'utf8',content:[{type:'output_text',text:'增量中文🙂'}]}));
  const cut=partial.indexOf(Buffer.from('中文'))+1;
  fs.appendFileSync(file,partial.subarray(0,cut));
  await fetch(base+'/api/state?id='+id);
  fs.appendFileSync(file,partial.subarray(cut));
  const unicode=await (await fetch(base+'/api/state?id='+id)).json();
  assert.equal(unicode.messages.at(-1).text,'增量中文🙂');
  assert.equal((await fetch(base+'/api/state?id=missing')).status,404);
  assert.equal((await fetch(base+'/api/sessions',{method:'POST'})).status,405);
  assert.equal((await fetch(base+'/api/sessions',{headers:{Origin:'https://example.com'}})).status,403);
  const invalidHost=await new Promise((resolve,reject)=>{const req=http.get(base+'/api/sessions',{headers:{Host:'example.com'}},res=>{res.resume();resolve(res.statusCode)});req.on('error',reject)});
  assert.equal(invalidHost,403);
  assert.equal((await fetch(base+'/LICENSE')).status,404);
  assert.equal((await fetch(base+'/')).status,200);
  const before=fs.readFileSync(file);await fetch(base+'/api/state?id='+id);assert.deepEqual(fs.readFileSync(file),before);
  fs.writeFileSync(file,line({type:'message',role:'user',id:'reset',content:[{type:'input_text',text:'重新开始'}]}));
  const reset=await (await fetch(base+'/api/state?id='+id)).json();assert.equal(reset.calls,0);
  empty=createDashboard({codexHome:path.join(directory,'missing')});empty.listen(0,'127.0.0.1');await once(empty,'listening');
  assert.deepEqual(await (await fetch(`http://127.0.0.1:${empty.address().port}/api/sessions`)).json(),[]);
  console.log('PASS: clean launch, custom home, index-free discovery, UTF-8 incremental logs, truncation, privacy, loopback HTTP guards, missing sessions');
 }finally{
  await new Promise(resolve=>server.close(resolve));
  if(empty)await new Promise(resolve=>empty.close(resolve));
  // Only remove this test's own verified temporary directory.
  if(path.dirname(directory)===os.tmpdir() && path.basename(directory).startsWith('haloflux-test-'))fs.rmSync(directory,{recursive:true,force:true});
 }
}
run().catch(error=>{console.error(error);process.exitCode=1});
