import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth-context';
import { useGrocery } from '@/context/grocery-context';
import { useRecipeDoc, useRecipes } from '@/context/recipes-context';
import { useThemeColor } from '@/hooks/use-theme-color';

// Matches the `accent` theme color (#0a7ea4), which is fixed across light/dark.
const accentSoft = 'rgba(10, 126, 164, 0.12)';

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

function StarRating({
  rating,
  onChange,
}: {
  rating: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  const accent = useThemeColor({}, 'accent');
  const border = useThemeColor({}, 'icon');

  return (
    <View style={styles.starRow}>
      {STAR_VALUES.map((value) => {
        const filled = rating !== undefined && value <= rating;
        return (
          <Pressable
            key={value}
            onPress={() => onChange(rating === value ? undefined : value)}
            hitSlop={6}>
            <IconSymbol
              name={filled ? 'star.fill' : 'star'}
              size={26}
              color={filled ? accent : border}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { markRecipeMade, setRecipeRating } = useRecipes();
  const { isQueued, toggleQueued, isIngredientAdded, toggleGroceryIngredient } = useGrocery();
  const border = useThemeColor({}, 'icon');
  const accent = useThemeColor({}, 'accent');
  const recipe = useRecipeDoc(id);

  if (recipe === undefined) {
    return (
      <ThemedView style={styles.notFound}>
        <ThemedText>Loading…</ThemedText>
      </ThemedView>
    );
  }

  if (recipe === null) {
    return (
      <ThemedView style={styles.notFound}>
        <ThemedText>Recipe not found.</ThemedText>
      </ThemedView>
    );
  }

  const isOwner = recipe.ownerId === user?.uid;
  const queued = isQueued(recipe.id);

  const metaItems: { icon: 'person.2.fill' | 'clock'; label: string }[] = [];
  if (recipe.servings) {
    metaItems.push({ icon: 'person.2.fill', label: `${recipe.servings} servings` });
  }
  if (recipe.prepTimeMinutes) {
    metaItems.push({ icon: 'clock', label: `${recipe.prepTimeMinutes} min prep` });
  }
  if (recipe.cookTimeMinutes) {
    metaItems.push({ icon: 'clock', label: `${recipe.cookTimeMinutes} min cook` });
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {recipe.photoUri ? <Image source={{ uri: recipe.photoUri }} style={styles.photo} /> : null}

      <ThemedText type="title">{recipe.title}</ThemedText>

      {isOwner ? (
        <>
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => toggleQueued(recipe.id)}
              style={[
                styles.actionButton,
                { borderColor: accent },
                queued && { backgroundColor: accent },
              ]}>
              <IconSymbol
                name={queued ? 'checkmark.circle.fill' : 'circle'}
                size={18}
                color={queued ? '#fff' : accent}
              />
              <ThemedText style={[styles.actionButtonText, { color: queued ? '#fff' : accent }]}>
                {queued ? 'Queued for this week' : 'Add to this week'}
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => markRecipeMade(recipe.id)}
              style={[styles.actionButton, { borderColor: accent }]}>
              <IconSymbol
                name={recipe.timesMade > 0 ? 'checkmark.circle.fill' : 'circle'}
                size={18}
                color={accent}
              />
              <ThemedText style={[styles.actionButtonText, { color: accent }]}>
                {recipe.timesMade === 0 ? 'I made this' : `Made it ${recipe.timesMade}×`}
              </ThemedText>
            </Pressable>
          </View>

          <StarRating rating={recipe.rating} onChange={(value) => setRecipeRating(recipe.id, value)} />
        </>
      ) : (
        <ThemedText style={styles.sharedNote}>Shared with you on your grocery list.</ThemedText>
      )}

      {metaItems.length > 0 ? (
        <View style={styles.metaRow}>
          {metaItems.map((item, index) => (
            <View key={index} style={styles.metaItem}>
              <IconSymbol name={item.icon} size={16} color={border} />
              <ThemedText style={styles.metaText}>{item.label}</ThemedText>
            </View>
          ))}
        </View>
      ) : null}

      {recipe.sourceUrl ? (
        <ExternalLink href={recipe.sourceUrl as `${string}:${string}`} style={styles.sourceLink}>
          <View style={styles.metaItem}>
            <IconSymbol name="link" size={16} color={border} />
            <ThemedText type="link" numberOfLines={1}>
              {recipe.sourceUrl}
            </ThemedText>
          </View>
        </ExternalLink>
      ) : null}

      <View style={styles.section}>
        <ThemedText type="subtitle">Ingredients</ThemedText>
        <ThemedText style={styles.sectionHint}>Tap an ingredient to add it to your grocery list.</ThemedText>
        {recipe.ingredients.map((ingredient, index) => {
          const added = isIngredientAdded(recipe.id, ingredient);
          return (
            <Pressable
              key={index}
              onPress={() => toggleGroceryIngredient(recipe.id, recipe.title, ingredient)}
              style={[styles.ingredientRow, added && { backgroundColor: accentSoft }]}>
              <IconSymbol
                name={added ? 'checkmark.circle.fill' : 'plus.circle'}
                size={20}
                color={added ? accent : border}
              />
              <ThemedText style={[styles.bulletText, added && { color: accent }]}>
                {ingredient}
              </ThemedText>
              {added ? <ThemedText style={[styles.addedLabel, { color: accent }]}>Added</ThemedText> : null}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.section}>
        <ThemedText type="subtitle">Instructions</ThemedText>
        {recipe.instructions.map((instruction, index) => (
          <View key={index} style={styles.bulletRow}>
            <ThemedText style={styles.bullet}>{index + 1}.</ThemedText>
            <ThemedText style={styles.bulletText}>{instruction}</ThemedText>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 16,
  },
  photo: {
    width: '100%',
    height: 220,
    borderRadius: 12,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    opacity: 0.8,
  },
  sourceLink: {
    marginTop: -8,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionButtonText: {
    fontWeight: '600',
  },
  starRow: {
    flexDirection: 'row',
    gap: 6,
  },
  sharedNote: {
    fontSize: 13,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  section: {
    gap: 10,
  },
  sectionHint: {
    fontSize: 13,
    opacity: 0.6,
    marginTop: -4,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: 8,
  },
  addedLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bullet: {
    opacity: 0.6,
    width: 20,
  },
  bulletText: {
    flex: 1,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
