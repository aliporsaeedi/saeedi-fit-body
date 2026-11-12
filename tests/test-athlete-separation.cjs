const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const s=fs.readFileSync('AppJs.html','utf8');new vm.Script(s.replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, ''));
const render=s.slice(s.indexOf('function render() {'),s.indexOf('function render() {')+6500);
assert(!render.includes("tabs.push(['coach'"));assert(!render.includes('sf7EnsureAdmUsers();'));assert(!render.includes('sf7CoachShell();'));
assert(render.includes("state.tab='home'"));assert(!s.includes("tiles.unshift(['coach', 'trophy', 'کنسول مربی'])"));
const index=fs.readFileSync('Index.html','utf8');for(const [i,m] of [...index.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].entries())new vm.Script(m[1].replace(/<\?[\s\S]*?\?>/g,'null'),{filename:'Index-'+i});
assert(index.includes("!t ? ' تکمیل پروفایل'"));assert(index.includes("t && !rest && tot ?"));
console.log('PASS: athlete routes exclude management, no background user-list fetch, empty home has profile action and no fake duration; all client scripts parse.');
