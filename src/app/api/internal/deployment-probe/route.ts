import { equal } from '@/lib/auth/session';
import { sql } from '@/lib/db/postgres';
import { asUser } from '@/server/documents';
import { GET as readiness } from '@/app/api/health/ready/route';
export async function GET(request:Request) {
  const secret=process.env.DEPLOYMENT_PROBE_SECRET;
  const supplied=request.headers.get('authorization')?.replace(/^Bearer /,'');
  if(!secret||secret.length<32||!equal(secret,supplied))return Response.json({status:'denied'},{status:401});
  try {
    if((await readiness()).status!==200)throw new Error('Not ready.');
    const profile=process.env.DEPLOYMENT_PROBE_PROFILE_ID;
    if(!profile||!/^[a-f0-9-]{36}$/.test(profile))throw new Error('Missing scoped probe identity.');
    if((await sql('SELECT id FROM profiles WHERE id=$1 AND NOT enabled',[profile])).rowCount!==1)throw new Error('Probe unavailable.');
    await asUser(profile,db=>db.query('SELECT document_id FROM dd_documents WHERE user_id=$1 LIMIT 1',[profile]));
    return Response.json({status:'ok'},{headers:{'Cache-Control':'no-store'}});
  }catch{return Response.json({status:'unavailable'},{status:503});}
}
