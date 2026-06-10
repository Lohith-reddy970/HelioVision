'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAppStore } from '@/store/useAppStore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
  getToken: async () => null,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Track the previous user's uid so we only reset on an actual account change
  const prevUidRef = useRef<string | null | undefined>(undefined);

  const resetAnalysis = useAppStore((state) => state.resetAnalysis);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      const prevUid = prevUidRef.current;
      const newUid = currentUser?.uid ?? null;

      // Reset analysis if:
      // - this isn't the very first load (prevUid !== undefined), AND
      // - the user actually changed (different uid or logged out)
      if (prevUid !== undefined && prevUid !== newUid) {
        resetAnalysis();
      }

      prevUidRef.current = newUid;
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [resetAnalysis]);

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const getToken = async () => {
    if (auth.currentUser) {
      return await auth.currentUser.getIdToken();
    }
    return null;
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut, getToken }}>
      {children}
    </AuthContext.Provider>
  );
};
