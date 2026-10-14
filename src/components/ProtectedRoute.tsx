import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { LoginScreen } from './LoginScreen.tsx';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { currentUser, loading } = useAuth();

  // 1. Loading state while Firebase checks authentication
  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#f1f5f9] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white p-2 shadow-sm border border-slate-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-teal-600 animate-spin text-[28px]">
              progress_activity
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-600">
            កំពុងពិនិត្យសិទ្ធិប្រើប្រាស់...
          </p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated: Redirect / Show Login component
  if (!currentUser) {
    return <LoginScreen />;
  }

  // 3. Authenticated: Render protected main dashboard page
  return <>{children}</>;
};
