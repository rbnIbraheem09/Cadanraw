import { describe,it,expect,vi } from 'vitest';
import { getLinkMetadata,parseLinkMetadata,youtubeVideoId } from '../electron/utils/link-metadata';
describe('link card metadata',()=>{
 it('reads titles with apostrophes, entities and either attribute order',()=>{
  const result=parseLinkMetadata(`<meta content="A creator's guide &amp; ideas &#x1F4A1;" property="og:title"><meta property='og:image' content='/preview.png'>`,'https://example.com/article');
  expect(result).toEqual({title:"A creator's guide & ideas 💡",image:'https://example.com/preview.png'});
 });
 it('uses YouTube oEmbed for short, video and shorts links',async()=>{
  const fake=vi.fn(async()=>new Response(JSON.stringify({title:'Actual video title',thumbnail_url:'https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg'}),{headers:{'Content-Type':'application/json'}}));
  expect(youtubeVideoId(new URL('https://www.youtube.com/shorts/abcdefghijk'))).toBe('abcdefghijk');
  expect((await getLinkMetadata('https://youtu.be/abcdefghijk',fake))?.title).toBe('Actual video title');
  expect(fake.mock.calls[0][0]).toContain('youtube.com/oembed?');
 });
 it('resolves redirects and falls back to the document title',async()=>{
  const fake=vi.fn().mockResolvedValueOnce(new Response(null,{status:302,headers:{location:'/final'}})).mockResolvedValueOnce(new Response('<title>Final &amp; correct</title>'));
  expect(await getLinkMetadata('https://example.com/start',fake)).toEqual({title:'Final & correct',image:null});
  expect(fake.mock.calls[1][0]).toBe('https://example.com/final');
 });
 it('returns a retryable failure instead of a made-up video title',async()=>{
  expect(await getLinkMetadata('https://youtu.be/abcdefghijk',async()=>{throw new Error('Offline');})).toBeNull();
  expect(await getLinkMetadata('file:///etc/passwd')).toBeNull();
 });
});
