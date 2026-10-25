(()=>{
  const script=document.currentScript;
  const cssUrl=new URL('widget.css',script?.src || location.href).href;
  if(!document.querySelector(`link[data-testimonial-widget-css="${cssUrl}"]`)){
    const link=document.createElement('link');link.rel='stylesheet';link.href=cssUrl;link.dataset.testimonialWidgetCss=cssUrl;document.head.appendChild(link);
  }
  const escape=value=>{const node=document.createElement('div');node.textContent=value??'';return node.innerHTML;};
  const detail=item=>[item.role,item.company].filter(Boolean).join(' · ');
  const card=item=>{
    const initial=(item.name||'?').trim().charAt(0).toUpperCase();
    const avatar=item.avatarUrl?`<img src="${escape(item.avatarUrl)}" alt="" loading="lazy" onerror="this.remove()">`:'';
    const video=item.videoUrl?`<video class="testimonial-widget-video" controls playsinline preload="metadata" src="${escape(item.videoUrl)}"></video>`:'';
    const stars=item.rating?`<div class="testimonial-widget-stars" aria-label="${item.rating} out of 5 stars">${'★'.repeat(item.rating)}</div>`:'';
    const recommendation=item.recommendation?`<p class="testimonial-widget-recommendation">“${escape(item.recommendation)}”</p>`:'';
    const tags=(item.trainings||[]).map(t=>`<span class="testimonial-widget-tag">${escape(t.name)}</span>`).join('');
    return `<article class="testimonial-widget-card ${item.featured?'featured':''}">${video}${stars}<p class="testimonial-widget-story">${escape(item.story)}</p>${recommendation}<div class="testimonial-widget-person"><span class="testimonial-widget-avatar"><span>${escape(initial)}</span>${avatar}</span><span><strong>${escape(item.name)}</strong><small>${escape(detail(item))}</small></span></div>${tags?`<div class="testimonial-widget-tags">${tags}</div>`:''}</article>`;
  };
  async function load(root){
    const params=new URLSearchParams({destination:root.dataset.destination||'testimonial_wall'});
    for(const key of ['training','page','format','limit']) if(root.dataset[key]) params.set(key,root.dataset[key]);
    try{
      const response=await fetch(`/api/testimonial-public?${params}`);const result=await response.json();
      if(!response.ok) throw new Error(result.error||'Testimonials could not be loaded.');
      const items=result.testimonials||[];
      root.innerHTML=items.length?`<div class="testimonial-widget-grid">${items.map(card).join('')}</div>`:`<div class="testimonial-widget-empty">No stories have been added to this display yet.</div>`;
    }catch(error){root.innerHTML='<div class="testimonial-widget-error">Stories could not be loaded right now.</div>';}
  }
  const init=()=>document.querySelectorAll('.testimonial-widget:not([data-widget-ready])').forEach(root=>{root.dataset.widgetReady='true';load(root);});
  init();document.addEventListener('DOMContentLoaded',init);
  window.DrErinTestimonials={refresh:init};
})();
