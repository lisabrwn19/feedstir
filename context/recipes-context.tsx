import {
  addDoc,
  collection,
  deleteField,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
  type DocumentData,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import type { NewRecipeInput, Recipe } from '@/types/recipe';
import { subscribeWithRetry } from '@/utils/firestore-retry';

type RecipesContextValue = {
  recipes: Recipe[];
  loading: boolean;
  addRecipe: (input: NewRecipeInput) => Promise<void>;
  markRecipeMade: (id: string) => void;
  setRecipeRating: (id: string, rating: number | undefined) => void;
};

const RecipesContext = createContext<RecipesContextValue | undefined>(undefined);

// Firestore rejects writes containing an `undefined` field value outright
// (throws synchronously, before any network call) — optional recipe fields
// (photoUri, servings, etc.) are `undefined` when not provided, so they must
// be dropped rather than passed straight through.
function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}

function mapRecipe(id: string, data: DocumentData): Recipe {
  return {
    id,
    ownerId: data.ownerId,
    title: data.title,
    ingredients: data.ingredients ?? [],
    instructions: data.instructions ?? [],
    photoUri: data.photoUri ?? undefined,
    servings: data.servings ?? undefined,
    prepTimeMinutes: data.prepTimeMinutes ?? undefined,
    cookTimeMinutes: data.cookTimeMinutes ?? undefined,
    sourceUrl: data.sourceUrl ?? undefined,
    createdAt: data.createdAt ?? 0,
    timesMade: data.timesMade ?? 0,
    lastMadeAt: data.lastMadeAt ?? undefined,
    rating: data.rating ?? undefined,
    queuedOnListId: data.queuedOnListId ?? null,
  };
}

export function RecipesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRecipes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const recipesQuery = query(collection(db, 'recipes'), where('ownerId', '==', user.uid));
    return onSnapshot(recipesQuery, (snapshot) => {
      const next = snapshot.docs.map((d) => mapRecipe(d.id, d.data()));
      next.sort((a, b) => b.createdAt - a.createdAt);
      setRecipes(next);
      setLoading(false);
    });
  }, [user]);

  const value = useMemo<RecipesContextValue>(
    () => ({
      recipes,
      loading,
      addRecipe: async (input) => {
        if (!user) throw new Error('Must be signed in to add a recipe');
        await addDoc(collection(db, 'recipes'), {
          ...stripUndefined(input),
          ownerId: user.uid,
          createdAt: Date.now(),
          timesMade: 0,
          rating: null,
          queuedOnListId: null,
        });
      },
      markRecipeMade: (id) => {
        const recipe = recipes.find((r) => r.id === id);
        updateDoc(doc(db, 'recipes', id), {
          timesMade: (recipe?.timesMade ?? 0) + 1,
          lastMadeAt: Date.now(),
        });
      },
      setRecipeRating: (id, rating) => {
        updateDoc(doc(db, 'recipes', id), {
          rating: rating ?? deleteField(),
        });
      },
    }),
    [recipes, loading, user]
  );

  return <RecipesContext.Provider value={value}>{children}</RecipesContext.Provider>;
}

export function useRecipes() {
  const context = useContext(RecipesContext);
  if (!context) {
    throw new Error('useRecipes must be used within a RecipesProvider');
  }
  return context;
}

/**
 * Fetches a single recipe by id directly, regardless of who owns it. Unlike
 * `useRecipes()` (scoped to the signed-in user's own library), this also
 * resolves recipes shared via `queuedOnListId` — e.g. a grocery-list
 * collaborator's recipe that's been queued onto a shared list.
 */
export function useRecipeDoc(recipeId: string | undefined) {
  const [recipe, setRecipe] = useState<Recipe | null | undefined>(undefined);

  useEffect(() => {
    if (!recipeId) {
      setRecipe(undefined);
      return;
    }
    setRecipe(undefined);
    return subscribeWithRetry<DocumentSnapshot<DocumentData>>(
      (onNext, onError) => onSnapshot(doc(db, 'recipes', recipeId), onNext, onError),
      (snapshot) => setRecipe(snapshot.exists() ? mapRecipe(snapshot.id, snapshot.data()) : null),
      (err) => {
        console.error('Recipe listener error', recipeId, err);
        setRecipe(null);
      }
    );
  }, [recipeId]);

  return recipe;
}
