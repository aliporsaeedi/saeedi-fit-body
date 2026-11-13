/** Read-only batch search; writes still go through the reviewed, locked commit. */
function adm_mediaReviewBatch(token,bank,excludeIds) {
  adm_who_(token,true); adm_ensure_();
  var b=adm_bank_(bank);sfInvalidate_(b.sheet);
  var queue=adm_mediaQueue(token,bank,excludeIds,bank === 'foods' ? 12 : 6),rows=sfObjects_(sfRead_(b.sheet)),byId={};
  rows.forEach(function(row) { var id=normalize_(row[b.id]);if(!byId[id])byId[id]=row; });
  var responses=null;
  if(bank === 'foods' && queue.items.length) responses=UrlFetchApp.fetchAll(queue.items.map(function(item) { return adm_foodImageReq_(item.english || item.name); }));
  return {ok:true,missing:queue.totalMissing,items:queue.items.map(function(item,index) {
    var row=byId[item.id];
    try { return {id:item.id,name:item.name,english:item.english,current:normalize_(row.ImageURL),candidates:adm_mediaCandidates_(item.name,item.english,bank,responses && responses[index])}; }
    catch(e) { return {id:item.id,name:item.name,english:item.english,current:normalize_(row.ImageURL),candidates:[],error:String(e.message || e)}; }
  })};
}
