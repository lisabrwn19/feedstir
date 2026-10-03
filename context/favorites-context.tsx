import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
  type DocumentData,
  type QuerySnapshot,
} from 'firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { subscribeWithRetry } from '@/utils/firestore-retry';

type FavoritesContextValue = {
  /** recipe ids I've favorited, live. Works for any recipe I can read — mine or a followed user's. */
  favoriteRecipeIds: string[];
  isFavorite: (recipeId: string) => boolean;
  toggleFavorite: (recipeId: string) => Promise<void>;
};

const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const myUid = user?.uid;

  const [favoriteRecipeIds, setFavoriteRecipeIds] = useState<string[]>([]);

  useEffect(() => {
    if (!myUid) {
      setFavoriteRecipeIds([]);
      return;
    }
    const q = query(collection(db, 'favorites'), where('uid', '==', myUid));
    return subscribeWithRetry<QuerySnapshot<DocumentData>>(
      (onNext, onError) => onSnapshot(q, onNext, onError),
      (snapshot) => setFavoriteRecipeIds(snapshot.docs.map((d) => d.data().recipeId as string)),
      (err) => console.error('Favorites listener error', err)
    );
  }, [myUid]);

  const value = useMemo<FavoritesContextValue>(
    () => ({
      favoriteRecipeIds,
      isFavorite: (recipeId) => favoriteRecipeIds.includes(recipeId),
      toggleFavorite: async (recipeId) => {
        if (!myUid) return;
        const ref = doc(db, 'favorites', `${myUid}_${recipeId}`);
        if (favoriteRecipeIds.includes(recipeId)) {
          await deleteDoc(ref);
        } else {
          await setDoc(ref, { uid: myUid, recipeId, createdAt: Date.now() });
        }
      },
    }),
    [favoriteRecipeIds, myUid]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
}
