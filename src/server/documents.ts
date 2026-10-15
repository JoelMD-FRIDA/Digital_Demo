import { withWrites } from '@/lib/db/postgres';
import type { PoolClient } from 'pg';
import { HttpError } from './http';
import { insurerById } from '@/lib/catalog';
import { retrieveAll,simulatedProvider } from './provider';
import type { Connection,SavedDocument } from '@/lib/types';
// Each transaction gets its own RLS actor, never a pooled connection's prior actor.
export async function asUser<T>(user:string,operation:(db:PoolClient)=>Promise<T>):Promise<T> {
  return withWrites(async db=>{
    await db.query("SELECT set_config('frida.user_id',$1,true)",[user]);
    return operation(db);
  });
}
export async function workspace(user:{id:string;email:string}) {
  return asUser(user.id,async db=>({email:user.email,
    documents:(await db.query<SavedDocument>('SELECT document_id,imported_at,read_at,metadata FROM dd_documents WHERE user_id=$1 ORDER BY imported_at DESC',[user.id])).rows,
    connections:(await db.query<Connection>('SELECT insurer_id,status,consent_at,last_sync_at FROM dd_connections WHERE user_id=$1',[user.id])).rows}));
}
export async function activeInsurers(user:string) {
  return asUser(user,async db=>(await db.query<{insurer_id:string}>("SELECT insurer_id FROM dd_connections WHERE user_id=$1 AND status='active'",[user])).rows.map(row=>row.insurer_id));
}
export async function connect(user:string,input:Record<string,unknown>) {
  if(typeof input.insurerId!=='string'||!insurerById(input.insurerId))throw new HttpError(400,'INVALID_INPUT');
  const insurer=input.insurerId;
  if(!['connect','disconnect','sync'].includes(String(input.action)))throw new HttpError(400,'INVALID_INPUT');
  if(input.action==='connect'&&(input.accepted!==true||!['de','en'].includes(String(input.locale))))throw new HttpError(400,'INVALID_INPUT');
  // Provider is a local simulator; no external credentials or network calls.
  const documents=input.action==='sync'?await retrieveAll(simulatedProvider,insurer):[];
  await asUser(user,async db=>{
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[user]);
    const current=(await db.query<Connection>('SELECT status FROM dd_connections WHERE user_id=$1 AND insurer_id=$2',[user,insurer])).rows[0];
    if(input.action==='connect') {
      if(current?.status==='active')return;
      const wording=input.locale==='de'?'Ich erlaube FRIDA Digital Documents, meine Beispieldokumente bei diesem Demo-Versicherer abzurufen und in meinem Sandbox-Postfach zu speichern. Ich kann die Verbindung jederzeit trennen. Bereits abgerufene Dokumente bleiben im Postfach.':'I allow FRIDA Digital Documents to retrieve my sample documents from this demo insurer and store them in my sandbox inbox. I can disconnect at any time. Previously retrieved documents remain in my inbox.';
      await db.query("INSERT INTO dd_connections(user_id,insurer_id,status,consent_at) VALUES($1,$2,'active',now()) ON CONFLICT(user_id,insurer_id) DO UPDATE SET status='active',consent_at=now()",[user,insurer]);
      await db.query("INSERT INTO dd_consent_events(user_id,insurer_id,action,locale,consent_text) VALUES($1,$2,'granted',$3,$4)",[user,insurer,input.locale,wording]);
    }else if(input.action==='disconnect') {
      if(current?.status!=='active')return;
      await db.query("UPDATE dd_connections SET status='disconnected' WHERE user_id=$1 AND insurer_id=$2",[user,insurer]);
      await db.query("INSERT INTO dd_consent_events(user_id,insurer_id,action,locale,consent_text) VALUES($1,$2,'revoked',coalesce((SELECT locale FROM dd_consent_events WHERE user_id=$1 AND insurer_id=$2 AND action='granted' ORDER BY created_at DESC LIMIT 1),'de'),'Demo connection revoked. Previously imported documents retained.')",[user,insurer]);
    }else {
      if(current?.status!=='active')throw new HttpError(409,'CONNECTION_INACTIVE');
      await db.query('INSERT INTO dd_documents(user_id,document_id,metadata) SELECT $1,id,metadata FROM dd_catalog WHERE insurer_id=$2 AND id=any($3::uuid[]) ON CONFLICT(user_id,document_id) DO NOTHING',[user,insurer,documents.map(document=>document.uuid)]);
      await db.query('UPDATE dd_connections SET last_sync_at=now() WHERE user_id=$1 AND insurer_id=$2',[user,insurer]);
    }
  });
}
export async function markRead(user:string,document:string) {
  if(!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(document))throw new HttpError(404,'NOT_FOUND');
  return asUser(user,async db=>{
    const result=await db.query('UPDATE dd_documents SET read_at=now() WHERE user_id=$1 AND document_id=$2',[user,document]);
    if(!result.rowCount)throw new HttpError(404,'NOT_FOUND');
  });
}
export async function canDownload(user:string,document:string,insurer:string) {
  return asUser(user,async db=>(await db.query("SELECT 1 FROM dd_documents WHERE user_id=$1 AND document_id=$2 UNION ALL SELECT 1 FROM dd_connections WHERE user_id=$1 AND insurer_id=$3 AND status='active' LIMIT 1",[user,document,insurer])).rowCount!==0);
}
export async function reset(user:string) {
  return asUser(user,async db=>{
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[user]);
    for(const table of ['dd_documents','dd_consent_events','dd_connections'])await db.query(`DELETE FROM ${table} WHERE user_id=$1`,[user]);
  });
}
