import { ReactNode, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';

interface AppProviderProps {
  children: ReactNode;
}

export default function AppProvider({ children }: AppProviderProps) {
  const verify = useAuthStore((state) => state.verify);

  // Verify authentication on app mount (runs in background)
  useEffect(() => {
    verify();
  }, []);

  // Render children immediately - pages that need auth will handle their own loading state
  return <>{children}</>;
}
