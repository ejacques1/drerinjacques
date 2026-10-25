import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const root=path.resolve(import.meta.dirname,'..');
const archive=path.join(root,'.project-notes','senja-backup-2026-10-24');
const env=JSON.parse(fs.readFileSync('/private/tmp/drerinjacques-supabase-env.json','utf8'));
const supabase=createClient(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});

function parseCsv(text){
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i],n=text[i+1];
    if(quoted&&c==='"'&&n==='"'){field+='"';i++;}
    else if(c==='"') quoted=!quoted;
    else if(c===','&&!quoted){row.push(field);field='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&n==='\n')i++;row.push(field);field='';if(row.some(Boolean))rows.push(row);row=[];}
    else field+=c;
  }
  if(field||row.length){row.push(field);rows.push(row);}
  const [headers,...body]=rows;
  return body.map(values=>Object.fromEntries(headers.map((header,index)=>[header,values[index]??''])));
}

function stableUuid(seed){
  const hex=crypto.createHash('sha256').update(seed).digest('hex').slice(0,32).split('');
  hex[12]='4';hex[16]=((parseInt(hex[16],16)&3)|8).toString(16);
  return `${hex.slice(0,8).join('')}-${hex.slice(8,12).join('')}-${hex.slice(12,16).join('')}-${hex.slice(16,20).join('')}-${hex.slice(20).join('')}`;
}

const normalize=value=>(value||'').trim().replace(/\s+/g,' ').toLowerCase();
const reviewKey=review=>[normalize(review.customer_name),review.type,review.date].join('|');
const rowKey=row=>[normalize(row.customer_name),row.type,row.date].join('|');
const safeSegment=value=>normalize(value).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'testimonial';

