import { identity,json,failure } from '@/server/http';
import { workspace } from '@/server/documents';
export async function GET(request:Request) {
  try{const {user}=await identity(request);return json(await workspace(user));}catch(error){return failure(error);}
}
