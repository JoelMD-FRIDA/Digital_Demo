#!/usr/bin/env node
// Real consent UI/API client; disposable API and OIDC callback transport only.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:https';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=resolve(import.meta.dirname,'..'),work=await mkdtemp(join(tmpdir(),'frida-browser-'));
let browser,server;
try {
 const aliases=Object.fromEntries(['link','image','navigation'].map(name=>['next/'+name,resolve(root,'tests/browser-fixture/'+name+(name==='navigation'?'.ts':'.tsx'))]));
 await build({configFile:false,root,logLevel:'error',define:{'process.env.NODE_ENV':'"production"'},resolve:{alias:aliases},build:{outDir:join(work,'bundle'),lib:{entry:resolve(root,'tests/browser-fixture/entry.tsx'),formats:['es'],fileName:'fixture',cssFileName:'fixture'},minify:false}});
 const cert=join(work,'cert.pem'),key=join(work,'key.pem');
 assert.equal(spawnSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-subj','/CN=127.0.0.1','-days','1'],{stdio:'ignore'}).status,0);
 const state={expired:false,deny:false,csrf:'initial',renewals:0,writes:[],requests:[]};
 server=createServer({key:await readFile(key),cert:await readFile(cert)},async(req,res)=>{
  const url=new URL(req.url,'https://fixture.invalid');
  if(url.pathname==='/fixture.js'||url.pathname==='/entry.css'){
   res.setHeader('content-type',url.pathname.endsWith('.js')?'text/javascript':'text/css');
   res.end(await readFile(join(work,'bundle',url.pathname.endsWith('.js')?'fixture.js':'fixture.css')));return;
  }
  if(url.pathname==='/api/auth/login') {
   state.renewals++;
   if(state.deny){res.setHeader('content-type','text/html');res.end('<p>Renewal denied</p>');return;}
   state.expired=false;state.csrf='renewed-'+state.renewals;
   res.setHeader('Set-Cookie','__Host-frida-digital-documents-csrf='+state.csrf+'; Path=/; Secure; SameSite=Strict');
   res.writeHead(302,{Location:'/auth/renew/complete'+(url.searchParams.get('renew')==='interactive'?'?popup=1':'')});res.end();return;
  }
  if(url.pathname.startsWith('/api/')) {
   state.requests.push({path:url.pathname,method:req.method});
   res.setHeader('content-type','application/json');
   if(state.expired){res.writeHead(401);res.end('{"error":"UNAUTHORIZED"}');return;}
   if(url.pathname==='/api/connections') {
    let raw='';for await(const chunk of req)raw+=chunk;
    if(req.headers['x-frida-csrf']!==state.csrf){res.writeHead(403);res.end('{}');return;}
    state.writes.push(JSON.parse(raw));res.end('{}');return;
   }
   res.end(JSON.stringify({email:'synthetic@example.test',documents:[],connections:[]}));return;
  }
  if(url.pathname==='/'||url.pathname==='/auth/renew/complete'){
   if(url.pathname==='/')res.setHeader('Set-Cookie','__Host-frida-digital-documents-csrf='+state.csrf+'; Path=/; Secure; SameSite=Strict');
   res.setHeader('content-type','text/html');res.end('<html><head><link rel="stylesheet" href="/entry.css"></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>');return;
  }
  res.writeHead(404);res.end();
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='https://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({ignoreHTTPSErrors:true});const page=await context.newPage();
 page.setDefaultTimeout(10000);
 const errors=[];page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});
 await page.goto(origin);await page.getByRole('button',{name:'Connect insurer',exact:true}).first().click();
 const dialog=page.getByRole('dialog');await dialog.locator('.insurer-option').first().click();
 await dialog.getByRole('button',{name:'Continue',exact:true}).click();await dialog.getByRole('button',{name:'Continue',exact:true}).click();
 await dialog.getByRole('checkbox').check();
 state.expired=true;state.deny=true;
 await dialog.getByRole('button',{name:'Connect & retrieve documents',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('iframe'));
 // Forged messages, including same-origin messages from the parent, cannot finish renewal.
 await page.evaluate(()=>window.postMessage({type:'frida-digital-documents-renewed'},window.location.origin));
 await page.waitForTimeout(100);assert.equal(state.writes.length,0);
 await page.getByRole('button',{name:'Renew session',exact:true}).waitFor({timeout:16000});
 assert.equal(page.url(),origin+'/');assert.equal(await dialog.getByRole('checkbox').isChecked(),true);
 assert.equal(state.writes.length,0);
 console.log('Denied background renewal preserved the actual insurer-consent dialog, checkbox and page; forged message rejected.');
 state.deny=false;
 const popupPromise=page.waitForEvent('popup');
 await dialog.getByRole('button',{name:'Renew session',exact:true}).click();
 const popup=await popupPromise;await popup.waitForEvent('close').catch(()=>{});
 await page.getByRole('button',{name:'Renew session',exact:true}).waitFor({state:'hidden'});
 assert.equal(await dialog.getByRole('checkbox').isChecked(),true);
 state.expired=true;
 const previous=state.renewals;
 await dialog.getByRole('button',{name:'Connect & retrieve documents',exact:true}).click();
 await dialog.waitFor({state:'hidden'});
 assert.equal(page.url(),origin+'/');assert.equal(state.renewals,previous+1);
 assert.deepEqual(state.writes.map(value=>value.action),['connect','sync']);
 assert.equal(state.writes[0].accepted,true);assert.ok(state.writes[0].insurerId);
 assert.deepEqual(errors,[]);
 console.log('Expired-session consent silently renewed and retried once with refreshed CSRF; one connect and one sync, no top-level login navigation.');
 await context.close();
} finally {
 await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(work,{recursive:true,force:true});
}