async function uploadStream(bucket,objectPath,localFile){
  if(bucket==='testimonial-photos'&&fs.statSync(localFile).size>9*1024*1024){
    const optimized=path.join(archive,'media','optimized-images',`${path.parse(localFile).name}.jpg`);
    if(!fs.existsSync(optimized))throw new Error(`Missing optimized image for ${path.basename(localFile)}`);
    localFile=optimized;
  }
  if(bucket==='testimonial-videos'&&fs.statSync(localFile).size>48*1024*1024){
    const optimized=path.join(archive,'media','optimized-videos',path.basename(localFile));
    if(!fs.existsSync(optimized))throw new Error(`Missing optimized video for ${path.basename(localFile)}`);
    localFile=optimized;
  }
  const ext=path.extname(localFile).toLowerCase();
  const contentType=({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.mov':'video/quicktime','.webm':'video/webm'})[ext]||'application/octet-stream';
  const objectUrl=`${env.SUPABASE_URL}/storage/v1/object/${bucket}/${objectPath.split('/').map(encodeURIComponent).join('/')}`;
  const existing=await fetch(objectUrl,{method:'HEAD',headers:{apikey:env.SUPABASE_SECRET_KEY,Authorization:`Bearer ${env.SUPABASE_SECRET_KEY}`}});
  if(existing.ok&&Number(existing.headers.get('content-length'))===fs.statSync(localFile).size)return;
  const response=await fetch(objectUrl,{
    method:'POST',headers:{apikey:env.SUPABASE_SECRET_KEY,Authorization:`Bearer ${env.SUPABASE_SECRET_KEY}`,'Content-Type':contentType,'x-upsert':'true'},body:fs.createReadStream(localFile),duplex:'half'
  });
  if(!response.ok) throw new Error(`${bucket}/${objectPath}: ${response.status} ${await response.text()}`);
}

async function uploadTus(bucket,objectPath,localFile,contentType){
  const size=fs.statSync(localFile).size;const encode=value=>Buffer.from(value).toString('base64');
  const create=await fetch(`${env.SUPABASE_URL}/storage/v1/upload/resumable`,{method:'POST',headers:{
    apikey:env.SUPABASE_SECRET_KEY,Authorization:`Bearer ${env.SUPABASE_SECRET_KEY}`,'tus-resumable':'1.0.0','upload-length':String(size),'x-upsert':'true',
    'upload-metadata':`bucketName ${encode(bucket)},objectName ${encode(objectPath)},contentType ${encode(contentType)},cacheControl ${encode('3600')}`
  }});
  if(!create.ok)throw new Error(`TUS create ${bucket}/${objectPath}: ${create.status} ${await create.text()}`);
  const location=create.headers.get('location');if(!location)throw new Error(`TUS create ${bucket}/${objectPath}: missing upload location`);
  const uploadUrl=new URL(location,env.SUPABASE_URL).href;const handle=fs.openSync(localFile,'r');const chunkSize=6*1024*1024;let offset=0;
  try{
    while(offset<size){
      const length=Math.min(chunkSize,size-offset),chunk=Buffer.allocUnsafe(length);fs.readSync(handle,chunk,0,length,offset);
      const patch=await fetch(uploadUrl,{method:'PATCH',headers:{apikey:env.SUPABASE_SECRET_KEY,Authorization:`Bearer ${env.SUPABASE_SECRET_KEY}`,'tus-resumable':'1.0.0','upload-offset':String(offset),'content-type':'application/offset+octet-stream'},body:chunk});
      if(!patch.ok)throw new Error(`TUS patch ${bucket}/${objectPath} at ${offset}: ${patch.status} ${await patch.text()}`);
      offset=Number(patch.headers.get('upload-offset')||offset+length);
    }
  }finally{fs.closeSync(handle);}
}

async function main(){
  const rows=parseCsv(fs.readFileSync(path.join(archive,'senja-testimonials.csv'),'utf8'));
  const media=JSON.parse(fs.readFileSync(path.join(archive,'media-manifest.json'),'utf8'));
  const selections=JSON.parse(fs.readFileSync(path.join(archive,'widget-selections.json'),'utf8'));
  const wall=selections.wall;
  const video=selections.video;
  const wallByKey=new Map(wall.map(review=>[reviewKey(review),review]));
  const videoByKey=new Map(video.map(review=>[reviewKey(review),review]));
  const mediaByRowField=new Map();
  for(const item of media) for(const rowNumber of item.csv_rows) mediaByRowField.set(`${rowNumber}:${item.csv_field}`,item);

  const uploaded=new Set();let mediaDone=0;
  for(const item of media){
    const localFile=path.join(archive,item.local_file);const isVideo=item.csv_field==='video_mp4_url';
    const bucket=isVideo?'testimonial-videos':'testimonial-photos';
    const objectPath=`senja-archive/${item.local_file.replace(/^media\//,'')}`;
    await uploadStream(bucket,objectPath,localFile);uploaded.add(item.source_url);mediaDone++;
    console.log(`MEDIA ${mediaDone}/${media.length} ${bucket} ${path.basename(localFile)} (${Math.round(item.bytes/1048576)} MB)`);
  }

  const records=[];const destinations=[];const matchedWall=[];const matchedVideo=[];
  for(let index=0;index<rows.length;index++){
    const row=rows[index],rowNumber=index+1,key=rowKey(row),wallReview=wallByKey.get(key),videoReview=videoByKey.get(key),publicReview=wallReview||videoReview;
    const id=publicReview?.id||stableUuid(`senja:${rowNumber}:${row.customer_name}:${row.date}:${row.text}`);
    const avatar=mediaByRowField.get(`${rowNumber}:customer_avatar`);const videoMedia=mediaByRowField.get(`${rowNumber}:video_mp4_url`);
    const photoPath=avatar?`senja-archive/${avatar.local_file.replace(/^media\//,'')}`:null;
    const videoPath=videoMedia?`senja-archive/${videoMedia.local_file.replace(/^media\//,'')}`:null;
    const isPublic=Boolean(publicReview);if(wallReview)matchedWall.push(id);if(videoReview)matchedVideo.push(id);
    records.push({
      id,format:row.type==='video'?'video':'written',status:isPublic?'approved':'pending',customer_name:row.customer_name.trim()||'Anonymous',
      customer_email:row.customer_email.trim()||`senja-${id}@archive.invalid`,customer_role:row.customer_tagline.trim()||null,customer_company:row.customer_company.trim()||null,
      story:row.text.trim()||row.title.trim()||'Video testimonial',recommendation:null,rating:Number(row.rating)||null,photo_path:photoPath,video_path:videoPath,
      transcript:row.type==='video'&&row.text.trim()?row.text.trim():null,source:'senja_import',source_reference:`Senja archive · ${id}`,language:'en',featured:false,
      consent_granted:true,consent_version:'senja-archive-2026-10-24',consented_at:row.date||null,submitted_at:row.date||new Date().toISOString(),approved_at:isPublic?(row.date||new Date().toISOString()):null
    });
    if(wallReview){
      const order=wall.findIndex(review=>review.id===wallReview.id)+1;
      for(const destination of ['homepage','testimonial_wall']) destinations.push({testimonial_id:id,destination,training_id:null,page_slug:null,sort_order:order});
      destinations.push({testimonial_id:id,destination:'sales_page',training_id:null,page_slug:'saas-sprint-wall',sort_order:order});
    }
    if(videoReview){
      const order=video.findIndex(review=>review.id===videoReview.id)+1;
      destinations.push({testimonial_id:id,destination:'sales_page',training_id:null,page_slug:'saas-sprint-video',sort_order:order});
    }
  }

  const {error:recordError}=await supabase.from('testimonials').upsert(records,{onConflict:'id'});if(recordError)throw recordError;
  const ids=records.map(record=>record.id);
  const {error:deleteError}=await supabase.from('testimonial_destinations').delete().in('testimonial_id',ids);if(deleteError)throw deleteError;
  const uniqueDestinations=[...new Map(destinations.map(item=>[[item.testimonial_id,item.destination,item.training_id||'',item.page_slug||''].join('|'),item])).values()];
  const {error:destinationError}=await supabase.from('testimonial_destinations').upsert(uniqueDestinations);if(destinationError)throw destinationError;

  const report={imported_at:new Date().toISOString(),records:records.length,media_files:media.length,media_bytes:media.reduce((n,item)=>n+item.bytes,0),public_wall:matchedWall.length,public_video:matchedVideo.length,pending:records.filter(r=>r.status==='pending').length};
  fs.writeFileSync(path.join(archive,'senja-import-report.json'),JSON.stringify(report,null,2)+'\n');console.log('COMPLETE',JSON.stringify(report));
}

main().catch(error=>{console.error('IMPORT_FAILED',error);process.exitCode=1;});
