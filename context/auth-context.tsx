import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { deleteField, doc, setDoc } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { auth, db } from '@/lib/firebase';

type AuthContextValue = {
  user: User | null;
  initializing: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (fields: { displayName?: string; photoUri?: string }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setInitializing(false);
    });
  }, []);

  const value: AuthContextValue = {
    user,
    initializing,
    signUp: async (email, password) => {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      // A minimal profile doc, useful once grocery-list invites need to look
      // up a user by email.
      await setDoc(doc(db, 'users', credential.user.uid), {
        email: credential.user.email,
        createdAt: Date.now(),
      });
    },
    signIn: async (email, password) => {
      await signInWithEmailAndPassword(auth, email, password);
    },
    signOut: () => firebaseSignOut(auth),
    updateProfile: async (fields) => {
      if (!user) throw new Error('Must be signed in to update your profile');
      // Only touch keys actually passed in — e.g. updating just the display
      // name must not also wipe an existing photo via an implicit `undefined`.
      const update: Record<string, unknown> = {};
      if ('displayName' in fields) {
        update.displayName = fields.displayName?.trim() || deleteField();
      }
      if ('photoUri' in fields) {
        update.photoUri = fields.photoUri || deleteField();
      }
      if (Object.keys(update).length === 0) return;
      await setDoc(doc(db, 'users', user.uid), update, { merge: true });
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
