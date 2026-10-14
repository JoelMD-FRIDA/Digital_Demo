import { identity,json,failure } from '@/server/http';
import { reset } from '@/server/documents';
export async function POST(request:Request) {
  try{const {user}=await identity(request);await reset(user.id);return json({ok:true});}catch(error){return failure(error);}
}
