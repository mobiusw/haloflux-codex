const a=require('node:assert/strict'),{readSkills,declaredSkills}=require('./skills.cjs'),{createState,parseLine}=require('./parser.cjs');
a.deepEqual(readSkills("Get-Content 'C:\\Users\\x\\.codex\\skills\\diagram-design\\SKILL.md'"),['diagram-design']);
a.deepEqual(readSkills("echo 'skills/foo/SKILL.md'"),[]);
a.deepEqual(declaredSkills('我会使用 Impeccable 技能整理布局。'),['impeccable']);
a.deepEqual(declaredSkills('我会使用 `example-skill` 检查项目。'),['example-skill']);
a.deepEqual(declaredSkills('你可以使用 diagram-design 技能。'),[]);
a.deepEqual(declaredSkills('我之前没有使用 diagram-design 技能。'),[]);
const s=createState('test');const j={type:'event_msg',timestamp:'now',payload:{type:'item_completed',item:{id:'read1',command:'cat skills/foo/SKILL.md',exit_code:0}}};parseLine(s,JSON.stringify(j));parseLine(s,JSON.stringify(j));a.equal(s.skills.length,1);j.payload.item.id='read2';j.payload.item.exit_code=1;parseLine(s,JSON.stringify(j));a.equal(s.skills.length,1);console.log('PASS skill paths, declarations, negative examples, failed reads, deduplication');
