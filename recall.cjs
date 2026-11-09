function describeRecall(input,context={}) {
 const text = typeof input === 'string' ? input : JSON.stringify(input || {});
 const id = text.match(/["']?threadId["']?\s*:\s*["']([^"']+)["']/)?.[1];
 const limit = text.match(/["']?turnLimit["']?\s*:\s*(\d+)/)?.[1];
 let title = '';
 if (id) {
  const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
  try {
   for (const line of fs.readFileSync(path.join(context.codexHome || process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'session_index.jsonl'), 'utf8').split('\n')) {
    try { const item = JSON.parse(line); if (item.id === id) title = item.thread_name || ''; } catch {}
   }
  } catch {}
 }
 return (title || (id ? '聊天 ' + id.slice(0, 8) : '历史聊天')) + (limit ? ' · 最近 ' + limit + ' 轮' : ' · 范围未记录');
}
// Match explicit calls, never a mention of a tool inside a message or shell script.
function recallRequest(p,context){
 const tool='mcp__codex_app__read_thread';
 if(p.name===tool)return describeRecall(p.arguments || p.input,context);
 if(p.name==='exec' && /^\s*(?:text\(\s*|(?:const|let)\s+\w+\s*=\s*)?await\s+tools\.mcp__codex_app__read_thread\s*\(/.test(p.input||''))return describeRecall(p.input,context);
 return null;
}
function memoryRead(command){
 if(typeof command!=='string')return false;
 return /^\s*(?:Get-Content|cat)\s+(?:-LiteralPath\s+|-Path\s+)?["']?(?:[^;|"'\n]*[\\/])?\.codex[\\/]memories[\\/][^;|"'\n]+\.md["']?\s*$/i.test(command);
}
module.exports={recallRequest,memoryRead};
