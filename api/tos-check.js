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

const CACHE_TTL_HOURS = 168; // 7 days

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

    // Prevent Vercel edge and browser from caching API responses
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const startTime = Date.now();
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

        // 3. Scrape via Apify (with time budget)
        console.log(`Scraping TOS for ${domain} from ${tosUrl}`);
        const tosText = await scrapeTOS(tosUrl, startTime);
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
async function scrapeTOS(tosUrl, startTime) {
    const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
    if (!APIFY_TOKEN) throw new Error('APIFY_API_TOKEN not configured');

    // Time budget: leave at least 70s for Claude analysis
    const MAX_SCRAPE_MS = 45000;
    const elapsed = Date.now() - startTime;
    const scrapeDeadline = startTime + MAX_SCRAPE_MS;

    // Try fast cheerio first (static HTML), fall back to playwright if needed
    const crawlerTypes = ['cheerio', 'playwright:firefox'];

    for (const crawlerType of crawlerTypes) {
        const remaining = Math.max(0, scrapeDeadline - Date.now());
        if (remaining < 5000) {
            console.warn(`Only ${remaining}ms left for scraping, skipping ${crawlerType}`);
            break;
        }

        const actorId = 'apify~website-content-crawler';
        const timeout = Math.min(
            crawlerType === 'cheerio' ? 15 : 25,
            Math.floor(remaining / 1000) - 2
        );

        if (timeout < 5) {
            console.warn(`Timeout too short (${timeout}s) for ${crawlerType}, skipping`);
            break;
        }

        const input = {
            startUrls: [{ url: tosUrl }],
            maxCrawlPages: 1,
            crawlerType,
            removeElementsCssSelector: 'nav, footer, header, .cookie-banner, .sidebar, [role="navigation"], [role="banner"]',
            ...(crawlerType === 'playwright:firefox' ? { maxScrollHeightPixels: 50000 } : {}),
            htmlTransformer: 'readableText',
            proxyConfiguration: { useApifyProxy: true },
        };

        console.log(`Trying ${crawlerType} crawler for: ${tosUrl} (timeout: ${timeout}s, ${Math.round(remaining/1000)}s remaining)`);

        try {
            const runRes = await fetch(
                `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=${timeout}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(input),
                }
            );

            if (!runRes.ok) {
                const errText = await runRes.text();
                console.error(`${crawlerType} error:`, errText.substring(0, 300));
                continue;
            }

            const items = await runRes.json();
            console.log(`${crawlerType} returned ${items ? items.length : 0} items`);

            if (items && items.length > 0) {
                const content = items[0].text || items[0].markdown || '';
                console.log(`Extracted content length: ${content.length} chars`);
                if (content.length > 200) {
                    return content.substring(0, 40000);
                }
            }

            console.warn(`${crawlerType} returned insufficient content, trying next...`);
        } catch (err) {
            console.error(`${crawlerType} failed:`, err.message);
            continue;
        }
    }

    throw new Error('No content extracted from any crawler');
}


// ============ AI ANALYSIS VIA CLAUDE ============
async function analyzeTOS(tosText, domain) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY not configured');

    const truncated = tosText.substring(0, 30000);

    const systemPrompt = `You are a TOS Red Flag Analyzer that PROTECTS entrepreneurs, content creators, and small business owners. You are NOT neutral. You are an advocate for the user. Your job is to find every clause that could hurt someone who uses this AI tool to run their business, create content, or build products.

Read the ENTIRE Terms of Service document word by word. Do not skim. Dangerous clauses are often buried in the middle or end of the document. If you miss something, a real person could lose their business, their content, or their money.

Analyze the TOS across exactly 9 risk categories. For each one, follow the specific instructions below.

THE 9 CATEGORIES:

1. Who Owns What I Create?
LOOK FOR: Any clause about ownership of "outputs," "generated content," "results," or "materials." Check if the TOS explicitly says "you retain ownership" or if it's silent on ownership (silence is bad). Check if ownership is conditional on anything (like paying for a plan, or not violating terms).
RED FLAG IF: The TOS does NOT explicitly say the user owns their outputs, OR if ownership can be revoked, OR if the company claims any ownership stake.
YELLOW FLAG IF: Ownership is granted but with conditions or limitations.
GREEN ONLY IF: The TOS clearly and unconditionally states users own what they create.

2. What Rights Am I Giving Away?
LOOK FOR: The word "license" and every adjective attached to it. Specifically search for: royalty-free, irrevocable, perpetual, worldwide, transferable, sublicensable, non-exclusive, unlimited. Each of these words has a specific meaning that hurts the user.
RED FLAG IF: The license includes "irrevocable" (you can never take it back), "sublicensable" (they can let OTHER companies use your content), "transferable" (they can hand your content to someone else), or "perpetual" (it lasts forever even if you cancel). Any combination of these is RED.
YELLOW FLAG IF: The license is broad but revocable, or limited to operating the service.
GREEN ONLY IF: The license is narrow, revocable, and limited to providing the service to you.
EXPLAIN EACH WORD: Do not just list the license terms. Explain what each adjective means in real-world terms. Example: "'Sublicensable' means Perplexity can turn around and let another company — a data broker, an advertiser, anyone — use your content without asking you."

3. Can I Use This For My Business?
LOOK FOR: The phrases "personal use," "non-commercial," "personal and non-commercial," "individual use," "not for commercial purposes," "personal, non-commercial." Also look for sections about "permitted use," "acceptable use," or "license to use the service." Also check if there's a separate "enterprise" or "business" plan mentioned — that often means the standard plan is NOT for business use.
RED FLAG IF: ANY language restricts the standard/free/pro plan to personal or non-commercial use. This is one of the MOST IMPORTANT flags. Most entrepreneurs don't realize that using an AI tool for client work, content creation, or business operations might violate the terms. Be very direct: "The terms say [exact quote]. This means if you're using this tool for your business — creating content for clients, researching for projects, writing marketing copy — you're technically violating the terms unless you pay for their enterprise plan."
YELLOW FLAG IF: Commercial use is allowed but with restrictions (attribution required, output limits, etc.).
GREEN ONLY IF: The TOS explicitly allows commercial use on the standard plan with no major restrictions.

4. Will They Train AI On My Work?
LOOK FOR: Clauses about "training," "improving," "developing," "machine learning," "model training," "AI development," "analytics," "aggregate data." Also look for opt-out provisions. Check if free/pro plans are treated differently from enterprise/API plans regarding training.
RED FLAG IF: The company can use your inputs, outputs, prompts, or content to train their AI models with no opt-out, OR if the opt-out is buried or difficult to execute. Also RED if free/pro plans allow training but enterprise doesn't — that means free users are the product.
YELLOW FLAG IF: Training is allowed but there's a clear, easy opt-out mechanism.
GREEN ONLY IF: The TOS explicitly says they do NOT train on user content, or training is off by default.

5. What Are They Doing With My Data?
LOOK FOR: Clauses about data collection, data sharing, third-party sharing, data selling, analytics, advertising, cookies, tracking. If the TOS references a separate privacy policy, note that the user needs to read THAT document too — and flag this as a gap in the TOS itself.
RED FLAG IF: They share data with third parties for advertising, sell data, or collect data beyond what's needed to run the service. Also RED if they defer everything to a separate privacy policy with no summary in the TOS.
YELLOW FLAG IF: They collect standard usage data and share with limited third parties for service operation.
GREEN ONLY IF: Minimal data collection, no third-party sharing, clear data practices explained in the TOS.

6. Am I Liable If Something Goes Wrong?
LOOK FOR: "Indemnification," "indemnify," "hold harmless," "defend," "at your own risk," "no warranty," "limitation of liability," "disclaimer." These clauses often mean: if the AI generates something that gets you sued, YOU pay — not the platform.
RED FLAG IF: The user must indemnify the company (pay their legal costs), AND the company disclaims all liability for AI outputs. This combination means: the AI could generate copyrighted content, you use it in your business, get sued, and the platform won't help — in fact, you might owe THEM money.
YELLOW FLAG IF: Standard limitation of liability with reasonable indemnification.
GREEN ONLY IF: The company shares some responsibility for output quality, or indemnification is mutual.

7. Can They Cut Me Off Without Warning?
LOOK FOR: "Terminate," "suspend," "discontinue," "at any time," "at our sole discretion," "without notice," "without cause," "delete," "remove content." Also check if they keep your data after termination or delete it.
RED FLAG IF: They can terminate for any reason or no reason, without notice, AND delete your content. Especially dangerous for someone who has built their business workflow around the tool.
YELLOW FLAG IF: They can terminate but with notice, or only for cause (violating terms).
GREEN ONLY IF: Termination requires cause, notice period, and you can export your data.

8. Can They Change The Rules On Me?
LOOK FOR: "Modify," "update," "revise," "change these terms," "at our discretion," "continued use constitutes acceptance," "posting changes." The worst version: they can change the terms, post it on their website, and if you keep using the service, you automatically agreed.
RED FLAG IF: They can change terms without direct notification to users, OR if continued use = automatic acceptance of new terms. This means they could add a clause tomorrow saying they own all your content, and if you don't notice, you agreed.
YELLOW FLAG IF: They notify users of changes but continued use still = acceptance.
GREEN ONLY IF: They notify users directly AND give time to review AND allow you to reject changes.

9. What Happens If There's A Problem?
LOOK FOR: "Arbitration," "class action waiver," "dispute resolution," "governing law," "jurisdiction," "small claims." Many AI platforms force arbitration and block class action lawsuits.
RED FLAG IF: Mandatory binding arbitration AND class action waiver. This means if the platform harms thousands of users, each person has to fight alone — which most people can't afford to do.
YELLOW FLAG IF: Arbitration is required but small claims court is an option, or there's an opt-out period.
GREEN ONLY IF: You can go to court and join class actions if needed.

RESPONSE FORMAT — Return valid JSON only, no markdown:
{
  "verdict": {
    "level": "red" | "yellow" | "green",
    "label": "HIGH RISK" | "PROCEED WITH CAUTION" | "RELATIVELY SAFE",
    "headline": "One-sentence verdict like you're warning a friend. Be blunt.",
    "summary": "2-3 sentences about the biggest dangers. Focus on real-world impact: what could actually happen to someone running a business with this tool."
  },
  "flags": [
    {
      "name": "Exact category name from the 9 above (question format)",
      "risk": "red" | "yellow" | "green",
      "finding": "What the TOS actually says. Quote the exact language in single quotes. Be specific — cite the section if you can identify it. If the TOS is silent on this topic, say so explicitly.",
      "plain_english": "What this means for you in real life. Use concrete examples. Not 'this could be concerning' — instead: 'If you paste a client's confidential business plan into this tool to summarize it, that content is now licensed to the platform and they can use it however they want — including training their AI on it.'"
    }
  ],
  "comparison": [
    {
      "Area": "Category name (question format)",
      "This Platform": "Brief, honest plain-English status",
      "Industry Standard": "What the better platforms (like OpenAI or Anthropic) typically offer",
      "Risk": "🔴 / 🟡 / 🟢"
    }
  ]
}

MANDATORY RULES:
- You are protecting the user, not being fair to the platform. When in doubt, flag it.
- Quote the actual TOS language and then explain it in plain English. Always both.
- NEVER say "not explicitly addressed" by itself. Say: "The TOS doesn't mention this at all — which means you have zero written protection. If something goes wrong, you have nothing to point to."
- NEVER say "deferred to separate policy" by itself. Say: "They push this to a separate [policy name] — which means the TOS you just agreed to doesn't actually cover this. You'd need to track down and read that other document too."
- NEVER soften a red flag. If the language is bad, say it's bad. Don't add "however" or "on the positive side" to a red flag.
- Use concrete scenarios in plain_english. Reference real situations: client work, content creation, business operations, freelancing, selling products.
- Risk colors: red = this could hurt your business, yellow = not ideal but manageable, green = this looks fair.
- Overall verdict: red if 3+ flags are red, yellow if most flags are yellow, green only if the terms are genuinely fair.
- Comparison table: 9 rows, one per category. "Industry Standard" should reflect what the BEST platforms offer, not the average.
- Do NOT add any text outside the JSON object.
- Read the ENTIRE document. The most dangerous clauses are often buried in sections 8, 9, 10+ of the TOS.
- If the TOS is clearly for a free/consumer plan, evaluate it as such. Don't assume enterprise protections apply to free users.`;

    const userPrompt = `Analyze this Terms of Service document from ${domain}:\n\n${truncated}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 8096,
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
