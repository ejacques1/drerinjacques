/**
 * Vercel Serverless Function — TOS Checker API
 * POST /api/tos-check
 * Body: { url: "https://perplexity.ai" } OR { text: "raw TOS content...", domain: "example.com" }
 *
 * Flow:
 * 1. Check cache (KV or in-memory) for recent result (URL mode only)
 * 2. If miss → scrape TOS via Apify Website Content Crawler
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
    const origin = req.headers.origin || '';
    const allowedOrigins = ['https://drerinjacques.com', 'https://www.drerinjacques.com'];
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', 'https://drerinjacques.com');
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { url, text, domain: providedDomain } = req.body;

        // === MODE 1: Pasted TOS text — always fresh analysis, no cache ===
        if (text && text.length > 200) {
            const label = providedDomain || 'Unknown Platform';
            console.log(`Pasted text mode: ${text.length} chars for "${label}"`);

            const analysis = await analyzeTOS(text, label);

            return res.status(200).json({
                domain: label,
                verdict: analysis.verdict,
                flags: analysis.flags,
                comparison: analysis.comparison || [],
                checked_at: new Date().toISOString(),
                cached: false
            });
        }

        if (text && text.length <= 200) {
            return res.status(400).json({ error: 'The pasted text is too short. Please paste the full Terms of Service.' });
        }

        // === MODE 2: URL-based lookup ===
        if (!url) return res.status(400).json({ error: 'Please provide a URL or paste TOS text.' });

        const domain = extractDomain(url);
        if (!domain) return res.status(400).json({ error: 'Invalid URL' });

        // 1. Check cache
        const cached = await checkCache(domain);
        if (cached) {
            console.log(`Cache hit for ${domain}`);
            return res.status(200).json({ ...cached, cached: true });
        }

        // 2. Resolve the TOS URL
        const tosUrl = resolveTosUrl(url, domain);
        if (!tosUrl) {
            return res.status(404).json({
                error: 'not_in_database',
                message: `We don't have a TOS link mapped for this platform yet. Please paste the direct TOS URL, or paste the TOS text directly.`,
                domain
            });
        }

        // 3. Scrape via Apify
        console.log(`Scraping TOS for ${domain} from ${tosUrl}`);
        const tosText = await scrapeTOS(tosUrl);
        if (!tosText || tosText.length < 200) {
            return res.status(422).json({
                error: 'Could not extract enough content from that page. Try pasting the TOS text directly.'
            });
        }
        console.log(`Got ${tosText.length} chars of TOS text for ${domain}`);

        // 4. AI Analysis via Claude
        console.log(`Running Claude analysis for ${domain}...`);
        const analysis = await analyzeTOS(tosText, domain);

        // 5. Cache and return
        const result = {
            domain,
            verdict: analysis.verdict,
            flags: analysis.flags,
            comparison: analysis.comparison || [],
            checked_at: new Date().toISOString(),
            cached: false
        };

        await saveCache(domain, result);
        console.log(`Done! Result cached for ${domain}`);
        return res.status(200).json(result);

    } catch (err) {
        console.error('TOS Check Error:', err.message, err.stack);
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


// ============ RESOLVE TOS URL ============
function resolveTosUrl(url, domain) {
    const knownTosUrls = {
        'perplexity.ai': 'https://www.perplexity.ai/hub/legal/terms-of-service',
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
        'elevenlabs.io': 'https://elevenlabs.io/terms-of-use',
        'stability.ai': 'https://stability.ai/terms-of-use',
        'adobe.com': 'https://www.adobe.com/legal/terms.html',
    };

    if (knownTosUrls[domain]) {
        return knownTosUrls[domain];
    }

    // If the URL itself looks like a direct TOS link, trust it
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('/terms') || lowerUrl.includes('/tos') || lowerUrl.includes('/legal')
        || lowerUrl.includes('/policy') || lowerUrl.includes('/policies')) {
        return url.startsWith('http') ? url : 'https://' + url;
    }

    // Unknown platform with just a homepage URL
    return null;
}


// ============ SCRAPING VIA APIFY ============
async function scrapeTOS(tosUrl) {
    const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
    if (!APIFY_TOKEN) throw new Error('APIFY_API_TOKEN not configured');

    const actorId = 'apify~website-content-crawler';
    const input = {
        startUrls: [{ url: tosUrl }],
        maxCrawlPages: 1,
        crawlerType: 'playwright:firefox',
        removeElementsCssSelector: 'nav, footer, header, .cookie-banner, .sidebar, [role="navigation"], [role="banner"]',
        maxScrollHeightPixels: 10000,
        htmlTransformer: 'readableText',
        proxyConfiguration: { useApifyProxy: true },
    };

    console.log(`Starting Apify Website Content Crawler for: ${tosUrl}`);

    const runRes = await fetch(
        `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=120`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        }
    );

    if (!runRes.ok) {
        const errText = await runRes.text();
        console.error('Apify error response:', errText.substring(0, 500));
        throw new Error(`Apify returned ${runRes.status}: ${errText.substring(0, 200)}`);
    }

    const items = await runRes.json();
    console.log(`Apify returned ${items ? items.length : 0} items`);

    if (items && items.length > 0) {
        const content = items[0].text || items[0].markdown || '';
        console.log(`Extracted content length: ${content.length} chars`);
        if (content.length > 200) {
            return content.substring(0, 50000);
        }
    }

    throw new Error('No content extracted from Apify');
}


// ============ AI ANALYSIS VIA CLAUDE ============
async function analyzeTOS(tosText, domain) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY not configured');

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

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Failed to parse AI response');
    return JSON.parse(jsonMatch[0]);
}


// ============ CACHE LAYER ============
const memoryCache = {};

async function checkCache(domain) {
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

    const cached = memoryCache[domain];
    if (cached) {
        const age = (Date.now() - new Date(cached.checked_at).getTime()) / (1000 * 60 * 60);
        if (age < CACHE_TTL_HOURS) return cached;
    }

    return null;
}

async function saveCache(domain, data) {
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

    memoryCache[domain] = data;
}
