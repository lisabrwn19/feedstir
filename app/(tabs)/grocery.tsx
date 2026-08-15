import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useGrocery } from '@/context/grocery-context';
import { useRecipes } from '@/context/recipes-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { categorizeIngredient, GROCERY_SECTIONS } from '@/utils/grocery-sections';

export default function GroceryScreen() {
  const router = useRouter();
  const { recipes } = useRecipes();
  const { queuedRecipeIds, toggleQueued, groceryItems, toggleGroceryItemChecked, removeGroceryItem, clearCheckedItems } =
    useGrocery();
  const border = useThemeColor({}, 'icon');
  const accent = useThemeColor({}, 'accent');

  const queuedRecipes = queuedRecipeIds
    .map((recipeId) => recipes.find((r) => r.id === recipeId))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  const checkedItems = groceryItems.filter((item) => item.checked);
  const groupedSections = GROCERY_SECTIONS.map((section) => {
    const items = groceryItems.filter((item) => categorizeIngredient(item.text) === section);
    const unchecked = items.filter((item) => !item.checked);
    const checked = items.filter((item) => item.checked);
    return { section, items: [...unchecked, ...checked] };
  }).filter((group) => group.items.length > 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Grocery</ThemedText>
      </ThemedView>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <ThemedText type="subtitle">This Week</ThemedText>
          {queuedRecipes.length === 0 ? (
            <ThemedText style={styles.emptyHint}>
              Open a recipe and tap &quot;Add to this week&quot; to queue it here.
            </ThemedText>
          ) : (
            <View style={styles.queuedList}>
              {queuedRecipes.map((recipe) => (
                <Pressable
                  key={recipe.id}
                  onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } })}
                  style={[styles.queuedCard, { borderColor: border }]}>
                  {recipe.photoUri ? (
                    <Image source={{ uri: recipe.photoUri }} style={styles.queuedThumbnail} />
                  ) : (
                    <View style={[styles.queuedThumbnail, styles.queuedThumbnailPlaceholder, { borderColor: border }]}>
                      <IconSymbol name="fork.knife" size={20} color={border} />
                    </View>
                  )}
                  <ThemedText style={styles.queuedTitle} numberOfLines={2}>
                    {recipe.title}
                  </ThemedText>
                  <Pressable onPress={() => toggleQueued(recipe.id)} hitSlop={8}>
                    <IconSymbol name="xmark" size={16} color={border} />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.listHeaderRow}>
            <ThemedText type="subtitle">Grocery List</ThemedText>
            {checkedItems.length > 0 ? (
              <Pressable onPress={clearCheckedItems}>
                <ThemedText style={{ color: accent }}>Clear checked</ThemedText>
              </Pressable>
            ) : null}
          </View>

          {groupedSections.length === 0 ? (
            <ThemedText style={styles.emptyHint}>
              Tap ingredients on a recipe to add them to your list.
            </ThemedText>
          ) : (
            groupedSections.map(({ section, items }) => (
              <View key={section} style={styles.sectionGroup}>
                <ThemedText style={[styles.sectionLabel, { color: border }]}>
                  {section.toUpperCase()}
                </ThemedText>
                {items.map((item) => (
                  <View key={item.id} style={styles.groceryRow}>
                    <Pressable
                      onPress={() => toggleGroceryItemChecked(item.id)}
                      style={styles.groceryRowMain}>
                      <IconSymbol
                        name={item.checked ? 'checkmark.circle.fill' : 'circle'}
                        size={22}
                        color={item.checked ? accent : border}
                      />
                      <View style={styles.groceryTextBlock}>
                        <ThemedText style={item.checked ? styles.groceryTextChecked : undefined}>
                          {item.text}
                        </ThemedText>
                        <ThemedText style={styles.groceryRecipeLabel}>{item.recipeTitle}</ThemedText>
                      </View>
                    </Pressable>
                    <Pressable onPress={() => removeGroceryItem(item.id)} hitSlop={8}>
                      <IconSymbol name="xmark" size={16} color={border} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 28,
  },
  section: {
    gap: 12,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emptyHint: {
    opacity: 0.6,
  },
  queuedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  queuedCard: {
    width: 140,
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    gap: 8,
  },
  queuedThumbnail: {
    width: '100%',
    height: 80,
    borderRadius: 8,
  },
  queuedThumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  queuedTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionGroup: {
    gap: 2,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  groceryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 6,
  },
  groceryRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  groceryTextBlock: {
    flex: 1,
  },
  groceryTextChecked: {
    opacity: 0.5,
    textDecorationLine: 'line-through',
  },
  groceryRecipeLabel: {
    fontSize: 12,
    opacity: 0.5,
  },
});
