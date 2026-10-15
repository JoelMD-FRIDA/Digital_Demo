"use client";
import { useEffect,useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { renewSession,SESSION_EVENT } from '@/lib/session-renewal';
export function SessionContinuity() {
  const path=usePathname();const {locale}=useI18n();
  const [expired,setExpired]=useState(false),[busy,setBusy]=useState(false);
  const [container,setContainer]=useState<HTMLElement|null>(null);
  useEffect(()=>{
    if(!expired)return;
    const update=()=>setContainer(document.querySelector<HTMLElement>('dialog[open]')??document.body);
    update();const observer=new MutationObserver(update);
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
    return ()=>observer.disconnect();
  },[expired]);
  useEffect(()=>{
    if(path.startsWith('/auth/')||path.startsWith('/login'))return;
    let lastActivity=Date.now();
    const activity=()=>{lastActivity=Date.now();};
    const status=(event:Event)=>setExpired(!(event as CustomEvent<{ready:boolean}>).detail.ready);
    window.addEventListener(SESSION_EVENT,status);
    window.addEventListener('pointerdown',activity);window.addEventListener('keydown',activity);
    const timer=setInterval(()=>{
      if(document.visibilityState==='visible'&&Date.now()-lastActivity<15*60_000)void renewSession();
    },40_000);
    return ()=>{clearInterval(timer);window.removeEventListener(SESSION_EVENT,status);
      window.removeEventListener('pointerdown',activity);window.removeEventListener('keydown',activity);};
  },[path]);
  if(!expired||!container)return null;
  return createPortal(<div role="status" className="session-notice">
    <span>{locale==='de'?'Ihre FRIDA-Sitzung muss erneuert werden. Ihre Auswahl bleibt erhalten.':'Your FRIDA session needs renewing. Your selections are preserved.'}</span>
    <button type="button" disabled={busy} onClick={async()=>{setBusy(true);try{await renewSession(true);}finally{setBusy(false);}}}>
      {locale==='de'?'Sitzung erneuern':'Renew session'}
    </button>
  </div>,container);
}
