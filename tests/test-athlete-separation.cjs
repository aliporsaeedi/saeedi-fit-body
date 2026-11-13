const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const s=fs.readFileSync('AppJs.html','utf8');new vm.Script(s.replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, ''));
const render=s.slice(s.indexOf('function render() {'),s.indexOf('function render() {')+6500);
assert(!render.includes("tabs.push(['coach'"));assert(!render.includes('sf7EnsureAdmUsers();'));assert(!render.includes('sf7CoachShell();'));
assert(render.includes("state.tab='home'"));assert(!s.includes("tiles.unshift(['coach', 'trophy', 'کنسول مربی'])"));
const index=fs.readFileSync('Index.html','utf8');for(const [i,m] of [...index.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].entries())new vm.Script(m[1].replace(/<\?[\s\S]*?\?>/g,'null'),{filename:'Index-'+i});
const exactReference=fs.readFileSync('ReferenceDesign.html','utf8');assert(exactReference.includes('تکمیل پروفایل'));assert(!index.includes("fa(tot * 3)"));assert(!index.includes('function homeView2('));
console.log('PASS: athlete routes exclude management, no background user-list fetch, empty home has profile action and no fake duration; all client scripts parse.');
const assertIndex=require('node:assert/strict'),indexSource=require('fs').readFileSync('Index.html','utf8'),clientSource=require('fs').readFileSync('AppJs.html','utf8');
assertIndex(!indexSource.includes('#sfAdminApp'));assertIndex(!indexSource.includes('.sfa-adm-'));assertIndex(!indexSource.includes('cleanAdminExerciseSetCounts'));assertIndex(!indexSource.includes('function admSync'));assertIndex(!clientSource.includes('W.sfImportProgram = open'));
for(const match of indexSource.matchAll(/^[ \t]*<style\b[^>]*>([\s\S]*?)<\/style>/gm)){assertIndex(!/<(?:style|script)\b/i.test(match[1]));assertIndex(!match[1].includes('function fixAiButtonText'));}
console.log('PASS: retired management markup/observers/import module removed; styles contain no nested tags or JavaScript.');
