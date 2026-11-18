const literal = /"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`/;
const calls = new RegExp(`//[^\\r\\n]*|/\\*[\\s\\S]*?\\*/|${literal.source}|\\btools\\.([a-z][\\w]*)\\s*(?=\\()`, 'g');
const nestedToolCalls = source => typeof source==='string'?[...source.matchAll(calls)].filter(match=>match[1]):[];
const shortcuts = new Map([
 ['get-content','Get-Content'], ['get-childitem','Get-ChildItem'], ['rg','rg'],
 ['node','node'], ['python','python'], ['pytest','pytest'], ['git','git'],
 ['get-command','Get-Command'], ['invoke-restmethod','Invoke-RestMethod'],
 ['invoke-webrequest','Invoke-WebRequest'], ['get-nettcpconnection','Get-NetTCPConnection'],
 ['select-string','Select-String'], ['test-path','Test-Path'], ['get-item','Get-Item'],
 ['npm','npm'], ['pnpm','pnpm'], ['uv','uv'], ['curl','curl'], ['netstat','netstat'], ['cat','cat'],
]);
function commandItems(command) {
 const lines=command.split(/\r?\n/).map(line=>line.trim()).filter(line=>line && !line.startsWith('#'));
 // A script with continuations or control flow is one command submission.
 if (lines.length>1 && lines.some(line=>/^[{$}&]|[`\\|]$|^\w+\s*=/.test(line)))
  return [{tool:'exec_command',command:'多行脚本'}];
 return lines.map(line => {
  const match = /^(?:&\s+)?(?:"([^"]+)"|'([^']+)'|([^\s]+))/.exec(line);
  const executable=(match?.[1]||match?.[2]||match?.[3]||'').split(/[\\/]/).at(-1).replace(/\.(?:exe|cmd)$/i,'').toLowerCase();
  const command = shortcuts.get(executable);
  if (!command) return {tool:'exec_command',command:'命令细节未识别'};
  const tail=line.slice(match[0].length).trimStart();
  const sub = executable==='git' ? /^(status|diff|log|show|branch|rev-parse)\b/i.exec(tail)?.[1]
   : /^(npm|pnpm|uv)$/.test(executable) ? /^(test|run|build|sync)\b/i.exec(tail)?.[1] : '';
  const check = executable==='node' && /^--check\b/i.test(tail) ? ' --check' : '';
  // Expose only a simple source filename. Leave options, paths and other arguments out.
  const file = /^(?:Get-Content(?:\s+-(?:LiteralPath|Path|Raw))*|node(?:\s+--check)?|python)\s+([\w.-]+\.(?:cjs|mjs|js|py|md|html|css))(?:\s|$)/i.exec(line)?.[1];
  return {tool:'exec_command',command:command+(sub ? ' '+sub : '')+check+(file ? ' '+file : '')};
 });
}
function batchSummary(payload) {
 let args = payload.arguments;
 if (typeof args === 'string') { try { args=JSON.parse(args); } catch { args=null; } }
 let items;
 if (typeof args?.cmd === 'string') {
  items=commandItems(args.cmd);
 } else {
  const source=payload.input || args?.code;
  if (typeof source !== 'string') return null;
  const detected=nestedToolCalls(source);
  items=detected.flatMap(match=>{
   const tool=match[1];
   if (tool !== 'exec_command') return [{tool}];
   const arg=new RegExp(`^\\(\\s*\\{\\s*(?:\\w+\\s*:\\s*(?:${literal.source}|\\d+|true|false)\\s*,\\s*)*?cmd\\s*:\\s*(${literal.source})\\s*(?=[,}])`).exec(source.slice(match.index+match[0].length))?.[1];
   try {
    const cmd=arg?.startsWith('"') ? JSON.parse(arg)
     : (arg?.startsWith("'") || arg?.startsWith('`')) && !arg.includes('\\') && !arg.includes('${') ? arg.slice(1,-1) : null;
    if (cmd) return commandItems(cmd);
   } catch {}
   return [{tool,command:'命令细节未识别'}];
  });
 }
 if (items.length<2) return items[0]?.command ? {commandDetail:items[0].command} : null;
 return {action:items.every(item=>item.tool==='exec_command')?'批量运行命令':'批量调用工具',
  target:items.length+' 项识别结果',batch:items.slice(0,30),batchCount:items.length};
}
const browserActions=new Map([
 ['getState','查看应用和标签页'], ['listTabs','查看标签页'], ['getTab','打开页面'],
 ['createBrowserTab','打开页面'], ['goto','跳转页面'], ['reload','刷新页面'],
 ['click','点击页面控件'], ['dblclick','双击页面控件'], ['selectOption','选择下拉选项'],
 ['getAXState','读取页面状态'], ['domSnapshot','读取页面状态'],
 ['getScreenshot','查看截图'], ['screenshot','查看截图'], ['scroll','滚动页面'],
 ['evaluate','检查页面内容'], ['getAXStateAndScreenshot','读取页面状态和截图'],
]);
const plainLabel = `["']([\\p{L}\\p{N} _·&()（）/—-]{1,60})["']`;
const namedControl = `\\.getByRole\\(\\s*["'](?:button|tab|menuitem|combobox|checkbox|radio)["']\\s*,\\s*\\{\\s*name\\s*:\\s*${plainLabel}\\s*(?:,\\s*exact\\s*:\\s*(?:true|false)\\s*)?\\}\\s*\\)\\s*\\.(click|dblclick|selectOption|check|uncheck)\\s*(?=\\()`;
const browserCalls=new RegExp(`//[^\\r\\n]*|/\\*[\\s\\S]*?\\*/|${literal.source}|${namedControl}|\\.([a-zA-Z]\\w*)\\s*(?=\\()`, 'gu');
browserActions.set('check','勾选控件');
browserActions.set('uncheck','取消勾选');
function browserSummary(source) {
 const steps=[...source.matchAll(browserCalls)].flatMap(([,label,method,fallback])=>{
  const action=browserActions.get(method||fallback);
  return action ? [{action,label:label||''}] : [];
 });
 if (!steps.length) return null;
 const [first,...rest]=steps;
 const following=[...new Set(rest.filter(step=>step.action!==first.action||step.label!==first.label)
  .map(step=>[step.action,step.label].filter(Boolean).join(' · ')))].slice(0,3);
 return {action:first.action,target:[first.label,...following].filter(Boolean).join(' → ')};
}
module.exports={batchSummary,browserSummary,commandItems,nestedToolCalls};
