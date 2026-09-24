const form = document.querySelector('#unlock-form');

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const button = form.querySelector('button');
  const message = document.querySelector('#form-message');
  button.disabled = true;
  button.textContent = 'Saving your signup…';
  message.textContent = '';
  try {
    const response = await fetch('/api/unlock-codex-students', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: form.email.value, website: form.website.value}),
      signal: AbortSignal.timeout(20000)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Please try again.');
    if (typeof data.html !== 'string' || !data.html.trim()) throw new Error('The details could not load. Please try again.');
    const remaining = document.querySelector('#remaining');
    remaining.innerHTML = data.html;
    remaining.hidden = false;
    document.querySelector('#gate').outerHTML = '<section class="gate unlocked" aria-label="Signup complete"><div class="lock-mark" aria-hidden="true">✓</div><p class="eyebrow">YOU’RE IN</p><h2>The details are open.</h2><p>Your signup is saved. Follow the official steps below.</p><a class="library-link" href="#remaining">See the details ↓</a></section>';
    remaining.focus();
    remaining.scrollIntoView({block: 'start'});
  } catch (error) {
    message.textContent = error.name === 'TimeoutError' || error instanceof TypeError
      ? 'We couldn’t connect just now. Please try again.' : error.message;
    button.disabled = false;
    button.textContent = 'Unlock the details →';
  }
});
