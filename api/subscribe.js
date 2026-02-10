// Vercel Serverless Function - api/subscribe.js
// Handles email subscriptions via Systeme.io API

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
    // Call Systeme.io API to create contact with tag
    const response = await fetch('https://api.systeme.io/api/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        email: email,
        tags: ['Website-Subscriber']
      })
    });

    const data = await response.json();

    // Check if request was successful
    if (!response.ok) {
      console.error('Systeme.io API error:', data);
      
      // Handle specific error cases
      if (response.status === 409 || data.message?.includes('already exists')) {
        // Contact already exists - still a success from user perspective
        return res.status(200).json({ 
          success: true, 
          message: 'You are already subscribed!' 
        });
      }
      
      return res.status(response.status).json({ 
        error: data.message || 'Failed to subscribe. Please try again.' 
      });
    }

    // Success!
    return res.status(200).json({ 
      success: true, 
      message: 'Successfully subscribed!' 
    });

  } catch (error) {
    console.error('Error subscribing contact:', error);
    return res.status(500).json({ 
      error: 'An unexpected error occurred. Please try again.' 
    });
  }
}
