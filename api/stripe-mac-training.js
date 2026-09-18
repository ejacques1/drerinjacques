import Stripe from 'stripe';
import {saveTaggedContact} from './_lib/systeme-signup.js';

export const config = {api:{bodyParser:false}};

// No API requests are made with this client; signature verification is local.
const stripe = new Stripe('sk_signature_verification_only');

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  const secret = process.env.STRIPE_MAC_TRAINING_WEBHOOK_SECRET;
  const linkId = process.env.MAC_TRAINING_PAYMENT_LINK_ID;
  const key = process.env.SYSTEME_API_KEY;
  if (!secret || !linkId || !key) return res.status(503).json({error:'Not configured'});
  let event;
  try {
    const chunks = []; let bytes = 0;
    for await (const chunk of req) {
      const part = Buffer.from(chunk); bytes += part.length;
      if (bytes > 1048576) return res.status(413).end();
      chunks.push(part);
    }
    event = stripe.webhooks.constructEvent(Buffer.concat(chunks), req.headers['stripe-signature'], secret);
  } catch { return res.status(400).json({error:'Invalid signature or payload'}); }
  if (!['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)) return res.status(200).json({received:true});
  const session = event.data?.object;
  if (session?.payment_link !== linkId || !['paid','no_payment_required'].includes(session.payment_status)) return res.status(200).json({received:true});
  const fullPrice = session.payment_status === 'paid' && session.amount_total === 2500;
  // Only the approved workshop promotion can fulfill a zero-dollar checkout.
  const approvedPromo = 'promo_1UGQu8PpfIBUNKpbK93XxBko';
  const usesApprovedPromo = Array.isArray(session.discounts) && session.discounts.some(discount =>
    (typeof discount.promotion_code === 'string' ? discount.promotion_code : discount.promotion_code?.id) === approvedPromo);
  const freeTest = session.amount_total === 0 && session.amount_subtotal === 2500 &&
    session.total_details?.amount_discount === 2500 && usesApprovedPromo;
  if (event.livemode !== true || session.livemode !== true || session.mode !== 'payment' || session.currency !== 'usd' || (!fullPrice && !freeTest)) return res.status(422).json({error:'Unexpected workshop payment'});
  const email = (session.customer_details?.email || session.customer_email || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(422).json({error:'Payment email missing'});
  try {
    // Repeated deliveries converge on the existing contact and tag. Never remove/re-add
    // the tag: doing so could restart reminder workflows on Stripe retries.
    await saveTaggedContact(email, 'Mac Training', key);
    return res.status(200).json({received:true});
  } catch {
    // A non-2xx response makes Stripe retry; do not acknowledge failed CRM writes.
    console.error('mac_training_systeme_sync_failed', event.id);
    return res.status(503).json({error:'Contact sync pending; retry required'});
  }
}
