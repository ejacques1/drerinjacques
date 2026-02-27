/**
 * Vercel Serverless Function — TOS Checker API
 * POST /api/tos-check
 * Body: { url: "https://perplexity.ai" }
 *
 * Flow:
 * 1. Check cache (KV or in-memory) for recent result
 * 2. If miss → scrape TOS via Apify actor
 * 3. Run AI analysis via Claude (Anthropic API)
 * 4. Cache result → return JSON
 *
 * Environment variables needed:
 *   APIFY_API_TOKEN     — Apify API token
 *   ANTHROPIC_API_KEY   — Anthropic API key
 *   KV_REST_API_URL     — Vercel KV URL (optional, falls back to in-memory)
 *   KV_REST_API_TOKEN   — Vercel KV token (optional)
 */

const CACHE_TTL_HOURS = 24;

// ============ MAIN HANDLER ============
module.exports = async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', 'https://drerinjacques.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        // Normalize the domain for cache key
        const domain = extractDomain(url);
        if (!domain) return res.status(400).json({ error: 'Invalid URL' });

        // 1. Check cache
        const cached = await checkCache(domain);
        if (cached) {
            return res.status(200).json({ ...cached, cached: true });
        }

        // 2. Scrape TOS
        const tosText = await scrapeTOS(url, domain);
        if (!tosText || tosText.length < 200) {
            return res.status(422).json({
                error: 'Could not find or extract Terms of Service. Try pasting the direct TOS URL.'
            });
        }

        // 3. AI Analysis via Claude
        const analysis = await analyzeTOS(tosText, domain);

        // 4. Cache and return
        const result = {
            domain,
            verdict: analysis.verdict,
            flags: analysis.flags,
            comparison: analysis.comparison || [],
            checked_at: new Date().toISOString(),
            cached: false
        };

        await saveCache(domain, result);
        return res.status(200).json(result);

    } catch (err) {
        console.error('TOS Check Error:', err);
        return res.status(500).json({
            error: 'Something went wrong while analyzing the TOS. Please try again.'
        });
    }
};


// ============ DOMAIN EXTRACTION ============
function extractDomain(url) {
    try {
        const u = new URL(url.startsWith('http') ? url : 'https://' + url);
        return u.hostname.replace(/^www\./, '');
    } catch {
        return null;
    }
}


