export interface User {
  id: number;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  location?: string | null;
  plan: 'Basic' | 'Premium' | 'Pro';
  credits: number;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials {
  email: string;
  password: string;
}

export interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  signup: (credentials: SignupCredentials) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  verify: () => Promise<void>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

export type AuthStore = AuthState & AuthActions;
