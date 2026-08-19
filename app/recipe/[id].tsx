import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth-context';
import { useGrocery } from '@/context/grocery-context';
import { useRecipeDoc, useRecipes } from '@/context/recipes-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { Recipe } from '@/types/recipe';

// Matches the `accent` theme color (#0a7ea4), which is fixed across light/dark.
const accentSoft = 'rgba(10, 126, 164, 0.12)';

const STAR_VALUES = [1, 2, 3, 4, 5];

function RatingStars({
  rating,
  onChange,
}: {
  rating: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  const accent = useThemeColor({}, 'accent');
  const border = useThemeColor({}, 'icon');

  return (
    <View style={styles.field}>
      <View style={styles.starRow}>
        {STAR_VALUES.map((value) => {
          const filled = rating !== undefined && value <= rating;
          return (
            <Pressable
              key={value}
              onPress={() => onChange(rating === value ? undefined : value)}
              hitSlop={6}
              accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`}
              accessibilityRole="button"
              testID={`rating-star-${value}`}
              style={styles.starButton}>
              <IconSymbol
                name={filled ? 'star.fill' : 'star'}
                size={36}
                color={filled ? accent : border}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.ratingLabelsRow}>
        <ThemedText style={[styles.ratingLabelText, { color: border }]}>Never again</ThemedText>
        <ThemedText style={[styles.ratingLabelText, { color: border }]}>Every day</ThemedText>
      </View>
    </View>
  );
}

function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  const accent = useThemeColor({}, 'accent');
  const border = useThemeColor({}, 'icon');

  return (
    <View style={styles.summaryStars}>
      {STAR_VALUES.map((value) => (
        <IconSymbol
          key={value}
          name={value <= rating ? 'star.fill' : 'star'}
          size={size}
          color={value <= rating ? accent : border}
        />
      ))}
    </View>
  );
}

const DIFFICULTIES = ['easy', 'moderate', 'hard'] as const;

function DifficultyPicker({
  difficulty,
  onChange,
}: {
  difficulty: Recipe['difficulty'];
  onChange: (value: Recipe['difficulty']) => void;
}) {
  const accent = useThemeColor({}, 'accent');

  return (
    <View style={styles.field}>
      <View style={styles.difficultyRow}>
        {DIFFICULTIES.map((level) => {
          const selected = difficulty === level;
          return (
            <Pressable
              key={level}
              onPress={() => onChange(selected ? undefined : level)}
              style={[
                styles.difficultyChip,
                { borderColor: accent },
                selected && { backgroundColor: accent },
              ]}>
              <ThemedText style={[styles.difficultyChipText, { color: selected ? '#fff' : accent }]}>
                {level[0].toUpperCase() + level.slice(1)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const CELEBRATION_EMOJI = ['🎉', '🍕', '🍰', '🎊', '🍜', '🥳', '🍩', '🍩'];

function ConfettiBurst() {
  const { height } = useWindowDimensions();
  const particles = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        emoji: CELEBRATION_EMOJI[i % CELEBRATION_EMOJI.length],
        left: Math.round(Math.random() * 96),
        delay: Math.round(Math.random() * 500),
        duration: 1800 + Math.round(Math.random() * 1000),
        spin: Math.random() > 0.5 ? '360deg' : '-360deg',
      })),
    []
  );
  const anims = useRef(particles.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = anims.map((value, i) =>
      Animated.timing(value, {
        toValue: 1,
        duration: particles[i].duration,
        delay: particles[i].delay,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      })
    );
    Animated.stagger(0, animations).start();
  }, [anims, particles]);

  return (
    <View style={styles.confettiContainer} pointerEvents="none">
      {particles.map((p, i) => {
        const translateY = anims[i].interpolate({ inputRange: [0, 1], outputRange: [-40, height] });
        const opacity = anims[i].interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] });
        const rotate = anims[i].interpolate({ inputRange: [0, 1], outputRange: ['0deg', p.spin] });
        return (
          <Animated.Text
            key={i}
            style={[
              styles.confettiEmoji,
              { left: `${p.left}%`, opacity, transform: [{ translateY }, { rotate }] },
            ]}>
            {p.emoji}
          </Animated.Text>
        );
      })}
    </View>
  );
}

function CompleteOverlay({
  visible,
  onClose,
  onComplete,
}: {
  visible: boolean;
  onClose: () => void;
  onComplete: (rating: number, difficulty: NonNullable<Recipe['difficulty']>) => void;
}) {
  const [step, setStep] = useState<'rating' | 'difficulty' | 'celebration'>('rating');
  const [draftRating, setDraftRating] = useState<number | undefined>();
  const [draftDifficulty, setDraftDifficulty] = useState<Recipe['difficulty']>();
  const accent = useThemeColor({}, 'accent');
  const border = useThemeColor({}, 'icon');

  const reset = () => {
    setStep('rating');
    setDraftRating(undefined);
    setDraftDifficulty(undefined);
  };

  const handleDone = () => {
    if (draftRating === undefined || !draftDifficulty) return;
    onComplete(draftRating, draftDifficulty);
    reset();
  };

  const handleClose = () => {
    // Closing from the celebration step means the rating/difficulty were
    // already chosen — finish and save instead of discarding them.
    if (step === 'celebration') {
      handleDone();
    } else {
      reset();
    }
    onClose();
  };

  const handleShowCelebration = () => {
    if (draftRating === undefined || !draftDifficulty) return;
    setStep('celebration');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlayBackdrop}>
        <ThemedView style={[styles.overlayCard, { borderColor: border }]}>
          <Pressable onPress={handleClose} hitSlop={8} style={styles.overlayCloseButton}>
            <IconSymbol name="xmark" size={18} color={border} />
          </Pressable>

          {step === 'rating' ? (
            <>
              <ThemedText type="subtitle" style={styles.overlayTitle}>
                How would you rate it?
              </ThemedText>
              <RatingStars rating={draftRating} onChange={setDraftRating} />
              <Pressable
                onPress={() => setStep('difficulty')}
                disabled={draftRating === undefined}
                style={[
                  styles.overlayPrimaryButton,
                  { backgroundColor: accent, opacity: draftRating === undefined ? 0.5 : 1 },
                ]}>
                <ThemedText style={styles.overlayPrimaryButtonText}>Next</ThemedText>
              </Pressable>
            </>
          ) : step === 'difficulty' ? (
            <>
              <ThemedText type="subtitle" style={styles.overlayTitle}>
                How difficult was it?
              </ThemedText>
              <DifficultyPicker difficulty={draftDifficulty} onChange={setDraftDifficulty} />
              <View style={styles.overlayButtonRow}>
                <Pressable onPress={() => setStep('rating')} style={styles.overlaySecondaryButton}>
                  <ThemedText style={{ color: accent }}>Back</ThemedText>
                </Pressable>
                <Pressable
                  onPress={handleShowCelebration}
                  disabled={!draftDifficulty}
                  style={[
                    styles.overlayPrimaryButton,
                    styles.overlayFinishButton,
                    { backgroundColor: accent, opacity: draftDifficulty ? 1 : 0.5 },
                  ]}>
                  <ThemedText style={styles.overlayPrimaryButtonText}>Complete</ThemedText>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.celebrationWrap}>
              <ThemedText type="subtitle" style={styles.overlayTitle}>
                Nice work!
              </ThemedText>
              {draftRating !== undefined ? <StarRow rating={draftRating} size={24} /> : null}
              {draftDifficulty ? (
                <ThemedText style={[styles.celebrationSummary, { color: border }]}>
                  {draftDifficulty[0].toUpperCase() + draftDifficulty.slice(1)}
                </ThemedText>
              ) : null}
              <Pressable
                onPress={handleDone}
                style={[styles.overlayPrimaryButton, { backgroundColor: accent }]}>
                <ThemedText style={styles.overlayPrimaryButtonText}>Done</ThemedText>
              </Pressable>
            </View>
          )}
        </ThemedView>
        {step === 'celebration' ? <ConfettiBurst /> : null}
      </View>
    </Modal>
  );
}

function ModificationRow({
  text,
  added,
  onToggle,
  onRemove,
}: {
  text: string;
  added: boolean;
  onToggle: () => void;
  onRemove?: () => void;
}) {
  const accent = useThemeColor({}, 'accent');
  const border = useThemeColor({}, 'icon');

  return (
    <View style={styles.modificationRow}>
      <Pressable
        onPress={onToggle}
        style={[styles.ingredientRow, styles.modificationItemRow, added && { backgroundColor: accentSoft }]}>
        <IconSymbol
          name={added ? 'checkmark.circle.fill' : 'plus.circle'}
          size={20}
          color={added ? accent : border}
        />
        <ThemedText style={[styles.bulletText, added && { color: accent }]}>{text}</ThemedText>
        {added ? <ThemedText style={[styles.addedLabel, { color: accent }]}>Added</ThemedText> : null}
      </Pressable>
      {onRemove ? (
        <Pressable onPress={onRemove} hitSlop={8} style={styles.modificationRemove}>
          <IconSymbol name="xmark" size={16} color={border} />
        </Pressable>
      ) : null}
    </View>
  );
}

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const {
    deleteRecipe,
    markRecipeMade,
    setRecipeRating,
    setRecipeDifficulty,
    addRecipeModification,
    removeRecipeModification,
  } = useRecipes();
  const { isQueued, toggleQueued, isIngredientAdded, toggleGroceryIngredient, removeItemsForRecipe } =
    useGrocery();
  const border = useThemeColor({}, 'icon');
  const accent = useThemeColor({}, 'accent');
  const placeholder = useThemeColor({}, 'icon');
  const text = useThemeColor({}, 'text');
  const recipe = useRecipeDoc(id);
  const [newModification, setNewModification] = useState('');
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);

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
  const rating = recipe.rating;

  const handleAddToWeek = () => {
    toggleQueued(recipe.id);
  };

  const handleRemoveFromWeek = () => {
    Alert.alert(
      'Remove from Upcoming Menu?',
      'Keep the ingredients you already added to your grocery list, or remove them too?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Keep items', onPress: () => toggleQueued(recipe.id) },
        {
          text: 'Remove items',
          style: 'destructive',
          onPress: () => {
            toggleQueued(recipe.id);
            removeItemsForRecipe(recipe.id);
          },
        },
      ]
    );
  };

  const handleComplete = (rating: number, difficulty: NonNullable<Recipe['difficulty']>) => {
    setRecipeRating(recipe.id, rating);
    setRecipeDifficulty(recipe.id, difficulty);
    markRecipeMade(recipe.id);
    toggleQueued(recipe.id);
    setShowCompleteOverlay(false);
  };

  const handleEdit = () => {
    router.push({ pathname: '/recipe/new', params: { id: recipe.id } });
  };

  const handleDelete = () => {
    Alert.alert('Delete this recipe?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (queued) {
            toggleQueued(recipe.id);
            removeItemsForRecipe(recipe.id);
          }
          await deleteRecipe(recipe.id);
          router.back();
        },
      },
    ]);
  };

  const handleAddModification = () => {
    if (!newModification.trim()) return;
    addRecipeModification(recipe.id, newModification);
    setNewModification('');
  };

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
    <>
      <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          headerRight: () =>
            isOwner ? (
              <View style={styles.headerActions}>
                <Pressable onPress={handleEdit} hitSlop={8}>
                  <IconSymbol name="pencil" size={20} color={accent} />
                </Pressable>
                <Pressable onPress={handleDelete} hitSlop={8}>
                  <IconSymbol name="trash" size={20} color="#d64545" />
                </Pressable>
              </View>
            ) : null,
        }}
      />

      {recipe.photoUri ? <Image source={{ uri: recipe.photoUri }} style={styles.photo} /> : null}

      <ThemedText type="title">{recipe.title}</ThemedText>

      {isOwner ? (
        <>
          <View style={styles.actionRow}>
            {queued ? (
              <>
                <Pressable
                  onPress={() => setShowCompleteOverlay(true)}
                  style={[styles.actionButton, { backgroundColor: accent }]}>
                  <IconSymbol name="checkmark.circle.fill" size={18} color="#fff" />
                  <ThemedText style={[styles.actionButtonText, { color: '#fff' }]}>Complete</ThemedText>
                </Pressable>
                <Pressable
                  onPress={handleRemoveFromWeek}
                  hitSlop={8}
                  style={[styles.overflowButton, { borderColor: border }]}>
                  <IconSymbol name="ellipsis" size={18} color={border} />
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={handleAddToWeek}
                style={[styles.actionButton, { borderColor: accent }]}>
                <IconSymbol name="circle" size={18} color={accent} />
                <ThemedText style={[styles.actionButtonText, { color: accent }]}>
                  Add to Upcoming Menu
                </ThemedText>
              </Pressable>
            )}
          </View>

          {rating !== undefined || recipe.difficulty || recipe.timesMade > 0 ? (
            <View style={styles.summaryRow}>
              {rating !== undefined ? <StarRow rating={rating} /> : null}
              {recipe.difficulty || recipe.timesMade > 0 ? (
                <ThemedText style={[styles.summaryText, { color: border }]}>
                  {[
                    recipe.difficulty
                      ? recipe.difficulty[0].toUpperCase() + recipe.difficulty.slice(1)
                      : null,
                    recipe.timesMade > 0 ? `Made ${recipe.timesMade}×` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </ThemedText>
              ) : null}
            </View>
          ) : null}
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

        {recipe.modifications.length > 0 || isOwner ? (
          <View style={styles.modificationsBlock}>
            <ThemedText type="defaultSemiBold" style={[styles.modificationsHeader, { color: border }]}>
              MODIFICATIONS
            </ThemedText>
            {recipe.modifications.map((modification, index) => (
              <ModificationRow
                key={index}
                text={modification}
                added={isIngredientAdded(recipe.id, modification)}
                onToggle={() => toggleGroceryIngredient(recipe.id, recipe.title, modification)}
                onRemove={isOwner ? () => removeRecipeModification(recipe.id, modification) : undefined}
              />
            ))}
            {isOwner ? (
              <View style={styles.importRow}>
                <TextInput
                  value={newModification}
                  onChangeText={setNewModification}
                  placeholder="Add a modification"
                  placeholderTextColor={placeholder}
                  onSubmitEditing={handleAddModification}
                  returnKeyType="done"
                  style={[styles.input, { color: text, borderColor: border }]}
                />
                <Pressable
                  onPress={handleAddModification}
                  disabled={!newModification.trim()}
                  style={[
                    styles.modificationAddButton,
                    { backgroundColor: accent, opacity: newModification.trim() ? 1 : 0.5 },
                  ]}>
                  <IconSymbol name="plus" size={20} color="#fff" />
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
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

      <CompleteOverlay
        visible={showCompleteOverlay}
        onClose={() => setShowCompleteOverlay(false)}
        onComplete={handleComplete}
      />
    </>
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
  headerActions: {
    flexDirection: 'row',
    gap: 18,
    paddingRight: 4,
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
  overflowButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: -6,
  },
  summaryText: {
    fontSize: 13,
  },
  summaryStars: {
    flexDirection: 'row',
    gap: 1,
  },
  field: {
    gap: 8,
  },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  starButton: {
    padding: 2,
  },
  ratingLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ratingLabelText: {
    fontSize: 12,
  },
  difficultyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  difficultyChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  difficultyChipText: {
    fontWeight: '600',
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
  modificationsBlock: {
    gap: 6,
    marginTop: 8,
  },
  modificationsHeader: {
    fontSize: 12,
    letterSpacing: 0.5,
  },
  modificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modificationItemRow: {
    flex: 1,
  },
  modificationRemove: {
    padding: 8,
  },
  importRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  modificationAddButton: {
    borderRadius: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
  overlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  overlayCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    gap: 16,
  },
  overlayCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
    padding: 4,
  },
  overlayTitle: {
    textAlign: 'center',
    marginRight: 20,
  },
  overlayPrimaryButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  overlayFinishButton: {
    flex: 1,
  },
  overlayPrimaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  overlayButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  overlaySecondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  celebrationWrap: {
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
  },
  celebrationSummary: {
    fontSize: 15,
    fontWeight: '600',
  },
  confettiContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  confettiEmoji: {
    position: 'absolute',
    top: 0,
    fontSize: 26,
  },
});
