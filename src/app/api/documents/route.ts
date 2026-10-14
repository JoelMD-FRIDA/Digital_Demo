import { identity,json,failure } from '@/server/http';
import { activeInsurers } from '@/server/documents';
import { searchOptions,simulatedProvider } from '@/server/provider';
export async function GET(request:Request) {
  try{const {user}=await identity(request);return json(await simulatedProvider.search(await activeInsurers(user.id),searchOptions(new URL(request.url))));}catch(error){return failure(error);}
}