// ============ SCRAPING VIA APIFY ============
async function scrapeTOS(url, domain) {
    const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
    if (!APIFY_TOKEN) throw new Error('APIFY_API_TOKEN not configured');

    // Known TOS URL patterns for popular platforms
    const knownTosUrls = {
        'perplexity.ai': 'https://www.perplexity.ai/hub/terms-of-service',
        'openai.com': 'https://openai.com/policies/terms-of-use',
        'chatgpt.com': 'https://openai.com/policies/terms-of-use',
        'claude.ai': 'https://www.anthropic.com/legal/consumer-terms',
        'anthropic.com': 'https://www.anthropic.com/legal/consumer-terms',
        'gemini.google.com': 'https://policies.google.com/terms/generative-ai',
        'midjourney.com': 'https://docs.midjourney.com/docs/terms-of-service',
        'github.com': 'https://github.com/customer-terms',
        'grok.x.ai': 'https://x.ai/legal/terms-of-service',
        'x.ai': 'https://x.ai/legal/terms-of-service',
        'jasper.ai': 'https://www.jasper.ai/terms',
        'notion.so': 'https://www.notion.so/terms',
        'canva.com': 'https://www.canva.com/policies/terms-of-use/',
        'grammarly.com': 'https://www.grammarly.com/terms',
        'copy.ai': 'https://www.copy.ai/terms',
        'writesonic.com': 'https://writesonic.com/terms',
        'runway.ml': 'https://runwayml.com/terms-of-use/',
        'elevenlabs.io': 'https://elevenlabs.io/terms-of-service',
        'stability.ai': 'https://stability.ai/terms-of-use',
        'adobe.com': 'https://www.adobe.com/legal/terms.html',
    };

    // Determine the URL to scrape
    const tosUrl = knownTosUrls[domain] || url;

    // Use Apify's Web Scraper actor (Puppeteer-based)
    const actorId = 'apify~web-scraper';
    const input = {
        startUrls: [{ url: tosUrl }],
        pageFunction: async function pageFunction(context) {
            const { page, request } = context;

            // Wait for content to load
            await page.waitForSelector('body', { timeout: 15000 });

            // Extract main text content
            const text = await page.evaluate(() => {
                // Remove nav, footer, scripts, styles
                const remove = document.querySelectorAll('nav, footer, script, style, header, .cookie-banner, .sidebar');
                remove.forEach(el => el.remove());

                // Try to find the main content area
                const selectors = [
                    'main', 'article', '[role="main"]',
                    '.terms', '.tos', '.legal', '.content',
                    '.entry-content', '.post-content',
                    '#content', '#main', '#terms'
                ];
                for (const sel of selectors) {
                    const el = document.querySelector(sel);
                    if (el && el.innerText.length > 500) return el.innerText;
                }
                return document.body.innerText;
            });

            return { url: request.url, text: text.substring(0, 50000) };
        },
        proxyConfiguration: { useApifyProxy: true },
        maxRequestsPerCrawl: 3,
        maxConcurrency: 1,
    };

    // Run the actor synchronously
    const runRes = await fetch(`https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });

    if (!runRes.ok) {
        const errText = await runRes.text();
        console.error('Apify error:', errText);
        throw new Error('Scraping failed');
    }

    const items = await runRes.json();
    if (!items || !items.length || !items[0].text) {
        throw new Error('No content extracted');
    }

    return items[0].text;
}


// ============ AI ANALYSIS VIA CLAUDE ============
async function analyzeTOS(tosText, domain) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY not configured');

    // Truncate to fit context window
    const truncated = tosText.substring(0, 30000);

    const systemPrompt = `You are a TOS Red Flag Analyzer for AI platforms. You read Terms of Service documents and produce a structured risk report that a non-lawyer can understand.

Your job: Analyze the provided TOS text and evaluate it across exactly 9 risk categories. For each, give a risk level and a plain-English explanation a 4th grader could understand.

The 9 categories:
1. Content Ownership — Who owns what you create using the platform?
2. Content License — What rights does the company take to use your content?
3. Commercial Use — Can you use the outputs for business/money-making purposes?
4. Data Training — Can they use your inputs/outputs to train their AI?
5. Privacy & Data Collection — What data do they collect and share?
6. Liability & Indemnification — What are you responsible for if something goes wrong?
7. Termination Rights — Can they delete your account or content without warning?
8. Changes to Terms — Can they change the rules without telling you?
9. Dispute Resolution — If there's a problem, how is it resolved? (Arbitration vs court)

RESPONSE FORMAT — Return valid JSON only, no markdown:
{
  "verdict": {
    "level": "red" | "yellow" | "green",
    "label": "HIGH RISK" | "PROCEED WITH CAUTION" | "RELATIVELY SAFE",
    "headline": "One-sentence verdict about this platform's TOS",
    "summary": "2-3 sentence plain-English summary of the biggest concerns"
  },
  "flags": [
    {
      "name": "Category Name",
      "risk": "red" | "yellow" | "green",
      "finding": "What the TOS actually says (specific, factual)",
      "plain_english": "What this means for you in simple language"
    }
  ],
  "comparison": [
    {
      "Area": "Category name",
      "This Platform": "Brief status",
      "Industry Standard": "What's typical",
      "Risk": "🔴 / 🟡 / 🟢"
    }
  ]
}

Rules:
- Be factual. Only flag what the TOS actually says.
- If a topic isn't addressed in the TOS, say "Not addressed — which itself is a yellow flag."
- Use the exact risk colors: red = dangerous, yellow = caution, green = acceptable.
- The overall verdict should be red if 3+ flags are red, yellow if 2+ flags are yellow, green otherwise.
- comparison table should have one row per category (9 rows).
- Do NOT add any text outside the JSON object.`;

    const userPrompt = `Analyze this Terms of Service document from ${domain}:\n\n${truncated}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 4000,
            system: systemPrompt,
            messages: [
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.3
        })
    });

    if (!res.ok) {
        const err = await res.text();
        console.error('Claude API error:', err);
        throw new Error('AI analysis failed');
    }

    const data = await res.json();
    const text = data.content[0].text;

    // Parse JSON from Claude's response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Failed to parse AI response');
    return JSON.parse(jsonMatch[0]);
}


// ============ CACHE LAYER ============
// Uses Vercel KV if available, otherwise in-memory (resets on cold start)
const memoryCache = {};

async function checkCache(domain) {
    // Try Vercel KV first
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        try {
            const res = await fetch(
                `${process.env.KV_REST_API_URL}/get/tos:${domain}`,
                { headers: { 'Authorization': `Bearer ${process.env.KV_REST_API_TOKEN}` } }
            );
            if (res.ok) {
                const data = await res.json();
                if (data.result) {
                    const parsed = JSON.parse(data.result);
                    const age = (Date.now() - new Date(parsed.checked_at).getTime()) / (1000 * 60 * 60);
                    if (age < CACHE_TTL_HOURS) return parsed;
                }
            }
        } catch (e) {
            console.warn('KV cache read failed:', e.message);
        }
    }

    // Fallback to memory
    const cached = memoryCache[domain];
    if (cached) {
        const age = (Date.now() - new Date(cached.checked_at).getTime()) / (1000 * 60 * 60);
        if (age < CACHE_TTL_HOURS) return cached;
    }

    return null;
}

async function saveCache(domain, data) {
    // Try Vercel KV
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        try {
            await fetch(
                `${process.env.KV_REST_API_URL}/set/tos:${domain}`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.KV_REST_API_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        value: JSON.stringify(data),
                        ex: CACHE_TTL_HOURS * 3600
                    })
                }
            );
        } catch (e) {
            console.warn('KV cache write failed:', e.message);
        }
    }

    // Always save to memory too
    memoryCache[domain] = data;
}
