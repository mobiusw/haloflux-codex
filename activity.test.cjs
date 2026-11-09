const assert = require('node:assert/strict');
const {actionSummary} = require('./actions.cjs');
const {createState, parseLine, snapshot} = require('./parser.cjs');
const {CodexHaloBridge} = require('./bridge.js');
assert.deepEqual(actionSummary({name:'exec',input:'text(await tools.exec_command({cmd:"node panels.test.cjs"}))'}),{action:'运行测试',target:'panels.test.cjs'});
assert.deepEqual(actionSummary({name:'exec',arguments:JSON.stringify({cmd:'Get-Content -Raw C:/project/readme.md'})}),{action:'读取文件',target:'readme.md'});
assert.equal(actionSummary({name:'js',arguments:JSON.stringify({code:'await tab.getScreenshot()'})}).action,'查看截图');
assert.equal(actionSummary({name:'exec',arguments:JSON.stringify({cmd:'echo password=secret'})}).target,'');
const state=createState('timing');
const notebook = '示例数据 - Notebook.ipynb';
const inlineCommand = `& 'C:/Program Files/Python/python.exe' -B -c "exec(code)" 'C:/example/${notebook}'`;
assert.deepEqual(actionSummary({input:`text(await tools.exec_command({cmd:${JSON.stringify(inlineCommand)}}))`}), {action:'运行 Notebook',target:notebook});
assert.equal(actionSummary({arguments:{cmd:inlineCommand.replace('exec(code)', 'print(1)')}}).action,'运行命令');
for (const [cmd,target] of [
 ['python -m unittest tests.test_legacy -v','tests.test_legacy'],
 ['py -3 -m unittest -v tests.test_legacy','tests.test_legacy'],
 ['& "C:/Program Files/Python/python.exe" -m pytest tests/test_model.py -q','test_model.py'],
 ['pytest tests/test_model.py -q','test_model.py'],
 ['python -m unittest discover -s tests -p test_*.py','test_*.py']
]) assert.deepEqual(actionSummary({arguments:JSON.stringify({cmd})}), {action:'运行 Python 测试',target});
function send(payload, seconds) {
 parseLine(state,JSON.stringify({type:'response_item',timestamp:new Date(1800000000000+seconds*1000).toISOString(),payload}));
}
send({type:'function_call',call_id:'test',name:'exec',arguments:JSON.stringify({cmd:'node panels.test.cjs'})},0);
send({type:'function_call_output',call_id:'test',output:JSON.stringify({exit_code:0})},2.5);
assert.equal(state.tools[0].endedAt-state.tools[0].startedAt,2500);
assert.equal(state.events[0].text,'运行测试 · panels.test.cjs · 开始');
assert.equal(state.events[1].text,'运行测试 · panels.test.cjs · 进程退出码 0');
const bridge=new CodexHaloBridge();
bridge.update(snapshot(state));
assert.equal(bridge.live.timeline[0].seconds,2.5);
assert.equal(bridge.live.recentActions[0].target,'panels.test.cjs');
bridge.update(snapshot(state));
assert.equal(bridge.live.timeline[0].seconds,2.5,'完成后的耗时应固定');
assert.ok(!JSON.stringify(snapshot(state)).includes('arguments'));
console.log('通过：操作目标、命令隐私、开始/结束时间、2.5 秒耗时与重复读取稳定性');
