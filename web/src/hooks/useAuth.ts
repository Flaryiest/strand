import { useAuthStore } from '@/stores/auth';

/**
 * Custom hook to access auth state and actions
 * Use this hook in components that need authentication functionality
 */
export const useAuth = () => {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const error = useAuthStore((state) => state.error);

  const login = useAuthStore((state) => state.login);
  const signup = useAuthStore((state) => state.signup);
  const logout = useAuthStore((state) => state.logout);
  const verify = useAuthStore((state) => state.verify);
  const clearError = useAuthStore((state) => state.clearError);

  return {
    // State
    user,
    isAuthenticated,
    isLoading,
    isInitializing,
    error,

    // Actions
    login,
    signup,
    logout,
    verify,
    clearError
  };
};
