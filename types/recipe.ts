export type Recipe = {
  id: string;
  title: string;
  ingredients: string[];
  instructions: string[];
  photoUri?: string;
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  sourceUrl?: string;
  createdAt: number;
  timesMade: number;
  lastMadeAt?: number;
  /** 1-5, undefined = unrated. */
  rating?: number;
};

export type NewRecipeInput = Omit<
  Recipe,
  'id' | 'createdAt' | 'timesMade' | 'lastMadeAt' | 'rating'
>;
