// Project only bounded, recognized facts; never publish raw command output.
function resultSummary(output, action = '') {
 const texts = [], codes = [];
 let toolFailed=false;
 function visit(value, depth = 0) {
  if (depth > 8 || value == null) return;
  if (typeof value === 'string') {
   try { visit(JSON.parse(value), depth + 1); } catch { texts.push(value); }
  } else if (Array.isArray(value)) value.forEach(item => visit(item, depth + 1));
  else if (typeof value === 'object') {
   if (Number.isInteger(value.exit_code)) codes.push(value.exit_code);
   if (value.isError === true || value.status === 'failed' || value.status === 'error' || value.error) toolFailed=true;
   for (const key of ['output','content','text','stdout','stderr']) if (value[key] != null) visit(value[key], depth + 1);
  }
 }
 visit(output);
 const text = texts.join('\n');
 for (const match of text.matchAll(/^(?:Process exited with code|Process exit code:)\s*(-?\d+)\s*$/gm)) codes.push(Number(match[1]));
 const failed = toolFailed || codes.some(code => code !== 0);
 const state = failed ? 'error' : codes.length ? 'ok' : 'returned';
 let result = failed ? codes.some(code=>code!==0) ? '进程失败 · 退出码 ' + codes.find(code => code !== 0) : '工具明确失败' : state === 'ok' ? '进程退出码 0' : '结果未确认';
 if (/测试|Notebook/.test(action)) {
  const unittest = text.match(/Ran (\d+) tests? in [\d.]+s[\s\S]*?\n(OK(?: \([^\n]*\))?|FAILED \([^\n]*\))/);
  const pytest = text.match(/(?:^|\n)[= ]*((?:\d+ (?:passed|failed|skipped|error[s]?)(?:, )?)+) in [\d.]+s/m);
  if (unittest) result = unittest[2].startsWith('OK') ? unittest[1] + (/skipped=(\d+)/.test(unittest[2]) ? ' 项测试结束（含跳过项）' : ' 项测试通过') : unittest[1] + ' 项测试 · 存在失败';
  else if (pytest) result = pytest[1].replace(/passed/g,'通过').replace(/failed/g,'失败').replace(/skipped/g,'跳过').replace(/errors?/g,'错误');
 }
 return {state, result};
}
module.exports = {resultSummary};
