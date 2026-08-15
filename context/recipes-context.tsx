import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { NewRecipeInput, Recipe } from '@/types/recipe';

type RecipesContextValue = {
  recipes: Recipe[];
  addRecipe: (input: NewRecipeInput) => Recipe;
  markRecipeMade: (id: string) => void;
  setRecipeRating: (id: string, rating: number | undefined) => void;
};

const RecipesContext = createContext<RecipesContextValue | undefined>(undefined);

export function RecipesProvider({ children }: { children: ReactNode }) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  const value = useMemo<RecipesContextValue>(
    () => ({
      recipes,
      addRecipe: (input) => {
        const recipe: Recipe = {
          ...input,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          createdAt: Date.now(),
          timesMade: 0,
          rating: undefined,
        };
        setRecipes((prev) => [recipe, ...prev]);
        return recipe;
      },
      markRecipeMade: (id) => {
        setRecipes((prev) =>
          prev.map((recipe) =>
            recipe.id === id
              ? { ...recipe, timesMade: recipe.timesMade + 1, lastMadeAt: Date.now() }
              : recipe
          )
        );
      },
      setRecipeRating: (id, rating) => {
        setRecipes((prev) =>
          prev.map((recipe) => (recipe.id === id ? { ...recipe, rating } : recipe))
        );
      },
    }),
    [recipes]
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
