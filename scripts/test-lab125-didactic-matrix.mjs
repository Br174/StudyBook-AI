// LAB125: 35 targeted didactic regressions from the 44-page original text.
// No real Gemini requests are made by this test.
import assert from 'node:assert/strict';
import {auditExplainedPageV122} from '../src/lib/explainedPolicyV122.js';
import {auditCriticalRelationsV125} from '../src/lib/fidelityEngine.js';
let checks=0;
function review(source,text,glossary=[],lines=3) {
 return auditExplainedPageV122({id:'p1',sourceLineCount:lines,
  segments:[{id:'p1-s0',source}]},{id:'p1',
  segments:[{id:'p1-s0',text}],glossary});
}
function check(label,passes){assert.ok(passes,'Failure: '+label);checks++;}
function hasIssue(reviewResult,code){
 return reviewResult.issues.some(x=>x===code||x.startsWith(code+':'));
}
function negative(label,source,text,code,glossary=[]){
 const result=review(source,text,glossary);
 check(label,hasIssue(result,code));
}
function relation(label,source,text,code){
 check(label,auditCriticalRelationsV125(source,text).issues.includes(code));
}
function good(label,source,text){
 const result=review(source,text);
 check(label,result.ready===true);
}
function copy(label,source){
 negative(label,source,source,'V125_SHORT_PAGE_NOT_SIMPLIFIED');
}
good('01 faithful paraphrase','La teoria generale del diritto analizza gli aspetti comuni tra ordinamenti giuridici.','Studia ciò che le regole di sistemi diversi hanno in comune.');
good('02 faithful synonym','L’interpretazione scientifica analizza il significato delle disposizioni.','Gli studiosi spiegano che cosa vogliono dire le norme.');
negative('03 lost negation','La norma non è valida se manca l’autorizzazione.','La norma è valida se manca l’autorizzazione.','V122_PROTECTED_MEANING_MISSING');
negative('04 omitted only if','La norma è valida solo se approvata dall’organo competente.','La norma è valida quando approvata dall’organo competente.','V122_PROTECTED_MEANING_MISSING');
relation('05 may vs must','La sanzione può essere positiva o negativa secondo la funzione svolta.','La sanzione deve essere positiva o negativa secondo la funzione svolta.','V125_PERMISSION_OBLIGATION_CHANGED');
relation('06 Kelsen/Hart swapped','Kelsen presenta la norma fondamentale. Hart presenta la norma di riconoscimento.','Hart presenta la norma fondamentale. Kelsen presenta la norma di riconoscimento.','V125_AUTHOR_THEORY_REVERSED');
relation('07 Catania two aspects','Per Catania la teoria generale considera sia il lato deontico sia quello fenomenologico.','Per Catania la teoria generale considera solo il lato deontico.','V125_DUAL_ASPECT_REDUCED_TO_SINGLE_ASPECT');
check('08 changed law',review('Il criterio gerarchico è richiamato nell’art. 134 Cost.','Il criterio gerarchico è richiamato nell’art. 135 Cost.').issues.some(x=>x.includes('legal-reference')));
check('09 invented article',review('Il principio di validità dipende dall’ordinamento.','Secondo l’art. 999 il principio di validità dipende dall’ordinamento.').issues.some(x=>x.includes('invented-legal-reference')));
negative('10 mandatory technical glossary','La giurisdizione esprime il potere di giudicare secondo l’ordinamento.','La giurisdizione è il potere di giudicare.','V122_LEGAL_GLOSSARY_REQUIRED');
copy('11 short page copied','L’ermeneutica è lo studio dell’interpretazione del diritto.');
relation('12 validity-efficacy inverted','La validità afferisce al dover essere mentre l’efficacia afferisce all’essere.','La validità afferisce all’essere mentre l’efficacia afferisce al dover essere.','V125_VALIDITY_EFFICACY_REVERSED');
relation('13 Hart primary-secondary','Hart definisce primarie le norme che regolano la condotta e secondarie quelle che conferiscono poteri.','Hart definisce secondarie le norme che regolano la condotta e primarie quelle che conferiscono poteri.','V125_PRIMARY_SECONDARY_RELATION_REVERSED');
relation('14 Kelsen sanctions','Kelsen considera primaria la norma sanzionatoria e non quella precettiva.','Kelsen considera primaria la norma precettiva e non quella sanzionatoria.','V125_PRIMARY_SANCTION_RELATION_REVERSED');
relation('15 institution vs norms','La teoria istituzionalistica valorizza l’organizzazione e quella normativistica le norme.','La teoria normativistica valorizza l’organizzazione e quella istituzionalistica le norme.','V125_INSTITUTION_NORM_REVERSED');
relation('16 hierarchy/chronology','Il criterio gerarchico privilegia la legge superiore; quello cronologico la legge posteriore.','Il criterio cronologico privilegia la legge superiore; quello gerarchico la legge posteriore.','V125_HIERARCHY_CHRONOLOGY_REVERSED');
negative('17 necessary not sufficient','L’effettività è necessaria ma non è sufficiente per la validità.','L’effettività è necessaria e sufficiente per la validità.','V122_PROTECTED_MEANING_MISSING');
negative('18 artt plural changed','Gli artt 4 e 8 disp. prel. c.c. disciplinano le fonti.','Gli artt 4 e 9 disp. prel. c.c. disciplinano le fonti.','V125_PLURAL_LEGAL_REFERENCE_CHANGED');
check('19 singular article',review('L’art. 15 delle disposizioni preliminari definisce l’abrogazione.','L’art. 16 delle disposizioni preliminari definisce l’abrogazione.').issues.some(x=>x.includes('legal-reference')));
negative('20 invented glossary definition','La norma fondamentale è presupposta dal giurista e non viene posta dal legislatore.','La **(norma fondamentale)** è presupposta dal giurista e non viene posta dal legislatore.','V125_GLOSSARY_FOUNDATIONAL_NORM_CONTRADICTION',[{term:'norma fondamentale',definition:'È una legge ordinaria approvata dal Parlamento.'}]);
good('21 correct everyday explanation','La teoria giuridica esamina le regole che guidano i comportamenti.','La teoria del diritto studia le regole che orientano le persone.');
negative('22 recognition norm without glossary','La norma di riconoscimento identifica quali norme appartengono all’ordinamento.','La norma di riconoscimento indica quali regole appartengono al sistema.','V122_LEGAL_GLOSSARY_REQUIRED');
good('23 simple scientific explanation','L’interpretazione scientifica attribuisce significato alle disposizioni.','Gli studiosi spiegano il significato delle regole.');
good('24 correct permission to prohibition','La legge non permette di fumare durante la lezione.','La legge vieta di fumare durante la lezione.');
negative('25 salvo removed','Il ricorso è ammesso salvo che la legge preveda un divieto.','Il ricorso è ammesso in ogni caso.','V122_PROTECTED_MEANING_MISSING');
relation('26 may-must repeat','Il diritto può prevedere sanzioni positive e negative.','Il diritto deve prevedere sanzioni positive e negative.','V125_PERMISSION_OBLIGATION_CHANGED');
relation('27 original p9 Kelsen','Kelsen ha considerato primaria la norma sanzionatoria e non quella precettiva.','Kelsen ha considerato primaria la norma precettiva e non quella sanzionatoria.','V125_PRIMARY_SANCTION_RELATION_REVERSED');
relation('28 original p26 validity','La validità afferisce al dover essere e l’efficacia afferisce all’essere.','La validità afferisce all’essere e l’efficacia afferisce al dover essere.','V125_VALIDITY_EFFICACY_REVERSED');
relation('29 original p35 Hart','Hart definisce primarie le norme che regolano la condotta e secondarie quelle che conferiscono poteri.','Hart definisce secondarie le norme che regolano la condotta e primarie quelle che conferiscono poteri.','V125_PRIMARY_SECONDARY_RELATION_REVERSED');
relation('30 original p43 multiple references','Agli artt 4 e 8 disp. prel. c.c. le leggi prevalgono sui regolamenti.','Agli artt 4 e 9 disp. prel. c.c. le leggi prevalgono sui regolamenti.','V125_PLURAL_LEGAL_REFERENCE_CHANGED');
const p44='L’ermeneutica degli operatori giuridici, ma soprattutto dei consociati che individuano il diritto e lo riconoscono come valido conformando i loro comportamenti ad esso. Qui nasce e muore la teoria generale del diritto.';
copy('31 original p44 copied',p44);
relation('32 Kelsen changed within band','Kelsen considera primaria la norma sanzionatoria e non quella precettiva.','Kelsen considera primaria la norma precettiva e non quella sanzionatoria.','V125_PRIMARY_SANCTION_RELATION_REVERSED');
relation('33 validity changed within band','La validità afferisce al dover essere e l’efficacia afferisce all’essere.','La validità afferisce all’essere e l’efficacia afferisce al dover essere.','V125_VALIDITY_EFFICACY_REVERSED');
const hOriginal='Hart definisce primarie le norme che regolano la condotta e secondarie quelle che conferiscono poteri pubblici o privati, favorendo l’integrazione e la convivenza sociale.';
const hWrong='Per Hart le norme secondarie regolano la condotta; le primarie conferiscono poteri pubblici e privati.';
const hReview=review(hOriginal,hWrong,[],8);
check('34 Hart reversed with compliant 40-60%',hReview.exactReduction>=40&&hReview.exactReduction<=60&&hReview.issues.includes('V125_PRIMARY_SECONDARY_RELATION_REVERSED'));
good('35 original p44 simplified',p44,'Il diritto viene interpretato sia dai professionisti sia, soprattutto, dai cittadini. Questi riconoscono le regole come valide e le seguono. Da qui comincia e qui finisce la teoria generale del diritto.');
console.log(JSON.stringify({suite:'LAB125_35_DIDACTIC_REGRESSIONS',checks,passed:true,geminiCalls:0}));
