// LAB138 opt-in contract. This route shares the exact V126 validator/provider
// implementation; installed LAB136/LAB137 clients keep /api/explained/v126.
import explainedV126Handler from './explainedV126.js';
export const EXPLAINED_QUALITY_CONTRACT_V138='lab138-targeted-reliable-pages-v1';
export default function explainedV138Handler(req,res){
 res.setHeader('X-StudyBook-Quality-Strategy-Contract',EXPLAINED_QUALITY_CONTRACT_V138);
 return explainedV126Handler({...req,qualityStrategyV138:true},res);
}
