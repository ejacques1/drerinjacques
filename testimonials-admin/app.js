const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
const demoTrainings = [
    {id:'training-leveraging-ai', name:'Leveraging AI'},
    {id:'training-mac', name:'Mac Training'},
    {id:'training-saas', name:'SaaS Sprint'},
    {id:'training-gating', name:'Content Gating Workshop'}
];
const demoTestimonials = [
    {id:'demo-1',status:'pending',featured:false,format:'written',customer_name:'Maya Thompson',customer_email:'maya@example.com',customer_role:'Consultant',customer_company:'Northstar Strategy',story:'I had ideas everywhere but no clear way to turn them into something useful. After the training, I built my first working AI tool in a weekend and finally understood how all the pieces connected.',recommendation:'Dr. Erin makes technical work feel possible without talking down to you.',source_reference:'Leveraging AI',submitted_at:'2026-09-19T14:25:00Z',trainingIds:['training-leveraging-ai'],destinations:[]},
    {id:'demo-2',status:'approved',featured:true,format:'video',customer_name:'Jordan Lee',customer_email:'jordan@example.com',customer_role:'Founder',customer_company:'Bright Path Studio',story:'The step-by-step process helped me stop overthinking and launch the client portal I had postponed for months.',recommendation:'Come ready to build. You will leave with something real.',source_reference:'SaaS Sprint',submitted_at:'2026-09-17T10:10:00Z',trainingIds:['training-saas'],destinations:[{destination:'homepage',sort_order:1},{destination:'testimonial_wall',sort_order:2},{destination:'training_page',training_id:'training-saas',sort_order:1}]},
    {id:'demo-3',status:'approved',featured:false,format:'written',customer_name:'Alexis Carter',customer_email:'alexis@example.com',customer_role:'Course Creator',customer_company:'',story:'I used the workflow to protect a paid resource and connect it to my checkout. It saved me days of trying to piece together conflicting tutorials.',recommendation:'The explanations are clear, practical, and focused on the result.',source_reference:'Content Gating Workshop',submitted_at:'2026-09-12T18:45:00Z',trainingIds:['training-gating'],destinations:[{destination:'testimonial_wall',sort_order:3},{destination:'training_page',training_id:'training-gating',sort_order:2}]},
    {id:'demo-4',status:'hidden',featured:false,format:'written',customer_name:'Taylor Morgan',customer_email:'taylor@example.com',customer_role:'Coach',customer_company:'',story:'This is a shorter draft that I may want to follow up on before publishing.',recommendation:'',source_reference:'',submitted_at:'2026-09-08T09:20:00Z',trainingIds:[],destinations:[]}
];

const state = {testimonials:[], trainings:[], selectedId:null, filter:'all', query:'', client:null, token:null};
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escapeHtml = value => { const div=document.createElement('div'); div.textContent=value ?? ''; return div.innerHTML; };
const labelForStatus = status => ({pending:'Needs review',approved:'Approved',hidden:'Hidden',archived:'Archived'})[status] || status;

function loadDemo() {
    const saved = localStorage.getItem('testimonial-dashboard-demo');
    if (saved) {
        try { const parsed=JSON.parse(saved); state.testimonials=parsed.testimonials; state.trainings=parsed.trainings; return; } catch (_) {}
    }
    state.testimonials=structuredClone(demoTestimonials);
    state.trainings=structuredClone(demoTrainings);
}

function persistDemo() {
    localStorage.setItem('testimonial-dashboard-demo',JSON.stringify({testimonials:state.testimonials,trainings:state.trainings}));
}

function showApp() {
    $('#loginScreen').hidden=true;
    $('#appShell').hidden=false;
    $('#signOutButton').hidden=isLocal;
    render();
}

async function start() {
    bindEvents();
    if (isLocal) {
        loadDemo();
        showApp();
        return;
    }
    try {
        const response=await fetch('/api/testimonial-admin?action=config');
        const config=await response.json();
        if (!response.ok) throw new Error(config.error);
        state.client=window.supabase.createClient(config.url,config.publishableKey);
        const {data:{session}}=await state.client.auth.getSession();
        if (!session) { $('#loginScreen').hidden=false; return; }
        state.token=session.access_token;
        await loadLive();
        $('#modePill').textContent='Live workspace';
        showApp();
    } catch (error) {
        $('#loginScreen').hidden=false;
        $('#loginMessage').textContent=error.message || 'The dashboard could not load.';
    }
}

async function loadLive() {
    const response=await fetch('/api/testimonial-admin',{headers:{Authorization:`Bearer ${state.token}`}});
    const result=await response.json();
    if (!response.ok) throw new Error(result.error || 'The dashboard could not load.');
    state.testimonials=result.testimonials;
    state.trainings=result.trainings;
}

function filteredTestimonials() {
    const query=state.query.toLowerCase();
    return state.testimonials.filter(item => {
        const statusMatches=state.filter==='all' || item.status===state.filter;
        const text=[item.customer_name,item.customer_email,item.customer_role,item.customer_company,item.story,item.source_reference].join(' ').toLowerCase();
        return statusMatches && (!query || text.includes(query));
    });
}

