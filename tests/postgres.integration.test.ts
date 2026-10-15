import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import { createServer,type Server } from 'node:https';
import { generateKeyPairSync,sign,randomUUID,createHash } from 'node:crypto';
import { readFile,mkdtemp,rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { Client } from 'pg';
import { NextRequest } from 'next/server';
import { startLogin,finishLogin } from '@/lib/auth/oidc';
import { SESSION_COOKIE,CSRF_COOKIE,sessionForCookie,decrypt,encrypt,RENEWAL_COOKIE } from '@/lib/auth/session';
import { database } from '@/lib/db/postgres';
import { proxy } from '@/proxy';
import { asUser,workspace,connect,reset } from '@/server/documents';
import { insurers,sampleDocuments } from '@/lib/catalog';
import { GET as ready } from '@/app/api/health/ready/route';
import { GET as probe } from '@/app/api/internal/deployment-probe/route';
import { GET as getWorkspace } from '@/app/api/workspace/route';
import { GET as getDocuments } from '@/app/api/documents/route';
import { GET as getInfos } from '@/app/api/insurance-infos/route';
import { GET as getFile } from '@/app/api/files/[uuid]/route';
import { PATCH as patchDocument } from '@/app/api/documents/[uuid]/route';
import { POST as postConnections } from '@/app/api/connections/route';
import { POST as postReset } from '@/app/api/reset/route';
const grants=new Map<string,Record<string,unknown>>();
let server:Server,issuer:string,owner:Client,sessionA:{session:string;csrf:string;returnPath:string;renewalCookie?:string},sessionB:typeof sessionA;
let profileA:string,profileB:string,bundle:Buffer;
let fixtureDirectory:string;
async function connectService(path:string) {
 const raw=await readFile(path,'utf8');const cfg=Object.fromEntries(raw.split('\n').filter(line=>line.includes('=')).map(line=>line.split('=')));
 const client=new Client({host:cfg.host,user:cfg.user,password:cfg.password,database:cfg.dbname,port:5432});await client.connect();return client;
}
function tool(command:string,service=process.env.FRIDA_TEST_OWNER_SERVICE!,input?:Buffer,extra:Record<string,string>={}) {
 return spawnSync(process.execPath,['deployment/tools.mjs',command],{input,env:{...process.env,PGSERVICEFILE:service,...extra},maxBuffer:300*1024*1024,timeout:280000});
}
async function login(subject:string,email:string,overrides:Record<string,unknown>={}) {
 const flow=await startLogin('/');const url=flow.url;
 const code=randomUUID();grants.set(code,{subject,email,nonce:url.searchParams.get('nonce'),challenge:url.searchParams.get('code_challenge'),...overrides});
 const callback=new URL('https://documents.frida.test/auth/callback');callback.searchParams.set('code',code);callback.searchParams.set('state',url.searchParams.get('state')!);
 return {result:finishLogin(callback,flow.transaction),callback,transaction:flow.transaction};
}
beforeAll(async()=>{
 if(!process.env.FRIDA_TEST_OWNER_SERVICE)throw new Error('Run only through the disposable test fixture.');
 fixtureDirectory=await mkdtemp(join(process.env.BACKUP_STAGING_DIRECTORY!,'tests-'));
 owner=await connectService(process.env.FRIDA_TEST_OWNER_SERVICE);
 const pair=generateKeyPairSync('rsa',{modulusLength:2048});const jwk=pair.publicKey.export({format:'jwk'});
 server=createServer({key:await readFile(process.env.FRIDA_TEST_KEY!),cert:await readFile(process.env.FRIDA_TEST_CERT!)},async(req,res)=>{
  res.setHeader('content-type','application/json');
  if(req.url==='/.well-known/openid-configuration')return res.end(JSON.stringify({issuer,authorization_endpoint:issuer+'/authorize',token_endpoint:issuer+'/token',jwks_uri:issuer+'/jwks',response_types_supported:['code'],subject_types_supported:['public'],id_token_signing_alg_values_supported:['RS256'],token_endpoint_auth_methods_supported:['client_secret_basic']}));
  if(req.url==='/jwks')return res.end(JSON.stringify({keys:[{...jwk,kid:'fixture',alg:'RS256',use:'sig'}]}));
  if(req.url==='/token'){
   let body='';for await(const chunk of req)body+=chunk;
   const input=new URLSearchParams(body),entry=grants.get(input.get('code')??'');
   const basic=Buffer.from(req.headers.authorization?.split(' ')[1]??'','base64').toString().split(':').map(value=>decodeURIComponent(value)).join(':');
   if(!entry||basic!=='documents-client:fixture-client-secret'||createHash('sha256').update(input.get('code_verifier')??'').digest('base64url')!==entry.challenge){res.statusCode=400;return res.end('{}');}
   grants.delete(input.get('code')!);
   const now=Math.floor(Date.now()/1000);
   const claims={iss:issuer,aud:'documents-client',sub:entry.subject,email:entry.email,email_verified:true,groups:['documents-sandbox'],nonce:entry.nonce,iat:now,exp:now+300,...(entry.claims as object??{})};
   const header=Buffer.from(JSON.stringify({alg:'RS256',kid:'fixture'})).toString('base64url');const payload=Buffer.from(JSON.stringify(claims)).toString('base64url');const signed=sign('RSA-SHA256',Buffer.from(header+'.'+payload),pair.privateKey);if(entry.badSignature)signed[0]^=1;const signature=signed.toString('base64url');
   return res.end(JSON.stringify({access_token:'fixture-access',token_type:'Bearer',expires_in:60,id_token:header+'.'+payload+'.'+signature}));
  }
  res.statusCode=404;res.end('{}');
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();if(!address||typeof address==='string')throw new Error('No fixture address.');issuer='https://127.0.0.1:'+address.port;
 Object.assign(process.env,{APP_ORIGIN:'https://documents.frida.test',OIDC_ISSUER:issuer,OIDC_CLIENT_ID:'documents-client',OIDC_CLIENT_SECRET:'fixture-client-secret',OIDC_REQUIRED_ENTITLEMENT_CLAIM:'groups',OIDC_REQUIRED_ENTITLEMENT_VALUE:'documents-sandbox',SESSION_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64')});
 sessionA=await (await login('person-a','a@example.test',{claims:{role:'admin',groups:['documents-sandbox','staff']}})).result;
 sessionB=await (await login('person-b','b@example.test')).result;
 profileA=(await sessionForCookie(sessionA.session))!.profile.id;profileB=(await sessionForCookie(sessionB.session))!.profile.id;
});
afterAll(async()=>{await owner?.end();await database().end();await new Promise<void>(resolve=>server?.close(()=>resolve()));if(fixtureDirectory)await rm(fixtureDirectory,{recursive:true,force:true});});

const origin='https://documents.frida.test';
function request(path:string,account=sessionA,value?:unknown,method='POST',extra:Record<string,string>={}) {
  return new NextRequest(origin+path,{method:value===undefined?'GET':method,
    headers:{cookie:`${SESSION_COOKIE}=${account.session}; ${CSRF_COOKIE}=${account.csrf}`,origin,'x-frida-csrf':account.csrf,...extra},
    ...(value===undefined?{}:{body:JSON.stringify(value)})});
}
const connection=(insurerId:string,action='connect',locale='de')=>({insurerId,action,locale,accepted:true});
describe('native PostgreSQL, OIDC and protected document API',()=>{
 it('creates independent empty accounts without passwords or Supabase',async()=>{
  expect(profileA).not.toBe(profileB);
  expect((await workspace({id:profileA,email:'a@example.test'})).documents).toEqual([]);
  expect((await owner.query("SELECT to_regclass('auth.users') AS auth")).rows[0].auth).toBe(null);
  expect((await owner.query('SELECT column_name FROM information_schema.columns WHERE table_name=$1',['profiles'])).rows.map(row=>row.column_name)).not.toContain('role');
  const rows=(await owner.query('SELECT expires_at-now() AS remaining FROM app_sessions')).rows;
  expect(rows).toHaveLength(2);
  expect((await sessionForCookie(sessionA.session))!.profile.enabled).toBe(true);
 });
 it('rejects invalid signatures, wrong issuer/audience/nonce, expiry, missing entitlement and unverified email',async()=>{
  for(const claims of [{aud:'peer-app'},{nonce:'wrong'},{iss:'https://untrusted.invalid'},{exp:1},{groups:['staff-only']},{email_verified:false}]) {
   await expect((await login('denied-'+randomUUID(),'denied@example.test',{claims})).result).rejects.toThrow();
  }
  await expect((await login('bad-signature','bad@example.test',{badSignature:true})).result).rejects.toThrow();
  expect((await owner.query('SELECT count(*)::int AS n FROM profiles')).rows[0].n).toBe(2);
 });
 it('renews an expired session silently for the same person without extending the one-hour binding',async()=>{
  await owner.query("UPDATE app_sessions SET expires_at=now()-interval '1 second' WHERE id_hash=$1",[createHash('sha256').update(sessionA.session).digest('hex')]);
  expect(await sessionForCookie(sessionA.session)).toBe(null);
  expect(await sessionForCookie(sessionA.renewalCookie)).toBe(null);
  const flow=await startLogin('/connections',{cookie:sessionA.renewalCookie});
  expect(flow.url.searchParams.get('prompt')).toBe('none');
  const code=randomUUID();grants.set(code,{subject:'person-a',email:'a@example.test',nonce:flow.url.searchParams.get('nonce'),challenge:flow.url.searchParams.get('code_challenge')});
  const callback=new URL('https://documents.frida.test/auth/callback');callback.searchParams.set('code',code);callback.searchParams.set('state',flow.url.searchParams.get('state')!);
  const renewed=await finishLogin(callback,flow.transaction);
  expect(renewed.returnPath).toBe('/auth/renew/complete');expect(renewed.renewalCookie).toBeUndefined();
  expect((await sessionForCookie(renewed.session))!.user.id).toBe(profileA);
  sessionA={...renewed,renewalCookie:sessionA.renewalCookie};
 });
 it('silent renewal rejects another SSO identity, removed entitlement and expired/tampered bindings',async()=>{
  for(const subject of ['person-b','removed-person']) {
   const flow=await startLogin(null,{cookie:sessionA.renewalCookie});const code=randomUUID();
   grants.set(code,{subject,email:subject==='person-b'?'b@example.test':'a@example.test',nonce:flow.url.searchParams.get('nonce'),challenge:flow.url.searchParams.get('code_challenge'),...(subject==='removed-person'?{claims:{groups:[]}}:{})});
   const callback=new URL('https://documents.frida.test/auth/callback');callback.searchParams.set('code',code);callback.searchParams.set('state',flow.url.searchParams.get('state')!);
   await expect(finishLogin(callback,flow.transaction)).rejects.toThrow();
  }
  const binding=JSON.parse(decrypt(sessionA.renewalCookie!));binding.expires=Date.now()-1;
  await expect(startLogin(null,{cookie:encrypt(JSON.stringify(binding))})).rejects.toThrow();
  await expect(startLogin(null,{cookie:'tampered'})).rejects.toThrow();
  await expect(startLogin(null,{cookie:undefined})).rejects.toThrow();
  const manual=await startLogin(null,{cookie:sessionA.renewalCookie,interactive:true});
  expect(manual.url.searchParams.get('prompt')).toBe('login');
 });
 it('resumes only the public page shells after expiry, while private API access stays denied',async()=>{
  const cookie=RENEWAL_COOKIE+'='+sessionA.renewalCookie;
  for(const path of ['/','/connections','/account']) {
   const response=await proxy(new NextRequest('https://documents.frida.test'+path,{headers:{cookie}}));
   expect(response.headers.get('x-middleware-next')).toBe('1');expect(response.headers.get('location')).toBe(null);
  }
  const denied=await proxy(new NextRequest('https://documents.frida.test/api/workspace',{headers:{cookie}}));
  expect(denied.status).toBe(401);
  const binding=JSON.parse(decrypt(sessionA.renewalCookie!));binding.expires=Date.now()-1000;
  const manual=await startLogin(null,{cookie:encrypt(JSON.stringify(binding)),interactive:true});
  expect(manual.url.searchParams.get('prompt')).toBe('login');
  await expect(startLogin(null,{cookie:encrypt(JSON.stringify(binding))})).rejects.toThrow();
 });
 it('consumes callbacks once and refuses email-only identity linking',async()=>{
  const flow=await login('collision','a@example.test');await expect(flow.result).rejects.toThrow();
  await expect(finishLogin(flow.callback,flow.transaction)).rejects.toThrow();
 });
 it('rejects unauthenticated APIs, bearer fallback, foreign Origin and missing CSRF in route handlers themselves',async()=>{
  expect((await getWorkspace(new Request(origin+'/api/workspace'))).status).toBe(401);
  expect((await getWorkspace(request('/api/workspace',sessionA,undefined,'GET',{authorization:'Bearer invalid'}))).status).toBe(401);
  expect((await postConnections(request('/api/connections',sessionA,connection(insurers[0].uuid),'POST',{origin:'https://sibling.frida.test'}))).status).toBe(403);
  expect((await postConnections(request('/api/connections',sessionA,connection(insurers[0].uuid),'POST',{'x-frida-csrf':''}))).status).toBe(403);
  expect((await proxy(request('/api/workspace'))).headers.get('x-middleware-next')).toBe('1');
  expect((await proxy(request('/api/workspace',sessionA,undefined,'GET',{authorization:'Bearer invalid'}))).status).toBe(401);
 });
 it('requires active consent, records one grant per connection and serializes duplicate connects',async()=>{
  expect((await postConnections(request('/api/connections',sessionA,connection(insurers[0].uuid,'sync')))).status).toBe(409);
  expect((await postConnections(request('/api/connections',sessionA,{...connection(insurers[0].uuid),accepted:false}))).status).toBe(400);
  await Promise.all(Array.from({length:4},()=>connect(profileA,connection(insurers[0].uuid))));
  const consent=(await owner.query('SELECT * FROM dd_consent_events WHERE user_id=$1',[profileA])).rows;
  expect(consent).toHaveLength(1);expect(consent[0].consent_text).toContain('Beispieldokumente');expect(consent[0].version).toBe('1.0');
 });
 it('imports all 18 documents and 21 files idempotently with original API pagination',async()=>{
  for(const insurer of insurers) {
   for(const action of ['connect','sync','sync'])expect((await postConnections(request('/api/connections',sessionA,connection(insurer.uuid,action)))).status).toBe(200);
  }
  const saved=await (await getWorkspace(request('/api/workspace'))).json();
  expect(saved.documents).toHaveLength(18);expect(saved.documents.flatMap((row:{metadata:{files:unknown[]}})=>row.metadata.files)).toHaveLength(21);
  expect((await getDocuments(request('/api/documents'))).status).toBe(400);
  expect((await getDocuments(request('/api/documents?sortAsc=true'))).status).toBe(200);
  expect(await (await getInfos(request('/api/insurance-infos'))).json()).toHaveLength(3);
 });
 it('enforces owner isolation at both SQL and HTTP boundaries',async()=>{
  expect((await (await getWorkspace(request('/api/workspace',sessionB))).json()).documents).toEqual([]);
  const uuid=sampleDocuments[0].uuid,file=sampleDocuments[0].files[0].uuid;
  expect((await getFile(request('/api/files/'+file,sessionB),{params:Promise.resolve({uuid:file})})).status).toBe(404);
  expect((await patchDocument(request('/api/documents/'+uuid,sessionB,{},'PATCH'),{params:Promise.resolve({uuid})})).status).toBe(404);
  expect((await asUser(profileB,db=>db.query('SELECT * FROM dd_documents WHERE user_id=$1',[profileA]))).rows).toEqual([]);
  await expect(asUser(profileB,db=>db.query("INSERT INTO dd_connections(user_id,insurer_id,status) VALUES($1,$2,'active')",[profileA,insurers[0].uuid]))).rejects.toThrow();
  await expect(asUser(profileA,db=>db.query("UPDATE dd_documents SET metadata='{}' WHERE user_id=$1",[profileA]))).rejects.toThrow();
  expect((await database().query('SELECT * FROM dd_documents')).rows).toEqual([]);
 });
 it('keeps read state and imported downloads after disconnect and renders both policy attachments in both languages',async()=>{
  const doc=sampleDocuments[0],uuid=doc.uuid;
  expect((await patchDocument(request('/api/documents/'+uuid,sessionA,{},'PATCH'),{params:Promise.resolve({uuid})})).status).toBe(200);
  expect((await postConnections(request('/api/connections',sessionA,connection(insurers[0].uuid,'disconnect')))).status).toBe(200);
  for(const locale of ['de','en'])for(const file of doc.files) {
   const response=await getFile(request('/api/files/'+file.uuid+'?locale='+locale),{params:Promise.resolve({uuid:file.uuid})});
   expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('private, no-store');
   expect(Buffer.from(await response.arrayBuffer()).subarray(0,4).toString()).toBe('%PDF');
  }
  expect((await workspace({id:profileA,email:'a@example.test'})).documents.find(row=>row.document_id===uuid)?.read_at).toBeTruthy();
  expect((await postConnections(request('/api/connections',sessionA,connection(insurers[0].uuid,'sync')))).status).toBe(409);
 });
 it('separates runtime, migration and backup privileges and detects migration drift',async()=>{
  await expect(database().query('CREATE TABLE cannot_ddl(id integer)')).rejects.toThrow();
  await expect(database().query('UPDATE profiles SET enabled=false')).rejects.toThrow();
  const backup=await connectService(process.env.FRIDA_TEST_BACKUP_SERVICE!);
  try {
   await expect(backup.query('UPDATE dd_connections SET status=$1',['disconnected'])).rejects.toThrow();
   expect((await backup.query('SELECT * FROM dd_documents')).rowCount).toBe(18);
  }finally{await backup.end();}
  expect(tool('migrate').status).toBe(0);
  expect((await owner.query('SELECT count(*)::int AS n FROM dd_documents')).rows[0].n).toBe(18);
  await owner.query("UPDATE frida_migrations SET sha256=repeat('0',64)");expect(tool('migrate').status).not.toBe(0);
  const contract=JSON.parse(await readFile('deployment/contract.json','utf8'));await owner.query('UPDATE frida_migrations SET sha256=$1',[contract.reviewed_migrations[0].sha256]);
 });
 it('refuses initialization over an unknown populated target',async()=>{
  const dirty=await connectService(process.env.FRIDA_TEST_DIRTY_SERVICE!);await dirty.query('CREATE TABLE sentinel(id integer)');await dirty.end();
  expect(tool('init',process.env.FRIDA_TEST_DIRTY_SERVICE).status).not.toBe(0);
 });
 it('checks database/schema/OIDC readiness and blocks writes during backup maintenance',async()=>{
  expect((await ready()).status).toBe(200);
  await owner.query('UPDATE app_maintenance SET active=true WHERE id=true');
  try{expect((await ready()).status).toBe(503);await expect(reset(profileA)).rejects.toThrow();}
  finally{await owner.query('UPDATE app_maintenance SET active=false WHERE id=true');}
  await owner.query('SELECT pg_advisory_lock(734292861)');
  try{await expect(reset(profileA)).rejects.toThrow();}finally{await owner.query('SELECT pg_advisory_unlock(734292861)');}
 });
 it('backs up every user-owned row and restores only to an empty different database, clearing sessions',async()=>{
  const result=tool('backup',process.env.FRIDA_TEST_BACKUP_SERVICE);expect(result.status,result.stderr.toString()).toBe(0);bundle=result.stdout;
  expect(tool('verify',undefined,bundle).status).toBe(0);
  expect(tool('restore',process.env.FRIDA_TEST_OWNER_SERVICE,bundle,{FRIDA_EMPTY_RESTORE:'true'}).status).not.toBe(0);
  const restored=tool('restore',process.env.FRIDA_TEST_RESTORE_SERVICE,bundle,{FRIDA_EMPTY_RESTORE:'true'});
  expect(restored.status,restored.stderr.toString()).toBe(0);
  const db=await connectService(process.env.FRIDA_TEST_RESTORE_SERVICE!);
  try {
   expect((await db.query('SELECT count(*)::int AS n FROM dd_documents')).rows[0].n).toBe(18);
   expect((await db.query('SELECT count(*)::int AS n FROM dd_consent_events')).rows[0].n).toBe(4);
   expect((await db.query('SELECT count(*)::int AS n FROM app_sessions')).rows[0].n).toBe(0);
   expect((await db.query('SELECT active FROM app_maintenance')).rows[0].active).toBe(false);
  }finally{await db.end();}
 });
 it('refuses corrupt backup bundles and leaves live records intact',async()=>{
  const corrupt=Buffer.from(bundle);const index=corrupt.indexOf(Buffer.from('PGDMP'));expect(index).toBeGreaterThan(0);corrupt[index+50]^=1;
  expect(tool('verify',undefined,corrupt).status).not.toBe(0);
  expect((await owner.query('SELECT count(*)::int AS n FROM dd_documents')).rows[0].n).toBe(18);
 });
 it('resets only the requesting account and immediately rejects disabled/expired sessions',async()=>{
  await connect(profileB,connection(insurers[1].uuid));await connect(profileB,connection(insurers[1].uuid,'sync'));
  expect((await postReset(request('/api/reset',sessionA,{}))).status).toBe(200);
  expect((await workspace({id:profileA,email:'a@example.test'})).documents).toHaveLength(0);
  expect((await workspace({id:profileB,email:'b@example.test'})).documents).toHaveLength(6);
  await owner.query('UPDATE profiles SET enabled=false WHERE id=$1',[profileB]);expect(await sessionForCookie(sessionB.session)).toBe(null);
  await owner.query("UPDATE app_sessions SET expires_at=now()-interval '1 second'");expect(await sessionForCookie(sessionA.session)).toBe(null);
 });
 it('uses an isolated probe credential that grants no browser access or document mutation',async()=>{
  expect((await probe(new Request(origin+'/api/internal/deployment-probe'))).status).toBe(401);
  const id=randomUUID();await owner.query('INSERT INTO profiles(id,email,enabled) VALUES($1,$2,false)',[id,'probe@example.test']);
  Object.assign(process.env,{DEPLOYMENT_PROBE_SECRET:'x'.repeat(40),DEPLOYMENT_PROBE_PROFILE_ID:id});
  const req=new Request(origin+'/api/internal/deployment-probe',{headers:{authorization:'Bearer '+'x'.repeat(40)}});
  expect((await probe(req)).status).toBe(200);
  expect((await getWorkspace(new Request(origin+'/api/workspace',{headers:{authorization:'Bearer '+'x'.repeat(40)}}))).status).toBe(401);
 });
});
