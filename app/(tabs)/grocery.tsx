import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useGrocery } from '@/context/grocery-context';
import { useRecipeDoc } from '@/context/recipes-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { db } from '@/lib/firebase';
import { categorizeIngredient, GROCERY_SECTIONS } from '@/utils/grocery-sections';

function useUserEmail(uid: string | undefined) {
  const [email, setEmail] = useState<string | undefined>();
  useEffect(() => {
    if (!uid) {
      setEmail(undefined);
      return;
    }
    return onSnapshot(doc(db, 'users', uid), (snapshot) => setEmail(snapshot.data()?.email));
  }, [uid]);
  return email;
}

function QueuedRecipeCard({ recipeId }: { recipeId: string }) {
  const router = useRouter();
  const border = useThemeColor({}, 'icon');
  const recipe = useRecipeDoc(recipeId);

  if (!recipe) return null;

  return (
    <Pressable
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
    </Pressable>
  );
}

function CollaboratorRow({ uid }: { uid: string }) {
  const border = useThemeColor({}, 'icon');
  const email = useUserEmail(uid);
  return <ThemedText style={{ color: border }}>{email ?? uid}</ThemedText>;
}

function SharingSection() {
  const { isOwnList, activeListId, collaboratorIds, inviteCollaborator } = useGrocery();
  const text = useThemeColor({}, 'text');
  const border = useThemeColor({}, 'icon');
  const accent = useThemeColor({}, 'accent');
  const ownerEmail = useUserEmail(isOwnList ? undefined : activeListId);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  const handleInvite = async () => {
    const trimmed = inviteEmail.trim();
    if (!trimmed) return;
    setInviting(true);
    try {
      await inviteCollaborator(trimmed);
      setInviteEmail('');
      Alert.alert('Invite sent', `${trimmed} can accept it next time they sign in.`);
    } catch {
      Alert.alert('Could not send invite', 'Something went wrong. Try again.');
    } finally {
      setInviting(false);
    }
  };

  if (!isOwnList) {
    return (
      <View style={styles.section}>
        <ThemedText type="subtitle">Sharing</ThemedText>
        <ThemedText style={styles.emptyHint}>
          You&apos;re collaborating on {ownerEmail ?? "someone else's"} grocery list.
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <ThemedText type="subtitle">Sharing</ThemedText>
      {collaboratorIds.length > 0 ? (
        <View style={styles.collaboratorList}>
          {collaboratorIds.map((uid) => (
            <CollaboratorRow key={uid} uid={uid} />
          ))}
        </View>
      ) : (
        <ThemedText style={styles.emptyHint}>
          Invite someone to collaborate on this grocery list with you.
        </ThemedText>
      )}
      <View style={styles.importRow}>
        <TextInput
          value={inviteEmail}
          onChangeText={setInviteEmail}
          placeholder="Their email"
          placeholderTextColor={border}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, { color: text, borderColor: border }]}
        />
        <Pressable
          onPress={handleInvite}
          disabled={inviting || !inviteEmail.trim()}
          style={[
            styles.inviteButton,
            { backgroundColor: accent, opacity: inviting || !inviteEmail.trim() ? 0.5 : 1 },
          ]}>
          {inviting ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.inviteButtonText}>Invite</ThemedText>}
        </Pressable>
      </View>
    </View>
  );
}

function InviteBanner() {
  const { pendingInvite, acceptInvite, declineInvite } = useGrocery();
  const accent = useThemeColor({}, 'accent');
  const [responding, setResponding] = useState(false);

  if (!pendingInvite) return null;

  const respond = async (action: 'accept' | 'decline') => {
    setResponding(true);
    try {
      await (action === 'accept' ? acceptInvite() : declineInvite());
    } finally {
      setResponding(false);
    }
  };

  return (
    <ThemedView style={[styles.inviteBanner, { borderColor: accent }]}>
      <ThemedText>
        <ThemedText type="defaultSemiBold">{pendingInvite.listOwnerEmail}</ThemedText> invited you to
        collaborate on their grocery list.
      </ThemedText>
      <View style={styles.inviteBannerActions}>
        <Pressable onPress={() => respond('decline')} disabled={responding} style={styles.inviteBannerButton}>
          <ThemedText style={{ opacity: 0.7 }}>Decline</ThemedText>
        </Pressable>
        <Pressable
          onPress={() => respond('accept')}
          disabled={responding}
          style={[styles.inviteBannerButton, { backgroundColor: accent, borderRadius: 8 }]}>
          {responding ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={{ color: '#fff', fontWeight: '600' }}>Accept</ThemedText>
          )}
        </Pressable>
      </View>
    </ThemedView>
  );
}

export default function GroceryScreen() {
  const {
    queuedRecipeIds,
    groceryItems,
    toggleGroceryItemChecked,
    removeGroceryItem,
    addManualItem,
    clearCheckedItems,
  } = useGrocery();
  const text = useThemeColor({}, 'text');
  const border = useThemeColor({}, 'icon');
  const accent = useThemeColor({}, 'accent');

  const [manualItemText, setManualItemText] = useState('');

  const handleAddManualItem = () => {
    if (!manualItemText.trim()) return;
    addManualItem(manualItemText);
    setManualItemText('');
  };

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
        <InviteBanner />

        <View style={styles.section}>
          <ThemedText type="subtitle">Upcoming Menu</ThemedText>
          {queuedRecipeIds.length === 0 ? (
            <ThemedText style={styles.emptyHint}>
              Open a recipe and tap &quot;Add to Upcoming Menu&quot; to queue it here.
            </ThemedText>
          ) : (
            <>
              <View style={styles.queuedList}>
                {queuedRecipeIds.map((recipeId) => (
                  <QueuedRecipeCard key={recipeId} recipeId={recipeId} />
                ))}
              </View>
              <ThemedText style={styles.sectionHint}>
                Open a recipe to remove it from your Upcoming Menu.
              </ThemedText>
            </>
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

          <View style={styles.importRow}>
            <TextInput
              value={manualItemText}
              onChangeText={setManualItemText}
              placeholder="Add an item"
              placeholderTextColor={border}
              onSubmitEditing={handleAddManualItem}
              returnKeyType="done"
              style={[styles.input, { color: text, borderColor: border }]}
            />
            <Pressable
              onPress={handleAddManualItem}
              disabled={!manualItemText.trim()}
              style={[
                styles.inviteButton,
                { backgroundColor: accent, opacity: manualItemText.trim() ? 1 : 0.5 },
              ]}>
              <IconSymbol name="plus" size={20} color="#fff" />
            </Pressable>
          </View>

          {groupedSections.length === 0 ? (
            <ThemedText style={styles.emptyHint}>
              Tap ingredients on a recipe, or add an item above.
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
                        {item.recipeTitle ? (
                          <ThemedText style={styles.groceryRecipeLabel}>{item.recipeTitle}</ThemedText>
                        ) : null}
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

        <SharingSection />
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
  sectionHint: {
    fontSize: 13,
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
  collaboratorList: {
    gap: 4,
  },
  importRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  inviteButton: {
    borderRadius: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  inviteBanner: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  inviteBannerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  inviteBannerButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
});
