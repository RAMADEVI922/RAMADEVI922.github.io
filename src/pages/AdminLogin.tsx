import { SignIn } from '@clerk/react';
import { Shield } from 'lucide-react';

export default function AdminLogin() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Admin Login</h1>
        </div>
        <div className="flex justify-center">
          <SignIn
            signUpUrl="/QRMENU/admin-signup"
            afterSignInUrl="/QRMENU/admin"
            fallbackRedirectUrl="/QRMENU/admin"
            appearance={{
              baseTheme: undefined,
              elements: {
                rootBox: "w-full",
                card: "w-full shadow-none border border-border rounded-lg",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
