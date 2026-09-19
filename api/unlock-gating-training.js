import {saveTaggedContact} from './_lib/systeme-signup.js';
import {session} from './_lib/gating-training-session.js';
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function confirmationHtml(){
 return `<section class="confirmation" aria-labelledby="confirmation-title"><p class="eyebrow">YOU’RE REGISTERED</p><h2 id="confirmation-title">Thank you. See you at 2 p.m. Eastern!</h2><p><strong>${escape(session.dateLabel)}<br>2:00 p.m. Eastern</strong></p><p><a class="join-link" href="${escape(session.zoomUrl)}" target="_blank" rel="noopener noreferrer">Join the training on Zoom ↗</a></p><p class="zoom-url">Meeting ID: <strong>738 777 8989</strong><br>Save your link: <a href="${escape(session.zoomUrl)}">${escape(session.zoomUrl)}</a></p><h3>What to bring</h3><ul class="prep-list"><li><strong>Your file:</strong> a PDF, Word document, or anything you want to put behind an email signup.</li><li><strong>A Systeme.io account:</strong> <a href="https://systeme.io/?sa=sa01702408010a2c50ae4ddb5fc0b72a3a97b1dcb6" target="_blank" rel="sponsored noopener noreferrer">create a free account ↗</a><span class="source-note disclosure">I may earn a commission if you purchase through this link.</span></li><li><strong>GitHub and Vercel accounts:</strong> sign up at <a href="https://github.com/" target="_blank" rel="noopener noreferrer">GitHub ↗</a> and <a href="https://vercel.com/" target="_blank" rel="noopener noreferrer">Vercel ↗</a>.</li><li><strong>Codex or Claude desktop app installed,</strong> with access to its coding features. <a href="https://developers.openai.com/codex/app/" target="_blank" rel="noopener noreferrer">Codex desktop setup ↗</a> · <a href="https://claude.com/download" target="_blank" rel="noopener noreferrer">Download Claude ↗</a></li></ul><p>That’s all you need to prepare. We’ll walk through the prompts, setup, and connections together live.</p><p>Live only. No replay. If you can’t attend, you’re on the list to hear about the next session.</p><p class="source-note">Save your Zoom link now. You can return to this page and enter the same email to reveal it again.</p></section>`;
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('Content-Type','application/json');
 const reply=(status,data)=>{res.statusCode=status;res.end(JSON.stringify(data));};
 if(req.method!=='POST'){res.setHeader('Allow','POST');return reply(405,{error:'Please use the email form to open the guide.'});}
 if(!String(req.headers['content-type']||'').startsWith('application/json'))return reply(415,{error:'Please use the email form.'});
 if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return reply(403,{error:'Please submit from the guide page.'});}catch{return reply(403,{error:'Invalid origin.'});}}
 let body=req.body;
 try{if(typeof body==='string')body=JSON.parse(body);}catch{return reply(400,{error:'Please enter a valid email address.'});}
 if(!body||typeof body!=='object'||body.website)return reply(400,{error:'Please try again.'});
 const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
 if(email.length>254||! /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(email)||email.split('@')[0].length>64||email.includes('..'))return reply(400,{error:'Please enter a valid email address, such as you@example.com.'});
 const key=process.env.SYSTEME_API_KEY;
 const unavailable=()=>reply(503,{error:'We could not save your signup right now. Please try again shortly.'});
 if(!key){console.warn('Contact capture not configured: SYSTEME_API_KEY is missing.');return unavailable();}
 if(!session.dateLabel || !session.zoomUrl)return reply(503,{error:'Registration is not open yet. Please check back shortly.'});
 try{
  await saveTaggedContact(email, session.tagName, key);
 }catch(error){
  console.warn('Resource signup incomplete:', 'Gating Training', error.name === 'TimeoutError' ? 'timeout' : /^((tag|contact)_[a-z0-9_]+)$/.test(error.message) ? error.message : 'provider_unavailable');
  return reply(503,{error:'We could not finish your signup right now. Please try again shortly using the same email.'});
 }
 // Unlock only after the contact and resource tag are confirmed.
 // Never log email addresses, API keys, or provider response bodies.
 return reply(200,{html:confirmationHtml()});
}
