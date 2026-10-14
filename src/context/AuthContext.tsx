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
    // Listen for auth state changes (sign in, sign out)
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    // If user has not yet configured their real Firebase keys, provide smooth local preview
    if (auth.app.options.apiKey === 'AIzaSyDummyKeyReplaceWithYourOwn') {
      if (pass.length < 6) {
        const err: any = new Error('Weak password');
        err.code = 'auth/weak-password';
        throw err;
      }
      if (pass === '123456' || email.includes('khema')) {
        const mockUser = {
          uid: 'khema-user-001',
          email: email.trim(),
          displayName: email.split('@')[0],
          photoURL: null,
        } as unknown as User;
        setCurrentUser(mockUser);
        return { user: mockUser };
      } else {
        const err: any = new Error('Invalid password');
        err.code = 'auth/wrong-password';
        throw err;
      }
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
