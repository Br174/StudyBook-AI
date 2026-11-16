// LAB141 new opt-in route, using the existing fixed Gemini 3.1 provider.
// Old /v126,/v138,/v139,/v140 clients are unchanged.
import explainedV126Handler from './explainedV126.js';
export const EXPLAINED_TAIL_CONTRACT_V141='lab141-endgame-two-repairs-one-pass-v1';
export default function explainedV141Handler(req,res){
 res.setHeader('X-StudyBook-Tail-Contract',EXPLAINED_TAIL_CONTRACT_V141);
 return explainedV126Handler({...req,fastLengthV139:true,
  focusedGlossaryV140:true,tailReliableV141:true},res);
}
