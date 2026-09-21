import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

const VALID_DESTINATIONS = new Set(['homepage', 'testimonial_wall', 'training_page', 'sales_page']);

function clean(value, max = 160) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function getAdmin() {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secretKey) throw new Error('Supabase environment variables are missing.');
  return createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

function avatarUrl(admin, testimonial) {
  if (testimonial.photo_path) {
    return admin.storage.from('testimonial-photos').getPublicUrl(testimonial.photo_path).data.publicUrl;
  }
  const hash = createHash('sha256').update(testimonial.customer_email.trim().toLowerCase()).digest('hex');
  return `https://www.gravatar.com/avatar/${hash}?s=240&d=404`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const destination = clean(req.query?.destination, 40) || 'testimonial_wall';
  const training = clean(req.query?.training, 120).toLowerCase();
  const page = clean(req.query?.page, 160).replace(/^\/+|\/+$/g, '');
  if (!VALID_DESTINATIONS.has(destination)) return res.status(400).json({ error: 'Invalid testimonial destination.' });
  if (destination === 'training_page' && !training) return res.status(400).json({ error: 'A training slug is required.' });
  if (destination === 'sales_page' && !page) return res.status(400).json({ error: 'A page slug is required.' });

  try {
    const admin = getAdmin();
    let trainingId = null;
    if (training) {
      const { data, error } = await admin.from('trainings').select('id').eq('slug', training).eq('active', true).maybeSingle();
      if (error) throw error;
      if (!data) return res.status(200).json({ testimonials: [], trainings: [] });
      trainingId = data.id;
    }

    let query = admin.from('testimonials').select(`
      id, format, customer_name, customer_email, customer_role, customer_company,
      story, recommendation, rating, photo_path, video_path, featured, approved_at,
      testimonial_destinations!inner(destination,training_id,page_slug,sort_order),
      testimonial_trainings(training_id,trainings(name,slug))
    `)
      .eq('status', 'approved')
      .eq('consent_granted', true)
      .eq('testimonial_destinations.destination', destination)
      .limit(120);

    if (trainingId) query = query.eq('testimonial_destinations.training_id', trainingId);
    if (page) query = query.eq('testimonial_destinations.page_slug', page);

    const { data, error } = await query;
    if (error) throw error;

    const testimonials = await Promise.all((data || []).map(async testimonial => {
      let videoUrl = null;
      if (testimonial.video_path) {
        const { data: signed, error: videoError } = await admin.storage.from('testimonial-videos').createSignedUrl(testimonial.video_path, 3600);
        if (!videoError) videoUrl = signed.signedUrl;
      }
      const placement = testimonial.testimonial_destinations[0] || {};
      const trainings = (testimonial.testimonial_trainings || [])
        .map(item => item.trainings)
        .filter(Boolean);
      return {
        id: testimonial.id,
        format: testimonial.format,
        name: testimonial.customer_name,
        role: testimonial.customer_role,
        company: testimonial.customer_company,
        story: testimonial.story,
        recommendation: testimonial.recommendation,
        rating: testimonial.rating,
        featured: testimonial.featured,
        approvedAt: testimonial.approved_at,
        avatarUrl: avatarUrl(admin, testimonial),
        videoUrl,
        trainings,
        sortOrder: Number(placement.sort_order) || 0
      };
    }));

    testimonials.sort((a, b) => a.sortOrder - b.sortOrder || Number(b.featured) - Number(a.featured) || String(b.approvedAt).localeCompare(String(a.approvedAt)));
    const trainings = [...new Map(testimonials.flatMap(item => item.trainings).map(item => [item.slug, item])).values()]
      .sort((a, b) => a.name.localeCompare(b.name));

    // Reviewers expect a newly approved or hidden story to change the wall on
    // the next refresh. The collection is small, so freshness is preferable to
    // a CDN cache here.
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ testimonials, trainings });
  } catch (error) {
    console.error('Public testimonial request failed:', error);
    return res.status(500).json({ error: 'Testimonials could not be loaded.' });
  }
}