function render() {
    const items=filteredTestimonials();
    $('#pendingCount').textContent=state.testimonials.filter(item=>item.status==='pending').length;
    $('#approvedCount').textContent=state.testimonials.filter(item=>item.status==='approved').length;
    $('#featuredCount').textContent=state.testimonials.filter(item=>item.featured).length;
    $('#totalCount').textContent=state.testimonials.length;
    $('#resultCount').textContent=`${items.length} ${items.length===1?'story':'stories'}`;
    $('#emptyState').hidden=items.length>0;
    $('#testimonialList').innerHTML=items.map(item=>{
        const date=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(new Date(item.submitted_at));
        const initial=(item.customer_name || '?').trim().charAt(0).toUpperCase();
        const avatar=item.avatar_url?`<img src="${escapeHtml(item.avatar_url)}" alt="" loading="lazy"><span class="avatar-fallback">${escapeHtml(initial)}</span>`:`<span class="avatar-fallback visible">${escapeHtml(initial)}</span>`;
        return `<button class="testimonial-item ${state.selectedId===item.id?'selected':''}" data-id="${escapeHtml(item.id)}" type="button">
            <span class="avatar">${avatar}</span>
            <span class="item-copy"><span class="item-topline"><i class="status-dot ${escapeHtml(item.status)}"></i><strong>${escapeHtml(item.customer_name)}</strong>${item.featured?' <span title="Featured">★</span>':''}</span><p>${escapeHtml(item.story)}</p><span class="item-meta">${escapeHtml(item.source_reference || 'General testimonial')} · ${date}</span></span>
            <span class="chevron">›</span>
        </button>`;
    }).join('');
    $$('.avatar img').forEach(image=>{
        image.addEventListener('load',()=>image.classList.add('loaded'));
        image.addEventListener('error',()=>{image.hidden=true;image.nextElementSibling?.classList.add('visible');});
        if (image.complete) {
            if (image.naturalWidth) image.classList.add('loaded');
            else { image.hidden=true; image.nextElementSibling?.classList.add('visible'); }
        }
    });
    $$('.testimonial-item').forEach(button=>button.addEventListener('click',()=>selectTestimonial(button.dataset.id)));
    if (state.selectedId && !state.testimonials.some(item=>item.id===state.selectedId)) closeEditor();
}

function selectTestimonial(id) {
    state.selectedId=id;
    const item=state.testimonials.find(testimonial=>testimonial.id===id);
    if (!item) return;
    $('#editorEmpty').hidden=true;
    $('#editorForm').hidden=false;
    $('#editorPanel').classList.add('open');
    $('#editorStatus').textContent=labelForStatus(item.status);
    $('#editorStatus').className=`status-badge ${item.status}`;
    $('#editorName').textContent=item.customer_name;
    $('#editorMeta').textContent=[item.customer_role,item.customer_company,item.customer_email].filter(Boolean).join(' · ');
    $('#editorRating').textContent=item.rating ? `${'★'.repeat(item.rating)}${'☆'.repeat(5-item.rating)}  ${item.rating}/5` : '';
    $('#editorRating').hidden=!item.rating;
    $('#editorStory').textContent=item.story;
    $('#editorRecommendation').textContent=item.recommendation || '';
    $('#editorRecommendationWrap').hidden=!item.recommendation;
    const statusRadio=$(`input[name="status"][value="${item.status}"]`);
    if (statusRadio) statusRadio.checked=true;
    $('#featuredInput').checked=Boolean(item.featured);
    renderTrainingChoices(item);
    renderDestinations(item);
    $('#saveMessage').textContent='';
    render();
}

function renderTrainingChoices(item) {
    const selected=new Set(item.trainingIds || (item.testimonial_trainings || []).map(row=>row.training_id));
    $('#trainingChoices').innerHTML=state.trainings.map(training=>`<label><input type="checkbox" value="${escapeHtml(training.id)}" ${selected.has(training.id)?'checked':''}><span>${escapeHtml(training.name)}</span></label>`).join('');
}

function renderDestinations(item) {
    const destinations=item.destinations || item.testimonial_destinations || [];
    const grouped=new Map();
    destinations.forEach(destination=>{
        if (!grouped.has(destination.destination)) grouped.set(destination.destination,destination);
    });
    $$('#destinationChoices > .destination > input[type="checkbox"]').forEach(input=>{
        input.checked=grouped.has(input.value);
        const order=$(`[data-order="${input.value}"]`);
        if (order) order.value=grouped.get(input.value)?.sort_order ?? 0;
    });
    const sales=grouped.get('sales_page');
    $('#salesSlug').value=sales?.page_slug || '';
    $('#salesSlugWrap').hidden=!sales;
}

function closeEditor() {
    state.selectedId=null;
    $('#editorForm').hidden=true;
    $('#editorEmpty').hidden=false;
    $('#editorPanel').classList.remove('open');
    render();
}

