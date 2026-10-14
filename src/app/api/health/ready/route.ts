import { sql } from '@/lib/db/postgres';
import { appOrigin,encrypt } from '@/lib/auth/session';
import { oidcSettings,oidcConfiguration } from '@/lib/auth/oidc';
import contract from '../../../../../deployment/contract.json';
export const dynamic='force-dynamic';
async function dependencies() {
  appOrigin();oidcSettings();encrypt('readiness');
  const [result]=await Promise.all([
    sql("SELECT id,sha256,current_user,has_schema_privilege(current_user,'public','CREATE') AS ddl FROM frida_migrations ORDER BY id DESC LIMIT 1"),oidcConfiguration()]);
  const expected=contract.reviewed_migrations.at(-1),row=result.rows[0];
  if(!expected||!row||row.id!==expected.file||row.sha256!==expected.sha256||row.current_user!=='frida_documents_app'||row.ddl)throw new Error('Schema/role mismatch.');
  if((await sql('SELECT active FROM app_maintenance WHERE id=true')).rows[0]?.active!==false)throw new Error('Maintenance active.');
  await sql('SELECT d.metadata,c.status,e.action FROM dd_documents d LEFT JOIN dd_connections c ON c.user_id=d.user_id LEFT JOIN dd_consent_events e ON e.user_id=d.user_id LIMIT 0');
  const catalog=await sql('SELECT (SELECT count(*)::int FROM dd_catalog) AS documents,(SELECT count(*)::int FROM dd_insurers) AS insurers');
  if(catalog.rows[0]?.documents!==18||catalog.rows[0]?.insurers!==3)throw new Error('Catalog unavailable.');
}
export async function GET() {
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{await Promise.race([dependencies(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Readiness deadline.')),4500);})]);return Response.json({status:'ready'},{headers:{'Cache-Control':'no-store'}});}
  catch{return Response.json({status:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
  finally{clearTimeout(timer);}
}
