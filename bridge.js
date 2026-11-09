class CodexHaloBridge {
 constructor(){this.reset()}
 reset(){this.session=null;this.cursor=null;this.live={running:false,sessionPresent:false,activity:0,tools:[],beamQueue:[],tokenQueue:[],stepsDone:0,turn:0,step:0,totalTokens:0,tps:0,contextTokens:0,contextLimit:0,thinking:false,streaming:false,lastToolAt:0,model:'',pullTokens:n=>this.live.tokenQueue.splice(0,n)};}
 update(s,quiet=false){if(this.session!==s.id){this.reset();this.session=s.id;quiet=true}if(this.cursor===null)quiet=true;
  const l=this.live;l.sessionPresent=true;l.running=s.status==='running';l.activity=l.running?1:0;l.tools=s.tools.map(x=>({...x}));l.stepsDone=s.completed;l.turn=s.turn;l.totalTokens=s.usage?.total_tokens||0;l.model=s.model||'';
  l.annotations=[s.skills?.at(-1),s.lastRecall].filter(Boolean).sort((a,b)=>b.seq-a.seq);
  const clean = text => String(text || '').replace(/[`*#]/g, '').replace(/\s+/g, ' ').trim();
  const excerpt = text => {
   const source = String(text || '');
   const request = source.includes('## My request:') ? source.split('## My request:').at(-1).split('<image')[0] : source;
   const sentence = clean(request).split(/[。！？\n]/).find(Boolean) || '';
   return sentence.length > 160 ? sentence.slice(0, 160) + '…' : sentence;
  };
  const stamp = value => new Date(value).toLocaleTimeString('zh-CN', {hour12:false});
  const status = {running:'执行中',ok:'完成',error:'失败',returned:'已返回',interrupted:'中断'};
  const latestSkills = new Map();
  for (const event of s.skills || []) latestSkills.set(event.name, event);
  l.panels = [...latestSkills.values()].slice(-3).reverse().map(event => ({
   version:event.seq || event.time, title:'skill', lines:[event.name, event.stage, stamp(event.time)]
  }));
  l.issues=(s.issues || []).filter(issue=>issue.turn===s.turn).map(issue=>({...issue}));
  for(const issue of l.issues.slice(-3).reverse()) l.panels.unshift({
   version:issue.toolId+':'+issue.result,title:'本轮待处理',priority:true,
   lines:[issue.target,issue.result,issue.action]
  });
  if (s.lastRecall) l.panels.push({
   version:s.lastRecall.seq || s.lastRecall.time, title:'历史读取', lines:[s.lastRecall.name, s.lastRecall.stage, stamp(s.lastRecall.time)]
  });
  const answer = s.messages.filter(m => m.role === 'assistant').at(-1);
  if (answer) l.panels.push({version:answer.time, title:'最近回复', lines:[excerpt(answer.text), stamp(answer.time)], prose:true});
  const user = s.messages.filter(m => m.role === 'user').at(-1);
  if (user) l.panels.push({version:user.time, title:'当前请求', lines:[excerpt(user.text), stamp(user.time)], prose:true});
  const latestTools = new Map();
  for (const tool of s.tools) latestTools.set((tool.action || tool.name) + ':' + (tool.target || ''), tool);
  for (const tool of [...latestTools.values()].slice(-3).reverse()) l.panels.push({
   version:tool.id + ':' + tool.state + ':' + tool.result, title:'工具', lines:tool.action ? [tool.action, tool.target ? '对象：' + tool.target : '对象未识别', tool.result || status[tool.state] || '等待结果'] : [tool.name, status[tool.state] || tool.state]
  });
  const outcomes = s.tools.filter(tool => tool.result && tool.result !== '结果未确认');
  const outcome = outcomes.filter(tool => /项测试|\d+ (?:通过|失败|错误|跳过)/.test(tool.result)).at(-1) || outcomes.at(-1);
  if (outcome) l.panels.push({version:outcome.id + ':' + outcome.result,title:'操作结果',lines:[outcome.result,outcome.target || '对象未识别',outcome.action || outcome.name]});
  const observedAt = Date.parse(s.updated) || Date.now();
  l.timeline = s.tools.filter(tool => tool.startedAt > 0).slice(-4).map(tool => ({
   name:tool.name,
   action:tool.action || '调用工具',
   target:tool.target || '',
   state:tool.state,
   seconds:Math.max(0, ((tool.endedAt || (tool.state === 'running' ? Date.now() : observedAt)) - tool.startedAt) / 1000)
  }));
  const actions = new Map();
  for (const tool of s.tools.slice(-12)) {
   const action = tool.action || '调用工具';
   const target = tool.target || tool.name;
   actions.set(action + ':' + target, {action, target, state:tool.result || status[tool.state] || tool.state});
  }
  l.recentActions = [...actions.values()].slice(-3).reverse();
  const previous = this.panelVersions || new Map();
  const versions = new Map();
  const now = Date.now();
  for (const panel of l.panels) {
   const key = panel.title + ':' + (panel.prose ? '' : panel.lines[0]);
   const version = String(panel.version || panel.lines.join('|'));
   const old = previous.get(key);
   const changed = !quiet && (!old || old.version !== version);
   const until = quiet ? 0 : changed ? now + 10000 : old?.until || 0;
   panel.highlight = until > now;
   versions.set(key, {version, until});
  }
  this.panelVersions = versions;
  l.panelRevision = JSON.stringify([l.panels, l.timeline.map(item => ({...item, seconds:Math.floor(item.seconds)})), l.recentActions]);
  if(!quiet)for(const e of s.events){if(e.seq<=this.cursor)continue;if(e.kind==='tool'){l.beamQueue.push({id:e.toolId,name:e.name});l.lastToolAt=Date.now()}if(e.kind==='message'&&e.textFragment){l.tokenQueue.push(...(e.textFragment.match(/[\p{Script=Han}]|[^\s\p{Script=Han}]{1,12}/gu)||[]));}}
  l.beamQueue=l.beamQueue.slice(-40);l.tokenQueue=l.tokenQueue.slice(-512);l.activity=(l.running||l.tokenQueue.length||l.beamQueue.length)?1:0;this.cursor=s.seq;return l;
 }
 suspend(){this.live.running=false;this.live.activity=0;this.live.beamQueue=[];this.live.tokenQueue=[];this.cursor=null;}
}
if(typeof module!=='undefined')module.exports={CodexHaloBridge};
