// Vercel Serverless Function - api/subscribe.js
// Handles email subscriptions via Systeme.io API

const SIO = 'https://api.systeme.io/api';
const NEWSLETTER_TAG = 'AI Upfront';

// Adds the "AI Upfront" tag (creating it the first time). Never blocks the signup.
async function tagAiUpfront(apiKey, email, contactId) {
  const headers = { 'Content-Type': 'application/json', 'X-API-Key': apiKey };
  try {
    if (!contactId) {
      const r = await fetch(`${SIO}/contacts?email=${encodeURIComponent(email)}`, { headers });
      const d = await r.json().catch(() => ({}));
      contactId = d.items && d.items[0] && d.items[0].id;
      if (!contactId) return;
    }
    const tr = await fetch(`${SIO}/tags?query=${encodeURIComponent(NEWSLETTER_TAG)}`, { headers });
    const td = await tr.json().catch(() => ({}));
    let tag = (td.items || []).find((t) => t.name === NEWSLETTER_TAG);
    if (!tag) {
      const cr = await fetch(`${SIO}/tags`, { method: 'POST', headers, body: JSON.stringify({ name: NEWSLETTER_TAG }) });
      tag = await cr.json().catch(() => null);
    }
    if (!tag || !tag.id) return;
    await fetch(`${SIO}/contacts/${contactId}/tags`, { method: 'POST', headers, body: JSON.stringify({ tagId: tag.id }) });
  } catch (err) {
    console.error('AI Upfront tag failed:', err && err.message);
  }
}

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get email from request body
  const { email } = req.body;

  // Validate email
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  // Get API key from environment variable
  const apiKey = process.env.SYSTEME_API_KEY;

  if (!apiKey) {
    console.error('SYSTEME_API_KEY not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // STEP 1: Create contact with campaign subscription
    const createResponse = await fetch('https://api.systeme.io/api/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        email: email,
        language: 'en',
        campaignIds: [1069815]
      })
    });

    const createData = await createResponse.json();

    // Handle errors from contact creation
    if (!createResponse.ok) {
      console.error('Systeme.io API error (create contact):', createData);
      
      // Email already exists
      if (
        createResponse.status === 409 || 
        createResponse.status === 422 ||
        createData.message?.includes('already exists') ||
        createData.message?.includes('already used') ||
        createData.detail?.includes('already used')
      ) {
        await tagAiUpfront(apiKey, email, null);
        return res.status(200).json({ 
          success: true, 
          message: 'You are already subscribed!' 
        });
      }
      
      return res.status(createResponse.status).json({ 
        error: createData.message || 'Failed to subscribe. Please try again.' 
      });
    }

    // Get the contact ID from the response
    const contactId = createData.id;
    
    if (!contactId) {
      console.error('No contact ID returned:', createData);
      return res.status(500).json({ error: 'Contact created but ID missing' });
    }

    console.log('Contact created successfully with campaign subscription:', createData);
    await tagAiUpfront(apiKey, email, contactId);

    // Success!
    return res.status(200).json({ 
      success: true, 
      message: 'Successfully subscribed! You\'ll start receiving updates soon.' 
    });

  } catch (error) {
    console.error('Error subscribing contact:', error);
    return res.status(500).json({ 
      error: 'An unexpected error occurred. Please try again.' 
    });
  }
}
