import { lookup } from 'node:dns/promises';
export interface LinkMetadata { title: string; image: string | null }
type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
export function youtubeVideoId(url: URL): string | null {
  const host = url.hostname.replace(/^(www\.|m\.)/, '');
  const id = host === 'youtu.be' ? url.pathname.slice(1).split('/')[0] : ['youtube.com','youtube-nocookie.com'].includes(host) ? url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1] : null;
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}
const decode = (text: string) => text.replace(/&(?:amp|quot|apos|lt|gt|#39|#(\d+)|#x([\da-f]+));/gi, (entity, decimal, hex) => {
  if (decimal || hex) { const point = parseInt(decimal || hex, hex ? 16 : 10); return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ''; }
  return ({'&amp;':'&','&quot;':'"','&apos;':"'",'&#39;':"'",'&lt;':'<','&gt;':'>'} as Record<string,string>)[entity.toLowerCase()] || entity;
});
export function parseLinkMetadata(html: string, base: string): LinkMetadata {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const meta = (name: string) => {
    for (const tag of tags) {
      const attrs: Record<string,string> = {};
      for (const m of tag.matchAll(/([^\s=<>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4];
      if ((attrs.property || attrs.name || '').toLowerCase() === name) return attrs.content;
    }
  };
  const title = decode(meta('og:title') || meta('twitter:title') || html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || new URL(base).hostname).replace(/\s+/g,' ').trim().slice(0,500);
  const rawImage = meta('og:image') || meta('twitter:image');
  let image: string | null = null;
  try { const candidate = new URL(decode(rawImage || ''), base); if (rawImage && ['http:','https:'].includes(candidate.protocol)) image = candidate.href; } catch { /* optional metadata */ }
  return { title, image };
}
async function assertPublic(url: URL) {
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use a public HTTP URL');
  const addresses = await lookup(url.hostname, { all:true });
  if (!addresses.length || addresses.some(({address}) => {
    const a = address.toLowerCase();
    if (a.includes(':')) return a === '::' || a === '::1' || a.startsWith('fc') || a.startsWith('fd') || a.startsWith('fe80:') || a.startsWith('::ffff:') || a.startsWith('ff');
    const [x,y] = a.split('.').map(Number);
    return x === 0 || x === 10 || x === 127 || x >= 224 || (x === 169 && y === 254) || (x === 172 && y >= 16 && y <= 31) || (x === 192 && y === 168) || (x === 100 && y >=64 && y<=127);
  })) throw new Error('Private addresses are not supported by the public relay');
}
export async function getLinkMetadata(raw: string, fetcher: Fetcher = fetch, publicOnly = false): Promise<LinkMetadata | null> {
  const fetchText = async (rawUrl: string, accept: string) => {
    let url = new URL(rawUrl);
    for (let i=0; i<5; i++) {
      if (!['http:','https:'].includes(url.protocol)) throw new Error('Invalid URL');
      if (publicOnly) await assertPublic(url);
      const response = await fetcher(url.href, { redirect:'manual', signal:AbortSignal.timeout(8000), headers: { 'User-Agent':'Cadanraw/0.2', Accept:accept } });
      if ([301,302,303,307,308].includes(response.status)) { const next = response.headers.get('location'); await response.body?.cancel(); if (!next) return null; url = new URL(next,url); continue; }
      if (!response.ok) { await response.body?.cancel(); return null; }
      const reader = response.body?.getReader(); if (!reader) return null;
      const decoder = new TextDecoder(); let text = ''; let bytes = 0;
      try { while (true) { const chunk=await reader.read(); if(chunk.done) break; bytes+=chunk.value.byteLength; if(bytes>1024*1024) break; text+=decoder.decode(chunk.value,{stream:true}); } } finally { await reader.cancel(); }
      return { text, url:url.href };
    }
    return null;
  };
  try {
    const url = new URL(raw); const id = youtubeVideoId(url);
    if (id) {
      const result = await fetchText(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`, 'application/json');
      if (result) { const data = JSON.parse(result.text); if (typeof data.title === 'string' && data.title.trim()) return { title:data.title.trim().slice(0,500), image:typeof data.thumbnail_url === 'string' ? data.thumbnail_url : null }; }
    }
    const result = await fetchText(raw,'text/html');
    return result ? parseLinkMetadata(result.text,result.url) : null;
  } catch { return null; }
}
