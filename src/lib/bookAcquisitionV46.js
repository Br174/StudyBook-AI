// LAB46: physical source acquisition only. Never mix IA parts with PDF pages.
const natural=value=>{
  const number=Number(value);
  return Number.isFinite(number)&&number>0?Math.trunc(number):0;
};
export function bookAcquisitionProgressV46(metadata={},live=null){
  const stored=natural(metadata?.pages);
  const liveTotal=natural(live?.total);
  const total=liveTotal||stored;
  const storedAcquired=Number.isFinite(Number(metadata?.pagesAcquired))
    ?Math.max(0,Math.trunc(Number(metadata.pagesAcquired)))
    :((metadata?.hasOriginal||metadata?.hasProcessed)?stored:0);
  const acquired=total?Math.min(total,
    liveTotal?Math.max(0,Math.trunc(Number(live?.done)||0)):storedAcquired):0;
  return {total,acquired,percent:total?Math.min(100,Math.floor(acquired*100/total)):null,
    completed:total>0&&acquired===total};
}