function collectChanges() {
    const status=$('input[name="status"]:checked')?.value || 'pending';
    const trainingIds=$$('#trainingChoices input:checked').map(input=>input.value);
    const destinations=[];
    $$('#destinationChoices > .destination > input[type="checkbox"]:checked').forEach(input=>{
        const sortOrder=Math.max(0,Number($(`[data-order="${input.value}"]`)?.value) || 0);
        if (input.value==='training_page') {
            trainingIds.forEach(trainingId=>destinations.push({destination:'training_page',training_id:trainingId,page_slug:null,sort_order:sortOrder}));
        } else if (input.value==='sales_page') {
            destinations.push({destination:'sales_page',training_id:null,page_slug:$('#salesSlug').value.trim().replace(/^\/+|\/+$/g,''),sort_order:sortOrder});
        } else {
            destinations.push({destination:input.value,training_id:null,page_slug:null,sort_order:sortOrder});
        }
    });
    return {id:state.selectedId,status,featured:$('#featuredInput').checked,trainingIds,destinations};
}

async function saveChanges(event) {
    event.preventDefault();
    const changes=collectChanges();
    if (changes.destinations.some(item=>item.destination==='sales_page' && !item.page_slug)) {
        $('#saveMessage').textContent='Add the sales-page address first.';
        return;
    }
    $('#saveButton').disabled=true;
    $('#saveButton').textContent='Saving…';
    try {
        if (isLocal) {
            const index=state.testimonials.findIndex(item=>item.id===changes.id);
            state.testimonials[index]={...state.testimonials[index],...changes};
            persistDemo();
        } else {
            const response=await fetch('/api/testimonial-admin',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${state.token}`},body:JSON.stringify(changes)});
            const result=await response.json();
            if (!response.ok) throw new Error(result.error || 'Changes could not be saved.');
            await loadLive();
        }
        selectTestimonial(changes.id);
        $('#saveMessage').textContent=isLocal?'Saved in this local preview.':'Changes saved.';
    } catch (error) {
        $('#saveMessage').textContent=error.message;
    } finally {
        $('#saveButton').disabled=false;
        $('#saveButton').textContent='Save changes';
    }
}

async function addTraining() {
    const name=$('#newTrainingName').value.trim();
    if (!name) return;
    try {
        let training;
        if (isLocal) {
            training={id:`training-${Date.now()}`,name};
            state.trainings.push(training); persistDemo();
        } else {
            const response=await fetch('/api/testimonial-admin?action=training',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${state.token}`},body:JSON.stringify({name})});
            const result=await response.json();
            if (!response.ok) throw new Error(result.error || 'Training could not be added.');
            training=result.training; state.trainings.push(training);
        }
        $('#newTrainingName').value=''; $('#trainingCreator').hidden=true;
        renderTrainingChoices(state.testimonials.find(item=>item.id===state.selectedId));
        const created=$(`#trainingChoices input[value="${CSS.escape(training.id)}"]`); if (created) created.checked=true;
    } catch (error) { $('#saveMessage').textContent=error.message; }
}

function bindEvents() {
    $('#statusTabs').addEventListener('click',event=>{
        const button=event.target.closest('[data-filter]'); if (!button) return;
        state.filter=button.dataset.filter; $$('.tab').forEach(tab=>tab.classList.toggle('active',tab===button)); render();
    });
    $('#searchInput').addEventListener('input',event=>{state.query=event.target.value;render();});
    $('#closeEditor').addEventListener('click',closeEditor);
    $('#editorForm').addEventListener('submit',saveChanges);
    $('#addTrainingButton').addEventListener('click',()=>{$('#trainingCreator').hidden=!$('#trainingCreator').hidden;});
    $('#saveTrainingButton').addEventListener('click',addTraining);
    $('#destinationChoices').addEventListener('change',event=>{
        if (event.target.value==='sales_page') $('#salesSlugWrap').hidden=!event.target.checked;
    });
    $('#loginForm').addEventListener('submit',async event=>{
        event.preventDefault();
        const email=$('#loginEmail').value.trim();
        const code=$('#loginCode').value.trim();
        if ($('#loginCodeWrap').hidden) {
            $('#loginMessage').textContent='Sending your sign-in code…';
            const {error}=await state.client.auth.signInWithOtp({email});
            if (error) { $('#loginMessage').textContent=error.message; return; }
            $('#loginCodeWrap').hidden=false;
            $('#loginCode').required=true;
            $('#loginEmail').readOnly=true;
            $('#loginButton').textContent='Sign in';
            $('#loginMessage').textContent='Enter the complete code from your email.';
            $('#loginCode').focus();
            return;
        }
        $('#loginMessage').textContent='Checking your code…';
        const {data,error}=await state.client.auth.verifyOtp({email,token:code,type:'email'});
        if (error) { $('#loginMessage').textContent=error.message; return; }
        state.token=data.session.access_token;
        try {
            await loadLive();
            $('#modePill').textContent='Live workspace';
            showApp();
        } catch (loadError) {
            $('#loginMessage').textContent=loadError.message || 'The dashboard could not load.';
        }
    });
    $('#signOutButton').addEventListener('click',async()=>{await state.client.auth.signOut();location.reload();});
}

start();
