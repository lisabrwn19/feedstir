import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth-context';
import { useDiscoveredRecipeDoc } from '@/context/discovered-recipes';
import { useRecipeDoc, useRecipes } from '@/context/recipes-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { DiscoveredRecipe } from '@/types/discovered-recipe';
import type { Recipe } from '@/types/recipe';
import { categoryEmoji, DEFAULT_CATEGORIES } from '@/utils/categories';
import { inferCategories } from '@/utils/categorize';
import { fetchAndParseRecipe, type AggregateRating } from '@/utils/parse-recipe';
import { isLocalPhotoUri, uploadRecipePhoto } from '@/utils/upload-photo';

function useFieldColors() {
  const text = useThemeColor({}, 'text');
  const border = useThemeColor({}, 'icon');
  const placeholder = useThemeColor({}, 'icon');
  return { text, border, placeholder };
}

function FieldLabel({ children }: { children: string }) {
  return (
    <ThemedText type="defaultSemiBold" style={styles.label}>
      {children}
    </ThemedText>
  );
}

function ListEditor({
  label,
  placeholder,
  items,
  onChange,
}: {
  label: string;
  placeholder: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const { text, border, placeholder: placeholderColor } = useFieldColors();

  const updateAt = (index: number, value: string) => {
    const next = [...items];
    next[index] = value;
    onChange(next);
  };

  const removeAt = (index: number) => {
    if (items.length === 1) {
      onChange(['']);
      return;
    }
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      {items.map((item, index) => (
        <View key={index} style={styles.listRow}>
          <ThemedText style={styles.listIndex}>{index + 1}</ThemedText>
          <TextInput
            value={item}
            onChangeText={(value) => updateAt(index, value)}
            placeholder={placeholder}
            placeholderTextColor={placeholderColor}
            style={[styles.input, styles.listInput, { color: text, borderColor: border }]}
            multiline
          />
          <Pressable onPress={() => removeAt(index)} hitSlop={8} style={styles.removeButton}>
            <IconSymbol name="xmark" size={16} color={border} />
          </Pressable>
        </View>
      ))}
      <Pressable onPress={() => onChange([...items, ''])} style={styles.addRowButton}>
        <IconSymbol name="plus" size={16} color={border} />
        <ThemedText style={{ color: border }}>Add {label.toLowerCase().slice(0, -1)}</ThemedText>
      </Pressable>
    </View>
  );
}

function CategoryPicker({
  selected,
  onChange,
  autoSorted,
}: {
  selected: string[];
  onChange: (categories: string[]) => void;
  autoSorted?: boolean;
}) {
  const { text, border, placeholder } = useFieldColors();
  const accent = useThemeColor({}, 'accent');
  const [draft, setDraft] = useState('');

  // Show every default chip plus any already-selected custom ones, so a
  // category picked on another recipe (or added here) doesn't disappear.
  const allChips = [...DEFAULT_CATEGORIES, ...selected.filter((c) => !DEFAULT_CATEGORIES.includes(c))];

  const toggle = (category: string) => {
    onChange(
      selected.includes(category) ? selected.filter((c) => c !== category) : [...selected, category]
    );
  };

  const addCustom = () => {
    const trimmed = draft.trim();
    if (!trimmed || selected.includes(trimmed)) return;
    onChange([...selected, trimmed]);
    setDraft('');
  };

  return (
    <View style={styles.field}>
      <FieldLabel>Categories</FieldLabel>
      {autoSorted ? (
        <ThemedText style={[styles.categoryHint, { color: border }]}>
          Auto-sorted from your recipe — tap to adjust.
        </ThemedText>
      ) : null}
      <View style={styles.categoryChipRow}>
        {allChips.map((category) => {
          const active = selected.includes(category);
          return (
            <Pressable
              key={category}
              onPress={() => toggle(category)}
              style={[
                styles.categoryChip,
                { borderColor: accent },
                active && { backgroundColor: accent },
              ]}>
              <ThemedText style={[styles.categoryChipText, { color: active ? '#fff' : accent }]}>
                {categoryEmoji(category)} {category}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.importRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a custom category"
          placeholderTextColor={placeholder}
          onSubmitEditing={addCustom}
          returnKeyType="done"
          style={[styles.input, styles.importInput, { color: text, borderColor: border }]}
        />
        <Pressable
          onPress={addCustom}
          disabled={!draft.trim()}
          style={[styles.importButton, { backgroundColor: accent, opacity: draft.trim() ? 1 : 0.5 }]}>
          <IconSymbol name="plus" size={20} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

export default function NewRecipeScreen() {
  const { id, discoverId } = useLocalSearchParams<{ id?: string; discoverId?: string }>();
  const isEditing = !!id;
  const { user } = useAuth();
  const existingRecipe = useRecipeDoc(id);
  const discovered = useDiscoveredRecipeDoc(isEditing ? undefined : discoverId);

  if (isEditing && existingRecipe === undefined) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>Loading…</ThemedText>
      </ThemedView>
    );
  }
  if (isEditing && (existingRecipe === null || existingRecipe?.ownerId !== user?.uid)) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>Recipe not found.</ThemedText>
      </ThemedView>
    );
  }
  if (!isEditing && discoverId && discovered === undefined) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>Loading…</ThemedText>
      </ThemedView>
    );
  }
  if (!isEditing && discoverId && discovered === null) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>Recipe not found.</ThemedText>
      </ThemedView>
    );
  }

  // Keyed by recipe/discovered id so switching between them remounts the
  // form with fresh initial state pulled directly from props, instead of
  // needing an effect to re-sync form fields after the id changes.
  return (
    <RecipeForm
      key={isEditing ? existingRecipe?.id : discoverId ? `discover-${discovered?.id}` : 'new'}
      isEditing={isEditing}
      id={id}
      existingRecipe={isEditing ? (existingRecipe ?? undefined) : undefined}
      initialDiscovered={isEditing ? undefined : (discovered ?? undefined)}
    />
  );
}

