const $=id=>document.getElementById(id);
let selected=localStorage.getItem('haloflux-session')||'',mode='messages',filter='all',paused=false,state=null,generation=0,busy=false,quiet=true;
const content=$('content');
const picker=$('session');
let sessionOptions=[];
let sessionMessage='正在加载聊天…';
let sessionListBusy=false;
let sessionListSignature='';
const rowsByKey=new Map();
let followLatest=true;
let renderedView='';
let lastSequence=0;
let listSignature='';
const time=t=>t?new Date(t).toLocaleTimeString('zh-CN',{hour12:false}):'—';
function halo(type,extra={}){$('halo').contentWindow?.postMessage({type,...extra},location.origin)}
function renderSessionOptions(){
 const options=sessionOptions.map(({id,title})=>[id,(title||id).slice(0,70)]);
 if(selected&&!options.some(([id])=>id===selected)){
  if(state?.id===selected)options.unshift([selected,(state.title||selected).slice(0,70)]);
  else if(options.length)options.unshift([selected,'正在读取当前聊天…']);
 }
 const signature=JSON.stringify(options.length?options:sessionMessage);
 if(signature===sessionListSignature)return;
 // Replacing options while the native menu has focus closes it on some browsers.
 if(!picker.disabled&&document.activeElement===picker)return;
 picker.replaceChildren(...(options.length?options:[['',sessionMessage]]).map(([id,title])=>new Option(title,id)));
 picker.value=options.length?selected:'';
 picker.disabled=!options.length;
 sessionListSignature=signature;
}
async function sessions(){
 if(sessionListBusy)return;
 sessionListBusy=true;
 try{
  const response=await fetch('/api/sessions',{signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error();
  const list=await response.json();
  if(list.length)sessionOptions=list;
  sessionMessage='暂无可切换的聊天';
  if(!selected&&!sessionOptions.length){
   $('connection').textContent='已连接 · 暂无会话';
   content.textContent='未发现 Codex 本地会话日志。请在 Codex 中开始对话，或使用 --codex-home 指定目录。';
  }
 }catch{
  sessionMessage='聊天列表暂不可用，正在重试…';
  if(!selected)$('connection').textContent='连接中断 · 无法读取会话列表';
 }finally{
  sessionListBusy=false;
 }
 if(!selected&&sessionOptions.length)switchSession(sessionOptions[0].id);
 renderSessionOptions();
}
function activityRows(events, tools){
 const toolStates=new Map(tools.map(tool=>[tool.id,tool]));
 const calls=new Map();
 const rows=[];
 let messageGroup;
 for(const event of events){
  if(event.kind==='message'){
   if(messageGroup){
    messageGroup.fragments=(messageGroup.fragments||1)+1;
    messageGroup.text='更新回答 · '+messageGroup.fragments+' 段';
   }else{
    messageGroup={...event};
    rows.push(messageGroup);
   }
   continue;
  }
  messageGroup=null;
  if(!event.toolId || !['tool','result','error'].includes(event.kind)){
   rows.push({...event});
   continue;
  }
  let row=calls.get(event.toolId);
  if(!row){
   row={...event,key:'tool:'+event.toolId,startTime:event.time};
   calls.set(event.toolId,row);
   rows.push(row);
  }else{
   const startTime=row.startTime;
   Object.assign(row,event,{startTime});
  }
 }
 for(const [id,row] of calls){
  const tool=toolStates.get(id);
  const status=tool?.state || row.state;
  const start=tool?.startedAt || Date.parse(row.startTime);
  const end=tool?.endedAt || (row.kind==='tool' || row.startTime===row.time ? NaN : Date.parse(row.time));
  const duration=end-start;
  const elapsed=status!=='running' && Number.isFinite(duration) && duration>=0
   ? (duration<1000 ? duration+' 毫秒' : (duration/1000).toFixed(1)+' 秒') : '';
  const label={running:'运行中',ok:'成功',error:'失败',returned:'已返回',interrupted:'已中断'}[status];
  row.text=[row.action||row.name,row.target,label,elapsed].filter(Boolean).join(' · ');
  row.headline=[row.action||row.name,row.target].filter(Boolean).join(' · ');
  row.statusLabel=label;
  row.elapsed=elapsed;
  row.callState=status;
  if(status==='error') row.kind='error';
  if(Number.isFinite(start)) row.time=new Date(start).toISOString();
 }
 return rows;
}
function batchDetails(event){
 const details=document.createElement('details');
 details.className='batch-details';
 details.dataset.event=event.key || event.seq;
 const summary=document.createElement('summary');
 summary.className='call-summary';
 const title=document.createElement('span');
 title.className='call-title';
 title.textContent=event.headline;
 const status=document.createElement('span');
 status.className='call-state';
 status.dataset.state=event.callState||'';
 status.textContent=event.statusLabel||'';
 const duration=document.createElement('span');
 duration.className='call-duration';
 duration.textContent=event.elapsed||'';
 const caret=document.createElement('span');
 caret.className='call-caret';
 caret.setAttribute('aria-hidden','true');
 caret.textContent='›';
 summary.append(title,status,duration,caret);
 const metadata=document.createElement('small');
 metadata.textContent=['底层工具：'+event.name,event.commandDetail && '命令摘要：'+event.commandDetail,event.result && '结果：'+event.result].filter(Boolean).join(' · ');
 details.append(summary,metadata);
 if(!event.batch?.length) return details;
 const list=document.createElement('ol');
 for(const entry of event.batch){
  const item=document.createElement('li');
  item.textContent=entry.command ? entry.tool+' · '+entry.command : entry.tool;
  list.append(item);
 }
 const note=document.createElement('small');
 note.textContent='按日志识别，状态以整批结果为准。'+(event.batchCount>event.batch.length?' 仅展示前 '+event.batch.length+' 项。':'');
 details.append(list,note);
 return details;
}
function createRow(event){
 const row=document.createElement('div');
 if(mode==='messages'){
  row.className='message';
  const heading=document.createElement('strong');
  heading.textContent=(event.role==='user'?'你':'Codex')+' · '+time(event.time);
  const body=document.createElement('pre');
  body.textContent=event.text;
  row.append(heading,body);
  return row;
 }
 row.className=event.key?'event call-event':'event';
 const stamp=document.createElement('time');
 stamp.textContent=time(event.time);
 if(event.kind==='skill'){
  const body=document.createElement('div');
  body.className='skill-record';
  const heading=document.createElement('div');
  heading.className='skill-heading';
  const name=document.createElement('strong');
  name.textContent=event.name?'技能 · '+event.name:event.text;
  heading.append(name);
  if(event.stage){
   const stage=document.createElement('span');
   stage.className='skill-stage';
   stage.textContent=event.stage;
   heading.append(stage);
  }
  body.append(heading);
  if(event.evidence){
   const evidence=document.createElement('p');
   evidence.className='skill-evidence';
   evidence.textContent=event.evidence;
   body.append(evidence);
  }
  row.append(stamp,body);
  return row;
 }
 const body=event.key?batchDetails(event):document.createElement('span');
 if(!event.key){
  body.textContent=event.text;
  if(event.kind==='error')body.style.color='#ffb4ab';
 }
 row.append(stamp,body);
 return row;
}
function updateRow(row,event,previous){
 const next=createRow(event);
 if(!event.key){
  row.replaceChildren(...next.children);
  return;
 }
 const [stamp,details]=row.children;
 const [nextStamp,nextDetails]=next.children;
 stamp.textContent=nextStamp.textContent;
 const summary=details.firstElementChild;
 const [title,status,duration]=summary.children;
 if(title.textContent!==event.headline)title.textContent=event.headline;
 status.dataset.state=event.callState||'';
 if(status.textContent!==(event.statusLabel||''))status.textContent=event.statusLabel||'';
 if(duration.textContent!==(event.elapsed||''))duration.textContent=event.elapsed||'';
 const metadata=details.children[1];
 const nextMetadata=nextDetails.children[1];
 if(metadata.textContent!==nextMetadata.textContent)metadata.textContent=nextMetadata.textContent;
 if(previous.batchCount!==event.batchCount||JSON.stringify(previous.batch)!==JSON.stringify(event.batch)){
  while(metadata.nextSibling)metadata.nextSibling.remove();
  details.append(...Array.from(nextDetails.children).slice(2));
 }
}
function scrollToLatest(){
 followLatest=true;
 const button=$('jump-latest');
 if(document.activeElement===button)content.focus({preventScroll:true});
 button.hidden=true;
 content.scrollTop=content.scrollHeight;
}
function renderList(list,sequence){
 const view=JSON.stringify([selected,mode,mode==='events'?filter:null]);
 const initial=view!==renderedView;
 const signature=JSON.stringify(list);
 if(!initial&&signature===listSignature&&sequence===lastSequence)return;
 listSignature=signature;
 if(initial){
  renderedView=view;
  rowsByKey.clear();
  content.replaceChildren();
  followLatest=true;
 }
 const entries=list.map(event=>[event.key||String(event.seq),event]);
 const keys=new Set(entries.map(([key])=>key));
 const viewport=content.getBoundingClientRect();
 const anchor=followLatest?null:Array.from(content.children).find(row=>
  keys.has(row.dataset.rowKey)&&row.getBoundingClientRect().bottom>viewport.top);
 const offset=anchor?.getBoundingClientRect().top;
 const focused=document.activeElement;
 for(const [key,{row}] of rowsByKey){
  if(keys.has(key))continue;
  if(row.contains(focused))content.focus({preventScroll:true});
  row.remove();
  rowsByKey.delete(key);
 }
 if(!list.length){
  content.textContent=filter==='skills'&&mode==='events'?'未识别到技能证据，不代表没有使用技能。':'此会话暂时没有可显示的记录。';
  scrollToLatest();
 }else{
  if(!rowsByKey.size)content.replaceChildren();
  let cursor=content.firstElementChild;
  for(const [key,event] of entries){
   const version=JSON.stringify(event);
   let entry=rowsByKey.get(key);
   if(!entry){
    const row=createRow(event);
    row.dataset.rowKey=key;
    entry={row,event,version};
    rowsByKey.set(key,entry);
   }else if(entry.version!==version){
    updateRow(entry.row,event,entry.event);
    Object.assign(entry,{event,version});
   }
   const {row}=entry;
   if(row!==cursor){
    if(row.parentNode===content&&typeof content.moveBefore==='function')content.moveBefore(row,cursor);
    else{
     content.insertBefore(row,cursor);
     if(row.contains(focused)&&document.activeElement!==focused)focused.focus({preventScroll:true});
    }
   }
   cursor=row.nextElementSibling;
  }
  if(followLatest)scrollToLatest();
  else{
   if(anchor)content.scrollTop+=anchor.getBoundingClientRect().top-offset;
   if(sequence>lastSequence)$('jump-latest').hidden=false;
  }
 }
 lastSequence=sequence;
}
function renderStatus(snapshot){
 const stale=snapshot?.status==='running'&&Date.now()-Date.parse(snapshot.updated)>120000;
 const taskState=stale?'stale':snapshot?.status||'unknown';
 const label={running:'运行中',completed:'已结束',interrupted:'已中断',failed:'失败',unknown:'未知',stale:'等待新日志'}[taskState];
 const status=$('status');
 const text=snapshot?label||'未知':'—';
 if(status.textContent!==text)status.textContent=text;
 $('session-state').dataset.state=taskState;
 $('calls').textContent=snapshot?.calls.toLocaleString()??'—';
 $('operations').textContent=snapshot?.completed.toLocaleString()??'—';
 $('tokens').textContent=snapshot?snapshot.usage?.total_tokens?.toLocaleString()??'未记录':'—';
 $('updated').textContent=time(snapshot?.updated);
 const latest=snapshot?.events.at(-1);
 const action=$('latest-action');
 action.textContent=latest?.text||(snapshot?'暂无记录':'正在读取…');
 action.title=latest?.text||'';
 const stamp=$('latest-time');
 stamp.textContent=latest?time(latest.time):'';
 stamp.dateTime=latest?.time||'';
 $('latest').dataset.kind=latest?.kind||'';
 $('latest').disabled=!latest;
}
function render(){if(!state)return;$('cwd').textContent=state.cwd;renderStatus(state);
 const issues=(state.issues || []).filter(issue=>issue.turn===state.turn);
 const pending=$('pending-issues');
 pending.hidden=!issues.length;
 pending.textContent=issues.length ? '本轮待处理 · '+issues.length+' 项 · '+issues.at(-1).target+' · '+issues.at(-1).result : '';
 $('filters').hidden=mode!=='events';
 const events=mode==='messages'?state.messages:filter==='skills'?(state.skills||[]):filter==='tools'
  ? state.events.filter(e=>['tool','result','error'].includes(e.kind)):state.events;
 const list=mode==='events'&&filter!=='skills'?activityRows(events,state.tools||[]):events;
 renderList(list,events.at(-1)?.seq||0);
}
async function tick(){
 if(paused||!selected||busy)return;
 busy=true;
 const id=selected,g=generation;
 try{
  const response=await fetch('/api/state?id='+encodeURIComponent(id),{signal:AbortSignal.timeout(8000)});
  if(paused||g!==generation||id!==selected)return;
  if(response.status===404){
   sessionOptions=sessionOptions.filter(entry=>entry.id!==id);
   const fallback=sessionOptions[0]?.id||'';
   switchSession(fallback);
   if(!fallback)$('connection').textContent='当前聊天不可用';
   return;
  }
  if(!response.ok)throw Error();
  const next=await response.json();
  if(paused||g!==generation||id!==selected)return;
  state=next;
  renderSessionOptions();
  $('connection').textContent='已连接 · 真实事件';
  render();
  const stale=state.status==='running'&&Date.now()-Date.parse(state.updated)>120000;
  halo('codex-snapshot',{state:stale?{...state,status:'unknown'}:state,quiet});
  quiet=false;
 }catch{
  if(g!==generation||paused)return;
  $('connection').textContent='连接中断 · 数据已停止更新';
  halo('codex-pause');
  quiet=true;
 }finally{
  busy=false;
 }
}
function switchSession(id){
 generation++;
 selected=id;
 if(id)localStorage.setItem('haloflux-session',id);
 else localStorage.removeItem('haloflux-session');
 renderedView='';
 state=null;
 quiet=true;
 renderStatus(null);
 renderSessionOptions();
 if([...picker.options].some(option=>option.value===id))picker.value=id;
 halo('codex-pause');
 content.textContent=id?'正在读取…':'暂无可显示的聊天。';
 scrollToLatest();
 tick();
}
picker.onchange=()=>switchSession(picker.value);
picker.onblur=renderSessionOptions;
for(const m of ['messages','events'])$(m).onclick=()=>{mode=m;$('messages').setAttribute('aria-selected',m==='messages');$('events').setAttribute('aria-selected',m==='events');render()};
$('pause').onclick=()=>{generation++;paused=!paused;quiet=true;$('pause').textContent=paused?'恢复跟随':'暂停跟随';$('connection').textContent=paused?'已暂停':'正在连接…';if(paused)halo('codex-pause');else tick()};
addEventListener('message',e=>{if(e.origin===location.origin&&e.source===$('halo').contentWindow&&e.data.type==='halo-ready'&&state&&!paused)halo('codex-snapshot',{state,quiet:true})});
sessions();tick();setInterval(tick,1000);setInterval(sessions,15000);

for(const f of ['all','tools','skills'])$('filter-'+f).onclick=()=>{filter=f;for(const n of ['all','tools','skills'])$('filter-'+n).setAttribute('aria-pressed',n===f);render()};

content.addEventListener('scroll',()=>{
 followLatest=content.scrollHeight-content.scrollTop-content.clientHeight<=8;
 if(followLatest&&!$('jump-latest').hidden)scrollToLatest();
});
$('jump-latest').onclick=scrollToLatest;

$('stats-toggle').onclick=event=>{
 const toggle=event.currentTarget;
 const metrics=$('session-metrics');
 metrics.hidden=!metrics.hidden;
 toggle.setAttribute('aria-expanded',String(!metrics.hidden));
};

$('latest').onclick = () => {
  $('events').click();
  $('filter-all').click();
  scrollToLatest();
  content.scrollIntoView({block:'nearest'});
};

$('pending-issues').onclick=()=>{$('events').click();$('filter-tools').click()};
