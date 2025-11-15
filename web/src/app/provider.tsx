import { ReactNode, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface AppProviderProps {
  children: ReactNode;
}

export default function AppProvider({ children }: AppProviderProps) {
  const { verify, isLoading } = useAuth();

  // Verify authentication on app mount
  useEffect(() => {
    verify();
  }, []);

  // Optional: Show loading screen while verifying
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontSize: '1.2rem',
        color: '#666'
      }}>
        Loading...
      </div>
    );
  }

  return <>{children}</>;
}
