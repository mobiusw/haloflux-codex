const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {CodexHaloBridge} = require('./bridge.js');
const bridge = new CodexHaloBridge();
const state = {
 id:'test', status:'running', completed:4, turn:1, seq:4, events:[], messages:[],
 skills:[
  {name:'example-skill',stage:'声明使用',time:'2026-11-08T01:00:00Z'},
  {name:'example-skill',stage:'已读取指引',time:'2026-11-08T01:00:01Z'},
  {name:'example-skill',stage:'已读取指引',time:'2026-11-08T01:01:00Z'}
 ],
 tools:[{name:'exec',state:'running'},{name:'exec',state:'ok'},{name:'js',state:'error'}]
};
bridge.update(state);
assert.equal(bridge.live.panels.filter(p=>p.title==='skill').length,1);
assert.equal(bridge.live.panels[0].lines[1],'已读取指引');
assert.equal(bridge.live.panels.filter(p=>p.lines[0]==='exec').length,1);
assert.equal(bridge.live.panels.find(p=>p.lines[0]==='exec').lines[1],'完成');
const source = fs.readFileSync(require.resolve('./engine.js'),'utf8');
const begin = source.indexOf('    function layoutPanel(');
const end = source.indexOf('    // Keep each panel coherent:',begin);
const layout = vm.runInNewContext(source.slice(begin,end)+';layoutPanel');
const measure = text => Array.from(text).reduce((n,c)=>n+(/[一-龥]/.test(c)?4.5:2.6),0);
const cases = [
 {title:'skill',lines:['example-skill','已读取指引','09:30:00']},
 {title:'历史读取',lines:['示例历史会话 · 最近 8 轮','请求读取','09:30:00']},
 {title:'当前请求',lines:['请检查 example-skill 面板的排字是否清晰，保留状态和时间','09:30:00'],prose:true},
 {title:'空白',lines:['']},
 {title:'工具',lines:['a'.repeat(200),'失败']}
];
let samples=0;
for(const panel of cases) for(const width of [22,32,50,65,80,120]) for(const capacity of [0,1,2,3,5]){
 const rows=layout(panel,width,capacity,measure);
 assert.ok(rows.length<=capacity);
 for(const row of rows) assert.ok(measure(row)<=width,JSON.stringify({row,width}));
 samples++;
}
assert.ok(layout(cases[0],32,3,measure)[0].endsWith('…'));
assert.equal(layout(cases[0],80,3,measure)[0],'example-skill');
console.log('通过：技能与工具去重、最新状态保留，以及 '+samples+' 组宽度/高度/内容排字测试');
bridge.update(state, true);
assert.ok(bridge.live.panels.every(panel => !panel.highlight), '历史初始化不应高亮');
const next = {...state, tools:[{id:'new-call', name:'exec',state:'running'}],seq:5};
bridge.update(next);
assert.equal(bridge.live.panels.find(panel=>panel.title==='工具').highlight,true);
bridge.update(next, true);
assert.ok(bridge.live.panels.every(panel=>!panel.highlight), '恢复或切换不应闪烁旧事件');
console.log('通过：新事件高亮、历史初始化及恢复保护');
