import { useEffect } from 'react';
import { SignedIn, SignedOut, SignInButton, useAuth } from '@clerk/clerk-react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@/store/authStore';

// Auth wrapper — shows sign-in for unauthenticated users
function AuthedApp() {
  const { getToken } = useAuth();
  const setToken = useAuthStore((s) => s.setToken);

  useEffect(() => {
    // Keep the Zustand token fresh for API calls
    const refresh = async () => {
      const token = await getToken();
      if (token) setToken(token);
    };
    refresh();
    const id = setInterval(refresh, 55 * 1000); // refresh before 60s expiry
    return () => clearInterval(id);
  }, [getToken, setToken]);

  return <AppShell />;
}

export default function App() {
  // Check if running without Clerk (demo mode)
  const hasCLerk = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  if (!hasCLerk) {
    return <AppShell />;
  }

  return (
    <>
      <SignedIn>
        <AuthedApp />
      </SignedIn>
      <SignedOut>
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-panel gap-6">
          <div className="text-center space-y-2">
            <div className="text-5xl font-bold text-avionics-cyan font-cockpit tracking-tight">✈ AKAGERA EFB</div>
            <p className="text-muted-foreground text-lg">Professional Electronic Flight Bag</p>
          </div>
          <SignInButton mode="modal">
            <button className="px-8 py-3 bg-avionics-blue rounded-lg font-semibold text-white hover:opacity-90 transition-opacity text-lg">
              Sign In
            </button>
          </SignInButton>
        </div>
      </SignedOut>
    </>
  );
}
