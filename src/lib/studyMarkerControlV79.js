// LAB79 isolated, reproducible FAIR control for LAB78 fixed20 markers.
// Same educational instruction text and same source/target budgets, except
// the one experimental variable: marker output vs unmarked text.
import {markerInstructionV78} from './studyMarkerExperimentsV78.js';
const MARKER_BOUNDARY='\nUsa marcatori esattamente nella forma';
export const FAIR_CONTROL_PROTOCOL_V79='studybook-fixed20-matched-control-v79';
export function matchedControlInstructionV79(sourceLetters,target,min,max){
 const withMarkers=markerInstructionV78('fixed20',sourceLetters,target,min,max,{count:0});
 const boundary=withMarkers.indexOf(MARKER_BOUNDARY);
 if(boundary<0)throw Error('LAB79_CONTROL_ANCHOR_MISSING');
 return withMarkers.slice(0,boundary)+
  '\nScrivi la rielaborazione IN UN SOLO TESTO, senza numeri o marcatori artificiali. Non devi contare esplicitamente. Conserva naturalezza e fedeltà.'+
  '\nRispondi soltanto JSON {parts:[{id,text}]} senza marcatori dentro text.';
}
