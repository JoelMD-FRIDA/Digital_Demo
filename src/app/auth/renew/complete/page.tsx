"use client";
import { useEffect } from 'react';
export default function RenewalComplete() {
  useEffect(()=>{
    const target=window.opener??(window.parent!==window?window.parent:null);
    target?.postMessage({type:'frida-digital-documents-renewed'},window.location.origin);
    if(window.opener||new URLSearchParams(window.location.search).get('popup')==='1')window.close();
  },[]);
  return null;
}
