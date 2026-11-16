// LAB139 isolated opt-in route. No modification to deployed /v126 or /v138.
import explainedV126Handler from './explainedV126.js';
export const EXPLAINED_FAST_CONTRACT_V139='lab139-length-only-fast-v1';
export default function explainedV139Handler(req,res){
 res.setHeader('X-StudyBook-Fast-Contract',EXPLAINED_FAST_CONTRACT_V139);
 return explainedV126Handler({...req,fastLengthV139:true},res);
}
