import {
  collection,
  deleteDoc,
  deleteField,
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

export type SavedRecipeMeta = {
  categories: string[];
  /** Your own personal rating of a recipe you don't own — distinct from the owner's `recipe.rating`. */
  rating?: number;
};

type SavedRecipesContextValue = {
  /** recipeId -> your personal folders/rating on it, for recipes you don't own. */
  savedRecipes: Record<string, SavedRecipeMeta>;
  getSavedMeta: (recipeId: string) => SavedRecipeMeta;
  /** Adds/removes `category` from your saved tags on `recipeId` — only meant for recipes you don't own (your own use `setRecipeCategories` directly). */
  toggleSavedCategory: (recipeId: string, category: string) => Promise<void>;
  setSavedRating: (recipeId: string, rating: number | undefined) => Promise<void>;
};

const EMPTY_META: SavedRecipeMeta = { categories: [] };

const SavedRecipesContext = createContext<SavedRecipesContextValue | undefined>(undefined);

export function SavedRecipesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const myUid = user?.uid;

  const [savedRecipes, setSavedRecipes] = useState<Record<string, SavedRecipeMeta>>({});

  useEffect(() => {
    if (!myUid) {
      setSavedRecipes({});
      return;
    }
    const q = query(collection(db, 'savedRecipes'), where('uid', '==', myUid));
    return subscribeWithRetry<QuerySnapshot<DocumentData>>(
      (onNext, onError) => onSnapshot(q, onNext, onError),
      (snapshot) => {
        const next: Record<string, SavedRecipeMeta> = {};
        snapshot.docs.forEach((d) => {
          const data = d.data();
          next[data.recipeId as string] = {
            categories: Array.isArray(data.categories) ? data.categories : [],
            rating: typeof data.rating === 'number' ? data.rating : undefined,
          };
        });
        setSavedRecipes(next);
      },
      (err) => console.error('Saved recipes listener error', err)
    );
  }, [myUid]);

  const value = useMemo<SavedRecipesContextValue>(
    () => ({
      savedRecipes,
      getSavedMeta: (recipeId) => savedRecipes[recipeId] ?? EMPTY_META,
      toggleSavedCategory: async (recipeId, category) => {
        if (!myUid) return;
        const current = savedRecipes[recipeId]?.categories ?? [];
        const next = current.includes(category)
          ? current.filter((c) => c !== category)
          : [...current, category];
        const ref = doc(db, 'savedRecipes', `${myUid}_${recipeId}`);
        if (next.length === 0 && savedRecipes[recipeId]?.rating === undefined) {
          await deleteDoc(ref);
        } else {
          await setDoc(ref, { uid: myUid, recipeId, categories: next }, { merge: true });
        }
      },
      setSavedRating: async (recipeId, rating) => {
        if (!myUid) return;
        const current = savedRecipes[recipeId];
        const ref = doc(db, 'savedRecipes', `${myUid}_${recipeId}`);
        if (rating === undefined && (current?.categories.length ?? 0) === 0) {
          await deleteDoc(ref);
        } else {
          await setDoc(
            ref,
            { uid: myUid, recipeId, categories: current?.categories ?? [], rating: rating ?? deleteField() },
            { merge: true }
          );
        }
      },
    }),
    [savedRecipes, myUid]
  );

  return <SavedRecipesContext.Provider value={value}>{children}</SavedRecipesContext.Provider>;
}

export function useSavedRecipes() {
  const context = useContext(SavedRecipesContext);
  if (!context) {
    throw new Error('useSavedRecipes must be used within a SavedRecipesProvider');
  }
  return context;
}
