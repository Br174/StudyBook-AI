// MotorLab StudyBook LAB98 offline semantic risk and baseline replay.
// No provider calls; adversarial mutation demonstrates exactly what the guard can catch.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {FIXTURES} from './lab93-semantic-gate.mjs';
import {semanticGuard} from './lab98-modal-semantic-guard.mjs';
import {evaluateLean} from './lab96-eval.mjs';
const lab97=JSON.parse(readFileSync('audit/reports/lab97-level-specific-real.json','utf8'));
const lab96=JSON.parse(readFileSync('audit/reports/lab96-source-only-real-gemini.json','utf8'));
const gold=JSON.parse(readFileSync('audit/test-fixtures/lab94-golden-20-percent-manual.json','utf8')).samples;
const mutate=[
 ['scienze','not avvengono','non avvengono a ogni lunazione','avvengono a ogni lunazione','eclipses_not_every_lunation'],
 ['scienze','distance not','non dalla distanza','dalla distanza','seasons_not_distance'],
 ['scienze','isolated result insufficient','Un risultato isolato non basta','Un risultato isolato basta','single_result_insufficient'],
 ['medicina','modality','può aumentare','sale','possible_increase_not_certainty'],
 ['medicina','partial pressure','pressione parziale','pressione','pressure_is_partial'],
 ['medicina','single diagnostic measure','non basta sempre','basta sempre','single_value_not_always_sufficient'],
 ['procedura','internal library rule','regola interna numero 12','norma 12','internal_rule_not_generic_norm'],
 ['procedura','extension not automatic','proroga non è automatica','proroga è automatica','extension_not_automatic'],
 ['procedura','confirmation','senza conferma scritta resta valida la data iniziale','le date cambiano senza alcuna conferma','written_confirmation_initial_deadline'],
 ['concetto_sbilanciato','documented not proven','fatti documentati','fatti dimostrati','documented_not_proven'],
 ['concetto_sbilanciato','fact opinion',"distinguere un fatto da un'opinione",'non distinguere informazioni','fact_vs_opinion'],
 ['concetto_sbilanciato','uncertainty','segnalare ciò che resta incerto','segnalare i dettagli','source_uncertainty'],
 ['pagina_breve_continua','peremptory','termine perentorio','termine indicativo','peremptory_term'],
 ['pagina_breve_continua','motivation right','resta però il diritto di conoscere la motivazione','è abolito il diritto di conoscere la motivazione','right_to_motivation_remains']
];
const issues=[],originals=[],benchmarks=[];
for(const src of FIXTURES){
 const original=src.concepts.join(' ');
 const check=semanticGuard(src.id,original,original,{level:10});
 originals.push({source:src.id,totalApplicable:check.totalApplicable,alerts:check.alerts.map(x=>x.id)});
 if(check.alerts.length)issues.push({source:src.id,reason:'original incorrectly flagged',ids:check.alerts.map(x=>x.id)});
}
for(const sample of gold){
 const source=FIXTURES.find(s=>s.id===sample.id),g=semanticGuard(sample.id,source.concepts.join(' '),sample.sections.map(x=>x.text).join(' '),{level:20});
 benchmarks.push({source:sample.id,kind:'MANUAL_NOT_GEMINI',totalApplicable:g.totalApplicable,alerts:g.alerts.map(x=>x.id)});
}
const past=[
 ...lab97.results.filter(x=>x.valid).map(x=>({lab:'LAB97',source:x.source,level:x.level,text:x.metrics.text,baselinePercent:x.metrics.reduction})),
 ...lab96.cases.filter(x=>x.valid).map(x=>({lab:'LAB96',source:x.source,level:x.level,text:x.metrics.text,baselinePercent:x.metrics.reduction}))
];
for(const item of past){
 const source=FIXTURES.find(s=>s.id===item.source);
 const s=semanticGuard(source.id,source.concepts.join(' '),item.text,{level:item.level});
 const e=evaluateLean(source,item.level,item.text);
 if(e.reduction!==item.baselinePercent)issues.push({source:source.id,lab:item.lab,reason:'percentage regression'});
 benchmarks.push({source:item.source,level:item.level,lab:item.lab,percent:e.reduction,strictCombined:e.completeMathPass,
  alerts:s.alerts.map(x=>x.id),orthography:s.orthography,semanticCertified:false});
}
const requiredSpecific=[
 ['scienze','eclipses_not_every_lunation'],
 ['medicina','possible_increase_not_certainty'],
 ['procedura','internal_rule_not_generic_norm'],
 ['concetto_sbilanciato','documented_not_proven']
];
for(const [id,risk] of requiredSpecific){
 const example=benchmarks.find(x=>x.lab==='LAB97'&&x.source===id&&x.level===10);
 if(!example?.alerts.includes(risk))issues.push({source:id,reason:'historical semantic regression not caught',risk,flags:example?.alerts});
}
let seed=983174,stress=0,detected=0;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(let n=0;n<16000;n++){
 const [source,name,from,to,expected]=mutate[Math.floor(random()*mutate.length)];
 const src=FIXTURES.find(s=>s.id===source),original=src.concepts.join(' ');
 if(!original.includes(from)){
  issues.push({n,source,name,reason:'mutation source text not found',from});break;
 }
 const modified=original.replace(from,to);
 const result=semanticGuard(source,original,modified,{level:10});
 stress++;
 if(result.alerts.some(x=>x.id===expected))detected++;
 else issues.push({n,source,name,reason:'missed forced semantic mutation',expected,found:result.alerts.map(x=>x.id)});
 if(issues.length>4)break;
}
const summary={originalSources:originals.length,
 originalFalseAlerts:originals.reduce((n,x)=>n+x.alerts.length,0),
 historicalReplays:past.length,
 manualExamples:gold.length,
 historicalLAB97CriticalRisksCaught:requiredSpecific.filter(([id,risk])=>benchmarks.some(x=>x.lab==='LAB97'&&x.source===id&&x.level===10&&x.alerts.includes(risk))).length,
 seededMutations:stress,mutationsDetected:detected,failures:issues.length};
const report={study:'LAB98 semantic source guard offline',date:new Date().toISOString(),
 limits:'Regex alerts are risk indicators; synonymy may cause false positives, matched words may hide semantic reversal. No automatic factual repair or certification.',
 sourceProtection:'No edits to source text or previous Gemini generations, only deterministic re-evaluation.',
 summary,originals,manualGold:benchmarks.filter(x=>x.kind==='MANUAL_NOT_GEMINI'),pastResults:benchmarks.filter(x=>x.lab),mutationCases:mutate.map(([source,name,from,to,expect])=>({source,name,expect})),issues};
mkdirSync('audit/reports',{recursive:true});writeFileSync('audit/reports/lab98-offline-semantic-guard.json',JSON.stringify(report,null,2)+'\n');
console.log('LAB98_OFFLINE_FINAL',JSON.stringify(summary));
if(issues.length||detected!==stress)process.exitCode=1;
