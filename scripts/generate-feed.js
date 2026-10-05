// Builds feed.xml (RSS for AI Upfront) on every deploy from ai-news/<slug>/index.html, newest first.
const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://drerinjacques.com';
const ROOT = path.resolve(__dirname, '..');
const MAX_ITEMS = 30;

function decode(text) {
  return text
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function xml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function discoverArticles() {
  const aiNewsDir = path.join(ROOT, 'ai-news');
  const articles = [];
  for (const entry of fs.readdirSync(aiNewsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(aiNewsDir, entry.name, 'index.html');
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf-8');
    if (/<meta name="robots" content="[^"]*noindex/i.test(html)) continue;
    const date = (html.match(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})/) || [])[1];
    const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
    if (!date || !title) continue; // drafts and templates have no publish date
    const description = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
    const category = (html.match(/"articleSection"\s*:\s*"([^"]*)"/) || [])[1] || '';
    articles.push({
      slug: entry.name, date, category,
      title: decode(title).replace(/\s*\|\s*Dr\. Erin Jacques.*$/, ''),
      description: decode(description),
    });
  }
  return articles.sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_ITEMS);
}

function buildFeed() {
  const articles = discoverArticles();
  const rfc822 = (d) => new Date(d + 'T12:00:00Z').toUTCString();
  const items = articles.map((a) => {
    const url = `${SITE_URL}/ai-news/${a.slug}`;
    return `    <item>
      <title>${xml(a.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${rfc822(a.date)}</pubDate>
      <description>${xml(a.description)}</description>${a.category ? `\n      <category>${xml(a.category)}</category>` : ''}
    </item>`;
  });
  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AI Upfront</title>
    <link>${SITE_URL}/ai-upfront</link>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>Straight talk on the AI economy, and how to claim your place in it. By Dr. Erin Jacques.</description>
    <language>en-us</language>
    <lastBuildDate>${articles.length ? rfc822(articles[0].date) : new Date().toUTCString()}</lastBuildDate>
${items.join('\n')}
  </channel>
</rss>
`;
  fs.writeFileSync(path.join(ROOT, 'feed.xml'), feed);
  console.log(`✅ feed.xml generated with ${articles.length} articles`);
}

buildFeed();