function RecipeForm({
  isEditing,
  id,
  existingRecipe,
  initialDiscovered,
}: {
  isEditing: boolean;
  id: string | undefined;
  existingRecipe: Recipe | undefined;
  initialDiscovered: DiscoveredRecipe | undefined;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { addRecipe, updateRecipe } = useRecipes();
  const { text, border, placeholder } = useFieldColors();
  const background = useThemeColor({}, 'background');
  const accent = useThemeColor({}, 'accent');

  const keyboard = useAnimatedKeyboard();
  const footerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -keyboard.height.value }],
  }));

  // A discovered recipe seeds the same fields an edit or a manual URL
  // import would — existingRecipe and initialDiscovered are mutually
  // exclusive (discovery only ever starts a brand-new, non-editing form).
  const seed = existingRecipe ?? initialDiscovered;

  const [title, setTitle] = useState(seed?.title ?? '');
  const [photoUri, setPhotoUri] = useState<string | undefined>(seed?.photoUri);
  const [servings, setServings] = useState(seed?.servings ? String(seed.servings) : '');
  const [prepTime, setPrepTime] = useState(seed?.prepTimeMinutes ? String(seed.prepTimeMinutes) : '');
  const [cookTime, setCookTime] = useState(seed?.cookTimeMinutes ? String(seed.cookTimeMinutes) : '');
  const [sourceUrl, setSourceUrl] = useState(
    existingRecipe?.sourceUrl ?? initialDiscovered?.sourceUrl ?? ''
  );
  const [sourceRating, setSourceRating] = useState<AggregateRating | undefined>(
    existingRecipe?.sourceRating
  );
  const [ingredients, setIngredients] = useState(seed?.ingredients.length ? seed.ingredients : ['']);
  const [instructions, setInstructions] = useState(
    seed?.instructions.length ? seed.instructions : ['']
  );
  // `undefined` means "not yet touched by the user" — categories are derived
  // live from the title/ingredients below instead. Editing an existing
  // recipe starts already-touched, so auto-sorting never overrides
  // categories someone already set. Once the user interacts with the
  // picker, their explicit choice (even `[]`) takes over for good.
  const [manualCategories, setManualCategories] = useState<string[] | undefined>(
    existingRecipe ? (existingRecipe.categories ?? []) : undefined
  );
  const categories = manualCategories ?? inferCategories({ title, ingredients });
  const autoSorted = manualCategories === undefined && categories.length > 0;

  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | undefined>();
  const [importNotice, setImportNotice] = useState<string | undefined>();

  const handleImport = async () => {
    const trimmedUrl = importUrl.trim();
    if (!trimmedUrl) return;

    setImporting(true);
    setImportError(undefined);
    setImportNotice(undefined);

    try {
      const result = await fetchAndParseRecipe(trimmedUrl);
      if (!result) {
        setImportError("Couldn't read a recipe from that link. Try entering it manually.");
        return;
      }

      const { recipe, matched } = result;
      if (recipe.title) setTitle(recipe.title);
      if (recipe.ingredients.length) setIngredients(recipe.ingredients);
      if (recipe.instructions.length) setInstructions(recipe.instructions);
      if (recipe.photoUri) setPhotoUri(recipe.photoUri);
      if (recipe.servings) setServings(String(recipe.servings));
      if (recipe.prepTimeMinutes) setPrepTime(String(recipe.prepTimeMinutes));
      if (recipe.cookTimeMinutes) setCookTime(String(recipe.cookTimeMinutes));
      setSourceUrl(trimmedUrl);
      setSourceRating(recipe.aggregateRating);

      if (!matched) {
        setImportNotice("Found the page but not the full recipe — check the details below.");
      }
    } catch {
      setImportError("Couldn't reach that link. Check your connection and try again.");
    } finally {
      setImporting(false);
    }
  };

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to add a recipe photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const [saveStatus, setSaveStatus] = useState<'idle' | 'uploading' | 'saving'>('idle');
  const saving = saveStatus !== 'idle';

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    const cleanIngredients = ingredients.map((i) => i.trim()).filter(Boolean);
    const cleanInstructions = instructions.map((i) => i.trim()).filter(Boolean);

    if (!trimmedTitle) {
      Alert.alert('Title required', 'Give your recipe a title.');
      return;
    }
    if (cleanIngredients.length === 0) {
      Alert.alert('Ingredients required', 'Add at least one ingredient.');
      return;
    }
    if (cleanInstructions.length === 0) {
      Alert.alert('Instructions required', 'Add at least one instruction step.');
      return;
    }
    if (!user) {
      Alert.alert('Not signed in', 'Sign in to save a recipe.');
      return;
    }

    const parsedServings = parseInt(servings, 10);
    const parsedPrepTime = parseInt(prepTime, 10);
    const parsedCookTime = parseInt(cookTime, 10);

    try {
      let finalPhotoUri = photoUri;
      if (photoUri && isLocalPhotoUri(photoUri)) {
        setSaveStatus('uploading');
        finalPhotoUri = await uploadRecipePhoto(photoUri, user.uid);
      }

      setSaveStatus('saving');
      const payload = {
        title: trimmedTitle,
        ingredients: cleanIngredients,
        instructions: cleanInstructions,
        photoUri: finalPhotoUri,
        servings: Number.isFinite(parsedServings) ? parsedServings : undefined,
        prepTimeMinutes: Number.isFinite(parsedPrepTime) ? parsedPrepTime : undefined,
        cookTimeMinutes: Number.isFinite(parsedCookTime) ? parsedCookTime : undefined,
        sourceUrl: sourceUrl.trim() || undefined,
        sourceRating,
        categories,
      };
      if (isEditing && id) {
        await updateRecipe(id, payload);
      } else {
        await addRecipe(payload);
      }
      router.back();
    } catch (err) {
      console.error('Failed to save recipe:', err);
      Alert.alert('Could not save', 'Something went wrong saving your recipe. Try again.');
    } finally {
      setSaveStatus('idle');
    }
  };

  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          title: isEditing ? 'Edit Recipe' : initialDiscovered ? 'Save Recipe' : 'New Recipe',
        }}
      />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        {isEditing || initialDiscovered ? null : (
          <View style={styles.field}>
            <FieldLabel>Import from a link</FieldLabel>
            <View style={styles.importRow}>
              <TextInput
                value={importUrl}
                onChangeText={setImportUrl}
                placeholder="Paste a recipe URL"
                placeholderTextColor={placeholder}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, styles.importInput, { color: text, borderColor: border }]}
              />
              <Pressable
                onPress={handleImport}
                disabled={importing || !importUrl.trim()}
                style={[
                  styles.importButton,
                  { backgroundColor: accent, opacity: importing || !importUrl.trim() ? 0.5 : 1 },
                ]}>
                {importing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText style={styles.importButtonText}>Fetch</ThemedText>
                )}
              </Pressable>
            </View>
            {importError ? <ThemedText style={styles.importError}>{importError}</ThemedText> : null}
            {importNotice ? (
              <ThemedText style={{ color: border }}>{importNotice}</ThemedText>
            ) : null}
          </View>
        )}

        <View style={styles.field}>
          <FieldLabel>Title</FieldLabel>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Grandma's lasagna"
            placeholderTextColor={placeholder}
            style={[styles.input, { color: text, borderColor: border }]}
          />
        </View>

        <View style={styles.field}>
          <FieldLabel>Photo</FieldLabel>
          {photoUri ? (
            <Pressable onPress={pickPhoto}>
              <Image source={{ uri: photoUri }} style={styles.photo} />
            </Pressable>
          ) : (
            <Pressable
              onPress={pickPhoto}
              style={[styles.photoPlaceholder, { borderColor: border }]}>
              <IconSymbol name="photo.fill" size={28} color={border} />
              <ThemedText style={{ color: border }}>Add a photo</ThemedText>
            </Pressable>
          )}
        </View>

        <View style={styles.row}>
          <View style={[styles.field, styles.flexItem]}>
            <FieldLabel>Servings</FieldLabel>
            <TextInput
              value={servings}
              onChangeText={setServings}
              placeholder="4"
              placeholderTextColor={placeholder}
              keyboardType="number-pad"
              style={[styles.input, { color: text, borderColor: border }]}
            />
          </View>
          <View style={[styles.field, styles.flexItem]}>
            <FieldLabel>Prep (min)</FieldLabel>
            <TextInput
              value={prepTime}
              onChangeText={setPrepTime}
              placeholder="15"
              placeholderTextColor={placeholder}
              keyboardType="number-pad"
              style={[styles.input, { color: text, borderColor: border }]}
            />
          </View>
          <View style={[styles.field, styles.flexItem]}>
            <FieldLabel>Cook (min)</FieldLabel>
            <TextInput
              value={cookTime}
              onChangeText={setCookTime}
              placeholder="30"
              placeholderTextColor={placeholder}
              keyboardType="number-pad"
              style={[styles.input, { color: text, borderColor: border }]}
            />
          </View>
        </View>

        <View style={styles.field}>
          <FieldLabel>Source URL</FieldLabel>
          <TextInput
            value={sourceUrl}
            onChangeText={setSourceUrl}
            placeholder="https://..."
            placeholderTextColor={placeholder}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { color: text, borderColor: border }]}
          />
        </View>

        <CategoryPicker selected={categories} onChange={setManualCategories} autoSorted={autoSorted} />

        <ListEditor
          label="Ingredients"
          placeholder="e.g. 2 cups flour"
          items={ingredients}
          onChange={setIngredients}
        />

        <ListEditor
          label="Instructions"
          placeholder="Describe this step"
          items={instructions}
          onChange={setInstructions}
        />
      </ScrollView>

      <Animated.View
        style={[styles.footer, { borderTopColor: border, backgroundColor: background }, footerAnimatedStyle]}>
        <SafeAreaView edges={['bottom']}>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveButton, { backgroundColor: accent, opacity: saving ? 0.6 : 1 }]}>
            {saving ? (
              <View style={styles.savingRow}>
                <ActivityIndicator color="#fff" />
                <ThemedText style={styles.saveButtonText}>
                  {saveStatus === 'uploading' ? 'Uploading photo…' : 'Saving…'}
                </ThemedText>
              </View>
            ) : (
              <ThemedText style={styles.saveButtonText}>
                {isEditing ? 'Save Changes' : 'Save Recipe'}
              </ThemedText>
            )}
          </Pressable>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
    gap: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flexItem: {
    flex: 1,
  },
  field: {
    gap: 8,
  },
  label: {
    marginBottom: 2,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  importRow: {
    flexDirection: 'row',
    gap: 8,
  },
  importInput: {
    flex: 1,
  },
  importButton: {
    borderRadius: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  importError: {
    color: '#d64545',
  },
  categoryChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  categoryChipText: {
    fontWeight: '600',
  },
  categoryHint: {
    fontSize: 13,
    marginTop: -4,
  },
  photo: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
  photoPlaceholder: {
    height: 120,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  listIndex: {
    width: 20,
    marginTop: 12,
    opacity: 0.6,
  },
  listInput: {
    flex: 1,
  },
  removeButton: {
    padding: 10,
  },
  addRowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
