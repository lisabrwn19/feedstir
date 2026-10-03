import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth-context';
import { useCategoryEmojis } from '@/context/category-emojis';
import { useFavorites } from '@/context/favorites-context';
import { useFollow } from '@/context/follow-context';
import { useDiscoverRecipes, useRecipes } from '@/context/recipes-context';
import { useSavedRecipes } from '@/context/saved-recipes';
import { useUserProfile } from '@/context/user-profile';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { Recipe } from '@/types/recipe';
import { DEFAULT_CATEGORIES } from '@/utils/categories';

const DIFFICULTY_LABELS: Record<NonNullable<Recipe['difficulty']>, string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  hard: 'Hard',
};

// Deterministic pseudo-random ordering (no Math.random, so it stays pure to
// call during render) — the same (id, seed) pair always sorts the same way,
// but a new seed from the shuffle button scrambles the order differently.
function seededScore(id: string, seed: number): number {
  let hash = seed;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return hash;
}

function formatMeta(recipe: Recipe) {
  const parts: string[] = [];
  const totalTime = (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0);
  if (totalTime > 0) parts.push(`${totalTime} min`);
  if (recipe.rating !== undefined) parts.push(`${recipe.rating}/5 ★`);
  if (recipe.difficulty) parts.push(DIFFICULTY_LABELS[recipe.difficulty]);
  if (recipe.timesMade > 0) parts.push(`Made ${recipe.timesMade}×`);
  return parts.join(' · ');
}

