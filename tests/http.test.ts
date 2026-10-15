import { expect,it } from 'vitest';
import { body,requestCookie } from '@/server/http';
import { safeReturnPath } from '@/lib/auth/session';
it('rejects oversized bodies before parsing and accepts a small object',async()=>{
  await expect(body(new Request('https://example.test',{method:'POST',body:' '.repeat(65537)}))).rejects.toMatchObject({status:413});
  await expect(body(new Request('https://example.test',{method:'POST',body:'{"accepted":true}'}))).resolves.toEqual({accepted:true});
});
it('rejects malformed JSON, arrays and scalar bodies',async()=>{
  for(const value of ['{','[]','null','true'])await expect(body(new Request('https://example.test',{method:'POST',body:value}))).rejects.toMatchObject({status:400});
});
it('refuses ambiguous duplicate session cookies',()=>{
  expect(requestCookie(new Request('https://example.test',{headers:{cookie:'session=a; session=b'}}),'session')).toBeUndefined();
});
it('restricts post-login redirects to the application origin',()=>{
  process.env.APP_ORIGIN='https://documents.example.test';
  for(const value of ['https://evil.test/','//evil.test/','/\\evil.test/','/\n/evil.test/'])expect(safeReturnPath(value)).toBe('/');
  expect(safeReturnPath('/connections?view=all')).toBe('/connections?view=all');
});
