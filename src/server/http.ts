import { appOrigin, SESSION_COOKIE, CSRF_COOKIE, sessionForCookie, hash, equal } from '@/lib/auth/session';
export class HttpError extends Error {
  constructor(public status:number,public code:string) { super(code); }
}
export function requestCookie(request:Request,name:string) {
  const entries=(request.headers.get('cookie')??'').split(';').map(value=>value.trim()).filter(value=>value.startsWith(name+'='));
  return entries.length===1?entries[0].slice(name.length+1):undefined;
}
export async function identity(request:Request) {
  if(request.headers.has('authorization'))throw new HttpError(401,'UNAUTHORIZED');
  const session=await sessionForCookie(requestCookie(request,SESSION_COOKIE));
  if(!session)throw new HttpError(401,'UNAUTHORIZED');
  if(!['GET','HEAD','OPTIONS'].includes(request.method)) {
    sameOrigin(request);
    const csrf=request.headers.get('x-frida-csrf');
    if(!csrf||!equal(csrf,requestCookie(request,CSRF_COOKIE))||!equal(hash(csrf),session.csrfHash))throw new HttpError(403,'CSRF_REJECTED');
  }
  return session;
}
export function sameOrigin(request:Request) {
  if(request.headers.get('origin')!==appOrigin())throw new HttpError(403,'ORIGIN_REJECTED');
}
export function json(value:unknown,status=200) {
  return Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
}
export function failure(error:unknown) {
  if(error instanceof HttpError)return json({error:error.code},error.status);
  // Never log database messages, record values, identity claims or credentials.
  return json({error:'TEMPORARILY_UNAVAILABLE'},503);
}
export async function body(request:Request):Promise<Record<string,unknown>> {
  if(!request.body)throw new HttpError(400,'INVALID_INPUT');
  const reader=request.body.getReader();let timer:ReturnType<typeof setTimeout>|undefined;
  try {
    return await Promise.race([new Promise<never>((_,reject)=>{timer=setTimeout(()=>{void reader.cancel().catch(()=>{});reject(new HttpError(408,'REQUEST_TIMEOUT'));},5000);}),
      (async()=>{
        const chunks:Uint8Array[]=[];let size=0;
        while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;
          if(size>64*1024)throw new HttpError(413,'BODY_TOO_LARGE');chunks.push(part.value);}
        let value:unknown;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new HttpError(400,'INVALID_INPUT');}
        if(!value||typeof value!=='object'||Array.isArray(value))throw new HttpError(400,'INVALID_INPUT');
        return value as Record<string,unknown>;
      })()]);
  }finally{clearTimeout(timer);void reader.cancel().catch(()=>{});}
}
