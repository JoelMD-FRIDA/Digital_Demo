import { AuthForm } from "@/components/auth-form";
import { authConfigured } from "@/lib/supabase/config";
export default function Page() {
  return <AuthForm mode="register" configured={authConfigured()} />;
}
