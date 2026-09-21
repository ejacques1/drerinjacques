import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

const VALID_STATUSES = new Set(['pending', 'approved', 'hidden', 'archived']);
const VALID_DESTINATIONS = new Set(['homepage', 'testimonial_wall', 'training_page', 'sales_page']);

function getConfig() {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !secretKey || !publishableKey) throw new Error('Supabase environment variables are missing.');
  return { url, secretKey, publishableKey };
}

function getAdmin() {
  const { url, secretKey } = getConfig();
  return createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

function clean(value, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function slugify(value) {
  return clean(value, 120).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function requireAdmin(req, admin) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user?.email) return null;
  const allowed = String(process.env.TESTIMONIAL_ADMIN_EMAILS || '')
    .split(',').map(email => email.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length || !allowed.includes(data.user.email.toLowerCase())) return null;
  return data.user;
}

async function listDashboard(admin, res) {
  const [{ data: testimonials, error: testimonialError }, { data: trainings, error: trainingError }] = await Promise.all([
    admin.from('testimonials').select('*, testimonial_trainings(training_id), testimonial_destinations(id,destination,training_id,page_slug,sort_order)').order('submitted_at', { ascending: false }),
    admin.from('trainings').select('id,name,slug,active').order('name')
  ]);
  if (testimonialError) throw testimonialError;
  if (trainingError) throw trainingError;
  const dashboardTestimonials = testimonials.map(testimonial => {
    if (testimonial.photo_path) {
      const { data } = admin.storage.from('testimonial-photos').getPublicUrl(testimonial.photo_path);
      return { ...testimonial, avatar_url: data.publicUrl };
    }
    const hash = createHash('sha256').update(testimonial.customer_email.trim().toLowerCase()).digest('hex');
    return { ...testimonial, avatar_url: `https://www.gravatar.com/avatar/${hash}?s=160&d=404` };
  });
  return res.status(200).json({ testimonials: dashboardTestimonials, trainings });
}

async function updateTestimonial(admin, body, res) {
  const id = clean(body.id, 80);
  const status = clean(body.status, 20);
  if (!id || !VALID_STATUSES.has(status)) return res.status(400).json({ error: 'Invalid testimonial update.' });
  const trainingIds = [...new Set(Array.isArray(body.trainingIds) ? body.trainingIds.map(id => clean(id, 80)).filter(Boolean) : [])];
  const destinations = Array.isArray(body.destinations) ? body.destinations : [];
  const safeDestinations = [];
  for (const destination of destinations) {
    const type = clean(destination.destination, 40);
    const trainingId = clean(destination.training_id, 80) || null;
    const pageSlug = clean(destination.page_slug, 160).replace(/^\/+|\/+$/g, '') || null;
    if (!VALID_DESTINATIONS.has(type)) return res.status(400).json({ error: 'Invalid display destination.' });
    if (type === 'training_page' && !trainingId) return res.status(400).json({ error: 'Choose a training for each training-page placement.' });
    if (type === 'sales_page' && !pageSlug) return res.status(400).json({ error: 'Enter the sales-page address.' });
    safeDestinations.push({ testimonial_id: id, destination: type, training_id: trainingId, page_slug: pageSlug, sort_order: Math.max(0, Number(destination.sort_order) || 0) });
  }

  const { error: updateError } = await admin.from('testimonials').update({
    status,
    featured: body.featured === true,
    approved_at: status === 'approved' ? new Date().toISOString() : null
  }).eq('id', id);
  if (updateError) throw updateError;

  const { error: trainingDeleteError } = await admin.from('testimonial_trainings').delete().eq('testimonial_id', id);
  if (trainingDeleteError) throw trainingDeleteError;
  if (trainingIds.length) {
    const { error } = await admin.from('testimonial_trainings').insert(trainingIds.map(training_id => ({ testimonial_id: id, training_id })));
    if (error) throw error;
  }

  const { error: destinationDeleteError } = await admin.from('testimonial_destinations').delete().eq('testimonial_id', id);
  if (destinationDeleteError) throw destinationDeleteError;
  if (safeDestinations.length) {
    const { error } = await admin.from('testimonial_destinations').insert(safeDestinations);
    if (error) throw error;
  }
  return res.status(200).json({ success: true });
}

async function createTraining(admin, body, res) {
  const name = clean(body.name, 120);
  const baseSlug = slugify(name);
  if (!name || !baseSlug) return res.status(400).json({ error: 'Enter a training name.' });
  const { data, error } = await admin.from('trainings').insert({ name, slug: `${baseSlug}-${Date.now().toString(36)}` }).select('id,name,slug,active').single();
  if (error) throw error;
  return res.status(201).json({ training: data });
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET' && req.query?.action === 'config') {
      const { url, publishableKey } = getConfig();
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ url, publishableKey });
    }
    const admin = getAdmin();
    const user = await requireAdmin(req, admin);
    if (!user) return res.status(401).json({ error: 'You are not authorized to use this dashboard.' });
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'GET') return listDashboard(admin, res);
    if (req.method === 'PATCH') return updateTestimonial(admin, req.body || {}, res);
    if (req.method === 'POST' && req.query?.action === 'training') return createTraining(admin, req.body || {}, res);
    res.setHeader('Allow', 'GET, PATCH, POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    console.error('Testimonial dashboard request failed:', error);
    return res.status(500).json({ error: 'The dashboard request could not be completed.' });
  }
}
