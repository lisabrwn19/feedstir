import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth-context';
import { useFollow } from '@/context/follow-context';
import { useGrocery } from '@/context/grocery-context';
import { useUserRecipes } from '@/context/recipes-context';
import { useSavedRecipes } from '@/context/saved-recipes';
import { useUserProfile } from '@/context/user-profile';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { Recipe } from '@/types/recipe';
import { categoryEmoji, DEFAULT_CATEGORIES } from '@/utils/categories';
import { menuLabel } from '@/utils/menu-labels';

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
  return parts.join(' · ');
}

function RecipeRow({ recipe, onQuickSave }: { recipe: Recipe; onQuickSave?: () => void }) {
  const router = useRouter();
  const accent = useThemeColor({}, 'accent');
  const border = useThemeColor({}, 'icon');
  const meta = formatMeta(recipe);

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } })}
      style={[styles.card, { borderColor: border }]}>
      {recipe.photoUri ? (
        <Image source={{ uri: recipe.photoUri }} style={styles.thumbnail} />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailPlaceholder, { borderColor: border }]}>
          <IconSymbol name="fork.knife" size={24} color={border} />
        </View>
      )}
      <View style={styles.cardBody}>
        <ThemedText type="defaultSemiBold" numberOfLines={1}>
          {recipe.title}
        </ThemedText>
        {meta ? <ThemedText style={styles.cardMeta}>{meta}</ThemedText> : null}
      </View>
      {onQuickSave ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onQuickSave();
          }}
          hitSlop={8}
          accessibilityLabel={`Save ${recipe.title}`}
          style={styles.saveButton}>
          <IconSymbol name="plus.circle" size={22} color={accent} />
        </Pressable>
      ) : null}
      <IconSymbol name="chevron.right" size={18} color={border} />
    </Pressable>
  );
}

const STAR_VALUES = [1, 2, 3, 4, 5];

