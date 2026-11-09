#!/usr/bin/env node
'use strict';
const {spawn}=require('node:child_process');
const path=require('node:path');
function main(argv=process.argv.slice(2)) {
 let port=43127,codexHome,open=false;
 for(let i=0;i<argv.length;i++) {
  const arg=argv[i];
  if(arg==='--help'||arg==='-h'){
   console.log('HALOFLUX Codex\n\nnode cli.cjs [--port 43127] [--codex-home PATH] [--open]\n\nRead-only local Codex session dashboard. Requires Node.js 22+.\nOnly listens on 127.0.0.1. Press Ctrl+C to stop.');return;
  }
  if(arg==='--open'){open=true;continue}
  if(arg==='--port'&&argv[i+1]){port=Number(argv[++i]);continue}
  if(arg==='--codex-home'&&argv[i+1]){codexHome=path.resolve(argv[++i]);continue}
  console.error('Unknown or incomplete option:',arg);process.exitCode=1;return;
 }
 if(!Number.isInteger(port)||port<1||port>65535){console.error('Port must be an integer between 1 and 65535.');process.exitCode=1;return}
 const server=require('./server.cjs').createDashboard({codexHome});
 server.on('error',error=>{
  console.error(error.code==='EADDRINUSE'?`Port ${port} is already in use. Choose --port NUMBER or open the existing dashboard.`:error.message);
  server.close();process.exitCode=1;
 });
 server.listen(port,'127.0.0.1',()=>{
  const url=`http://127.0.0.1:${port}/`;
  console.log(`HALOFLUX Codex: ${url}\nRead-only local dashboard. Press Ctrl+C to stop.`);
  if(open){
   const command=process.platform==='win32'?'rundll32':process.platform==='darwin'?'open':'xdg-open';
   const args=process.platform==='win32'?['url.dll,FileProtocolHandler',url]:[url];
   const child=spawn(command,args,{stdio:'ignore',detached:true,windowsHide:true});
   child.on('error',()=>console.log('Open the URL above in your browser.'));child.unref();
  }
 });
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close());return server;
}
module.exports={main};
if(require.main===module)main();
