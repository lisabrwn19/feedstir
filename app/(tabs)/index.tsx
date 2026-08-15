import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRecipes } from '@/context/recipes-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { Recipe } from '@/types/recipe';

function formatMeta(recipe: Recipe) {
  const parts: string[] = [];
  if (recipe.servings) parts.push(`${recipe.servings} servings`);
  const totalTime = (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0);
  if (totalTime > 0) parts.push(`${totalTime} min`);
  if (recipe.rating) parts.push(`★${recipe.rating}`);
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

export default function RecipesScreen() {
  const { recipes } = useRecipes();
  const router = useRouter();
  const accentColor = useThemeColor({}, 'accent');
  const borderColor = useThemeColor({}, 'icon');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Recipes</ThemedText>
        <Pressable
          onPress={() => router.push('/recipe/new')}
          style={[styles.addButton, { backgroundColor: accentColor }]}
          hitSlop={8}>
          <IconSymbol name="plus" size={20} color="#fff" />
        </Pressable>
      </ThemedView>

      {recipes.length === 0 ? (
        <ThemedView style={styles.emptyState}>
          <IconSymbol name="fork.knife" size={48} color={borderColor} />
          <ThemedText type="subtitle" style={styles.emptyTitle}>
            No recipes yet
          </ThemedText>
          <ThemedText style={styles.emptyBody}>
            Save your first recipe to see it here.
          </ThemedText>
          <Pressable
            onPress={() => router.push('/recipe/new')}
            style={[styles.emptyButton, { backgroundColor: accentColor }]}>
            <ThemedText style={styles.emptyButtonText}>Add your first recipe</ThemedText>
          </Pressable>
        </ThemedView>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <RecipeCard recipe={item} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 24,
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
  emptyButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
