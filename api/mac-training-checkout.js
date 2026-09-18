export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).end();
  const {MAC_TRAINING_PAYMENT_URL:url, MAC_TRAINING_PAYMENT_LINK_ID:id, MAC_TRAINING_READY:ready, STRIPE_MAC_TRAINING_WEBHOOK_SECRET:secret, SYSTEME_API_KEY:key} = process.env;
  if (ready !== 'true' || !id || !secret || !key || Date.now() >= Date.parse('2026-09-19T16:00:00Z')) return res.status(503).json({available:false});
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'buy.stripe.com') throw new Error();
    return res.status(200).json({url:parsed.href});
  } catch { return res.status(503).json({available:false}); }
}
