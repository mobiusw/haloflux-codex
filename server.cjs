'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {StringDecoder}=require('node:string_decoder');
const {createState,parseLine,snapshot}=require('./parser.cjs');
function createDashboard(options={}) {
 const home=path.resolve(options.codexHome || process.env.CODEX_HOME || path.join(os.homedir(),'.codex'));
 const files=new Map(),cache=new Map(),titles=new Map();
 function scan(dir,next){
  let entries;try{entries=fs.readdirSync(dir,{withFileTypes:true})}catch{return}
  for(const entry of entries){const file=path.join(dir,entry.name);
   if(entry.isDirectory())scan(file,next);
   else if(entry.isFile()){
    const id=entry.name.match(/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\.jsonl$/i)?.[1];if(id)next.set(id,file);
   }
  }
 }
 function fresh(){
  const next=new Map();scan(path.join(home,'sessions'),next);
  for(const id of files.keys())if(!next.has(id)){files.delete(id);cache.delete(id)}
  for(const [id,file] of next)files.set(id,file);
  titles.clear();
  try{for(const line of fs.readFileSync(path.join(home,'session_index.jsonl'),'utf8').split('\n')){
   try{const item=JSON.parse(line);if(item.id && item.thread_name)titles.set(item.id,item.thread_name)}catch{}
  }}catch{}
 }
 function read(id){
  const file=files.get(id);if(!file)return null;
  const stat=fs.statSync(file);let item=cache.get(id);
  if(!item || stat.size<item.offset)item={offset:0,tail:'',decoder:new StringDecoder('utf8'),state:createState(id)};
  if(stat.size>item.offset){const fd=fs.openSync(file,'r');
   try{let remaining=stat.size-item.offset;while(remaining){
    const bytes=Buffer.alloc(Math.min(remaining,1024*1024));const count=fs.readSync(fd,bytes,0,bytes.length,item.offset);if(!count)break;
    item.offset+=count;remaining-=count;
    const lines=(item.tail+item.decoder.write(bytes.subarray(0,count))).split('\n');item.tail=lines.pop();
    for(const line of lines)parseLine(item.state,line,{codexHome:home});
   }}finally{fs.closeSync(fd)}
  }
  cache.delete(id);cache.set(id,item);while(cache.size>32)cache.delete(cache.keys().next().value);
  return {...snapshot(item.state),title:titles.get(id)||item.state.title,mtime:stat.mtimeMs,observedAt:new Date().toISOString()};
 }
 fresh();const timer=setInterval(fresh,10000);timer.unref();
 const routes={'/':'index.html','/app.js':'app.js','/halo.html':'live-halo.html','/engine.js':'engine.js','/bridge.js':'bridge.js'};
 const server=http.createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','SAMEORIGIN');res.setHeader('Referrer-Policy','no-referrer');
  const port=server.address()?.port;
  const origins=[`http://127.0.0.1:${port}`,`http://localhost:${port}`];
  if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host)||(req.headers.origin&&!origins.includes(req.headers.origin))){res.writeHead(403).end();return}
  if(req.method!=='GET'){res.writeHead(405,{'Allow':'GET'}).end();return}
  try{const url=new URL(req.url,origins[0]);
   if(url.pathname==='/api/sessions'){
    const list=[...files].filter(([id])=>titles.get(id)!=='Guardian review').map(([id,file])=>({id,mtime:fs.statSync(file).mtimeMs})).sort((a,b)=>b.mtime-a.mtime).slice(0,25).map(item=>{
     const state=read(item.id);return {id:state.id,title:state.title,cwd:state.cwd,mtime:item.mtime};
    });
    res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'}).end(JSON.stringify(list));return;
   }
   if(url.pathname==='/api/state'){
    const state=read(url.searchParams.get('id'));
    res.writeHead(state?200:404,{'Content-Type':'application/json; charset=utf-8'}).end(JSON.stringify(state||{error:'会话不存在'}));return;
   }
   const file=routes[url.pathname];if(!file){res.writeHead(404).end();return}
   res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8'}).end(fs.readFileSync(path.join(__dirname,file)));
  }catch{res.writeHead(500,{'Content-Type':'application/json'}).end(JSON.stringify({error:'读取失败，请检查本地会话日志'}))}
 });
 server.once('close',()=>clearInterval(timer));return server;
}
module.exports={createDashboard};
if(require.main===module)require('./cli.cjs').main();
