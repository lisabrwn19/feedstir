import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRecipeDoc, useRecipes } from '@/context/recipes-context';
import { useSavedRecipes } from '@/context/saved-recipes';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { Recipe } from '@/types/recipe';
import { categoryEmoji } from '@/utils/categories';

const DIFFICULTY_LABELS: Record<NonNullable<Recipe['difficulty']>, string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  hard: 'Hard',
};

function formatMeta(recipe: Recipe) {
  const parts: string[] = [];
  const totalTime = (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0);
  if (totalTime > 0) parts.push(`${totalTime} min`);
  if (recipe.rating !== undefined) parts.push(`${recipe.rating}/5 ★`);
  if (recipe.difficulty) parts.push(DIFFICULTY_LABELS[recipe.difficulty]);
  if (recipe.timesMade > 0) parts.push(`Made ${recipe.timesMade}×`);
  return parts.join(' · ');
}

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const router = useRouter();
  const borderColor = useThemeColor({}, 'icon');
  const meta = formatMeta(recipe);

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } })}
      style={[styles.card, { borderColor }]}>
      {recipe.photoUri ? (
        <Image source={{ uri: recipe.photoUri }} style={styles.thumbnail} />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailPlaceholder, { borderColor }]}>
          <IconSymbol name="fork.knife" size={24} color={borderColor} />
        </View>
      )}
      <View style={styles.cardBody}>
        <ThemedText type="defaultSemiBold" numberOfLines={1}>
          {recipe.title}
        </ThemedText>
        {meta ? <ThemedText style={styles.cardMeta}>{meta}</ThemedText> : null}
      </View>
      <IconSymbol name="chevron.right" size={18} color={borderColor} />
    </Pressable>
  );
}

// Saved (non-owned) recipes aren't in `useRecipes()`'s own-only list, so
// each resolves its own doc — same per-row pattern as FavoriteRow etc.
function SavedRecipeCard({ recipeId }: { recipeId: string }) {
  const recipe = useRecipeDoc(recipeId);
  if (!recipe) return null;
  return <RecipeCard recipe={recipe} />;
}

export default function CategoryScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const { recipes } = useRecipes();
  const { savedRecipes } = useSavedRecipes();
  const borderColor = useThemeColor({}, 'icon');

  const ownRecipes = recipes.filter((r) => r.categories.includes(name));
  const savedRecipeIds = Object.entries(savedRecipes)
    .filter(([, meta]) => meta.categories.includes(name))
    .map(([recipeId]) => recipeId);

  const items = [
    ...ownRecipes.map((recipe) => ({ key: recipe.id, recipe })),
    ...savedRecipeIds.map((recipeId) => ({ key: recipeId, recipeId })),
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ title: `${categoryEmoji(name)} ${name}` }} />
      {items.length === 0 ? (
        <ThemedView style={styles.emptyState}>
          <IconSymbol name="list.bullet" size={48} color={borderColor} />
          <ThemedText type="subtitle" style={styles.emptyTitle}>
            No recipes here yet
          </ThemedText>
          <ThemedText style={styles.emptyBody}>
            Tag a recipe with “{name}” to see it in this folder.
          </ThemedText>
        </ThemedView>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.list}
          renderItem={({ item }) =>
            'recipe' in item ? (
              <RecipeCard recipe={item.recipe} />
            ) : (
              <SavedRecipeCard recipeId={item.recipeId} />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: 20,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  thumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardMeta: {
    fontSize: 13,
    opacity: 0.7,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    marginTop: 8,
  },
  emptyBody: {
    textAlign: 'center',
    opacity: 0.7,
  },
});
