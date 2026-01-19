import React from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from '../Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const isConversationView = location.pathname.startsWith('/c/');

  return (
    <div className="flex w-full h-screen overflow-hidden bg-background relative">
      {/* Sidebar - only show on home page */}
      {!isConversationView && <Sidebar />}

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden h-full">
        {children}
      </main>
    </div>
  );
}