import { identity,json,failure } from '@/server/http';
import { markRead } from '@/server/documents';
export async function PATCH(request:Request,context:{params:Promise<{uuid:string}>}) {
  try{const {user}=await identity(request);await markRead(user.id,(await context.params).uuid);return json({ok:true});}catch(error){return failure(error);}
}
