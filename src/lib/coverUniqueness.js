/* LAB23: diagnose and safely reconcile previously duplicated WEB THEMATIC photos.
   Never touch original scans, imported originals, user-selected covers or PDFs.
   This compares the actual linked Wikimedia image, not JPEGs with different title overlays. */
const clean=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ');
export function coverAssetIdentity(record){
  if(!record)return'';
  return String(record.coverImageAssetId||record.coverImageSourceUrl||'').trim();
}
export function usedCoverAssets(items=[],exceptId=''){
  const found=[];
  for(const item of items){
    if(item.id===exceptId||!item.coverCustom)continue;
    const asset=coverAssetIdentity(item);
    if(asset)found.push(asset);
    if(item.coverImageSourceUrl && item.coverImageSourceUrl!==asset)found.push(item.coverImageSourceUrl);
  }
  return [...new Set(found)].slice(0,60);
}
function affinity(item){
  const title=clean(item.fileName);
  const source=clean(item.coverImageSourceUrl);
  const roman=/roman|coloss|rome|roma|foro/.test(source);
  const saints=/sant|christ|religio|chiesa|church|jesus|crist/.test(source);
  if(roman && /roman|roma|impero|coloss/.test(title))return 7;
  if(saints && /sant|religio|crist|chies|gesu/.test(title))return 7;
  const words=title.split(' ').filter(x=>x.length>=5&&!/appunti|fotografati|pagina|pagine|documento|originale|modificato|testo|libro/.test(x));
  return words.filter(w=>source.includes(w)).length;
}
export function findDuplicateWebCovers(items=[]){
  const groups=new Map();
  for(const item of items){
    if(item.coverOrigin!=='online-thematic'||!item.coverCustom||!item.coverImageSourceUrl)continue;
    const key=item.coverImageSourceUrl;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(item);
  }
  const losers=[];
  for(const group of groups.values()){
    if(group.length<2)continue;
    // Original oldest book wins ties, subject/title relevance wins over recency.
    const ranked=[...group].sort((a,b)=>affinity(b)-affinity(a)
      ||String(a.createdAt||'').localeCompare(String(b.createdAt||''))
      ||String(a.id).localeCompare(String(b.id)));
    for(const item of ranked.slice(1))losers.push(item);
  }
  return losers;
}
