import { createHash } from 'node:crypto';

import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { fetchAndParseRecipe } from './parse-recipe';
import { parseRssFeed } from './rss';
import { RECIPE_SOURCES } from './sources';

initializeApp();
setGlobalOptions({ maxInstances: 5 });

// Caps keep each run fast, cheap, and gentle on the source sites — this is
// a background job pulling a handful of new posts per feed, not a full
// backfill crawl.
const MAX_NEW_PER_SOURCE = 5;
const FEED_ITEMS_TO_CONSIDER = MAX_NEW_PER_SOURCE * 3;
const FETCH_TIMEOUT_MS = 15000;

/** Deterministic per-URL doc id, so re-running the aggregator naturally skips recipes it already has. */
function docIdForUrl(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 32);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export const aggregateRecipes = onSchedule(
  {
    schedule: 'every 6 hours',
    timeZone: 'America/Chicago',
    memory: '256MiB',
    timeoutSeconds: 300,
  },
  async () => {
    const db = getFirestore();

    for (const source of RECIPE_SOURCES) {
      try {
        const feedResponse = await fetch(source.feedUrl, {
          headers: { 'User-Agent': 'feedstir-recipe-aggregator/1.0 (+https://feedstir.app)' },
        });
        if (!feedResponse.ok) {
          logger.warn(`Feed fetch failed for ${source.name}: HTTP ${feedResponse.status}`);
          continue;
        }

        const items = parseRssFeed(await feedResponse.text()).slice(0, FEED_ITEMS_TO_CONSIDER);
        let added = 0;

        for (const item of items) {
          if (added >= MAX_NEW_PER_SOURCE) break;

          const ref = db.collection('discoveredRecipes').doc(docIdForUrl(item.link));
          if ((await ref.get()).exists) continue;

          const result = await withTimeout(fetchAndParseRecipe(item.link), FETCH_TIMEOUT_MS);
          if (!result?.matched || !result.recipe.title || result.recipe.ingredients.length === 0) {
            continue;
          }

          const { recipe } = result;
          await ref.set({
            title: recipe.title,
            ingredients: recipe.ingredients,
            instructions: recipe.instructions,
            photoUri: recipe.photoUri ?? null,
            servings: recipe.servings ?? null,
            prepTimeMinutes: recipe.prepTimeMinutes ?? null,
            cookTimeMinutes: recipe.cookTimeMinutes ?? null,
            aggregateRating: recipe.aggregateRating ?? null,
            sourceUrl: item.link,
            sourceName: source.name,
            fetchedAt: FieldValue.serverTimestamp(),
          });
          added += 1;
        }

        logger.info(`${source.name}: added ${added} new recipe(s)`);
      } catch (err) {
        logger.error(`Aggregation failed for ${source.name}`, err);
      }
    }
  }
);
