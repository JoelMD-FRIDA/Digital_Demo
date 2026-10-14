import { AuthForm } from "@/components/auth-form";
import { authConfigured } from "@/lib/supabase/config";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <AuthForm
      mode="login"
      configured={authConfigured()}
      callbackError={Boolean((await searchParams).error)}
    />
  );
}
