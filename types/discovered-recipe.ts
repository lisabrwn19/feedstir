import type { AggregateRating } from '@/utils/parse-recipe';

/** A recipe the background aggregator pulled in from a recipe blog's RSS feed, for browsing in Discover. */
export type DiscoveredRecipe = {
  id: string;
  title: string;
  ingredients: string[];
  instructions: string[];
  photoUri?: string;
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  /** The source site's own rating, when it publishes one. */
  aggregateRating?: AggregateRating;
  sourceUrl: string;
  sourceName: string;
  /** Epoch millis. */
  fetchedAt: number;
};
