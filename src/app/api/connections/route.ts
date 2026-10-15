import { identity,json,failure,body } from '@/server/http';
import { connect } from '@/server/documents';
export async function POST(request:Request) {
  try{const {user}=await identity(request);await connect(user.id,await body(request));return json({ok:true});}catch(error){return failure(error);}
}
