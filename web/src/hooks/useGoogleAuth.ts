import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';

declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: () => void;
          renderButton: (element: HTMLElement, config: any) => void;
        };
      };
    };
  }
}

export const useGoogleAuth = () => {
  const navigate = useNavigate();

  const handleCredentialResponse = useCallback(async (response: any) => {
    const result = await useAuthStore.getState().googleLogin(response.credential);
    if (result.success) {
      navigate('/chat');
    }
  }, [navigate]);

  useEffect(() => {
    // Initialize Google Sign-In when SDK loads
    const initializeGoogleSignIn = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
        });
      }
    };

    // Check if Google SDK is already loaded
    if (window.google) {
      initializeGoogleSignIn();
    } else {
      // Wait for SDK to load
      const checkGoogleLoaded = setInterval(() => {
        if (window.google) {
          initializeGoogleSignIn();
          clearInterval(checkGoogleLoaded);
        }
      }, 100);

      return () => clearInterval(checkGoogleLoaded);
    }
  }, [handleCredentialResponse]);

  const signInWithGoogle = useCallback(() => {
    if (window.google) {
      window.google.accounts.id.prompt();
    }
  }, []);

  return { signInWithGoogle };
};
