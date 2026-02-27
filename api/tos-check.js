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

        // 1. Check cache (skip if ?fresh=true)
        const fresh = req.query && req.query.fresh === 'true';
        if (!fresh) {
            const cached = await checkCache(domain);
            if (cached) {
                console.log(`Cache hit for ${domain}`);
                return res.status(200).json({ ...cached, cached: true });
            }
        } else {
            console.log(`Fresh mode — skipping cache for ${domain}`);
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
        maxScrollHeightPixels: 50000,
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
            return content.substring(0, 60000);
        }
    }

    throw new Error('No content extracted from Apify');
}


// ============ AI ANALYSIS VIA CLAUDE ============
async function analyzeTOS(tosText, domain) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY not configured');

    const truncated = tosText.substring(0, 45000);

    const systemPrompt = `You are a TOS Red Flag Analyzer built for entrepreneurs, content creators, and small business owners who use AI platforms. You read Terms of Service documents and produce a risk report in plain, everyday language — no legal jargon.

Your job: Analyze the provided TOS text and evaluate it across exactly 9 risk categories. Write as if you're explaining this to a friend who runs their own business. Be specific and direct.

The 9 categories (use these exact names):
1. Who Owns What I Create? — Does the user retain ownership of content they create with the platform? Or does the company claim any ownership rights over your work?
2. What Rights Am I Giving Away? — What license does the company take over your content? Is it revocable or permanent? Can they sublicense it, sell it, or transfer it to others?
3. Can I Use This For My Business? — Can you use the AI outputs in client work, in products you sell, in your marketing, or to make money? Are there restrictions on commercial use?
4. Will They Train AI On My Work? — Can the company use your inputs, outputs, or content to train, improve, or develop their AI models? Is there a way to opt out?
5. What Are They Doing With My Data? — What personal data and usage data do they collect? Do they share it with third parties? Do they sell it?
6. Am I Liable If Something Goes Wrong? — If the AI output causes a problem (copyright infringement, inaccurate information, client complaint), who's on the hook — you or them? Do you have to pay their legal fees?
7. Can They Cut Me Off Without Warning? — Can they terminate your account, delete your content, or restrict access at any time for any reason without notice?
8. Can They Change The Rules On Me? — Can they modify the Terms of Service without notifying you? Do they give you a chance to review changes before they take effect?
9. What Happens If There's A Problem? — If you have a dispute, can you go to court? Or do they force arbitration? Can you join a class action lawsuit?

RESPONSE FORMAT — Return valid JSON only, no markdown:
{
  "verdict": {
    "level": "red" | "yellow" | "green",
    "label": "HIGH RISK" | "PROCEED WITH CAUTION" | "RELATIVELY SAFE",
    "headline": "One-sentence verdict written like you're warning a friend. Be direct.",
    "summary": "2-3 sentences explaining the biggest concerns in plain language. Talk about real-world impact: what this means for someone running a business, creating content, or building products with this tool."
  },
  "flags": [
    {
      "name": "Category Name (use the exact question-format names above)",
      "risk": "red" | "yellow" | "green",
      "finding": "What the TOS actually says — be specific, quote key phrases in single quotes when possible. Do NOT say 'not addressed' unless you've thoroughly searched the full text.",
      "plain_english": "What this means for you as an entrepreneur or creator. Be direct and specific. Examples: 'If you create a blog post using this tool and it accidentally copies someone else's work, YOU could be sued — not the platform.' or 'They can use anything you type in to make their AI smarter, including your private business ideas.'"
    }
  ],
  "comparison": [
    {
      "Area": "Category name (question format)",
      "This Platform": "Brief plain-English status — not legal jargon",
      "Industry Standard": "What most platforms do, explained simply",
      "Risk": "🔴 / 🟡 / 🟢"
    }
  ]
}

Rules:
- Write like you're talking to a smart friend who doesn't have a law degree.
- Be specific and factual. Quote the actual TOS language when it matters, then explain what it means.
- NEVER say "not explicitly addressed" or "deferred to separate policy" without explaining what that means for the user. If the TOS doesn't cover something, say: "Their TOS doesn't mention this at all, which means you have no written protection if something goes wrong."
- If they reference a separate privacy policy, say: "They push this to a separate privacy policy — so you'd need to read that too before you know the full picture."
- Use the exact risk colors: red = dangerous/you should be worried, yellow = not great/proceed carefully, green = this looks reasonable.
- The overall verdict should be red if 3+ flags are red, yellow if 2+ flags are yellow, green otherwise.
- comparison table should have one row per category (9 rows).
- Do NOT add any text outside the JSON object.
- IMPORTANT: Read the ENTIRE TOS text carefully. Do not skim. Many important clauses are buried deep in the document.`;

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
