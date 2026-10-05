// Builds llms.txt (a plain summary of the site for AI tools) on every deploy.
// The article list is read from ai-news/<slug>/index.html, newest first, so new articles show up automatically.
const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://drerinjacques.com';
const ROOT = path.resolve(__dirname, '..');

function decode(text) {
  return text
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
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
    articles.push({ slug: entry.name, date, title: decode(title).replace(/\s*\|\s*Dr\. Erin Jacques.*$/, ''), description: decode(description) });
  }
  return articles.sort((a, b) => b.date.localeCompare(a.date));
}

function buildLlms() {
  const articles = discoverArticles();
  const lines = [
    '# Dr. Erin Jacques',
    '',
    '> Dr. Erin Jacques is a professor, AI strategist and the founder of Leveraging AI and ChatifyIT. She helps entrepreneurs and creators use AI safely and turn what they know into income. Her theme: build your place in the new economy.',
    '',
    '## AI Upfront',
    '',
    'AI Upfront is her newsletter and AI news: straight talk on the AI economy, and how to claim your place in it. Each issue covers what\'s true, what\'s changing for jobs, income and opportunity, and the reader\'s move. Three short emails a week, free.',
    '',
    `- [AI Upfront (newsletter and all articles)](${SITE_URL}/ai-upfront)`,
    '',
    '## Main pages',
    '',
    `- [Home](${SITE_URL}/): who she is, speaking, and her work`,
    `- [Work With Me](${SITE_URL}/leveraging-ai/): Leveraging AI, building AI-powered web apps people pay to subscribe to`,
    '- [Leveraging AI Community](https://www.skool.com/leveragingai/about)',
    '- [ChatifyIT](https://chatifyit.com): link-in-bio pages with free AI guides that capture email leads',
    '',
    '## Articles (newest first)',
    '',
    ...articles.map((a) => `- [${a.title}](${SITE_URL}/ai-news/${a.slug})${a.description ? ': ' + a.description : ''} (${a.date})`),
    '',
  ];
  fs.writeFileSync(path.join(ROOT, 'llms.txt'), lines.join('\n'));
  console.log(`✅ llms.txt generated with ${articles.length} articles`);
}

buildLlms();
