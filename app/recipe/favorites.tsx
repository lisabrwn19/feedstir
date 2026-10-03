import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useFavorites } from '@/context/favorites-context';
import { useRecipeDoc } from '@/context/recipes-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { Recipe } from '@/types/recipe';

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

// Favorites can point at any recipe the user can currently read (their own
// or a followed user's), so each row resolves its own recipe doc rather
// than relying on the owned-only `useRecipes()` list.
function FavoriteRow({ recipeId }: { recipeId: string }) {
  const recipe = useRecipeDoc(recipeId);
  if (!recipe) return null;
  return <RecipeCard recipe={recipe} />;
}

export default function FavoritesScreen() {
  const { favoriteRecipeIds } = useFavorites();
  const borderColor = useThemeColor({}, 'icon');

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {favoriteRecipeIds.length === 0 ? (
        <ThemedView style={styles.emptyState}>
          <IconSymbol name="heart" size={48} color={borderColor} />
          <ThemedText type="subtitle" style={styles.emptyTitle}>
            No favorites yet
          </ThemedText>
          <ThemedText style={styles.emptyBody}>
            Tap the heart on a recipe to add it here.
          </ThemedText>
        </ThemedView>
      ) : (
        <FlatList
          data={favoriteRecipeIds}
          keyExtractor={(id) => id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <FavoriteRow recipeId={item} />}
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
