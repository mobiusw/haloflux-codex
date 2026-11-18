const {readSkills} = require('./skills.cjs');
const {browserSummary,commandItems,nestedToolCalls} = require('./batch.cjs');
const basename = value => String(value || '').replace(/\\/g, '/').split('/').at(-1).slice(0, 70);
function compound(command) {
 let quote='';
 for(let i=0;i<command.length;i++) {
  const c=command[i];
  if(quote){if(c===quote && command[i-1]!=='\\')quote='';continue}
  if(c==='"' || c==="'"){quote=c;continue}
  if(c===';' || c==='\n' || c==='|' || (c==='&' && command[i+1]==='&'))return true;
 }
 return false;
}
function actionSummary(payload) {
 let args = payload.arguments;
 if (typeof args === 'string') { try { args = JSON.parse(args); } catch { args = {}; } }
 args ||= {};
 if (/apply_patch$/.test(payload.name || '')) {
  const paths = [...String(payload.input || '').matchAll(/^\*\*\* (?:Update|Add|Delete) File: (.+)$/gm)].map(match => basename(match[1]));
  if (paths.length) return {action:'修改文件',target:[...new Set(paths)].join('、').slice(0,160)};
 }
 if (/read_file$/.test(payload.name || '') && (args.path || args.file_path)) return {action:'读取文件',target:basename(args.path || args.file_path)};
 let command = args.cmd || args.command;
 const source = payload.input || args.code || '';
 if(nestedToolCalls(source).length>1)return {action:'批量工具调用',target:''};
 if (!command && /tools\.exec_command\s*\(/.test(source)) {
  const match = source.match(/\bcmd\s*:\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/);
  if (match) {
   try { command = match[1][0] === '"' ? JSON.parse(match[1]) : match[1].slice(1,-1); } catch {}
  }
 }
 if (Array.isArray(command)) {
  const flag = command.findIndex(arg => /^-(?:command|c)$/i.test(arg));
  command = flag >= 0 ? command[flag + 1] : command.join(' ');
 }
 if (typeof command === 'string') {
  if(compound(command))return {action:'批量命令',target:''};
  const skills = readSkills(command);
  if (skills.length) return {action:'读取 skill',target:skills.join(', ')};
  const tokens = command.match(/"[^"\r\n]*"|'[^'\r\n]*'|[^\s;|]+/g)?.map(x => x.replace(/^["']|["']$/g, '')) || [];
  if (tokens[0] === '&') tokens.shift();
  const notebook = tokens.find(token => /\.ipynb$/i.test(token));
  if (notebook && /(?:unittest|pytest|test_notebook)/i.test(command)) return {action:'运行 Notebook 测试',target:basename(notebook)};
  const executable = basename(tokens[0]).replace(/\.exe$/i, '');
  let runner = -1;
  if (/^(?:python\d*(?:\.\d+)?|py)$/i.test(executable)) {
   const inline = tokens.indexOf('-c');
   if (inline >= 0 && /\bexec\s*\(/.test(tokens[inline + 1] || '')) {
    const notebook = tokens.slice(inline + 2).find(arg => /\.ipynb$/i.test(arg));
    if (notebook) return {action:'运行 Notebook',target:basename(notebook)};
   }
   const moduleIndex = tokens.indexOf('-m');
   if (moduleIndex > 0 && /^(?:unittest|pytest)$/.test(tokens[moduleIndex + 1])) runner = moduleIndex + 1;
  } else if (/^pytest$/i.test(executable)) runner = 0;
  if (runner >= 0) {
   const tail = tokens.slice(runner + 1);
   const discover = tail.includes('discover');
   const patternIndex = tail.indexOf('-p');
   const directoryIndex = tail.indexOf('-s');
   const target = discover ? tail[patternIndex + 1] && patternIndex >= 0 ? tail[patternIndex + 1] : directoryIndex >= 0 ? tail[directoryIndex + 1] : '测试发现' : tail.find(x => !x.startsWith('-') && /^[\w./\\:*\-]+$/.test(x));
   return {action:'运行 Python 测试',target:basename(target || tokens[runner])};
  }
  const rules = [
   [/^\s*node\s+["']?([^\s"'\r\n;]+(?:test|spec)[^\s"'\r\n;]*)/im,'运行测试'],
   [/^\s*node\s+--check\s+["']?([^\s"'\r\n;]+)/im,'语法检查'],
   [/^\s*node\s+["']?([^\s"'\r\n;]+\.(?:cjs|mjs|js))/im,'运行脚本'],
   [/^\s*(?:Get-Content|cat)\s+(?:(?:-Raw|-Path|-LiteralPath)\s+)*(?:"([^"\r\n]+)"|'([^'\r\n]+)'|([^\s"'\r\n;|]+))/im,'读取文件']
  ];
  for (const [pattern,action] of rules) {
   const match = command.match(pattern);
   if (match) return {action,target:basename(match[1] || match[2] || match[3])};
  }
  const summary=commandItems(command)[0]?.command;
  return {action:'运行命令',target:summary==='命令细节未识别'?'':summary || ''};
 }
 if (/(?:^|[_.])js$/.test(payload.name || '') && typeof source==='string') {
  const details=browserSummary(source);
  if(details) return details;
 }
 if (/\.getScreenshot\s*\(/.test(source)) return {action:'查看截图',target:'看板'};
 if (/\.reload\s*\(/.test(source)) return {action:'刷新页面',target:'看板'};
 if (/cua\.(?:getTab|createBrowserTab)\s*\(/.test(source)) return {action:'打开页面',target:''};
 return {action:'调用工具',target:basename(payload.name)};
}
function retryCommand(payload) {
 let args=payload.arguments;
 if(typeof args==='string'){try{args=JSON.parse(args)}catch{args={}}}
 let command=args?.cmd || args?.command;
 let workdir=args?.workdir;
 if(!command){
  const source=payload.input || args?.code || '';
  if(nestedToolCalls(source).length>1)return {};
  const match=source.match(/\bcmd\s*:\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/);
  if(match){try{command=match[1][0]==='"'?JSON.parse(match[1]):match[1].slice(1,-1)}catch{}}
  const folder=source.match(/\bworkdir\s*:\s*("(?:\\.|[^"\\])*"|'[^'\\\r\n]*')/);
  if(folder){try{workdir=folder[1][0]==='"'?JSON.parse(folder[1]):folder[1].slice(1,-1)}catch{}}
 }
 return {command,workdir};
}
const hashRetry = values => require('node:crypto').createHash('sha256').update(JSON.stringify(values)).digest('hex');
// Match ordinary retries by the full command and its working directory.
function operationKey(payload, cwd) {
 const {command,workdir}=retryCommand(payload);
 if(!command)return null;
 return hashRetry([workdir||cwd||'',command]);
}
// A commit retried with per-command author settings is still the same commit request.
function gitCommitKey(payload,cwd){
 const {command,workdir}=retryCommand(payload);
 const folder=workdir||cwd;
 if(typeof command!=='string'||typeof folder!=='string'||!folder)return null;
 const commits=[...command.matchAll(/^[ \t]*git(?:[ \t]+-c[ \t]+["']user\.(?:name|email)=[^"'\r\n]+["'])*[ \t]+commit[ \t]+-m[ \t]+(?:"([^"$`\r\n]+)"|'([^'\r\n]+)')[ \t]*$/gim)];
 if(commits.length!==1)return null;
 const path=folder.replace(/\\/g,'/').replace(/\/$/,'');
 const canonical=/^[A-Za-z]:\//.test(path)?path.toLowerCase():path;
 return hashRetry(['git commit',canonical,commits[0][1]||commits[0][2]]);
}
module.exports = {actionSummary,operationKey,gitCommitKey};
