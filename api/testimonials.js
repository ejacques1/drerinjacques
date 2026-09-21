import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'node:crypto';

const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const MAX_PHOTO_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 500 * 1024 * 1024;
const WORKSHOPS = {
  'gating-workshop': 'Email Signup Page Workshop'
};

function text(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function safeFileName(name, fallback) {
  const cleaned = text(name, 180)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

function validateFile(file, kind) {
  if (!file) return null;
  if (typeof file !== 'object') return 'Invalid file information.';
  const type = text(file.type, 100);
  const size = Number(file.size);
  const allowed = kind === 'photo' ? PHOTO_TYPES : VIDEO_TYPES;
  const limit = kind === 'photo' ? MAX_PHOTO_SIZE : MAX_VIDEO_SIZE;
  if (!allowed.has(type)) return `Unsupported ${kind} format.`;
  if (!Number.isFinite(size) || size <= 0 || size > limit) return `${kind === 'photo' ? 'Photo' : 'Video'} is too large.`;
  return null;
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secretKey) throw new Error('Supabase environment variables are missing.');
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function submissionKey(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || String(req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown');
  const salt = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createHmac('sha256', salt).update(ip).digest('hex');
}

async function createUpload(admin, bucket, path) {
  const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path);
  if (error) throw error;
  return { bucket, path, token: data.token };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const body = req.body || {};
  if (text(body.website, 200)) return res.status(200).json({ success: true });

  const startedAt = Number(body.startedAt);
  const elapsed = Date.now() - startedAt;
  if (!Number.isFinite(startedAt) || elapsed < 2500 || elapsed > 24 * 60 * 60 * 1000) {
    return res.status(400).json({ error: 'Please refresh the page and try again.' });
  }

  const format = body.storyType === 'video' ? 'video' : 'written';
  const name = text(body.name, 120);
  const email = text(body.email, 254).toLowerCase();
  const story = text(body.story, 10000);
  const consentGranted = body.consent === true;

  if (!name || !validEmail(email) || !story || !consentGranted) {
    return res.status(400).json({ error: 'Name, valid email, story, and publication permission are required.' });
  }

  const photoError = validateFile(body.photo, 'photo');
  const videoError = validateFile(body.video, 'video');
  if (photoError || videoError) return res.status(400).json({ error: photoError || videoError });
  if (format === 'video' && !body.video) return res.status(400).json({ error: 'A video file is required.' });

  try {
    const admin = getSupabaseAdmin();
    const workshopSlug = text(body.workshop, 120).toLowerCase();
    const workshopName = WORKSHOPS[workshopSlug] || '';
    let trainingId = null;
    if (workshopName) {
      const { data: training, error: trainingError } = await admin.from('trainings')
        .upsert({ name: workshopName, slug: workshopSlug, active: true }, { onConflict: 'slug' })
        .select('id')
        .single();
      if (trainingError) throw trainingError;
      trainingId = training.id;
    }
    const { data: allowed, error: rateError } = await admin.rpc('check_testimonial_rate_limit', {
      p_key_hash: submissionKey(req),
      p_limit: 5,
      p_window: '1 hour'
    });
    if (rateError) throw rateError;
    if (!allowed) return res.status(429).json({ error: 'Too many submissions. Please try again later.' });

    const id = crypto.randomUUID();
    const photoPath = body.photo ? `${id}/${safeFileName(body.photo.name, 'photo.jpg')}` : null;
    const videoPath = body.video ? `${id}/${safeFileName(body.video.name, 'video.mp4')}` : null;
    const uploads = {};

    if (photoPath) uploads.photo = await createUpload(admin, 'testimonial-photos', photoPath);
    if (videoPath) uploads.video = await createUpload(admin, 'testimonial-videos', videoPath);

    const { error } = await admin.from('testimonials').insert({
      id,
      format,
      status: 'pending',
      customer_name: name,
      customer_email: email,
      customer_role: text(body.role, 160) || null,
      customer_company: text(body.company, 160) || null,
      story,
      recommendation: text(body.recommendation, 5000) || null,
      photo_path: photoPath,
      video_path: videoPath,
      source: 'website_form',
      source_reference: workshopName || text(body.program, 200) || null,
      consent_granted: true,
      consent_version: '2026-09-20',
      consented_at: new Date().toISOString()
    });

    if (error) throw error;

    if (trainingId) {
      const { error: connectionError } = await admin.from('testimonial_trainings').insert({
        testimonial_id: id,
        training_id: trainingId
      });
      if (connectionError) {
        await admin.from('testimonials').delete().eq('id', id);
        throw connectionError;
      }
    }

    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (Object.keys(uploads).length && !publishableKey) throw new Error('Supabase publishable key is missing.');

    return res.status(201).json({
      success: true,
      id,
      uploads,
      supabase: Object.keys(uploads).length ? { url: process.env.SUPABASE_URL, publishableKey } : null
    });
  } catch (error) {
    console.error('Testimonial submission failed:', error);
    return res.status(500).json({ error: 'Your story could not be submitted. Please try again.' });
  }
}
