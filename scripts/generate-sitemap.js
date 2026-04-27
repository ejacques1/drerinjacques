const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://drerinjacques.com';
const ROOT = path.resolve(__dirname, '..');

// Static pages (path, priority, changefreq)
const staticPages = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/ai-news', priority: '0.9', changefreq: 'daily' },
  { path: '/tos-checker', priority: '0.7', changefreq: 'monthly' },
  { path: '/converter', priority: '0.8', changefreq: 'monthly' },
];

function getDatePublished(htmlPath) {
  try {
    const content = fs.readFileSync(htmlPath, 'utf-8');
    // Look for datePublished in JSON-LD schema
    const match = content.match(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})"/);
    if (match) return match[1];
    // Fallback: dateModified
    const modMatch = content.match(/"dateModified"\s*:\s*"(\d{4}-\d{2}-\d{2})"/);
    if (modMatch) return modMatch[1];
  } catch (e) {}
  return null;
}

function getLastmod(htmlPath) {
  // Try to get date from the HTML content first
  const published = getDatePublished(htmlPath);
  if (published) return published;
  // Fallback to file modification time
  const stat = fs.statSync(htmlPath);
  return stat.mtime.toISOString().split('T')[0];
}

function discoverArticles() {
  const aiNewsDir = path.join(ROOT, 'ai-news');
  if (!fs.existsSync(aiNewsDir)) return [];

  const articles = [];
  const entries = fs.readdirSync(aiNewsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const articleIndex = path.join(aiNewsDir, entry.name, 'index.html');
    if (!fs.existsSync(articleIndex)) continue;

    // Skip template/draft folders (no datePublished = not a real article)
    const datePublished = getDatePublished(articleIndex);
    if (!datePublished) continue;

    articles.push({
      path: `/ai-news/${entry.name}`,
      lastmod: datePublished,
      priority: '0.8',
      changefreq: 'monthly',
    });
  }

  // Sort by date descending (newest first)
  articles.sort((a, b) => b.lastmod.localeCompare(a.lastmod));
  return articles;
}

function buildSitemap() {
  const today = new Date().toISOString().split('T')[0];
  const articles = discoverArticles();

  const urls = [];

  // Add static pages
  for (const page of staticPages) {
    const htmlPath = path.join(ROOT, page.path === '/' ? 'index.html' : `${page.path}/index.html`);
    const lastmod = page.path === '/' ? today : (fs.existsSync(htmlPath) ? getLastmod(htmlPath) : today);

    urls.push(`  <url>
    <loc>${SITE_URL}${page.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`);
  }

  // Add discovered articles
  for (const article of articles) {
    urls.push(`  <url>
    <loc>${SITE_URL}${article.path}</loc>
    <lastmod>${article.lastmod}</lastmod>
    <changefreq>${article.changefreq}</changefreq>
    <priority>${article.priority}</priority>
  </url>`);
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;

  const outPath = path.join(ROOT, 'sitemap.xml');
  fs.writeFileSync(outPath, sitemap);
  console.log(`✅ Sitemap generated with ${urls.length} URLs (${articles.length} articles discovered)`);
}

buildSitemap();
