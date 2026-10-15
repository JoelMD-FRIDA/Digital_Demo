"use client";
let pending:Promise<boolean>|undefined;
export const SESSION_EVENT='frida-session-status';
function report(ready:boolean) {window.dispatchEvent(new CustomEvent(SESSION_EVENT,{detail:{ready}}));}
export function renewSession(interactive=false):Promise<boolean> {
  if(pending)return pending;
  const operation=new Promise<boolean>(resolve=>{
    const csrf=()=>document.cookie.split('; ').find(value=>value.startsWith('__Host-frida-digital-documents-csrf='));
    const previousCsrf=csrf();
    const frame=interactive?undefined:document.createElement('iframe');
    const url='/api/auth/login?renew='+(interactive?'interactive':'silent');
    const popup=interactive?window.open(url,'frida-digital-documents-signin','popup,width=520,height=720'):null;
    if(interactive&&!popup){resolve(false);return;}
    if(frame){frame.hidden=true;frame.title='Session renewal';frame.setAttribute('aria-hidden','true');frame.src=url;}
    let settled=false;
    const done=(ready:boolean)=>{
      if(settled)return;settled=true;clearTimeout(timeout);clearInterval(closed);
      window.removeEventListener('message',message);frame?.remove();
      if(popup&&!popup.closed)popup.close();report(ready);resolve(ready);
    };
    const message=(event:MessageEvent)=>{
      if(event.origin!==window.location.origin || event.source!==(popup??frame?.contentWindow) || event.data?.type!=='frida-digital-documents-renewed')return;
      done(true);
    };
    const timeout=setTimeout(()=>done(false),interactive?120000:12000);
    // The IdP may sever window.opener with COOP. Successful same-account
    // callback still rotates the app CSRF cookie; observe that change locally.
    const closed=setInterval(()=>{if(interactive&&csrf()&&csrf()!==previousCsrf)done(true);},500);
    window.addEventListener('message',message);
    if(frame)document.body.append(frame);
  });
  pending=operation.finally(()=>{pending=undefined;});
  return pending;
}
