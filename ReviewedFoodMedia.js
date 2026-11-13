/** Exact food photos reviewed visually against their preparation, with source credits. */
var SF_REVIEWED_FOOD_PHOTOS = [
  {keys:['chickenbreastcooked'],title:'Grilled chicken breast slices',image:'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9d/Grilled_Chicken_Breasts_%2828905381261%29.jpg/500px-Grilled_Chicken_Breasts_%2828905381261%29.jpg',source:'https://commons.wikimedia.org/wiki/File:Grilled_Chicken_Breasts_(28905381261).jpg',credit:'Sharon Chen / delishplan.com · CC BY 2.0 · https://creativecommons.org/licenses/by/2.0/ · بدون تغییر'},
  {keys:['salmon'],title:'Atlantic salmon fillet',image:'https://upload.wikimedia.org/wikipedia/commons/c/c7/Atlantic_Salmon.png',source:'https://commons.wikimedia.org/wiki/File:Atlantic_Salmon.png',credit:'Robpedia · Public domain · بدون تغییر'},
  {keys:['lentilscooked'],title:'Cooked lentils with onion garnish',image:'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/93/Liat_Portal_for_Foodie_Disorder_-_Cooked_Lentils_with_Caramelized_Onions.jpg/500px-Liat_Portal_for_Foodie_Disorder_-_Cooked_Lentils_with_Caramelized_Onions.jpg',source:'https://commons.wikimedia.org/wiki/File:Liat_Portal_for_Foodie_Disorder_-_Cooked_Lentils_with_Caramelized_Onions.jpg',credit:'HaJunkiyada / Liat Portal · CC BY-SA 4.0 · https://creativecommons.org/licenses/by-sa/4.0/ · بدون تغییر'},
{"keys":["mozzarella"],"title":"Fresh mozzarella","image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/5/57/Mozzarella_di_bufala3.jpg/960px-Mozzarella_di_bufala3.jpg","source":"https://commons.wikimedia.org/wiki/File:Mozzarella_di_bufala3.jpg","credit":"Popo le Chien · CC BY-SA 3.0 · https://creativecommons.org/licenses/by-sa/3.0 · بدون تغییر"},
{"keys":["doogh"],"title":"Doogh yogurt drink","image":"https://upload.wikimedia.org/wikipedia/commons/c/c8/%D0%A2%D0%90%D0%9D_%28%D0%BD%D0%B0%D0%BF%D0%B8%D1%82%D0%BE%D0%BA%29.jpg","source":"https://commons.wikimedia.org/wiki/File:%D0%A2%D0%90%D0%9D_%28%D0%BD%D0%B0%D0%BF%D0%B8%D1%82%D0%BE%D0%BA%29.jpg","credit":"Schekinov Alexey Victorovich · CC BY-SA 4.0 · https://creativecommons.org/licenses/by-sa/4.0 · بدون تغییر"},
{"keys":["barbaribread"],"title":"Barbari bread","image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9a/Nun_Barbar%C3%AD_fatto_con_farina_di_grano_del_Senatore_Cappelli.jpg/960px-Nun_Barbar%C3%AD_fatto_con_farina_di_grano_del_Senatore_Cappelli.jpg","source":"https://commons.wikimedia.org/wiki/File:Nun_Barbar%C3%AD_fatto_con_farina_di_grano_del_Senatore_Cappelli.jpg","credit":"Marcuscalabresus · CC BY-SA 4.0 · https://creativecommons.org/licenses/by-sa/4.0 · بدون تغییر"},
{"keys":["boiledegg"],"title":"Boiled egg","image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cc/Soft-boiled-egg.jpg/960px-Soft-boiled-egg.jpg","source":"https://commons.wikimedia.org/wiki/File:Soft-boiled-egg.jpg","credit":"Amin · CC BY-SA 4.0 · https://creativecommons.org/licenses/by-sa/4.0 · بدون تغییر"}
];
function sfReviewedFoodImage_(english){
  var key=String(english || '').toLowerCase().replace(/[^a-z0-9]/g,''),at=SF_REVIEWED_FOOD_PHOTOS.findIndex(function(r){return r.keys.indexOf(key)>=0;});if(at<0)return null;
  var row=SF_REVIEWED_FOOD_PHOTOS[at];return {code:'reviewed-food-'+at,title:row.title,image:row.image,source:row.source,credit:row.credit,score:100,brand:''};
}

function sfReviewFoodCredit_(candidate){
  if(String(candidate.code).indexOf('reviewed-food-')===0)return candidate;
  var image=String(candidate.image || ''),match=image.match(/^https:\/\/(?:thumb|upload)\.wikimedia\.org\/wikipedia\/commons\/(?:thumb\/)?[a-f0-9]\/[a-f0-9]{2}\/([^/?]+)/i);
  if(!match)throw new Error('منبع عکس برای ثبت نهایی قابل تأیید نیست.');
  var file=decodeURIComponent(match[1]),url='https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata&titles='+encodeURIComponent('File:'+file),response=UrlFetchApp.fetch(url,{muteHttpExceptions:true,headers:{'User-Agent':'SaeediFit-media-review/1.0'}}),pages=(JSON.parse(response.getContentText()).query || {}).pages || {},page=pages[Object.keys(pages)[0]] || {},info=(page.imageinfo || [])[0] || {},meta=info.extmetadata || {};
  function text(key){return String(meta[key] && meta[key].value || '').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#(\d+);/g,function(_,n){return String.fromCharCode(Number(n));}).trim();}
  var license=text('LicenseShortName'),licenseUrl=text('LicenseUrl');if(!license)throw new Error('اطلاعات مجوز عکس دریافت نشد؛ عکس قبلی حفظ شد.');
  var result=Object.assign({},candidate);result.source='https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(file);result.credit=(text('Artist') || 'Wikimedia Commons')+' · '+license+(licenseUrl?' · '+licenseUrl:'')+' · بدون تغییر';return result;
}
