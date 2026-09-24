import {saveTaggedContact} from './_lib/systeme-signup.js';

const html = `<div class="guide-layout">
  <div class="library-intro">
    <p class="eyebrow">OFFICIAL STUDENT OFFER</p>
    <h2>Claim $100 in Codex credits.</h2>
    <p>This offer comes directly from OpenAI. Here is what you need to know before you begin.</p>
  </div>
  <div class="fact-list" aria-label="Offer summary">
    <div class="fact"><strong>$100</strong><span>in ChatGPT credits for Codex</span></div>
    <div class="fact"><strong>US + Canada</strong><span>for eligible university students</span></div>
    <div class="fact"><strong>12 months</strong><span>to use the credits after they are granted</span></div>
  </div>
  <section class="offer-card">
    <h3>Who qualifies?</h3>
    <p>You must be a current student enrolled at a degree-granting university in the United States or Canada and live in the United States or Canada when you claim the offer. Approval depends on successful student verification. The offer is limited to one per student.</p>
  </section>
  <div class="steps">
    <article class="step"><h3>Sign in to ChatGPT.</h3><p>You may use a personal ChatGPT account. OpenAI says the account can be on the Free, Go, Plus, or Pro plan.</p></article>
    <article class="step"><h3>Open the official student page.</h3><p>Use the button below to reach OpenAI’s Codex for Students page, then select <strong>Claim now</strong>.</p></article>
    <article class="step"><h3>Verify your student status.</h3><p>Begin the verification using your ChatGPT account and university email, then complete the requested school information.</p></article>
    <article class="step"><h3>Use your Codex credits.</h3><p>After verification succeeds, OpenAI automatically adds the credits to your ChatGPT account. They expire 12 months after the grant date.</p></article>
  </div>
  <section class="offer-card">
    <h3>Ready to claim it?</h3>
    <p>This button takes you to the official OpenAI Developers page.</p>
    <a class="claim-button" href="https://developers.openai.com/community/students" target="_blank" rel="noopener noreferrer">Open the student offer →</a>
  </section>
  <p class="source-note">Offer terms and availability can change. Review the current details on the <a href="https://developers.openai.com/community/students" target="_blank" rel="noopener noreferrer">official OpenAI Codex for Students page</a>.</p>
</div>`;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', 'application/json');
  const reply = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return reply(405, {error: 'Please use the email form to open the details.'}); }
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) return reply(415, {error: 'Please use the email form.'});
  if (req.headers.origin) {
    try { if (new URL(req.headers.origin).host !== req.headers.host) return reply(403, {error: 'Please submit from the student guide page.'}); }
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
    await saveTaggedContact(email, 'Codex Students', key, {createTagIfMissing: true});
  } catch (error) {
    console.warn('Resource signup incomplete:', 'Codex Students', error.name === 'TimeoutError' ? 'timeout' : /^((tag|contact)_[a-z0-9_]+)$/.test(error.message) ? error.message : 'provider_unavailable');
    return unavailable();
  }
  return reply(200, {html});
}
