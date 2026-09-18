fetch('/api/mac-training-checkout', {cache:'no-store'})
  .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
  .then(data => {
    const link = document.getElementById('checkout');
    const url = new URL(data.url);
    if (url.protocol !== 'https:' || url.hostname !== 'buy.stripe.com') throw new Error();
    link.href = url.href;
    link.hidden = false;
    document.getElementById('checkout-status').hidden = true;
  })
  .catch(() => { document.getElementById('checkout-status').textContent = 'Registration is not open right now. Please check back soon.'; });
