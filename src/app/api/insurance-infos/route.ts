import { identity,json,failure } from '@/server/http';
import { activeInsurers } from '@/server/documents';
import { simulatedProvider } from '@/server/provider';
export async function GET(request:Request) {
  try{const {user}=await identity(request);return json(await simulatedProvider.insuranceInfos(await activeInsurers(user.id)));}catch(error){return failure(error);}
}
