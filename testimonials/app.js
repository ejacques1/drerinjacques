const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
const demoTestimonials = [
  {id:'demo-a',name:'Maya Thompson',role:'Consultant',company:'Northstar Strategy',story:'I had ideas everywhere but no clear way to turn them into something useful. After the training, I built my first working AI tool in a weekend and finally understood how all the pieces connected.',recommendation:'Dr. Erin makes technical work feel possible without talking down to you.',rating:5,featured:true,avatarUrl:null,videoUrl:null,trainings:[{name:'Leveraging AI',slug:'leveraging-ai'}]},
  {id:'demo-b',name:'Jordan Lee',role:'Founder',company:'Bright Path Studio',story:'The step-by-step process helped me stop overthinking and launch the client portal I had postponed for months.',recommendation:'Come ready to build. You will leave with something real.',rating:5,featured:false,avatarUrl:null,videoUrl:null,trainings:[{name:'SaaS Sprint',slug:'saas-sprint'}]},
  {id:'demo-c',name:'Alexis Carter',role:'Course Creator',company:'',story:'I used the workflow to protect a paid resource and connect it to my checkout. It saved me days of trying to piece together conflicting tutorials.',recommendation:'The explanations are clear, practical, and focused on the result.',rating:null,featured:false,avatarUrl:null,videoUrl:null,trainings:[{name:'Content Gating Workshop',slug:'content-gating'}]}
];

const state = { testimonials: [], filter: 'all' };
const $ = selector => document.querySelector(selector);
const escapeHtml = value => { const div=document.createElement('div'); div.textContent=value ?? ''; return div.innerHTML; };

function personLine(item) {
  return [item.role, item.company].filter(Boolean).join(' · ');
}

function card(item) {
  const initial=(item.name || '?').trim().charAt(0).toUpperCase();
  const avatar=item.avatarUrl
    ? `<img src="${escapeHtml(item.avatarUrl)}" alt="" loading="lazy"><span class="avatar-fallback">${escapeHtml(initial)}</span>`
    : `<span class="avatar-fallback visible">${escapeHtml(initial)}</span>`;
  const rating=item.rating?`<div class="rating" aria-label="${item.rating} out of 5 stars">${'★'.repeat(item.rating)}</div>`:'';
  const video=item.videoUrl?`<video class="card-video" controls preload="metadata" src="${escapeHtml(item.videoUrl)}"></video>`:'';
  const recommendation=item.recommendation?`<p class="recommendation">“${escapeHtml(item.recommendation)}”</p>`:'';
  const tags=(item.trainings || []).map(training=>`<span class="tag">${escapeHtml(training.name)}</span>`).join('');
  return `<article class="testimonial-card ${item.featured?'featured':''}" data-trainings="${escapeHtml((item.trainings || []).map(training=>training.slug).join(','))}">
    ${video}${rating}<p class="story">${escapeHtml(item.story)}</p>${recommendation}
    <div class="person"><span class="avatar">${avatar}</span><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(personLine(item))}</small></span></div>
    ${tags?`<div class="tags">${tags}</div>`:''}
  </article>`;
}

function render() {
  const items=state.filter==='all' ? state.testimonials : state.testimonials.filter(item=>(item.trainings || []).some(training=>training.slug===state.filter));
  $('#testimonialGrid').innerHTML=items.map(card).join('');
  $('#testimonialGrid').hidden=!items.length;
  $('#emptyState').hidden=Boolean(items.length);
  $('#storyCount').textContent=`${items.length} ${items.length===1?'story':'stories'}`;
  document.querySelectorAll('.avatar img').forEach(image=>{
    const fail=()=>{image.hidden=true;image.nextElementSibling?.classList.add('visible');};
    image.addEventListener('load',()=>image.classList.add('loaded'));
    image.addEventListener('error',fail);
    if (image.complete) image.naturalWidth ? image.classList.add('loaded') : fail();
  });
}

function renderFilters(trainings) {
  if (!trainings.length) return;
  $('#filters').hidden=false;
  $('#filters').innerHTML=[{name:'All stories',slug:'all'},...trainings].map(training=>`<button class="filter ${training.slug==='all'?'active':''}" data-filter="${escapeHtml(training.slug)}" type="button">${escapeHtml(training.name)}</button>`).join('');
  $('#filters').addEventListener('click',event=>{
    const button=event.target.closest('[data-filter]'); if (!button) return;
    state.filter=button.dataset.filter;
    document.querySelectorAll('.filter').forEach(filter=>filter.classList.toggle('active',filter===button));
    render();
  });
}

async function start() {
  try {
    if (isLocal) {
      state.testimonials=demoTestimonials;
      renderFilters([...new Map(demoTestimonials.flatMap(item=>item.trainings).map(training=>[training.slug,training])).values()]);
      render();
      return;
    }
    const response=await fetch('/api/testimonial-public?destination=testimonial_wall');
    const result=await response.json();
    if (!response.ok) throw new Error(result.error);
    state.testimonials=result.testimonials || [];
    renderFilters(result.trainings || []);
    render();
  } catch (_) {
    $('#testimonialGrid').hidden=true;
    $('#storyCount').textContent='';
    $('#errorState').hidden=false;
  }
}

start();
