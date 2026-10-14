"use client";
export async function apiFetch(path:string,init:RequestInit={}) {
  if(!path.startsWith('/api/'))throw new Error('Only application APIs are supported.');
  const headers=new Headers(init.headers);
  if(!['GET','HEAD','OPTIONS'].includes((init.method??'GET').toUpperCase())) {
    const cookie=document.cookie.split('; ').find(value=>value.startsWith('__Host-frida-digital-documents-csrf='));
    if(cookie)headers.set('x-frida-csrf',cookie.slice(cookie.indexOf('=')+1));
  }
  const response=await fetch(path,{...init,headers,credentials:'same-origin',cache:'no-store'});
  if(response.status===401)window.location.assign(new URL('/api/auth/login?redirect='+encodeURIComponent(window.location.pathname+window.location.search),window.location.origin));
  return response;
}
