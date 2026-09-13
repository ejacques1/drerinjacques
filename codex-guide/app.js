const form=document.querySelector('#unlock-form');
form.addEventListener('submit',async event=>{
 event.preventDefault();if(!form.reportValidity())return;
 const button=form.querySelector('button');const message=document.querySelector('#form-message');
 button.disabled=true;button.textContent='Saving your signup…';message.textContent='';
 try{
  const response=await fetch('/api/unlock-codex',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:form.email.value,website:form.website.value}),signal:AbortSignal.timeout(20000)});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Please try again.');
  if(typeof data.html!=='string')throw new Error('The guide could not load. Please try again.');
  const remaining=document.querySelector('#remaining');remaining.innerHTML=data.html;remaining.hidden=false;
  document.querySelector('#gate').outerHTML='<section class="gate unlocked" aria-label="Signup complete"><div class="lock-mark" aria-hidden="true">✓</div><p class="eyebrow">YOU’RE IN</p><h2>Your guide is open.</h2><p>Your signup is saved. Your full step-by-step guide is open below.</p><a class="library-link" href="#remaining">Read the steps ↓</a></section>';
  remaining.focus();remaining.scrollIntoView({block:'start'});
 }catch(error){message.textContent=error.name==='TimeoutError'?'The connection took too long. Please try again.':error.message;button.disabled=false;button.textContent='Unlock the steps →';}
});
document.querySelector('#remaining').addEventListener('click',async event=>{
 const button=event.target.closest('.copy-prompt');if(!button)return;
 const card=button.closest('.prompt-card');const value=card.querySelector('.prompt-text').textContent;
 try{await navigator.clipboard.writeText(value);button.textContent='Copied!';document.querySelector('#copy-status').textContent='Prompt copied. Replace the brackets with your details.';setTimeout(()=>button.textContent='Copy prompt',1800);}
 catch{const range=document.createRange();range.selectNodeContents(card);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);document.querySelector('#copy-status').textContent='Select and copy the highlighted prompt.';}
});