function RecipeTile({ recipe, showOwner }: { recipe: Recipe; showOwner?: boolean }) {
  const router = useRouter();
  const borderColor = useThemeColor({}, 'icon');
  const meta = formatMeta(recipe);
  // Only subscribes when actually needed (Discover tiles) — "All Recipes"
  // and folder views are always the viewer's own, so no owner lookup there.
  const ownerProfile = useUserProfile(showOwner ? recipe.ownerId : undefined);

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } })}
      style={styles.tile}
    >
      <View>
        {recipe.photoUri ? (
          <Image source={{ uri: recipe.photoUri }} style={styles.tilePhoto} />
        ) : (
          <View style={[styles.tilePhoto, styles.tilePhotoPlaceholder, { borderColor }]}>
            <IconSymbol name="fork.knife" size={28} color={borderColor} />
          </View>
        )}
        {showOwner ? (
          ownerProfile?.photoUri ? (
            <Image source={{ uri: ownerProfile.photoUri }} style={styles.tileOwnerAvatar} />
          ) : (
            <View style={[styles.tileOwnerAvatar, styles.tileOwnerAvatarPlaceholder, { borderColor }]}>
              <IconSymbol name="person.crop.circle" size={14} color={borderColor} />
            </View>
          )
        ) : null}
      </View>
      <ThemedText type="defaultSemiBold" numberOfLines={2} style={styles.tileTitle}>
        {recipe.title}
      </ThemedText>
      {meta ? (
        <ThemedText numberOfLines={1} style={styles.tileMeta}>
          {meta}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

function FolderTile({
  emoji,
  color,
  label,
  count,
  onPress,
  onEditEmoji,
}: {
  emoji: string;
  color: string;
  label: string;
  count: number;
  onPress: () => void;
  onEditEmoji: () => void;
}) {
  const borderColor = useThemeColor({}, 'icon');
  const accentColor = useThemeColor({}, 'accent');

  return (
    <Pressable onPress={onPress} style={styles.tile}>
      <View style={[styles.folderTilePhoto, { borderColor }]}>
        <ThemedText style={[styles.folderTileEmoji, { color }]}>{emoji}</ThemedText>
        <Pressable
          onPress={onEditEmoji}
          hitSlop={8}
          accessibilityLabel={`Change ${label} emoji`}
          style={[styles.folderEditBadge, { backgroundColor: accentColor }]}
        >
          <IconSymbol name="pencil" size={11} color="#fff" />
        </Pressable>
      </View>
      <ThemedText type="defaultSemiBold" numberOfLines={1} style={styles.tileTitle}>
        {label}
      </ThemedText>
      <ThemedText numberOfLines={1} style={styles.tileMeta}>
        {count} recipe{count === 1 ? '' : 's'}
      </ThemedText>
    </Pressable>
  );
}

function EmojiEditModal({
  folderKey,
  currentEmoji,
  onClose,
  onSave,
  onReset,
}: {
  folderKey: string | null;
  currentEmoji: string;
  onClose: () => void;
  onSave: (emoji: string) => void;
  onReset: () => void;
}) {
  const border = useThemeColor({}, 'icon');
  const accent = useThemeColor({}, 'accent');
  const text = useThemeColor({}, 'text');
  const [draft, setDraft] = useState(currentEmoji);

  const handleSave = () => {
    if (!draft.trim()) return;
    onSave(draft.trim());
    onClose();
  };

  return (
    <Modal visible={folderKey !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        {folderKey !== null ? (
          <ThemedView key={folderKey} style={[styles.modalCard, { borderColor: border }]}>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityLabel="Close"
              style={styles.modalCloseButton}
            >
              <IconSymbol name="xmark" size={18} color={border} />
            </Pressable>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              Change {folderKey} emoji
            </ThemedText>
            <ThemedText style={[styles.modalHint, { color: border }]}>
              Tap the field and switch to your emoji keyboard.
            </ThemedText>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              autoFocus
              maxLength={8}
              returnKeyType="done"
              onSubmitEditing={handleSave}
              style={[styles.emojiInput, { color: text, borderColor: border }]}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  onReset();
                  onClose();
                }}
                style={styles.modalSecondaryButton}
              >
                <ThemedText style={{ color: accent }}>Reset to default</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={!draft.trim()}
                style={[
                  styles.modalPrimaryButton,
                  { backgroundColor: accent, opacity: draft.trim() ? 1 : 0.5 },
                ]}
              >
                <ThemedText style={styles.modalPrimaryButtonText}>Save</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        ) : null}
      </View>
    </Modal>
  );
}

function CarouselSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
  children: React.ReactNode;
}) {
  const accentColor = useThemeColor({}, 'accent');

  return (
    <View style={styles.carouselSection}>
      <View style={styles.carouselHeader}>
        <ThemedText type="subtitle">{title}</ThemedText>
        {action ? (
          <Pressable onPress={action.onPress} hitSlop={8} accessibilityLabel={action.label}>
            <IconSymbol name="arrow.triangle.2.circlepath" size={18} color={accentColor} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export default function RecipesScreen() {
  const { user } = useAuth();
  const { recipes } = useRecipes();
  const { followingIds } = useFollow();
  const { favoriteRecipeIds } = useFavorites();
  const { getEmoji, setCategoryEmoji, resetCategoryEmoji } = useCategoryEmojis();
  const { savedRecipes } = useSavedRecipes();
  const router = useRouter();
  const accentColor = useThemeColor({}, 'accent');
  const borderColor = useThemeColor({}, 'icon');

  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [editingEmojiFor, setEditingEmojiFor] = useState<string | null>(null);

  // Your own recipes + everyone you follow's, combined — shuffled so the
  // same handful don't always lead.
  const discoverPool = useDiscoverRecipes(user ? [user.uid, ...followingIds] : []);
  const discoverRecipes = [...(discoverPool ?? [])]
    .sort((a, b) => seededScore(a.id, shuffleSeed) - seededScore(b.id, shuffleSeed))
    .slice(0, 10);

  const categoryCounts = new Map<string, number>();
  for (const name of DEFAULT_CATEGORIES) categoryCounts.set(name, 0);
  for (const recipe of recipes) {
    for (const name of recipe.categories) {
      categoryCounts.set(name, (categoryCounts.get(name) ?? 0) + 1);
    }
  }
  // Folders also include recipes you don't own but saved into them.
  for (const meta of Object.values(savedRecipes)) {
    for (const name of meta.categories) {
      categoryCounts.set(name, (categoryCounts.get(name) ?? 0) + 1);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topActions}>
        <Pressable
          onPress={() => router.push('/recipe/discover')}
          hitSlop={8}
          style={styles.topActionButton}
        >
          <IconSymbol name="sparkles" size={22} color={accentColor} />
        </Pressable>
        <Pressable
          onPress={() => router.push('/recipe/new')}
          style={[styles.addButton, { backgroundColor: accentColor }]}
          hitSlop={8}
        >
          <IconSymbol name="plus" size={20} color="#fff" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.sectionsStack}>
          {discoverRecipes.length > 0 ? (
            <CarouselSection
              title="Discover"
              action={{
                label: 'Shuffle',
                onPress: () => setShuffleSeed((s) => s + 1),
              }}
            >
              <FlatList
                data={discoverRecipes}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tileRow}
                renderItem={({ item }) => <RecipeTile recipe={item} showOwner />}
              />
            </CarouselSection>
          ) : null}

          <CarouselSection title="Folders">
            <FlatList
              data={[{ key: 'favorites' }, ...[...categoryCounts].map(([name]) => ({ key: name }))]}
              keyExtractor={(item) => item.key}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tileRow}
              renderItem={({ item }) =>
                item.key === 'favorites' ? (
                  <FolderTile
                    emoji={getEmoji('Favorites')}
                    color="#d64545"
                    label="Favorites"
                    count={favoriteRecipeIds.length}
                    onPress={() => router.push('/recipe/favorites')}
                    onEditEmoji={() => setEditingEmojiFor('Favorites')}
                  />
                ) : (
                  <FolderTile
                    emoji={getEmoji(item.key)}
                    color={accentColor}
                    label={item.key}
                    count={categoryCounts.get(item.key) ?? 0}
                    onPress={() =>
                      router.push({
                        pathname: '/recipe/category/[name]',
                        params: { name: item.key },
                      })
                    }
                    onEditEmoji={() => setEditingEmojiFor(item.key)}
                  />
                )
              }
            />
          </CarouselSection>

          <CarouselSection title="All Recipes">
            {recipes.length === 0 ? (
              <View style={styles.emptyRow}>
                <IconSymbol name="fork.knife" size={32} color={borderColor} />
                <ThemedText style={[styles.emptyRowText, { color: borderColor }]}>
                  No recipes yet — save your first one.
                </ThemedText>
                <Pressable
                  onPress={() => router.push('/recipe/new')}
                  style={[styles.emptyButton, { backgroundColor: accentColor }]}
                >
                  <ThemedText style={styles.emptyButtonText}>Add your first recipe</ThemedText>
                </Pressable>
              </View>
            ) : (
              <FlatList
                data={recipes}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tileRow}
                renderItem={({ item }) => <RecipeTile recipe={item} />}
              />
            )}
          </CarouselSection>
        </View>
      </ScrollView>

      <EmojiEditModal
        folderKey={editingEmojiFor}
        currentEmoji={editingEmojiFor ? getEmoji(editingEmojiFor) : ''}
        onClose={() => setEditingEmojiFor(null)}
        onSave={(emoji) => editingEmojiFor && setCategoryEmoji(editingEmojiFor, emoji)}
        onReset={() => editingEmojiFor && resetCategoryEmoji(editingEmojiFor)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  topActionButton: {
    padding: 4,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingBottom: 24,
  },
  sectionsStack: {
    gap: 24,
  },
  carouselSection: {
    gap: 10,
  },
  carouselHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  tileRow: {
    gap: 12,
    paddingHorizontal: 20,
  },
  tile: {
    width: 130,
    gap: 6,
  },
  tilePhoto: {
    width: 130,
    height: 100,
    borderRadius: 10,
  },
  tilePhotoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  tileTitle: {
    fontSize: 14,
  },
  tileOwnerAvatar: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  tileOwnerAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  tileMeta: {
    fontSize: 12,
    opacity: 0.6,
  },
  folderTilePhoto: {
    width: 130,
    height: 100,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderTileEmoji: {
    fontSize: 36,
    // iOS clips large emoji glyphs to the font's nominal line height, which
    // is shorter than the glyph's actual rendered bounds — an explicit,
    // generous lineHeight stops the top/bottom from being cut off.
    lineHeight: 44,
  },
  folderEditBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
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
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    gap: 4,
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
  },
  modalHint: {
    fontSize: 13,
    marginBottom: 12,
  },
  emojiInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    fontSize: 36,
    lineHeight: 44,
    textAlign: 'center',
    paddingVertical: 12,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  modalSecondaryButton: {
    paddingVertical: 10,
  },
  modalPrimaryButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  modalPrimaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyRow: {
    marginHorizontal: 20,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  emptyRowText: {
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
