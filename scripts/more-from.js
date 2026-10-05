// "More from AI Upfront": 3 recent articles + "See all" link, added to the end of every
// article (before the signup box) at build time, so it stays current automatically.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MARKERS = ['<div class="subscribe">', '<div class="newsletter-cta">']; // current and older article templates

function decode(text) {
  return text
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function esc(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function listArticles(dir) {
  const articles = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(dir, entry.name, 'index.html');
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf-8');
    if (/<meta name="robots" content="[^"]*noindex/i.test(html)) continue;
    const date = (html.match(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})/) || [])[1];
    const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
    if (!date || !title) continue;
    articles.push({
      slug: entry.name, file, date,
      title: decode(title).replace(/\s*\|\s*Dr\. Erin Jacques.*$/, ''),
      category: (html.match(/"articleSection"\s*:\s*"([^"]*)"/) || [])[1] || '',
      hasImage: fs.existsSync(path.join(dir, entry.name, 'featured.png')),
    });
  }
  return articles.sort((a, b) => b.date.localeCompare(a.date));
}

const STYLE = `<style>
.more-from{margin-top:44px;padding-top:22px;border-top:2px solid var(--rule-dark,#121212);}
.more-from h3{font-family:var(--sans,'Libre Franklin',Helvetica,Arial,sans-serif);font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ink,#121212);margin:0 0 16px;}
.more-from ul{list-style:none;margin:0;padding:0;}
.more-from li{margin:0;padding:0;}
.more-from li a{display:flex;gap:14px;align-items:center;padding:12px 0;border-bottom:1px solid var(--rule,#dcdcdc);text-decoration:none;color:var(--ink,#121212);}
.more-from li a:hover .mf-title{text-decoration:underline;text-underline-offset:3px;}
.more-from img{width:96px;height:56px;object-fit:cover;flex:0 0 auto;background:#f2f2f2;}
.more-from .mf-cat{display:block;font-family:var(--sans,'Libre Franklin',Helvetica,Arial,sans-serif);font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0A8FAF;margin-bottom:3px;}
.more-from .mf-title{font-family:var(--serif,'Source Serif 4',Georgia,serif);font-size:17px;font-weight:600;line-height:1.3;}
.more-from .mf-all{display:inline-block;margin-top:14px;font-family:var(--sans,'Libre Franklin',Helvetica,Arial,sans-serif);font-size:14px;font-weight:600;color:var(--ink,#121212);text-decoration:none;box-shadow:inset 0 -.45em 0 #FFD93D;}
.more-from .mf-all:hover{text-decoration:underline;text-underline-offset:3px;}
</style>`;

function block(current, articles, base = '') {
  const picks = articles.filter((a) => a.slug !== current).slice(0, 3);
  if (!picks.length) return '';
  const items = picks.map((a) => `      <li><a href="${base}/ai-news/${a.slug}">${a.hasImage ? `<img src="${base}/ai-news/${a.slug}/featured.png" alt="" loading="lazy">` : ''}<span>${a.category ? `<span class="mf-cat">${esc(a.category)}</span>` : ''}<span class="mf-title">${esc(a.title)}</span></span></a></li>`).join('\n');
  return `${STYLE}
    <nav class="more-from" aria-label="More from AI Upfront">
      <h3>More from AI Upfront</h3>
      <ul>
${items}
      </ul>
      <a class="mf-all" href="${base}/ai-upfront">See all AI Upfront articles →</a>
    </nav>

    `;
}

// Adds the block to every article page inside `dir` (the built copy, not the source files).
function addMoreFrom(dir) {
  const articles = listArticles(dir);
  let count = 0;
  for (const a of articles) {
    const html = fs.readFileSync(a.file, 'utf-8');
    const marker = MARKERS.find((m) => html.includes(m));
    if (html.includes('class="more-from"') || !marker) continue;
    fs.writeFileSync(a.file, html.replace(marker, block(a.slug, articles) + marker));
    count++;
  }
  console.log(`✅ "More from AI Upfront" added to ${count} articles`);
}

module.exports = { addMoreFrom, listArticles, block };
