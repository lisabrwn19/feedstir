import {
  doc,
  onSnapshot,
  type DocumentData,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from '@/lib/firebase';
import type { DiscoveredRecipe } from '@/types/discovered-recipe';
import { subscribeWithRetry } from '@/utils/firestore-retry';

function mapDiscoveredRecipe(id: string, data: DocumentData): DiscoveredRecipe {
  return {
    id,
    title: data.title,
    ingredients: data.ingredients ?? [],
    instructions: data.instructions ?? [],
    photoUri: data.photoUri ?? undefined,
    servings: data.servings ?? undefined,
    prepTimeMinutes: data.prepTimeMinutes ?? undefined,
    cookTimeMinutes: data.cookTimeMinutes ?? undefined,
    aggregateRating: data.aggregateRating ?? undefined,
    sourceUrl: data.sourceUrl,
    sourceName: data.sourceName,
    fetchedAt: data.fetchedAt?.toMillis?.() ?? 0,
  };
}

/** Fetches a single discovered (aggregator-sourced) recipe by id, for prefilling "New Recipe" from Discover. */
export function useDiscoveredRecipeDoc(id: string | undefined) {
  const [recipe, setRecipe] = useState<DiscoveredRecipe | null | undefined>(undefined);

  useEffect(() => {
    if (!id) {
      setRecipe(undefined);
      return;
    }
    setRecipe(undefined);
    return subscribeWithRetry<DocumentSnapshot<DocumentData>>(
      (onNext, onError) => onSnapshot(doc(db, 'discoveredRecipes', id), onNext, onError),
      (snapshot) =>
        setRecipe(snapshot.exists() ? mapDiscoveredRecipe(snapshot.id, snapshot.data()) : null),
      (err) => {
        console.error('Discovered recipe listener error', id, err);
        setRecipe(null);
      }
    );
  }, [id]);

  return recipe;
}
