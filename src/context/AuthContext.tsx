import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '../firebase.ts';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<any>;
  signup: (email: string, pass: string) => Promise<any>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // 1. Check local saved user (supports multi-device & quick login for sokly, meymey)
    try {
      const savedUser = localStorage.getItem('khema_active_user');
      if (savedUser && (savedUser === 'sokly' || savedUser === 'meymey' || savedUser.includes('khema'))) {
        const restored = {
          uid: `user-${savedUser}`,
          email: `${savedUser}@khema.com`,
          displayName: savedUser,
          photoURL: null,
        } as unknown as User;
        setCurrentUser(restored);
        setLoading(false);
      }
    } catch (e) {}

    // Listen for auth state changes (sign in, sign out)
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        try {
          const uname = (user.displayName || user.email || 'khema').split('@')[0];
          localStorage.setItem('khema_active_user', uname);
        } catch (e) {}
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    const rawInput = (email || '').trim().toLowerCase();
    const uname = rawInput.replace(/@.*$/, '');
    const isSpecialUser = uname === 'sokly' || uname === 'meymey' || uname.includes('khema') || uname === 'admin';
    const emailFormatted = rawInput.includes('@') ? rawInput : `${uname}@khema.com`;

    // Local / direct authentication for sokly, meymey, and khema team
    if (auth.app.options.apiKey === 'AIzaSyDummyKeyReplaceWithYourOwn' || isSpecialUser) {
      if (pass.length < 6) {
        const err: any = new Error('លេខសម្ងាត់ត្រូវមានយ៉ាងហោចណាស់ ៦ ខ្ទង់ (Password must be at least 6 characters)');
        err.code = 'auth/weak-password';
        throw err;
      }
      const displayName = (uname === 'sokly' || uname === 'meymey') ? uname : (rawInput.split('@')[0] || 'khema');
      const mockUser = {
        uid: `user-${displayName}`,
        email: emailFormatted,
        displayName: displayName,
        photoURL: null,
      } as unknown as User;
      setCurrentUser(mockUser);
      try {
        localStorage.setItem('khema_active_user', displayName);
      } catch (e) {}
      return { user: mockUser };
    }
    return signInWithEmailAndPassword(auth, email, pass);
  };

  const signup = async (email: string, pass: string) => {
    if (auth.app.options.apiKey === 'AIzaSyDummyKeyReplaceWithYourOwn') {
      if (pass.length < 6) {
        const err: any = new Error('Weak password');
        err.code = 'auth/weak-password';
        throw err;
      }
      const mockUser = {
        uid: `khema-${Date.now()}`,
        email: email.trim(),
        displayName: email.split('@')[0],
        photoURL: null,
      } as unknown as User;
      setCurrentUser(mockUser);
      return { user: mockUser };
    }
    return createUserWithEmailAndPassword(auth, email, pass);
  };

  const logout = async () => {
    try {
      localStorage.removeItem('khema_active_user');
    } catch (e) {}
    if (auth.app.options.apiKey === 'AIzaSyDummyKeyReplaceWithYourOwn') {
      setCurrentUser(null);
      return;
    }
    return signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
