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
    console.log('Google credential received:', response);
    const result = await useAuthStore.getState().googleLogin(response.credential);
    if (result.success) {
      navigate('/chat');
    } else {
      console.error('Google login failed:', result.error);
    }
  }, [navigate]);

  useEffect(() => {
    // Initialize Google Sign-In when SDK loads
    const initializeGoogleSignIn = () => {
      if (window.google) {
        console.log('Initializing Google Sign-In with client ID:', import.meta.env.VITE_GOOGLE_CLIENT_ID);
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        console.log('Google Sign-In initialized');
      }
    };

    // Check if Google SDK is already loaded
    if (window.google) {
      initializeGoogleSignIn();
    } else {
      console.log('Waiting for Google SDK to load...');
      // Wait for SDK to load
      const checkGoogleLoaded = setInterval(() => {
        if (window.google) {
          console.log('Google SDK loaded');
          initializeGoogleSignIn();
          clearInterval(checkGoogleLoaded);
        }
      }, 100);

      return () => clearInterval(checkGoogleLoaded);
    }
  }, [handleCredentialResponse]);

  const signInWithGoogle = useCallback(() => {
    console.log('Sign in with Google clicked');
    if (window.google) {
      try {
        // Use prompt() to show the One Tap UI
        window.google.accounts.id.prompt();
        console.log('Google prompt initiated');
      } catch (error) {
        console.error('Error showing Google prompt:', error);
      }
    } else {
      console.error('Google SDK not loaded yet');
    }
  }, []);

  return { signInWithGoogle };
};
