const $=id=>document.getElementById(id);
let selected=localStorage.getItem('haloflux-session')||'',mode='messages',filter='all',paused=false,state=null,signature='',generation=0,busy=false,quiet=true;
const time=t=>t?new Date(t).toLocaleTimeString('zh-CN',{hour12:false}):'—';
function halo(type,extra={}){$('halo').contentWindow?.postMessage({type,...extra},location.origin)}
async function sessions(){try{const r=await fetch('/api/sessions',{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error();const list=await r.json();$('session').replaceChildren(...list.map(s=>{const o=document.createElement('option');o.value=s.id;o.textContent=(s.title||s.id).slice(0,70);return o}));if(!list.some(x=>x.id===selected)){generation++;selected=list[0]?.id||'';state=null;signature='';quiet=true;halo('codex-pause');$('pending-issues').hidden=true;if(selected)tick()}$('session').value=selected||'';if(!selected){$('connection').textContent='已连接 · 暂无会话';$('content').textContent='未发现 Codex 本地会话日志。请在 Codex 中开始一次对话；使用自定义目录时，通过 --codex-home 指定。';$('latest-action').textContent='等待本机会话';$('latest-time').textContent='';$('latest').disabled=true;$('status').textContent='暂无会话';$('cwd').textContent='';for(const id of ['calls','operations'])$(id).textContent='0';$('tokens').textContent='未记录';$('updated').textContent='—';}}catch{$('connection').textContent='连接中断 · 无法读取会话列表';}}
function render(){if(!state)return;$('cwd').textContent=state.cwd;const stale=state.status==='running'&&Date.now()-Date.parse(state.updated)>120000;$('status').textContent=stale?'等待新日志':({running:'运行中',completed:'已结束',interrupted:'已中断',failed:'失败',unknown:'未知'})[state.status]||'未知';$('calls').textContent=state.calls.toLocaleString();$('tokens').textContent=state.usage?.total_tokens?.toLocaleString()||'未记录';$('updated').textContent=time(state.updated);$('operations').textContent=state.completed.toLocaleString();
 const issues=(state.issues || []).filter(issue=>issue.turn===state.turn);
 const pending=$('pending-issues');
 pending.hidden=!issues.length;
 pending.textContent=issues.length ? '本轮待处理 · '+issues.length+' 项 · '+issues.at(-1).target+' · '+issues.at(-1).result : '';
 const latest = state.events.at(-1);
 $('latest-action').textContent = latest?.text || '暂无记录';
 $('latest-time').textContent = latest ? time(latest.time) : '';
 $('latest').dataset.kind = latest?.kind || '';
 $('latest').disabled = !latest;
 $('filters').hidden=mode!=='events'; const list=mode==='messages'?state.messages:filter==='skills'?(state.skills||[]):filter==='tools'?state.events.filter(e=>['tool','result','error'].includes(e.kind)):state.events,sig=JSON.stringify(list);if(signature===sig)return;const first=!signature;signature=sig;const c=$('content'),bottom=first||c.scrollHeight-c.scrollTop-c.clientHeight<80;
 c.replaceChildren(...list.map(x=>{const d=document.createElement('div');d.className=mode==='messages'?'message':'event';if(mode==='messages'){const h=document.createElement('strong');h.textContent=(x.role==='user'?'你':'Codex')+' · '+time(x.time);const p=document.createElement('pre');p.textContent=x.text;d.append(h,p)}else{const t=document.createElement('time');t.textContent=time(x.time);const p=document.createElement('span');p.textContent=x.text;if(x.toolId){const detail=document.createElement('small');detail.textContent='底层工具：'+x.name;p.append(document.createElement('br'),detail)}if(x.kind==='error')p.style.color='#ffb4ab';if(x.kind==='skill'){const detail=document.createElement('small');detail.textContent=x.evidence;p.append(document.createElement('br'),detail);p.style.color='#98e0cf'}d.append(t,p)}return d}));if(!list.length)c.textContent=filter==='skills'?'未识别到技能证据，不代表没有使用技能。':'此会话暂时没有可显示的记录。';if(bottom)c.scrollTop=c.scrollHeight;
}
async function tick(){if(paused||!selected||busy)return;busy=true;const id=selected,g=generation;try{const r=await fetch('/api/state?id='+encodeURIComponent(id),{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error();const next=await r.json();if(paused||g!==generation||id!==selected)return;state=next;$('connection').textContent='已连接 · 真实事件';render();const stale=state.status==='running'&&Date.now()-Date.parse(state.updated)>120000;halo('codex-snapshot',{state:stale?{...state,status:'unknown'}:state,quiet});quiet=false;}catch{if(g!==generation||paused)return;$('connection').textContent='连接中断 · 数据已停止更新';halo('codex-pause');quiet=true;}finally{busy=false}}
$('session').onchange=()=>{generation++;selected=$('session').value;localStorage.setItem('haloflux-session',selected);signature='';state=null;quiet=true;$('latest-action').textContent='正在读取…';$('latest-time').textContent='';$('latest').disabled=true;halo('codex-pause');$('content').textContent='正在读取…';tick()};
for(const m of ['messages','events'])$(m).onclick=()=>{mode=m;signature='';$('messages').setAttribute('aria-selected',m==='messages');$('events').setAttribute('aria-selected',m==='events');render()};
$('pause').onclick=()=>{generation++;paused=!paused;quiet=true;$('pause').textContent=paused?'恢复跟随':'暂停跟随';$('connection').textContent=paused?'已暂停':'正在连接…';if(paused)halo('codex-pause');else tick()};
addEventListener('message',e=>{if(e.origin===location.origin&&e.source===$('halo').contentWindow&&e.data.type==='halo-ready'&&state&&!paused)halo('codex-snapshot',{state,quiet:true})});
sessions().then(tick);setInterval(tick,1000);setInterval(sessions,15000);

for(const f of ['all','tools','skills'])$('filter-'+f).onclick=()=>{filter=f;signature='';for(const n of ['all','tools','skills'])$('filter-'+n).setAttribute('aria-pressed',n===f);render()};

$('latest').onclick = () => {
  $('events').click();
  $('filter-all').click();
  $('content').scrollTop = $('content').scrollHeight;
  $('content').scrollIntoView({block:'nearest'});
};

$('pending-issues').onclick=()=>{$('events').click();$('filter-tools').click()};
