import AuthGate from "@/components/auth/AuthGate";

export default function LoginPage() {
  return (
    <AuthGate requireAuth={false}>
      {/* محتوای فرم لاگین */}
    </AuthGate>
  );
}
