// Read-only Codex rollout adapter. Never expose tool arguments, raw outputs or reasoning.
const {readSkills,declaredSkills}=require('./skills.cjs');
const {actionSummary,operationKey}=require('./actions.cjs');
const {resultSummary}=require('./results.cjs');
const {recallRequest,memoryRead}=require('./recall.cjs');
function createState(id){return {id,title:id,cwd:'',status:'unknown',calls:0,completed:0,turn:0,seq:0,messages:[],events:[],skills:[],tools:[],issues:[],usage:null,_seen:new Set(),_tools:new Map()};}
function resultState(output){let o=output;if(typeof o==='string'){try{o=JSON.parse(o)}catch{return 'returned'}}if(!o||typeof o!=='object')return 'returned';if(o.isError===true||o.error||o.status==='failed'||o.status==='error'||(typeof o.exit_code==='number'&&o.exit_code!==0))return 'error';if(o.isError===false||o.status==='completed'||o.exit_code===0)return 'ok';return 'returned';}
function parseLine(s,line,context={}){let j;try{j=JSON.parse(line)}catch{return}const p=j.payload||{},t=j.timestamp;
 const emit=(kind,text,extra={})=>{s.events.push({seq:++s.seq,kind,text,time:t,...extra});s.events=s.events.slice(-160)};
 const once=key=>{if(s._seen.has(key))return false;s._seen.add(key);return true};
 function recall(name,stage,key){if(!once('recall:'+key))return;emit('memory','记忆 · '+stage+'：'+name,{name,stage});s.lastRecall=s.events.at(-1)}
 function skill(name,stage,evidence,key){if(!once('skill:'+key+':'+name+':'+stage))return;emit('skill','技能 · '+stage+'：'+name,{name,stage,evidence});s.skills.push(s.events[s.events.length-1]);s.skills=s.skills.slice(-160)}
 function tool(id,name,state,summary){if(!id)return;let a=s._tools.get(id);if(!a){a={id,name:name||'工具',state,t:Date.parse(t)||0,startedAt:Date.parse(t)||0,...summary};s._tools.set(id,a);s.tools.push(a);if(name)s.calls++;}else{if(name)a.name=name;if(['error','ok'].includes(a.state)&&state==='returned')return;const changed=summary?.result && summary.result!==a.result;Object.assign(a,summary);if(a.state===state&&!changed)return;a.state=state;a.t=Date.parse(t)||0;}
  if(state!=='running')a.endedAt=Date.parse(t)||a.t;
  if(state==='error' && a.target && a.operationKey) {
   const key=a.operationKey || id;
   s.issues=s.issues.filter(issue=>issue.key!==key);
   s.issues.push({key,toolId:id,action:a.action || a.name,target:a.target || '对象未识别',result:a.result || '工具明确失败',time:t,turn:s.turn});
  } else if(state==='ok' && a.operationKey) {
   const resolved=s.issues.filter(issue=>issue.key===a.operationKey);
   s.issues=s.issues.filter(issue=>issue.key!==a.operationKey);
   for(const issue of resolved)emit('resolved','已解决 · '+issue.action+' · '+issue.target,{toolId:id,name:a.name,target:issue.target});
  }
  if(state!=='running'&&!a.finished){a.finished=true;s.completed++}emit(state==='running'?'tool':state==='error'?'error':'result',[a.action || a.name,a.target,a.result || ({running:'开始',ok:'完成',error:'失败',returned:'已返回（状态未明确）',interrupted:'已中断'})[state]].filter(Boolean).join(' · '),{toolId:id,name:a.name,action:a.action,target:a.target,result:a.result,state});s.tools=s.tools.slice(-80);
 }
 if(j.type==='session_meta'){s.cwd=p.cwd||s.cwd;s.id=p.id||s.id}
 if(j.type==='turn_context'){s.cwd=p.cwd||s.cwd;s.model=p.model||s.model}
 if(j.type==='event_msg'){
  if(p.type==='item_completed'&&p.item?.exit_code===0&&memoryRead(p.item.command))recall('本机记忆文件','已读取',p.item.id||t);
  if(['task_started','turn_started'].includes(p.type)&&once('start:'+(p.turn_id||t))){for(const a of s.tools)if(a.state==='running'){a.state='interrupted';a.endedAt=Date.parse(t)||a.t;}s.status='running';s.turn++;emit('turn','开始新一轮任务')}
  if(['task_complete','turn_complete','turn_aborted','task_failed'].includes(p.type)&&once('end:'+(p.turn_id||t))){s.status=p.type==='task_failed'?'failed':p.type==='turn_aborted'?'interrupted':'completed';for(const a of s.tools)if(a.state==='running'){a.state=s.status==='interrupted'?'interrupted':'returned';a.endedAt=Date.parse(t)||a.t;}emit('turn',s.status==='completed'?'任务结束':s.status==='failed'?'任务失败':'任务中断')}
  if(p.type==='token_count'&&p.info)s.usage=p.info.total_token_usage||s.usage;
  // Command result carries a reliable exit code. Enrich its associated call only;
  // don't count item_completed and response_item twice.
  if(p.type==='item_completed'&&p.item){const a=p.item,id=a.call_id||a.id;if(id&&s._tools.has(id)){const state=resultState(a);if(state!=='returned')tool(id,null,state)}}
  if(p.type==='item_completed'&&p.item&&p.item.exit_code===0){const a=p.item;for(const name of readSkills(a.command))skill(name,'已读取指引','依据：包含该 SKILL.md 的读取命令已结束，退出码为 0；不等于实际使用。',a.id||t)}
 }
 if(j.type==='response_item'){
  if(['function_call','custom_tool_call'].includes(p.type)){const source=recallRequest(p,context);if(source)recall(source,'请求读取',p.call_id||p.id||t)}
  if(p.type==='message'&&['user','assistant'].includes(p.role)){
   const text=(p.content||[]).filter(x=>['input_text','output_text','text'].includes(x.type)).map(x=>x.text||'').join('\n');
   if(p.role==='assistant'&&p.phase==='commentary')for(const name of declaredSkills(text))skill(name,'声明使用','依据：助手进度消息：'+text.slice(0,350),p.id||t);
   if(text&&!/^\s*<(environment_context|external_browser_tabs|external_codex_apps_)/.test(text)&&!text.startsWith('The following is the Codex agent history')&&once('msg:'+(p.id||t+text))){const m={id:p.id||t,role:p.role,text,time:t,seq:++s.seq};s.messages.push(m);s.messages=s.messages.slice(-30);if(p.role==='user'){s.title=text.replace(/<[^>]*>/g,'').slice(0,90);s.status='running'}else emit('message','新增回答片段',{messageId:m.id,textFragment:text.slice(-1200)});if(p.phase==='final_answer')s.status='completed'}
  }
  if(['function_call','custom_tool_call'].includes(p.type)&&once('call:'+(p.call_id||p.id))){tool(p.call_id||p.id,p.name,'running',{...actionSummary(p),operationKey:operationKey(p,s.cwd)});s.status='running'}
  if(['function_call_output','custom_tool_call_output'].includes(p.type)&&once('out:'+(p.call_id||p.id))){const id=p.call_id||p.id;if(s._tools.has(id)){const summary=resultSummary(p.output,s._tools.get(id).action);tool(id,null,summary.state,{result:summary.result})}}
 }
 s.updated=t||s.updated;
}
function snapshot(s){const {_seen,_tools,...rest}=s;return rest}
module.exports={createState,parseLine,snapshot,resultState};

