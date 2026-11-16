// LAB140: single-pass glossary and closer 50% target; new opt-in route.
// LAB139 and earlier Worker contracts remain available for installed APKs.
import explainedV126Handler from './explainedV126.js';
export const EXPLAINED_GLOSSARY_CONTRACT_V140='lab140-glossary-one-pass-precision-v1';
export default function explainedV140Handler(req,res){
 res.setHeader('X-StudyBook-Glossary-Contract',EXPLAINED_GLOSSARY_CONTRACT_V140);
 return explainedV126Handler({...req,fastLengthV139:true,focusedGlossaryV140:true},res);
}
