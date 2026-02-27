/**
 * Vercel Serverless Function — TOS Checker API
 * POST /api/tos-check
 * Body: { url: "https://perplexity.ai" } OR { text: "raw TOS content...", domain: "example.com" }
 *
 * Flow:
 * 1. Check cache (KV or in-memory) for recent result (URL mode only)
 * 2. If miss → direct fetch TOS page (no Apify)
 * 3. Run AI analysis via Claude (Anthropic API)
 * 4. Cache result → return JSON
 *
 * Environment variables needed:
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

        // 3. Direct fetch
        console.log(`Fetching TOS for ${domain} from ${tosUrl}`);
        const tosText = await directFetch(tosUrl);
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

    // If the domain is in our map, use the mapped URL
    if (knownTosUrls[domain]) {
        return knownTosUrls[domain];
    }

    // If the URL itself looks like a direct TOS link (contains terms, tos, legal, policy),
    // trust it and use it directly
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('/terms') || lowerUrl.includes('/tos') || lowerUrl.includes('/legal')
        || lowerUrl.includes('/policy') || lowerUrl.includes('/policies')) {
        return url.startsWith('http') ? url : 'https://' + url;
    }

    // Unknown platform with just a homepage URL — we can't help
    return null;
}


// ============ DIRECT HTTP FETCH + HTML-TO-TEXT ============
async function directFetch(tosUrl) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    try {
        const res = await fetch(tosUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            redirect: 'follow',
        });

        clearTimeout(timeout);

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const html = await res.text();
        const text = htmlToText(html);
        return text.substring(0, 50000);
    } catch (e) {
        clearTimeout(timeout);
        throw e;
    }
}


// ============ HTML → PLAIN TEXT CONVERTER ============
function htmlToText(html) {
    if (!html) return '';

    // Remove script and style blocks entirely
    let text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

    // Try to extract just the main content area if possible
    const mainMatch = text.match(/<main[\s\S]*?<\/main>/i)
        || text.match(/<article[\s\S]*?<\/article>/i)
        || text.match(/<div[^>]*(?:class|id)="[^"]*(?:content|main|body|terms|tos|legal|policy)[^"]*"[\s\S]*?<\/div>/i);

    if (mainMatch && mainMatch[0].length > 500) {
        text = mainMatch[0];
    }

    // Convert common block elements to newlines
    text = text
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(?:p|div|h[1-6]|li|tr|section|article)>/gi, '\n')
        .replace(/<(?:p|div|h[1-6]|li|tr|section|article)[^>]*>/gi, '\n');

    // Remove all remaining HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode common HTML entities
    text = text
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&rsquo;/gi, "'")
        .replace(/&lsquo;/gi, "'")
        .replace(/&rdquo;/gi, '"')
        .replace(/&ldquo;/gi, '"')
        .replace(/&mdash;/gi, '\u2014')
        .replace(/&ndash;/gi, '\u2013')
        .replace(/&#\d+;/gi, ' ');

    // Clean up whitespace
    text = text
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();

    return text;
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
