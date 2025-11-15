import { useEffect } from 'react';

export default function GoogleCallback() {
  useEffect(() => {
    // Get the authorization code from URL
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (code && window.opener) {
      // Send the code back to the parent window
      window.opener.postMessage(
        {
          type: 'GOOGLE_AUTH_SUCCESS',
          code,
        },
        window.location.origin
      );
      window.close();
    } else if (error) {
      console.error('Google OAuth error:', error);
      window.close();
    }
  }, []);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <p>Completing sign in...</p>
    </div>
  );
}
