"use client";
import { renewSession } from './session-renewal';
export async function apiFetch(path:string,init:RequestInit={}) {
  if(!path.startsWith('/api/'))throw new Error('Only application APIs are supported.');
  const send=()=>{
  const headers=new Headers(init.headers);
  if(!['GET','HEAD','OPTIONS'].includes((init.method??'GET').toUpperCase())) {
    const cookie=document.cookie.split('; ').find(value=>value.startsWith('__Host-frida-digital-documents-csrf='));
    if(cookie)headers.set('x-frida-csrf',cookie.slice(cookie.indexOf('=')+1));
  }
  return fetch(path,{...init,headers,credentials:'same-origin',cache:'no-store'});
  };
  const response=await send();
  // A 401 is returned before any mutation. Rebuild CSRF headers after renewal.
  if(response.status===401 && !(init.body instanceof ReadableStream) && await renewSession())return send();
  return response;
}
