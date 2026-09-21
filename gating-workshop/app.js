for (const button of document.querySelectorAll('[data-copy], #copy')) {button.addEventListener('click', async () => {const target=button.dataset.copy || 'prompt';const status=button.id==='copy' ? document.getElementById('copy-status') : button.nextElementSibling;try {await navigator.clipboard.writeText(document.getElementById(target).textContent);status.textContent='Copied. Replace the brackets with your details before sending.';} catch {status.textContent='Select the prompt text below and copy it.';}});}

const communityInvite = document.querySelector('.community-invite');
communityInvite.insertAdjacentHTML('beforebegin', '<section class="workshop-stories" id="workshopStories" aria-labelledby="workshop-stories-title" hidden><p class="eyebrow">WHAT PARTICIPANTS BUILT</p><h2 id="workshop-stories-title">Success stories from this workshop.</h2><div class="workshop-story-grid" id="workshopStoryGrid"></div></section>');
communityInvite.insertAdjacentHTML('afterend', '<section class="share-experience" aria-labelledby="share-experience-title"><p class="eyebrow">HOW DID IT GO?</p><h2 id="share-experience-title">Share what you built or learned.</h2><p>Your experience can help someone else feel confident enough to build their first page.</p><a class="share-experience-button" href="/share-your-story/?training=gating-workshop">Share your experience →</a></section>');

const escapeHtml = value => { const div=document.createElement('div'); div.textContent=value ?? ''; return div.innerHTML; };

async function loadWorkshopStories() {
  try {
    const response = await fetch('/api/testimonial-public?destination=training_page&training=gating-workshop');
    const result = await response.json();
    if (!response.ok) return;
    if (!result.testimonials?.length) {
      document.getElementById('workshopStories').hidden=true;
      document.getElementById('workshopStoryGrid').innerHTML='';
      return;
    }
    const grid = document.getElementById('workshopStoryGrid');
    grid.innerHTML = result.testimonials.slice(0, 6).map(item => {
      const initial=(item.name || '?').trim().charAt(0).toUpperCase();
      const avatar=item.avatarUrl ? `<img src="${escapeHtml(item.avatarUrl)}" alt="" loading="lazy"><span>${escapeHtml(initial)}</span>` : `<span>${escapeHtml(initial)}</span>`;
      const detail=[item.role,item.company].filter(Boolean).join(' · ');
      return `<article class="workshop-story"><blockquote>“${escapeHtml(item.story)}”</blockquote><div class="workshop-person"><span class="workshop-avatar">${avatar}</span><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(detail)}</small></span></div></article>`;
    }).join('');
    grid.querySelectorAll('.workshop-avatar img').forEach(image => image.addEventListener('error', () => image.remove()));
    document.getElementById('workshopStories').hidden=false;
  } catch (_) {}
}

if (!['localhost','127.0.0.1'].includes(location.hostname)) {
  loadWorkshopStories();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) loadWorkshopStories();
  });
  window.setInterval(loadWorkshopStories, 60000);
}
