import {saveTaggedContact} from './_lib/systeme-signup.js';

const html = `<div class="guide-layout">
  <div class="library-intro">
    <p class="eyebrow">YOUR GUIDE IS OPEN</p>
    <h2>Set up your AI second brain.</h2>
    <p>Follow these steps in order. Your AI will first show you a proposed structure, so you can review it before anything is created.</p>
  </div>
  <div class="steps">
    <article class="step"><h3>Download Obsidian.</h3><p>Go to <a href="https://obsidian.md/download" target="_blank" rel="noopener noreferrer">obsidian.md/download</a>, install the app, and open it.</p></article>
    <article class="step"><h3>Create or choose a vault.</h3><p>An Obsidian vault is simply the folder that holds your notes and files. Give it a name you will recognize.</p></article>
    <article class="step"><h3>Add what you want to organize.</h3><p>Place the notes, articles, PDFs, and project files you want included inside the vault folder. Keep a backup of anything important.</p></article>
    <article class="step"><h3>Open that vault folder in your AI coding app.</h3><p>In Claude Code or Codex, choose the Obsidian vault as the project or source folder. Then paste the prompt below.</p></article>
  </div>
  <section class="prompt-section" aria-labelledby="prompt-title">
    <p class="eyebrow">COPY AND PASTE</p>
    <h2 id="prompt-title">Your exact prompt</h2>
    <article class="prompt-card">
      <header><h3 class="prompt-label">Build the searchable wiki</h3><button class="copy-prompt" type="button">Copy prompt</button></header>
      <p class="prompt-text">Review everything in this Obsidian vault without moving, renaming, or deleting anything. Create a searchable wiki with an index, category pages, one summary note for each project or major topic, links to the original files, related-note connections, a project dashboard, and an Obsidian Canvas showing how everything connects. Flag anything you cannot classify confidently. Show me your proposed structure before creating it.</p>
    </article>
  </section>
  <aside class="finish-note"><h3>Review before it builds.</h3><p>Read the proposed structure first. Ask for any changes you want, then tell the AI to create it. Your original files should stay in place.</p></aside>
</div>`;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', 'application/json');
  const reply = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return reply(405, {error: 'Please use the email form to open the guide.'}); }
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) return reply(415, {error: 'Please use the email form.'});
  if (req.headers.origin) {
    try { if (new URL(req.headers.origin).host !== req.headers.host) return reply(403, {error: 'Please submit from the guide page.'}); }
    catch { return reply(403, {error: 'Invalid origin.'}); }
  }
  let body = req.body;
  try { if (typeof body === 'string') body = JSON.parse(body); }
  catch { return reply(400, {error: 'Please enter a valid email address.'}); }
  if (!body || typeof body !== 'object' || body.website) return reply(400, {error: 'Please try again.'});
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(email) || email.split('@')[0].length > 64 || email.includes('..')) return reply(400, {error: 'Please enter a valid email address, such as you@example.com.'});
  const key = process.env.SYSTEME_API_KEY;
  const unavailable = () => reply(503, {error: 'We could not save your signup right now. Please try again shortly.'});
  if (!key) { console.warn('Contact capture not configured: SYSTEME_API_KEY is missing.'); return unavailable(); }
  try {
    await saveTaggedContact(email, 'Obsidian', key, {createTagIfMissing: true});
  } catch (error) {
    console.warn('Resource signup incomplete:', 'Obsidian', error.name === 'TimeoutError' ? 'timeout' : /^((tag|contact)_[a-z0-9_]+)$/.test(error.message) ? error.message : 'provider_unavailable');
    return unavailable();
  }
  return reply(200, {html});
}
