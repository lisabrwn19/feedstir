import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { GroceryItem } from '@/types/grocery';

type GroceryContextValue = {
  queuedRecipeIds: string[];
  isQueued: (recipeId: string) => boolean;
  toggleQueued: (recipeId: string) => void;

  groceryItems: GroceryItem[];
  isIngredientAdded: (recipeId: string, text: string) => boolean;
  toggleGroceryIngredient: (recipeId: string, recipeTitle: string, text: string) => void;
  toggleGroceryItemChecked: (id: string) => void;
  removeGroceryItem: (id: string) => void;
  clearCheckedItems: () => void;
};

const GroceryContext = createContext<GroceryContextValue | undefined>(undefined);

function ingredientKey(recipeId: string, text: string) {
  return `${recipeId}::${text.trim().toLowerCase()}`;
}

export function GroceryProvider({ children }: { children: ReactNode }) {
  const [queuedRecipeIds, setQueuedRecipeIds] = useState<string[]>([]);
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);

  const value = useMemo<GroceryContextValue>(() => {
    const isQueued = (recipeId: string) => queuedRecipeIds.includes(recipeId);

    const toggleQueued = (recipeId: string) => {
      setQueuedRecipeIds((prev) =>
        prev.includes(recipeId) ? prev.filter((id) => id !== recipeId) : [...prev, recipeId]
      );
    };

    const isIngredientAdded = (recipeId: string, text: string) =>
      groceryItems.some((item) => item.id === ingredientKey(recipeId, text));

    const toggleGroceryIngredient = (recipeId: string, recipeTitle: string, text: string) => {
      const id = ingredientKey(recipeId, text);
      setGroceryItems((prev) =>
        prev.some((item) => item.id === id)
          ? prev.filter((item) => item.id !== id)
          : [...prev, { id, text: text.trim(), checked: false, recipeId, recipeTitle }]
      );
    };

    const toggleGroceryItemChecked = (id: string) => {
      setGroceryItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
      );
    };

    const removeGroceryItem = (id: string) => {
      setGroceryItems((prev) => prev.filter((item) => item.id !== id));
    };

    const clearCheckedItems = () => {
      setGroceryItems((prev) => prev.filter((item) => !item.checked));
    };

    return {
      queuedRecipeIds,
      isQueued,
      toggleQueued,
      groceryItems,
      isIngredientAdded,
      toggleGroceryIngredient,
      toggleGroceryItemChecked,
      removeGroceryItem,
      clearCheckedItems,
    };
  }, [queuedRecipeIds, groceryItems]);

  return <GroceryContext.Provider value={value}>{children}</GroceryContext.Provider>;
}

export function useGrocery() {
  const context = useContext(GroceryContext);
  if (!context) {
    throw new Error('useGrocery must be used within a GroceryProvider');
  }
  return context;
}
