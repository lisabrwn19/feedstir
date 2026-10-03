import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type QuerySnapshot,
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
  updateRecipe: (id: string, input: NewRecipeInput) => Promise<void>;
  deleteRecipe: (id: string) => Promise<void>;
  markRecipeMade: (id: string) => void;
  setRecipeRating: (id: string, rating: number | undefined) => void;
  setRecipeDifficulty: (id: string, difficulty: Recipe['difficulty']) => void;
  setRecipeCategories: (id: string, categories: string[]) => void;
  addRecipeModification: (id: string, text: string) => void;
  removeRecipeModification: (id: string, text: string) => void;
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

// For updates (unlike create), a field going from "set" to `undefined` means
// the user cleared it in the edit form — that has to actually delete the
// field in Firestore, not just be omitted from the write (omitting would
// silently leave the old value in place).
function toFirestoreUpdate<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key in obj) {
    result[key] = obj[key] === undefined ? deleteField() : obj[key];
  }
  return result;
}

export function mapRecipe(id: string, data: DocumentData): Recipe {
  return {
    id,
    ownerId: data.ownerId,
    title: data.title,
    ingredients: data.ingredients ?? [],
    instructions: data.instructions ?? [],
    modifications: data.modifications ?? [],
    categories: data.categories ?? [],
    sourceRating: data.sourceRating ?? undefined,
    photoUri: data.photoUri ?? undefined,
    servings: data.servings ?? undefined,
    prepTimeMinutes: data.prepTimeMinutes ?? undefined,
    cookTimeMinutes: data.cookTimeMinutes ?? undefined,
    sourceUrl: data.sourceUrl ?? undefined,
    createdAt: data.createdAt ?? 0,
    timesMade: data.timesMade ?? 0,
    lastMadeAt: data.lastMadeAt ?? undefined,
    rating: data.rating ?? undefined,
    difficulty: data.difficulty ?? undefined,
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
          modifications: [],
          queuedOnListId: null,
        });
      },
      updateRecipe: async (id, input) => {
        await updateDoc(doc(db, 'recipes', id), toFirestoreUpdate(input));
      },
      deleteRecipe: async (id) => {
        await deleteDoc(doc(db, 'recipes', id));
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
      setRecipeDifficulty: (id, difficulty) => {
        updateDoc(doc(db, 'recipes', id), {
          difficulty: difficulty ?? deleteField(),
        });
      },
      setRecipeCategories: (id, categories) => {
        updateDoc(doc(db, 'recipes', id), { categories });
      },
      addRecipeModification: (id, text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        updateDoc(doc(db, 'recipes', id), { modifications: arrayUnion(trimmed) });
      },
      removeRecipeModification: (id, text) => {
        updateDoc(doc(db, 'recipes', id), { modifications: arrayRemove(text) });
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

/**
 * Live query of any user's recipes by uid — used to browse a followed
 * user's library. Relies entirely on the Firestore rule (owner, grocery-list
 * member, or follower can read a recipe) to return results only when we're
 * actually allowed to see them; an unauthorized uid just yields an empty list.
 */
export function useUserRecipes(uid: string | undefined) {
  const [recipes, setRecipes] = useState<Recipe[] | undefined>(undefined);

  useEffect(() => {
    if (!uid) {
      setRecipes(undefined);
      return;
    }
    setRecipes(undefined);
    const recipesQuery = query(collection(db, 'recipes'), where('ownerId', '==', uid));
    return subscribeWithRetry<QuerySnapshot<DocumentData>>(
      (onNext, onError) => onSnapshot(recipesQuery, onNext, onError),
      (snapshot) => {
        const next = snapshot.docs.map((d) => mapRecipe(d.id, d.data()));
        next.sort((a, b) => b.createdAt - a.createdAt);
        setRecipes(next);
      },
      (err) => {
        console.error('User recipes listener error', uid, err);
        setRecipes([]);
      }
    );
  }, [uid]);

  return recipes;
}

/**
 * Live pool of recipes owned by any of the given uids — used for the
 * Discover carousel (your own recipes + everyone you follow, combined).
 * Keyed off a sorted/deduped string rather than the raw array so passing a
 * freshly-spread `[myUid, ...followingIds]` array each render doesn't
 * re-subscribe on every render.
 */
export function useDiscoverRecipes(ownerIds: string[]) {
  const [recipes, setRecipes] = useState<Recipe[] | undefined>(undefined);
  const key = [...new Set(ownerIds)].sort().join(',');

  useEffect(() => {
    const ids = key ? key.split(',') : [];
    if (ids.length === 0) {
      setRecipes([]);
      return;
    }
    // Firestore's `in` operator caps at 30 values — plenty for this app's
    // scale (follow counts aren't expected to approach that).
    const recipesQuery = query(collection(db, 'recipes'), where('ownerId', 'in', ids.slice(0, 30)));
    return subscribeWithRetry<QuerySnapshot<DocumentData>>(
      (onNext, onError) => onSnapshot(recipesQuery, onNext, onError),
      (snapshot) => setRecipes(snapshot.docs.map((d) => mapRecipe(d.id, d.data()))),
      (err) => {
        console.error('Discover recipes listener error', err);
        setRecipes([]);
      }
    );
  }, [key]);

  return recipes;
}
