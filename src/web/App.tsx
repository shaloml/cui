import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import InspectorApp from './inspector/InspectorApp';
import ChatApp from './chat/ChatApp';
import Login from './components/Login/Login';
import { useAuth, getAuthToken, setAuthToken, checkAuthStatus } from './hooks/useAuth';

type AuthMode = 'loading' | 'setup' | 'accessCode' | 'authenticated';

function App() {
  const [authMode, setAuthMode] = useState<AuthMode>('loading');

  // Handle auth token extraction from URL fragment
  useAuth();

  useEffect(() => {
    const initAuth = async () => {
      // Check if already authenticated
      if (getAuthToken()) {
        setAuthMode('authenticated');
        return;
      }

      // Check auth configuration
      const status = await checkAuthStatus();
      if (status.needsSetup) {
        setAuthMode('setup');
      } else {
        setAuthMode('accessCode');
      }
    };

    initAuth();
  }, []);

  if (authMode === 'loading') {
    return <div className="flex items-center justify-center h-screen bg-background text-foreground">Loading...</div>;
  }

  if (authMode === 'setup' || authMode === 'accessCode') {
    return <Login
      mode={authMode}
      onLogin={(token) => {
        setAuthToken(token);
        setAuthMode('authenticated');
      }}
    />;
  }

  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/*" element={<ChatApp />} />
        <Route path="/inspector" element={<InspectorApp />} />
      </Routes>
    </Router>
  );
}

export default App;