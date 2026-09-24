// This module is server-only. Never log credentials, emails, or response bodies.
const base = 'https://api.systeme.io/api';
const tagCache = new Map();
const validId = id => Number.isSafeInteger(Number(id)) && Number(id) > 0;
const hasTag = (contact, id) => Array.isArray(contact?.tags) && contact.tags.some(tag => Number(tag.id) === Number(id));

async function resolveTag(name, request, createIfMissing = false) {
  const cached = tagCache.get(name);
  if (cached && cached.until > Date.now()) return cached.id;
  let cursor;
  const matches = new Map();
  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({query:name, limit:'100', order:'asc'});
    if (cursor) params.set('startingAfter', String(cursor));
    const response = await request(`/tags?${params}`);
    if (!response.ok) throw new Error(`tag_lookup_${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.items)) throw new Error('tag_lookup_invalid');
    for (const tag of data.items) if (tag.name === name && validId(tag.id)) matches.set(Number(tag.id), tag);
    if (!data.hasMore) {
      if (matches.size === 0 && createIfMissing) {
        const created = await request('/tags', {method:'POST', body:JSON.stringify({name})});
        if (created.ok) {
          const tag = await created.json().catch(()=>null);
          if (validId(tag?.id)) {
            tagCache.set(name, {id:Number(tag.id), until:Date.now()+300000});
            return Number(tag.id);
          }
        }
        // A simultaneous signup may have created the tag first. Look it up once more.
        if ([400,409,422].includes(created.status)) {
          const retry = await request(`/tags?${new URLSearchParams({query:name,limit:'100',order:'asc'})}`);
          if (retry.ok) {
            const retryData = await retry.json();
            const exact = Array.isArray(retryData.items) ? retryData.items.filter(tag => tag.name === name && validId(tag.id)) : [];
            if (exact.length === 1) {
              const id = Number(exact[0].id);
              tagCache.set(name, {id, until:Date.now()+300000});
              return id;
            }
          }
        }
        throw new Error(`tag_create_${created.status}`);
      }
      if (matches.size !== 1) throw new Error('tag_missing_or_ambiguous');
      const id = [...matches.keys()][0];
      tagCache.set(name, {id, until:Date.now()+300000});
      return id;
    }
    const next = data.items.at(-1)?.id;
    if (!validId(next) || Number(next) === Number(cursor)) throw new Error('tag_cursor_invalid');
    cursor = next;
  }
  throw new Error('tag_lookup_incomplete');
}

export async function saveTaggedContact(email, tagName, key, {createTagIfMissing = false} = {}) {
  const signal = AbortSignal.timeout(15000);
  const request = (path, options={}) => fetch(base+path, {
    ...options, headers:{'Content-Type':'application/json','X-API-Key':key}, signal
  });
  const lookup = async () => {
    const response = await request(`/contacts?${new URLSearchParams({email,limit:'10'})}`);
    if (!response.ok) throw new Error(`contact_lookup_${response.status}`);
    const data = await response.json();
    return data.items?.find(contact => typeof contact.email === 'string' && contact.email.toLowerCase() === email);
  };
  const created = await request('/contacts', {method:'POST', body:JSON.stringify({email,locale:'en'})});
  let contact;
  if (created.ok) contact = await created.json().catch(()=>null);
  else if ([400,409,422].includes(created.status)) contact = await lookup();
  else throw new Error(`contact_create_${created.status}`);
  if (!validId(contact?.id)) contact = await lookup();
  if (!validId(contact?.id)) throw new Error('contact_unverified');
  const tagId = await resolveTag(tagName, request, createTagIfMissing);
  if (hasTag(contact, tagId)) return;
  const tagged = await request(`/contacts/${Number(contact.id)}/tags`, {method:'POST',body:JSON.stringify({tagId})});
  if (!tagged.ok) {
    // A concurrent/repeated signup may already have applied the tag.
    const verify = await request(`/contacts/${Number(contact.id)}`);
    if (!verify.ok || !hasTag(await verify.json(),tagId)) throw new Error(`tag_assign_${tagged.status}`);
  }
}
