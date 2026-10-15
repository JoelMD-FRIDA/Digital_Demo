import { NextResponse,type NextRequest } from 'next/server';
import { identity,HttpError } from '@/server/http';
import { appOrigin } from '@/lib/auth/session';
const PUBLIC=new Set(['/auth/renew/complete','/login','/api/auth/login','/auth/callback','/api/health/live','/api/health/ready','/api/internal/deployment-probe','/frida-icon.png','/frida-logo.svg','/favicon.ico','/pdf.worker.min.mjs']);
const RETIRED=new Set(['/register','/forgot-password','/reset-password']);
export async function proxy(request:NextRequest) {
  const path=request.nextUrl.pathname;
  if(RETIRED.has(path))return NextResponse.redirect(new URL('/login',appOrigin()));
  if(PUBLIC.has(path))return NextResponse.next();
  try {
    await identity(request);
    const response=NextResponse.next();response.headers.set('Cache-Control','private, no-store');return response;
  }catch(error) {
    if(error instanceof HttpError&&error.status===401&&!path.startsWith('/api/')) {
      const url=new URL('/api/auth/login',appOrigin());url.searchParams.set('redirect',path+request.nextUrl.search);return NextResponse.redirect(url);
    }
    return NextResponse.json({error:error instanceof HttpError?error.code:'TEMPORARILY_UNAVAILABLE'},{status:error instanceof HttpError?error.status:503,headers:{'Cache-Control':'private, no-store'}});
  }
}
export const config={matcher:['/((?!_next/static|_next/image).*)']};
