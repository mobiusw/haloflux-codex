// Accept the actual argv logged by CommandExecution as well as legacy command strings.
function readSkills(command) {
  let script = command;
  if (Array.isArray(command)) {
    const flag = command.findIndex(arg => /^-(?:command|c)$/i.test(arg));
    script = flag >= 0 ? command[flag + 1] : command.join(' ');
  }
  if (typeof script !== 'string') return [];
  const reads = /(?:^|[;\n])\s*(?:Get-Content|cat|type)\s+(?:(?:-Raw|-LiteralPath|-Path)\s+)*(?:'([^']+)'|"([^"]+)"|([^\s;|]+))/gi;
  const names = new Set();
  for (const match of script.matchAll(reads)) {
    const path = match[1] || match[2] || match[3];
    const skill = path.match(/(?:^|[\\/])skills[\\/]+(?:\.system[\\/]+)?([\w.-]+)[\\/]+SKILL\.md$/i);
    if (skill) names.add(skill[1]);
  }
  return [...names];
}
function declaredSkills(text) {
  if (typeof text !== 'string') return [];
  const names = new Set();
  const aliases = {'impeccable':'impeccable','ui ux pro max':'ui-ux-pro-max','emil-design-eng':'emil-design-eng','emil design engineering':'emil-design-eng','openai docs':'openai-docs'};
  for (const m of text.matchAll(/(?:^|[。\n])\s*(?:现在)?我(?:正在|会|将)?(?:使用|采用|用)\s*`([\w.-]+)`/g)) names.add(m[1].toLowerCase());
  const list = text.replace(/\x60/g, '').match(/(?:^|[。\n])\s*(?:现在)?我(?:正在|会|将)?(?:使用|采用|用)\s*([^，。\n]+)/);
  if (list) {
    let tail = list[1].trim().toLowerCase();
    for (;;) {
      const alias = Object.keys(aliases).find(key => tail.startsWith(key) && !/[a-z0-9_-]/i.test(tail[key.length] || ' '));
      if (!alias) break;
      names.add(aliases[alias]); tail = tail.slice(alias.length).trim();
      const sep = tail.match(/^(?:、|和|及|与)\s*/);
      if (!sep) break;
      tail = tail.slice(sep[0].length);
    }
  }
  for (const m of text.matchAll(/(?:我(?:正在|会|将)?(?:使用|采用)|我正在用)[\s`「“]*([A-Za-z][A-Za-z0-9_-]*(?:[ :][A-Za-z][A-Za-z0-9_-]*)?)[`」”]*(?:\s*技能|\s+skill\b|(?=\s*[，。：]))/gi))
    names.add(aliases[m[1].toLowerCase()] || m[1].toLowerCase());
  return [...names];
}
module.exports = {readSkills,declaredSkills};
