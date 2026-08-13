import { readFileSync } from 'fs';
const html = readFileSync('public/drive-assets/know-your-car/index.html','utf8');

const secSrc = html.match(/const SECTIONS = (\[[\s\S]*?\n\];)/)[1].replace(/;$/,'');
const qSrc   = html.match(/const QUESTIONS = (\[[\s\S]*?\n\];)/)[1].replace(/;$/,'');
const ARTsrc = html.slice(html.indexOf('const ART = {'), html.indexOf('const VIEWBOX'));
const VB     = html.match(/const VIEWBOX = \{([\s\S]*?)\};/)[1];

const SECTIONS = eval(secSrc);
const QUESTIONS = eval(qSrc);

const vb = {};
VB.split(',').forEach(p=>{ const m=p.match(/(\w+)\s*:\s*'([^']+)'/); if(m) vb[m[1]]=m[2].split(' ').map(Number); });

let fail=0, warn=0;
const bad = (m)=>{ console.log('  [FAIL] '+m); fail++; };
const wrn = (m)=>{ console.log('  [WARN] '+m); warn++; };

const viewOf = (s,p) => p.view || s.diagram;
// the DOT is what the user taps: part position plus its offset
const DX = p => p.x + (p.dx||0);
const DY = p => p.y + (p.dy||0);

console.log('=== 1. HOTSPOTS INSIDE VIEWBOX ===');
let boundsOk = true;
for (const s of SECTIONS) {
  for (const p of s.parts) {
    const key = viewOf(s,p);
    if (!vb[key]) { bad(`${s.id} #${p.n} references unknown view "${key}"`); boundsOk=false; continue; }
    const [X0,Y0,W,H] = vb[key];   // viewBox may have a negative origin
    const PAD = 14;
    const x = DX(p), y = DY(p);
    if (x < X0+PAD || x > X0+W-PAD || y < Y0+PAD || y > Y0+H-PAD) {
      bad(`${s.id} #${p.n} "${p.name}" dot at (${x},${y}) outside ${key} [${X0} ${Y0} ${W} ${H}]`); boundsOk = false;
    }
  }
}
if (boundsOk) console.log('  OK - every hotspot sits inside its own view');

console.log('\n=== 2. HOTSPOT COLLISIONS (within the same view) ===');
const MIN = 21;
let colOk = true;
for (const s of SECTIONS) {
  for (let i=0;i<s.parts.length;i++) for (let j=i+1;j<s.parts.length;j++) {
    const a=s.parts[i],b=s.parts[j];
    if (viewOf(s,a) !== viewOf(s,b)) continue;   // different pictures cannot collide
    const d=Math.hypot(DX(a)-DX(b),DY(a)-DY(b));
    if (d < MIN) { bad(`${s.id}/${viewOf(s,a)}: #${a.n} "${a.name}" / #${b.n} "${b.name}" overlap (${d.toFixed(1)}px)`); colOk=false; }
    else if (d < MIN+7) { wrn(`${s.id}/${viewOf(s,a)}: #${a.n} and #${b.n} tight (${d.toFixed(1)}px)`); colOk=false; }
  }
}
if (colOk) console.log('  OK - no dots overlap or crowd each other');

console.log('\n=== 2b. VIEW COVERAGE ===');
for (const s of SECTIONS) {
  if (!s.views) continue;
  const counts = {};
  s.parts.forEach(p => { const k=viewOf(s,p); counts[k]=(counts[k]||0)+1; });
  s.views.forEach(v => { if (!counts[v.key]) bad(`${s.id}: view "${v.key}" has NO hotspots`); });
  const declared = s.views.map(v=>v.key);
  Object.keys(counts).forEach(k => { if(!declared.includes(k)) bad(`${s.id}: parts point at undeclared view "${k}"`); });
  console.log(`  ${s.id}: ` + s.views.map(v=>`${v.key}=${counts[v.key]||0}`).join(', '));
}

console.log('\n=== 3. NUMBERING + DUPLICATE NAMES ===');
let numOk = true;
for (const s of SECTIONS) {
  const ns = s.parts.map(p=>p.n).sort((a,b)=>a-b);
  const exp = Array.from({length:s.parts.length},(_,i)=>i+1);
  if (JSON.stringify(ns)!==JSON.stringify(exp)) { bad(`${s.id}: numbering not 1..${s.parts.length}`); numOk=false; }
  const names = s.parts.map(p=>p.name.toLowerCase());
  const dups = names.filter((n,i)=>names.indexOf(n)!==i);
  if (dups.length) { bad(`${s.id}: duplicate names ${[...new Set(dups)].join(', ')}`); numOk=false; }
}
if (numOk) console.log('  OK - contiguous 1..N, no duplicate part names');

console.log('\n=== 4. REQUIRED FIELDS + touch values ===');
const OK=['yes','read','care','no'];
let fieldOk = true;
const touchCount = {yes:0,read:0,care:0,no:0};
for (const s of SECTIONS) for (const p of s.parts) {
  if(!p.name||!p.what) { bad(`${s.id} #${p.n} missing name/what`); fieldOk=false; }
  if(!OK.includes(p.touch)) { bad(`${s.id} #${p.n} bad touch "${p.touch}"`); fieldOk=false; }
  else touchCount[p.touch]++;
  if(p.what && p.what.length<40) { wrn(`${s.id} #${p.n} description very short`); fieldOk=false; }
}
if (fieldOk) console.log('  OK - every part has name/what/valid touch');
console.log(`  touch split: operate=${touchCount.yes} read=${touchCount.read} care=${touchCount.care} do-not-touch=${touchCount.no}`);

console.log('\n=== 5. QUIZ INTEGRITY ===');
let qOk = true;
QUESTIONS.forEach((q,i)=>{
  if(q.correct_index<0||q.correct_index>=q.choices.length) { bad(`Q${i+1} correct_index out of range`); qOk=false; }
  if(new Set(q.choices).size!==q.choices.length) { bad(`Q${i+1} duplicate choices`); qOk=false; }
  if(q.choices.length!==4) { wrn(`Q${i+1} has ${q.choices.length} choices`); qOk=false; }
  if(!q.explanation) { bad(`Q${i+1} missing explanation`); qOk=false; }
});
if (qOk) console.log('  OK - all questions well-formed, 4 unique choices, explanation present');
const dist=[0,0,0,0]; QUESTIONS.forEach(q=>dist[q.correct_index]++);
console.log(`  answer positions A/B/C/D = ${dist.join('/')}`);
if (Math.max(...dist) > QUESTIONS.length*0.5) { wrn('answer positions skewed - guessable'); }
else console.log('  OK - no guessable answer-position bias');
const secs=[...new Set(QUESTIONS.map(q=>q.section))];
SECTIONS.forEach(s=>{ if(!secs.includes(s.name)) bad(`no quiz question for "${s.name}"`); });
const perSec = {};
QUESTIONS.forEach(q=>perSec[q.section]=(perSec[q.section]||0)+1);
console.log('  per-section: ' + Object.entries(perSec).map(([k,v])=>`${k}=${v}`).join(', '));

console.log('\n=== 6. ART + VIEWBOX KEYS ===');
let artOk = true;
const artKeys = ARTsrc.split('\n').map(l=>l.trim()).filter(l=>/^[a-zA-Z]+:\s*`/.test(l)).map(l=>l.split(':')[0]);
const needed = new Set();
SECTIONS.forEach(s => (s.views ? s.views.map(v=>v.key) : [s.diagram]).forEach(k=>needed.add(k)));
for (const k of needed) {
  if (!artKeys.includes(k)) { bad(`ART missing key "${k}"`); artOk=false; }
  if (!vb[k]) { bad(`VIEWBOX missing key "${k}"`); artOk=false; }
}
if (artOk) console.log(`  OK - art + viewBox present for all ${needed.size} diagrams: ` + [...needed].join(', '));

console.log('\n=== TOTALS ===');
console.log(`parts: ${SECTIONS.reduce((a,s)=>a+s.parts.length,0)} across ${SECTIONS.length} sections | quiz: ${QUESTIONS.length}`);
SECTIONS.forEach(s=>console.log(`  ${s.name}: ${s.parts.length} parts`));
console.log(`\nFAIL=${fail} WARN=${warn}`);
