import { redirect } from 'next/navigation';
export default async function Page({searchParams}:{searchParams:Promise<{redirect?:string}>}) {
  const value=(await searchParams).redirect;
  redirect('/api/auth/login'+(value?'?redirect='+encodeURIComponent(value):''));
}
