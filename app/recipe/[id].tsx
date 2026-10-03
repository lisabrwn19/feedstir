import { Image } from 'expo-image';
import { useKeepAwake } from 'expo-keep-awake';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { useFavorites } from '@/context/favorites-context';
import { useGrocery } from '@/context/grocery-context';
import { useRecipeDoc, useRecipes } from '@/context/recipes-context';
import { useSavedRecipes } from '@/context/saved-recipes';
import { useUserProfile } from '@/context/user-profile';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { Recipe } from '@/types/recipe';
import type { Menu } from '@/types/grocery';
import { formatDateRangeLabel } from '@/utils/calendar';
import { categoryEmoji, DEFAULT_CATEGORIES } from '@/utils/categories';
import { menuLabel } from '@/utils/menu-labels';
import { convertIngredientLine, detectPredominantSystem } from '@/utils/unit-conversion';

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

type ConfettiParticle = {
  emoji: string;
  left: number;
  delay: number;
  duration: number;
  spin: string;
  anim: Animated.Value;
};

function ConfettiBurst() {
  const { height } = useWindowDimensions();
  // A lazy useState initializer is the sanctioned way to compute a stable
  // random value once on mount — unlike a useMemo factory or the render
  // body itself, it's exempt from the "no impure calls during render" rule.
  const [particles] = useState<ConfettiParticle[]>(() =>
    Array.from({ length: 28 }, (_, i) => ({
      emoji: CELEBRATION_EMOJI[i % CELEBRATION_EMOJI.length],
      left: Math.round(Math.random() * 96),
      delay: Math.round(Math.random() * 500),
      duration: 1800 + Math.round(Math.random() * 1000),
      spin: Math.random() > 0.5 ? '360deg' : '-360deg',
      anim: new Animated.Value(0),
    }))
  );

  // Starting the animation is an imperative side effect on an external
  // system (the Animated engine), not a setState call — belongs in an
  // effect per the react-hooks/set-state-in-effect rule's own guidance.
  useEffect(() => {
    Animated.stagger(
      0,
      particles.map((p) =>
        Animated.timing(p.anim, {
          toValue: 1,
          duration: p.duration,
          delay: p.delay,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        })
      )
    ).start();
  }, [particles]);

  return (
    <View style={styles.confettiContainer} pointerEvents="none">
      {particles.map((p, i) => {
        const translateY = p.anim.interpolate({ inputRange: [0, 1], outputRange: [-40, height] });
        const opacity = p.anim.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] });
        const rotate = p.anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', p.spin] });
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
  onComplete: (rating: number | undefined, difficulty: NonNullable<Recipe['difficulty']>) => void;
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
    if (!draftDifficulty) return;
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
    if (!draftDifficulty) return;
    setStep('celebration');
  };

  const handleSkipRating = () => {
    setDraftRating(undefined);
    setStep('difficulty');
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
              <View style={styles.overlayButtonRow}>
                <Pressable onPress={handleSkipRating} style={styles.overlaySecondaryButton}>
                  <ThemedText style={{ color: accent }}>Skip</ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => setStep('difficulty')}
                  disabled={draftRating === undefined}
                  style={[
                    styles.overlayPrimaryButton,
                    styles.overlayFinishButton,
                    { backgroundColor: accent, opacity: draftRating === undefined ? 0.5 : 1 },
                  ]}>
                  <ThemedText style={styles.overlayPrimaryButtonText}>Next</ThemedText>
                </Pressable>
              </View>
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

function AddToMenuModal({
  visible,
  onClose,
  menus,
  queuedMenuIndexes,
  onToggleMenu,
  onAddNewMenu,
}: {
  visible: boolean;
  onClose: () => void;
  menus: Menu[];
  queuedMenuIndexes: number[];
  onToggleMenu: (menuIndex: number) => void;
  onAddNewMenu: () => void;
}) {
  const accent = useThemeColor({}, 'accent');
  const border = useThemeColor({}, 'icon');

  // Always show at least "Menu 1", even before anything's ever been queued
  // on this list.
  const rowCount = Math.max(menus.length, 1);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlayBackdrop}>
        <ThemedView style={[styles.overlayCard, { borderColor: border }]}>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityLabel="Close"
            style={styles.overlayCloseButton}>
            <IconSymbol name="xmark" size={18} color={border} />
          </Pressable>

          <ThemedText type="subtitle" style={styles.overlayTitle}>
            Add to Menu
          </ThemedText>

          <View style={styles.menuPickerList}>
            {Array.from({ length: rowCount }, (_, menuIndex) => {
              const queuedHere = queuedMenuIndexes.includes(menuIndex);
              const dateLabel = formatDateRangeLabel(
                menus[menuIndex]?.startDate,
                menus[menuIndex]?.endDate
              );
              // Once queued for the menu you're cooking from (index 0),
              // that row stops being directly toggleable — removal only
              // happens via the overflow menu on the recipe screen, so
              // there's no way to skip its keep/remove-items confirmation.
              const disabled = menuIndex === 0 && queuedHere;
              return (
                <Pressable
                  key={menuIndex}
                  onPress={() => !disabled && onToggleMenu(menuIndex)}
                  disabled={disabled}
                  style={styles.menuPickerRow}>
                  <IconSymbol
                    name={queuedHere ? 'checkmark.circle.fill' : 'circle'}
                    size={22}
                    color={queuedHere ? accent : border}
                  />
                  <View style={styles.menuPickerRowText}>
                    <ThemedText style={queuedHere ? { color: accent, fontWeight: '600' } : undefined}>
                      {menuLabel(menuIndex)}
                    </ThemedText>
                    {dateLabel ? (
                      <ThemedText style={[styles.menuPickerDate, { color: border }]}>
                        {dateLabel}
                      </ThemedText>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
            <Pressable onPress={onAddNewMenu} style={styles.menuPickerRow}>
              <IconSymbol name="plus.circle" size={22} color={accent} />
              <ThemedText style={{ color: accent, fontWeight: '600' }}>New Menu</ThemedText>
            </Pressable>
          </View>

          <Pressable onPress={onClose} style={[styles.overlayPrimaryButton, { backgroundColor: accent }]}>
            <ThemedText style={styles.overlayPrimaryButtonText}>Done</ThemedText>
          </Pressable>
        </ThemedView>
      </View>
    </Modal>
  );
}

// Which folders this recipe sits in, from the viewer's own point of view —
// works the same whether you own the recipe (writes straight to
// `recipe.categories`) or not (writes to your own `savedRecipes` doc,
// since you can't edit someone else's recipe doc).
function FoldersRow({ recipe, isOwner }: { recipe: Recipe; isOwner: boolean }) {
  const { setRecipeCategories } = useRecipes();
  const { getSavedMeta, toggleSavedCategory } = useSavedRecipes();
  const accent = useThemeColor({}, 'accent');
  const border = useThemeColor({}, 'icon');

  const currentCategories = isOwner ? recipe.categories : getSavedMeta(recipe.id).categories;
  const allChips = [
    ...DEFAULT_CATEGORIES,
    ...currentCategories.filter((c) => !DEFAULT_CATEGORIES.includes(c)),
  ];

  const handleToggle = (category: string) => {
    if (isOwner) {
      const next = currentCategories.includes(category)
        ? currentCategories.filter((c) => c !== category)
        : [...currentCategories, category];
      setRecipeCategories(recipe.id, next);
    } else {
      toggleSavedCategory(recipe.id, category);
    }
  };

  return (
    <View style={styles.foldersBlock}>
      <ThemedText type="defaultSemiBold" style={[styles.modificationsHeader, { color: border }]}>
        FOLDERS
      </ThemedText>
      <View style={styles.categoryChipRow}>
        {allChips.map((category) => {
          const active = currentCategories.includes(category);
          return (
            <Pressable
              key={category}
              onPress={() => handleToggle(category)}
              accessibilityLabel={`${category} folder${active ? ', saved' : ''}`}
              style={[
                styles.difficultyChip,
                { borderColor: accent },
                active && { backgroundColor: accent },
              ]}>
              <ThemedText style={[styles.difficultyChipText, { color: active ? '#fff' : accent }]}>
                {categoryEmoji(category)} {category}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
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
  const {
    menus,
    isQueuedInMenu,
    menusContainingRecipe,
    addRecipeToMenu,
    removeRecipeFromMenu,
    addRecipeToNewMenu,
    isIngredientAdded,
    toggleGroceryIngredient,
    removeItemsForRecipe,
  } = useGrocery();
  const { isFavorite, toggleFavorite } = useFavorites();
  // Keeps the screen on for as long as this recipe stays mounted; releases
  // automatically on unmount (navigating away), so no manual cleanup needed.
  useKeepAwake();
  const border = useThemeColor({}, 'icon');
  const accent = useThemeColor({}, 'accent');
  const placeholder = useThemeColor({}, 'icon');
  const text = useThemeColor({}, 'text');
  const recipe = useRecipeDoc(id);
  const [newModification, setNewModification] = useState('');
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);
  const [showMenuPicker, setShowMenuPicker] = useState(false);
  const [showConvertedUnits, setShowConvertedUnits] = useState(false);
  // Every hook must run unconditionally before the loading/not-found
  // returns below, so the "who owns this" check for the profile lookup is
  // done defensively here rather than after `recipe` is known non-null.
  const recipeOwnerId = recipe?.ownerId;
  const ownerProfile = useUserProfile(
    recipeOwnerId && recipeOwnerId !== user?.uid ? recipeOwnerId : undefined
  );

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
  // Converting "to" the opposite of whatever system the recipe is mostly
  // already written in — a single toggle, no separate unit picker needed.
  const predominantUnitSystem = detectPredominantSystem(recipe.ingredients);
  const targetUnitSystem = predominantUnitSystem === 'metric' ? 'us' : 'metric';
  const queuedMenuIndexes = menusContainingRecipe(recipe.id);
  const queuedInCurrentMenu = isQueuedInMenu(recipe.id, 0);
  const rating = recipe.rating;
  const favorited = isFavorite(recipe.id);

  const handleToggleFavorite = async () => {
    try {
      await toggleFavorite(recipe.id);
    } catch (err) {
      console.error('Failed to toggle favorite', err);
    }
  };

  const handleToggleMenu = (menuIndex: number) => {
    if (isQueuedInMenu(recipe.id, menuIndex)) {
      removeRecipeFromMenu(recipe.id, menuIndex);
    } else {
      addRecipeToMenu(recipe.id, menuIndex);
    }
  };

  const handleAddToNewMenu = () => {
    addRecipeToNewMenu(recipe.id);
  };

  const handleRemoveFromCurrentMenu = () => {
    Alert.alert(
      'Remove from this menu?',
      'Keep the ingredients you already added to your grocery list, or remove them too?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Keep items', onPress: () => removeRecipeFromMenu(recipe.id, 0) },
        {
          text: 'Remove items',
          style: 'destructive',
          onPress: () => {
            removeRecipeFromMenu(recipe.id, 0);
            removeItemsForRecipe(recipe.id);
          },
        },
      ]
    );
  };

  const handleComplete = (
    rating: number | undefined,
    difficulty: NonNullable<Recipe['difficulty']>
  ) => {
    if (rating !== undefined) setRecipeRating(recipe.id, rating);
    setRecipeDifficulty(recipe.id, difficulty);
    markRecipeMade(recipe.id);
    removeRecipeFromMenu(recipe.id, 0);
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
          if (queuedMenuIndexes.length > 0) {
            queuedMenuIndexes.forEach((menuIndex) => removeRecipeFromMenu(recipe.id, menuIndex));
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
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable
                onPress={handleToggleFavorite}
                hitSlop={8}
                accessibilityLabel={favorited ? 'Unfavorite' : 'Favorite'}>
                <IconSymbol
                  name={favorited ? 'heart.fill' : 'heart'}
                  size={20}
                  color={favorited ? '#d64545' : accent}
                />
              </Pressable>
              {isOwner ? (
                <>
                  <Pressable onPress={handleEdit} hitSlop={8}>
                    <IconSymbol name="pencil" size={20} color={accent} />
                  </Pressable>
                  <Pressable onPress={handleDelete} hitSlop={8}>
                    <IconSymbol name="trash" size={20} color="#d64545" />
                  </Pressable>
                </>
              ) : null}
            </View>
          ),
        }}
      />

      {recipe.photoUri ? <Image source={{ uri: recipe.photoUri }} style={styles.photo} /> : null}

      <ThemedText type="title">{recipe.title}</ThemedText>

      {recipe.sourceRating ? (
        <View style={styles.sourceRatingRow}>
          <IconSymbol name="star.fill" size={14} color={accent} />
          <ThemedText style={[styles.sourceRatingText, { color: border }]}>
            {recipe.sourceRating.ratingValue.toFixed(1)}
            {recipe.sourceRating.reviewCount !== undefined
              ? ` (${recipe.sourceRating.reviewCount.toLocaleString()})`
              : ''}
            {' · from the source site'}
          </ThemedText>
        </View>
      ) : null}

      {!isOwner ? (
        <Pressable
          onPress={() => router.push({ pathname: '/user/[uid]', params: { uid: recipe.ownerId } })}
          hitSlop={8}>
          <ThemedText style={[styles.sharedNote, { color: accent }]}>
            By {ownerProfile?.displayName ?? '…'}
          </ThemedText>
        </Pressable>
      ) : null}

      {isOwner ? (
        <>
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => setShowMenuPicker(true)}
              style={[styles.actionButton, { borderColor: accent }]}>
              <IconSymbol
                name={queuedMenuIndexes.length > 0 ? 'checkmark.circle.fill' : 'plus.circle'}
                size={18}
                color={accent}
              />
              <ThemedText style={[styles.actionButtonText, { color: accent }]}>
                {queuedMenuIndexes.length === 0
                  ? 'Add to Menu'
                  : queuedMenuIndexes.length === 1
                    ? `In ${menuLabel(queuedMenuIndexes[0])}`
                    : `In ${queuedMenuIndexes.length} Menus`}
              </ThemedText>
            </Pressable>
          </View>

          {queuedInCurrentMenu ? (
            <View style={styles.actionRow}>
              <Pressable
                onPress={() => setShowCompleteOverlay(true)}
                style={[styles.actionButton, { backgroundColor: accent }]}>
                <IconSymbol name="checkmark.circle.fill" size={18} color="#fff" />
                <ThemedText style={[styles.actionButtonText, { color: '#fff' }]}>Complete</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleRemoveFromCurrentMenu}
                hitSlop={8}
                style={[styles.overflowButton, { borderColor: border }]}>
                <IconSymbol name="ellipsis" size={18} color={border} />
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}

      {rating !== undefined || recipe.difficulty || recipe.timesMade > 0 ? (
        <View style={styles.summaryRow}>
          {rating !== undefined ? <StarRow rating={rating} /> : null}
          {recipe.difficulty || recipe.timesMade > 0 ? (
            <ThemedText style={[styles.summaryText, { color: border }]}>
              {[
                recipe.difficulty ? recipe.difficulty[0].toUpperCase() + recipe.difficulty.slice(1) : null,
                recipe.timesMade > 0 ? `Made ${recipe.timesMade}×` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </ThemedText>
          ) : null}
        </View>
      ) : null}

      <FoldersRow recipe={recipe} isOwner={isOwner} />

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
        <View style={styles.ingredientsHeaderRow}>
          <ThemedText type="subtitle">Ingredients</ThemedText>
          <Pressable
            onPress={() => setShowConvertedUnits((v) => !v)}
            hitSlop={8}
            accessibilityLabel={
              showConvertedUnits
                ? 'Show original units'
                : `Convert to ${targetUnitSystem === 'metric' ? 'Metric' : 'US'}`
            }>
            <ThemedText style={{ color: accent, fontSize: 13, fontWeight: '600' }}>
              {showConvertedUnits
                ? 'Show original'
                : `Convert to ${targetUnitSystem === 'metric' ? 'Metric' : 'US'}`}
            </ThemedText>
          </Pressable>
        </View>
        <ThemedText style={styles.sectionHint}>Tap an ingredient to add it to your grocery list.</ThemedText>
        {recipe.ingredients.map((ingredient, index) => {
          const added = isIngredientAdded(recipe.id, ingredient);
          const converted = showConvertedUnits ? convertIngredientLine(ingredient, targetUnitSystem) : undefined;
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
                {converted ? converted.text : ingredient}
                {converted?.approximate ? ' (approx.)' : ''}
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
      <AddToMenuModal
        visible={showMenuPicker}
        onClose={() => setShowMenuPicker(false)}
        menus={menus}
        queuedMenuIndexes={queuedMenuIndexes}
        onToggleMenu={handleToggleMenu}
        onAddNewMenu={handleAddToNewMenu}
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
  menuPickerList: {
    gap: 4,
  },
  menuPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  menuPickerRowText: {
    flex: 1,
  },
  menuPickerDate: {
    fontSize: 12,
    marginTop: 1,
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
    fontSize: 14,
    fontWeight: '600',
  },
  sourceRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -8,
  },
  sourceRatingText: {
    fontSize: 13,
  },
  section: {
    gap: 10,
  },
  ingredientsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  foldersBlock: {
    gap: 8,
  },
  categoryChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
    ...StyleSheet.absoluteFill,
    zIndex: 10,
  },
  confettiEmoji: {
    position: 'absolute',
    top: 0,
    fontSize: 26,
  },
});