function QuickSaveModal({ recipe, onClose }: { recipe: Recipe | null; onClose: () => void }) {
  const { getSavedMeta, toggleSavedCategory, setSavedRating } = useSavedRecipes();
  const { menus, isQueuedInMenu, addRecipeToMenu, removeRecipeFromMenu, addRecipeToNewMenu } = useGrocery();
  const accent = useThemeColor({}, 'accent');
  const border = useThemeColor({}, 'icon');

  const meta = recipe ? getSavedMeta(recipe.id) : undefined;
  const allChips = meta
    ? [...DEFAULT_CATEGORIES, ...meta.categories.filter((c) => !DEFAULT_CATEGORIES.includes(c))]
    : [];
  const rowCount = Math.max(menus.length, 1);

  return (
    <Modal visible={recipe !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        {recipe && meta ? (
          <ThemedView key={recipe.id} style={[styles.modalCard, { borderColor: border }]}>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityLabel="Close"
              style={styles.modalCloseButton}>
              <IconSymbol name="xmark" size={18} color={border} />
            </Pressable>
            <ThemedText type="subtitle" style={styles.modalTitle} numberOfLines={1}>
              Save “{recipe.title}”
            </ThemedText>

            <ThemedText type="defaultSemiBold" style={[styles.modalSectionLabel, { color: border }]}>
              FOLDERS
            </ThemedText>
            <View style={styles.categoryChipRow}>
              {allChips.map((category) => {
                const active = meta.categories.includes(category);
                return (
                  <Pressable
                    key={category}
                    onPress={() => toggleSavedCategory(recipe.id, category)}
                    accessibilityLabel={`${category} folder${active ? ', saved' : ''}`}
                    style={[
                      styles.chip,
                      { borderColor: accent },
                      active && { backgroundColor: accent },
                    ]}>
                    <ThemedText style={[styles.chipText, { color: active ? '#fff' : accent }]}>
                      {categoryEmoji(category)} {category}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <ThemedText type="defaultSemiBold" style={[styles.modalSectionLabel, { color: border }]}>
              YOUR RATING
            </ThemedText>
            <View style={styles.starRow}>
              {STAR_VALUES.map((value) => {
                const filled = meta.rating !== undefined && value <= meta.rating;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setSavedRating(recipe.id, meta.rating === value ? undefined : value)}
                    hitSlop={6}
                    accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`}>
                    <IconSymbol
                      name={filled ? 'star.fill' : 'star'}
                      size={30}
                      color={filled ? accent : border}
                    />
                  </Pressable>
                );
              })}
            </View>

            <ThemedText type="defaultSemiBold" style={[styles.modalSectionLabel, { color: border }]}>
              ADD TO MENU
            </ThemedText>
            <View style={styles.menuPickerList}>
              {Array.from({ length: rowCount }, (_, menuIndex) => {
                const queued = isQueuedInMenu(recipe.id, menuIndex);
                return (
                  <Pressable
                    key={menuIndex}
                    onPress={() =>
                      queued ? removeRecipeFromMenu(recipe.id, menuIndex) : addRecipeToMenu(recipe.id, menuIndex)
                    }
                    style={styles.menuPickerRow}>
                    <IconSymbol
                      name={queued ? 'checkmark.circle.fill' : 'circle'}
                      size={20}
                      color={queued ? accent : border}
                    />
                    <ThemedText style={queued ? { color: accent, fontWeight: '600' } : undefined}>
                      {menuLabel(menuIndex)}
                    </ThemedText>
                  </Pressable>
                );
              })}
              <Pressable onPress={() => addRecipeToNewMenu(recipe.id)} style={styles.menuPickerRow}>
                <IconSymbol name="plus.circle" size={20} color={accent} />
                <ThemedText style={{ color: accent, fontWeight: '600' }}>New Menu</ThemedText>
              </Pressable>
            </View>

            <Pressable onPress={onClose} style={[styles.modalDoneButton, { backgroundColor: accent }]}>
              <ThemedText style={styles.modalDoneButtonText}>Done</ThemedText>
            </Pressable>
          </ThemedView>
        ) : null}
      </View>
    </Modal>
  );
}

export default function UserProfileScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const { user: me } = useAuth();
  const profile = useUserProfile(uid);
  const recipes = useUserRecipes(uid);
  const { isFollowing, follow, unfollow } = useFollow();
  const border = useThemeColor({}, 'icon');
  const accent = useThemeColor({}, 'accent');

  const [busy, setBusy] = useState(false);
  const [quickSaveRecipe, setQuickSaveRecipe] = useState<Recipe | null>(null);

  const isMe = uid === me?.uid;
  const following = isFollowing(uid ?? '');

  const handleToggleFollow = async () => {
    setBusy(true);
    try {
      await (following ? unfollow(uid) : follow(uid));
    } catch (err) {
      console.error('Failed to toggle follow', err);
    } finally {
      setBusy(false);
    }
  };

  if (profile === undefined || recipes === undefined) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (profile === null) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>Profile not found.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ title: profile.displayName }} />
      <View style={styles.profileHeader}>
        {profile.photoUri ? (
          <Image source={{ uri: profile.photoUri }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder, { borderColor: border }]}>
            <IconSymbol name="person.crop.circle" size={32} color={border} />
          </View>
        )}
        <View style={styles.profileHeaderText}>
          <ThemedText type="title" numberOfLines={1}>
            {profile.displayName}
          </ThemedText>
          <ThemedText style={{ color: border }}>
            {recipes.length} recipe{recipes.length === 1 ? '' : 's'}
          </ThemedText>
        </View>
        {isMe ? null : (
          <Pressable
            onPress={handleToggleFollow}
            disabled={busy}
            style={[
              styles.followButton,
              following
                ? { borderColor: border }
                : { backgroundColor: accent, borderColor: accent },
              { opacity: busy ? 0.6 : 1 },
            ]}>
            {busy ? (
              <ActivityIndicator color={following ? border : '#fff'} />
            ) : (
              <ThemedText style={{ color: following ? border : '#fff', fontWeight: '600' }}>
                {following ? 'Following' : 'Follow'}
              </ThemedText>
            )}
          </Pressable>
        )}
      </View>

      {recipes.length === 0 ? (
        <ThemedView style={styles.centered}>
          <IconSymbol name="fork.knife" size={40} color={border} />
          <ThemedText style={[styles.emptyBody, { color: border }]}>
            {isMe ? "You haven't saved any recipes yet." : "No recipes here yet."}
          </ThemedText>
        </ThemedView>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <RecipeRow recipe={item} onQuickSave={isMe ? undefined : () => setQuickSaveRecipe(item)} />
          )}
        />
      )}

      <QuickSaveModal recipe={quickSaveRecipe} onClose={() => setQuickSaveRecipe(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  saveButton: {
    padding: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    gap: 6,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
    padding: 4,
  },
  modalTitle: {
    marginRight: 20,
    marginBottom: 8,
  },
  modalSectionLabel: {
    fontSize: 12,
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 2,
  },
  categoryChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontWeight: '600',
  },
  starRow: {
    flexDirection: 'row',
    gap: 10,
  },
  menuPickerList: {
    gap: 2,
  },
  menuPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  modalDoneButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  modalDoneButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 40,
  },
  emptyBody: {
    textAlign: 'center',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 20,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  profileHeaderText: {
    flex: 1,
    gap: 2,
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 92,
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
});
