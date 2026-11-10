// LAB116 local-only: real fixture + 44/2000 synthetic pages.
// A PASS is never proof of automatic semantic accuracy; no Gemini calls.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {studyLetters} from '../src/lib/studyPillarV38.js';
import {STUDY_LEVELS_V67} from '../src/lib/studyRebalancePolicyV67.js';
import {prepareSourceTiersV116,composeSourceTiersV116,
 sourceTierInstructionV116,sourceTierUserV116} from '../src/lib/studySourceTiersV116.js';
const suite=JSON.parse(readFileSync('audit/test-fixtures/lab109-worker-source.json','utf8'));
let assertions=0;
const ok=(x,m)=>{assert.ok(x,m);assertions++};
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);assertions++};
// Manually written examples, NOT model output, not semantic certification.
// One unit/page with 12 statements. Each variant retains the same claim.
const sentences=[
 ['La norma scolastica prevede una richiesta scritta per ottenere il materiale.',
  'La norma richiede una richiesta scritta per il materiale.',
  'La richiesta scritta è necessaria.'],
 ['Il registro elenca i volumi disponibili e informa gli studenti delle possibilità di prestito.',
  'Il registro elenca i volumi disponibili e i prestiti.',
  'Il registro indica i prestiti.'],
 ['Il personale valuta le richieste e risponde secondo le procedure comunicate in precedenza.',
  'Il personale valuta le richieste secondo la procedura.',
  'Il personale valuta le richieste.'],
 ['Una richiesta completa contiene il titolo e i dati necessari a identificare il libro.',
  'La richiesta indica titolo e dati identificativi del libro.',
  'Servono titolo e dati del libro.'],
 ['Un esempio descrive il procedimento senza introdurre una regola nuova.',
  'L’esempio illustra il procedimento senza nuove regole.',
  'L’esempio non crea regole.'],
 ['La disponibilità dei libri può variare nel corso della giornata e dipende dalle restituzioni.',
  'La disponibilità varia e dipende dalle restituzioni.',
  'Le restituzioni cambiano la disponibilità.'],
 ['La prima registrazione rende possibile riconoscere la data in cui comincia il prestito.',
  'La registrazione indica la data iniziale del prestito.',
  'La registrazione segna l’inizio.'],
 ['Una spiegazione accessoria ripete che il titolo va indicato prima di chiedere il prestito.',
  'La spiegazione ricorda di indicare il titolo prima del prestito.',
  'Il titolo precede la richiesta.'],
 ['Il lettore può consultare il regolamento prima di prendere una decisione.',
  'Il lettore può leggere il regolamento prima della decisione.',
  'Il regolamento si può consultare.'],
 ['Le eccezioni devono essere considerate separatamente, perché modificano l’applicazione della regola.',
  'Le eccezioni modificano come si applica la regola.',
  'Le eccezioni cambiano la regola.'],
 ['Un riepilogo finale ricorda il percorso delle domande e delle risposte.',
  'Il riepilogo ricorda domande e risposte.',
  'Riepilogo di domande e risposte.'],
 ['Il testo insiste sul fatto che tutte le informazioni devono provenire dalla procedura originaria.',
  'Le informazioni devono derivare dalla procedura originaria.',
  'Solo informazioni della procedura originaria.']
];
function controlled(pages){
 return Array.from({length:pages},(_,i)=>({
  id:'0:'+i,pageStart:i+1,pageEnd:i+1,
  source:sentences.map(s=>s[0]).join(' ')
 }));
}
function manualReply(plan){
 return {units:plan.units.map(u=>({id:u.id,variants:u.segments.map((s,i)=>{
  const line=sentences[i%sentences.length];
  return {compact:line[1],brief:line[2],importance:i%5,essential:i%3===0};
 })}))};
}
const small=prepareSourceTiersV116(controlled(44));
const prompt=sourceTierInstructionV116(small),json=sourceTierUserV116(small);
ok(prompt.includes('Non scrivere sei versioni'));eq(json.units.length,44);
let result=composeSourceTiersV116(small,manualReply(small));
eq(Object.keys(result.partsByLevel),STUDY_LEVELS_V67);
const reports=STUDY_LEVELS_V67.map(level=>{
 const r=result.quality[level];
 eq(r.totalGroups,44);
 eq(result.partsByLevel[level].length,44);
 ok(result.partsByLevel[level].every(p=>p.text.trim()!==''),'No empty pages');
 ok(r.semanticCertified===false,'No false semantic proof');
 return {level,percent:r.achievedReduction,passingPages:r.compliantGroups,
  total:44,allNumeric:r.allNumeric,allRows:r.allRows};
});
// Explicit hard rejection: do not corrupt real dates, negations or articles.
const source=suite.sources.find(s=>s.id==='procedura').text;
const p=prepareSourceTiersV116([{id:'x',pageStart:1,pageEnd:1,source}]);
const edited={units:[{id:'x',variants:p.units[0].segments.map((s,i)=>({
 compact:i===0?'La biblioteca simulata nel 2023 usa una procedura.':s.original,
 brief:i===0?'La biblioteca simulata del 2023.':s.original,
 importance:5,essential:true}))}]};
const guarded=composeSourceTiersV116(p,edited,['10']);
eq(guarded.partsByLevel['10'][0].text,p.units[0].source,
 'Invented date must not replace original protected fact');
// Always mark impossible targets; never force filler or broken words.
const single=prepareSourceTiersV116([{id:'only',source:'Una sola frase breve con un fatto irriducibile.',
 pageStart:1,pageEnd:1}]);
const same={units:[{id:'only',variants:[{compact:single.units[0].segments[0].original,
 brief:single.units[0].segments[0].original,importance:5,essential:true}]}]};
const imposs=composeSourceTiersV116(single,same);
ok(!imposs.quality.summary.allNumeric,'Do not fake mathematical compliance');
const start=performance.now();
// 2000 source pages are processed in moderate naturally bounded blocks:
// they cannot be submitted as one oversized request to the provider.
let maxElapsed=0,perPage=[];
for(let i=0;i<20;i++){
 const unit=controlled(100).map((u,index)=>({...u,
  id:i+':'+index,pageStart:100*i+index+1,pageEnd:100*i+index+1}));
 const plan=prepareSourceTiersV116(unit);
 const from=performance.now();
 const out=composeSourceTiersV116(plan,manualReply(plan));
 maxElapsed=Math.max(maxElapsed,performance.now()-from);
 perPage.push(out.quality['10'].totalGroups);
}
const elapsed=Math.round(performance.now()-start);
eq(perPage.reduce((a,b)=>a+b,0),2000);
console.log(JSON.stringify({lab:'LAB116',assertions,pages:2000,
 modelCalls:0,freeTierCalls:0,synthetic44:reports,
 performance2000PagesMs:elapsed,max100PageBlockMs:Math.round(maxElapsed),
 semanticCertified:false,apkReady:false},null,2));
