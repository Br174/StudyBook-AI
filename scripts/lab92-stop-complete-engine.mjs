// StudyBook AI / MotorLab LAB92 - shared geometric and semantic-budget math.
// Purely deterministic; no model calls, no production app modification.
export const WIDTH=60;
export const AVG={letters:46.346,naturalSpaces:7.844,justifySpaces:3.658,punctuation:1.966,digits:0.186};
export const LEVELS=[10,20,30,40,50,65];
export const sum=a=>a.reduce((x,y)=>x+y,0);
export const letters=s=>(String(s||'').normalize('NFC').match(/\p{L}/gu)||[]).length;
export const spaceNorm=s=>String(s||'').normalize('NFC').replace(/\s+/gu,' ').trim();
export function largest(total,weights){
 if(!Number.isInteger(total)||total<0||!weights.length||weights.some(w=>!Number.isFinite(w)||w<0))throw Error('invalid apportionment input');
 const all=sum(weights);const scale=(all?weights.map(w=>w/all):weights.map(()=>1/weights.length)).map(p=>p*total);
 const out=scale.map(Math.floor),rest=total-sum(out);
 const order=scale.map((val,i)=>({i,d:val-out[i]})).sort((a,b)=>b.d-a.d||a.i-b.i);
 for(let k=0;k<rest;k++)out[order[k].i]++;
 if(sum(out)!==total)throw Error('apportionment sum');
 return out;
}
export function wrap(input,width=WIDTH){
 const items=spaceNorm(input).split(' ').filter(Boolean);let line='',overlong=false;
 const lines=[];
 for(const word of items){
  if([...word].length>width)overlong=true;
  const n=line?line+' '+word:word;
  if([...n].length>width&&line){lines.push(line);line=word}else line=n;
 }
 if(line)lines.push(line);
 return{lines,overlong};
}
export function budget(source,level){
 if(!LEVELS.includes(level))throw Error('bad level');
 const src=source.concepts.map(spaceNorm),sourceLetterCounts=src.map(letters);
 const sourceText=src.join(' '),originalLetters=sum(sourceLetterCounts);
 const originalRows=wrap(sourceText).lines.length;
 const short=originalRows<=5;
 const target=Math.round(originalLetters*(1-level/100));
 const low=Math.ceil(originalLetters*(1-(level+5)/100));
 const high=Math.floor(originalLetters*(1-(level-5)/100));
 const theoreticalTargetRows=target/AVG.letters;
 const expectedTextChars=target*(AVG.letters+AVG.naturalSpaces+AVG.punctuation+AVG.digits)/AVG.letters;
 const targetCap=short?5:Math.ceil(theoreticalTargetRows);
 const toleranceCap=short?5:Math.ceil(high/AVG.letters);
 const weights=sourceLetterCounts.map((l,i)=>l*(source.importance?.[i]||1));
 const allocations=largest(target,weights);
 if(sum(allocations)!==target)throw Error('allocations');
 return{
  source:source.id,level,originalLetters,originalRows,short,
  targetLetters:target,band:{low,high},
  lineEquivalents:+theoreticalTargetRows.toFixed(3),
  targetCap,toleranceCap,
  expectedNaturalChars:Math.round(expectedTextChars),
  goalPerConcept:allocations.map((n,i)=>({id:'C'+(i+1),sourceLetters:sourceLetterCounts[i],softTargetLetters:n,importance:source.importance?.[i]||1,
     requiredFacts:source.keyPoints?.[i]||[],text:src[i]})),
  maxWidth:WIDTH
 };
}
export function evaluate(source,plan,sections){
 const valid=Array.isArray(sections)&&sections.length===source.concepts.length&&sections.every((v,i)=>v?.id==='C'+(i+1)&&typeof v.text==='string'&&v.text.trim());
 if(!valid)return{valid:false,error:'wrong section count or identity'};
 const sourceSections=sections.map(x=>spaceNorm(x.text));
 const text=sourceSections.join(' '),n=letters(text),layout=wrap(text);
 const last=layout.lines.at(-1)||'';
 const lastLength=[...last].length;
 const maxRowWidth=Math.max(0,...layout.lines.map(x=>[...x].length));
 const percent=+((1-n/plan.originalLetters)*100).toFixed(2);
 const strictBand=plan.short||(n>=plan.band.low&&n<=plan.band.high);
 const missingLetters=Math.max(0,plan.band.low-n);
 // A small deficit is only a "reviewable exception", NEVER an automatic acceptance.
 const smallShortfall= !plan.short && n<plan.band.low&&missingLetters<=Math.ceil(AVG.letters);
 const pageFitsTarget=layout.lines.length<=plan.targetCap&&!layout.overlong;
 const pageFitsTolerance=layout.lines.length<=plan.toleranceCap&&!layout.overlong;
 const suspiciousSpacing=/ {2,}/.test(sections.map(x=>x.text).join(' '));
 const hyphenSplit=/\p{L}-\s*[\r\n]\s*\p{L}/u.test(sections.map(x=>x.text).join('\n'));
 const malformed=/(?:\b(?:dall|all|l|un)\s+(?:asse|inclinazione|aria|altra)\b)|\b(?:Mareee|di e la notte)\b/iu.test(text);
 const technicalMissing=plan.level<=20?(source.flags||[]).filter(t=>!text.toLocaleLowerCase('it').includes(t.toLocaleLowerCase('it'))):[];
 const regexRubric={
  scienze:[/rotaz|ruot/i,/giorno/i,/notte/i,/rivoluz/i,/stagion/i,/inclin/i,/distanza/i,/maree/i,/luna/i,/sole/i,/ecliss/i,/alline/i,/lunaz|ogni/i,/ipotes/i,/verific/i,/ripet/i,/caus/i],
  procedura:[/2024|duemilaventiquattro/i,/12|dodici/i,/titolo/i,/dieci|10/i,/prorog/i,/prenot|riserv/i,/scritt/i,/scaden|data iniziale/i,/lettur|letto|finito|complet/i,/registr/i,/opinioni/i],
  medicina:[/diaframma/i,/inspir/i,/espir/i,/alveol/i,/ossigeno/i,/anidride carbonica/i,/emoglobin/i,/sforzo/i,/diagnos|medic/i,/sintom/i],
  concetto_sbilanciato:[/font/i,/confront/i,/document/i,/primaria/i,/secondaria/i,/ipotes/i,/fatt/i],
  pagina_breve_continua:[/termine perentorio/i,/15|quindici/i,/notifica/i,/deposit/i,/motivaz/i]
 }[source.id]||[];
 const missingRubric=regexRubric.filter(r=>!r.test(text)).map(String);
 return{valid:true,letters:n,sourceLetters:plan.originalLetters,targetLetters:plan.targetLetters,
  reduction:percent,deviationPoints:+(percent-plan.level).toFixed(2),strictBand,smallShortfall,missingLetters,
  rows:layout.lines.length,targetCap:plan.targetCap,toleranceCap:plan.toleranceCap,
  fitsTarget:pageFitsTarget,fitsTolerance:pageFitsTolerance,
  strictCombined:strictBand&&pageFitsTarget,
  toleranceCombined:strictBand&&pageFitsTolerance,
  lastRowUsed:lastLength,usedFractionalRows:+(layout.lines.length-1+lastLength/WIDTH).toFixed(3),
  maxRowWidth,wordIntegrity:!hyphenSplit&&!malformed,spuriousMultipleSpaces:suspiciousSpacing,
  technicalMissing,missingRubric,possibleSemanticPass:missingRubric.length===0&&technicalMissing.length===0&&!hyphenSplit&&!malformed,
  rawText:text,sections:sourceSections,virtualRows:layout.lines};
}
