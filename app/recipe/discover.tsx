import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
  type QuerySnapshot,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { db } from '@/lib/firebase';
import type { DiscoveredRecipe } from '@/types/discovered-recipe';
import { subscribeWithRetry } from '@/utils/firestore-retry';

const PAGE_SIZE = 50;

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

function DiscoveredRecipeCard({ recipe }: { recipe: DiscoveredRecipe }) {
  const router = useRouter();
  const border = useThemeColor({}, 'icon');
  const accent = useThemeColor({}, 'accent');

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/recipe/new', params: { discoverId: recipe.id } })}
      style={[styles.card, { borderColor: border }]}>
      {recipe.photoUri ? (
        <Image source={{ uri: recipe.photoUri }} style={styles.thumbnail} />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailPlaceholder, { borderColor: border }]}>
          <IconSymbol name="fork.knife" size={24} color={border} />
        </View>
      )}
      <View style={styles.cardBody}>
        <ThemedText type="defaultSemiBold" numberOfLines={2}>
          {recipe.title}
        </ThemedText>
        <View style={styles.cardMetaRow}>
          <ThemedText style={[styles.cardMeta, { color: border }]} numberOfLines={1}>
            {recipe.sourceName}
          </ThemedText>
          {recipe.aggregateRating ? (
            <View style={styles.ratingRow}>
              <IconSymbol name="star.fill" size={12} color={accent} />
              <ThemedText style={[styles.cardMeta, { color: border }]}>
                {recipe.aggregateRating.ratingValue.toFixed(1)}
                {recipe.aggregateRating.reviewCount ? ` (${recipe.aggregateRating.reviewCount})` : ''}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>
      <IconSymbol name="chevron.right" size={18} color={border} />
    </Pressable>
  );
}

export default function DiscoverScreen() {
  const border = useThemeColor({}, 'icon');
  const [recipes, setRecipes] = useState<DiscoveredRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const q = query(collection(db, 'discoveredRecipes'), orderBy('fetchedAt', 'desc'), limit(PAGE_SIZE));
    return subscribeWithRetry<QuerySnapshot<DocumentData>>(
      (onNext, onError) => onSnapshot(q, onNext, onError),
      (snapshot) => {
        setRecipes(snapshot.docs.map((d) => mapDiscoveredRecipe(d.id, d.data())));
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load discovered recipes', err);
        setError("Couldn't load recipes. Try again shortly.");
        setLoading(false);
      }
    );
  }, []);

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {recipes.length === 0 ? (
        <ThemedView style={styles.centered}>
          <IconSymbol name="sparkles" size={48} color={border} />
          <ThemedText type="subtitle" style={styles.emptyTitle}>
            No recipes yet
          </ThemedText>
          <ThemedText style={styles.emptyBody}>
            {error ?? 'Check back soon — new recipes are added automatically.'}
          </ThemedText>
        </ThemedView>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <DiscoveredRecipeCard recipe={item} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
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
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardMeta: {
    fontSize: 13,
    opacity: 0.8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
});
