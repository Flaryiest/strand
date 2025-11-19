import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './signup.module.css';
import { useAuth } from '@/hooks/useAuth';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';

const carouselSlides = [
  {
    title: 'AI-Powered Itineraries',
    description:
      'Our intelligent AI analyzes thousands of reviews, maps, and recommendations to craft your perfect day.',
    imagePlaceholder: 'AI_ITINERARY'
  },
  {
    title: 'Optimize Every Moment',
    description:
      'Save time and money with smart route planning that considers distance, budget, and your schedule.',
    imagePlaceholder: 'OPTIMIZE_ROUTE'
  },
  {
    title: 'Share Your Adventures',
    description:
      'Collaborate with friends and family. Share your plans instantly with a single link.',
    imagePlaceholder: 'SHARE_PLANS'
  },
  {
    title: 'Discover Hidden Gems',
    description:
      'Find the best local spots, trending cafes, and secret locations curated just for you.',
    imagePlaceholder: 'DISCOVER_PLACES'
  }
];

export default function SignupPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [localError, setLocalError] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const navigate = useNavigate();
  const { signup, login, isLoading, error, clearError, isAuthenticated } =
    useAuth();
  const { signInWithGoogle } = useGoogleAuth();

  // Auto-advance carousel
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselSlides.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Listen for successful authentication (after login following signup)
  useEffect(() => {
    if (isAuthenticated && !isExiting) {
      setIsExiting(true);
      setTimeout(() => {
        navigate('/chat');
      }, 1000);
    }
  }, [isAuthenticated, isExiting, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setLocalError('');
    clearError();
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    // Validation
    if (formData.password.length < 8) {
      setLocalError('Password must be at least 8 characters long');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    const result = await signup({
      email: formData.email,
      password: formData.password
    });

    if (result.success) {
      // Successfully signed up, now log them in
      const loginResult = await login({
        email: formData.email,
        password: formData.password
      });

      if (loginResult.success) {
        // The useEffect watching isAuthenticated will handle the animation and navigation
        // Don't navigate directly here
      } else {
        // If auto-login fails, redirect to login page (no animation needed)
        navigate('/login');
      }
    }
  };

  const handleGoogleAuth = () => {
    signInWithGoogle();
  };

  return (
    <div
      className={`${styles.pageContainer} ${isExiting ? styles.exitAnimation : ''}`}
    >
      {/* Left Side - Carousel */}
      <div className={styles.carouselSection}>
        <div className={styles.carouselBackground}>
          <div className={styles.carouselContent}>
            <div className={styles.imagePlaceholder}>
              <span className={styles.placeholderText}>
                {carouselSlides[currentSlide].imagePlaceholder}
              </span>
            </div>
            <h2 className={styles.carouselTitle}>
              {carouselSlides[currentSlide].title}
            </h2>
            <p className={styles.carouselDescription}>
              {carouselSlides[currentSlide].description}
            </p>

            {/* Carousel Indicators */}
            <div className={styles.carouselIndicators}>
              {carouselSlides.map((_, index) => (
                <button
                  key={index}
                  className={`${styles.indicator} ${index === currentSlide ? styles.activeIndicator : ''}`}
                  onClick={() => setCurrentSlide(index)}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Decorative Elements */}
          <div className={styles.decorativeCircle1}></div>
          <div className={styles.decorativeCircle2}></div>
          <div className={styles.decorativeCircle3}></div>
        </div>
      </div>

      {/* Right Side - Signup Form */}
      <div className={styles.signupSection}>
        <div className={styles.signupContainer}>
          {/* Header */}
          <div className={styles.header}>
            <Link to="/" className={styles.logo}>
              Strand
            </Link>
            <h1 className={styles.title}>Create your account</h1>
            <p className={styles.subtitle}>
              Start planning your perfect adventures
            </p>
          </div>

          {/* Auth Options */}
          <div className={styles.authSection}>
            {/* Google OAuth Button */}
            <button
              className={styles.googleButton}
              onClick={handleGoogleAuth}
              type="button"
            >
              <svg
                className={styles.googleIcon}
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div className={styles.divider}>
              <span className={styles.dividerLine}></span>
              <span className={styles.dividerText}>or</span>
              <span className={styles.dividerLine}></span>
            </div>

            {/* Signup Form */}
            <form onSubmit={handleSignup} className={styles.signupForm}>
              {(localError || error) && (
                <div className={styles.errorMessage}>{localError || error}</div>
              )}

              <div className={styles.inputGroup}>
                <label htmlFor="email" className={styles.label}>
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className={styles.input}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="password" className={styles.label}>
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="At least 8 characters"
                  className={styles.input}
                  required
                  disabled={isLoading}
                  minLength={8}
                />
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="confirmPassword" className={styles.label}>
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Re-enter your password"
                  className={styles.input}
                  required
                  disabled={isLoading}
                />
              </div>

              <button
                type="submit"
                className={styles.submitButton}
                disabled={isLoading}
              >
                {isLoading ? 'Creating account...' : 'Create account'}
              </button>
            </form>

            {/* Footer */}
            <p className={styles.footerText}>
              Already have an account?{' '}
              <Link to="/login" className={styles.link}>
                Sign in
              </Link>
            </p>
            <p className={styles.termsText}>
              By creating an account, you agree to our{' '}
              <span className={styles.link}>Terms of Service</span> and{' '}
              <span className={styles.link}>Privacy Policy</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
