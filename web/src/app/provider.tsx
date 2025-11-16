import { ReactNode, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface AppProviderProps {
  children: ReactNode;
}

export default function AppProvider({ children }: AppProviderProps) {
  const { verify, isInitializing } = useAuth();

  // Verify authentication on app mount
  useEffect(() => {
    verify();
  }, []);

  // Show loading screen only during initial app load
  if (isInitializing) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontSize: '1.2rem',
          color: '#666'
        }}
      >
        Loading...
      </div>
    );
  }

  return <>{children}</>;
}
