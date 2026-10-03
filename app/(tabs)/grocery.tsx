import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useGrocery } from '@/context/grocery-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { db } from '@/lib/firebase';
import type { GroceryItem } from '@/types/grocery';
import { effectiveSection, GROCERY_SECTIONS } from '@/utils/grocery-sections';

type Row =
  | { rowType: 'header'; key: string; section: string; isCustom: boolean }
  | { rowType: 'empty-hint'; key: string }
  | { rowType: 'item'; key: string; item: GroceryItem };

// Only sections that already have an item (or are custom) get a header —
// a brand-new empty default section isn't a drag target until something's
// moved into it some other way, same as before this feature existed.
function buildRows(visibleSections: string[], groceryItems: GroceryItem[], customSections: string[]): Row[] {
  const rows: Row[] = [];
  for (const section of visibleSections) {
    const items = groceryItems
      .filter((item) => effectiveSection(item.text, item.sectionOverride) === section)
      .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
    rows.push({ rowType: 'header', key: `header:${section}`, section, isCustom: customSections.includes(section) });
    if (items.length === 0) {
      rows.push({ rowType: 'empty-hint', key: `empty:${section}` });
    }
    for (const item of items) {
      rows.push({ rowType: 'item', key: item.id, item });
    }
  }
  return rows;
}

function useUserEmail(uid: string | undefined) {
  const [email, setEmail] = useState<string | undefined>();
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, 'users', uid), (snapshot) => setEmail(snapshot.data()?.email));
  }, [uid]);
  // Force undefined when uid drops rather than resetting `email` state
  // directly in the effect — avoids a stale value flashing before the next
  // effect run, and a synchronous setState call outside a subscription
  // callback.
  return uid ? email : undefined;
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

function GroceryItemPreview({
  item,
  onClose,
  onRename,
}: {
  item: GroceryItem | null;
  onClose: () => void;
  onRename: (newText: string) => void;
}) {
  const border = useThemeColor({}, 'icon');
  const accent = useThemeColor({}, 'accent');
  const text = useThemeColor({}, 'text');
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState('');

  const startEditing = () => {
    setDraftText(item?.text ?? '');
    setEditing(true);
  };

  const handleSaveName = () => {
    onRename(draftText);
    setEditing(false);
  };

  const handleClose = () => {
    setEditing(false);
    onClose();
  };

  return (
    <Modal
      visible={item !== null}
      transparent
      animationType="fade"
      onRequestClose={handleClose}>
      <View style={styles.previewBackdrop}>
        <ThemedView style={[styles.previewCard, { borderColor: border }]}>
          <Pressable
            onPress={handleClose}
            hitSlop={8}
            accessibilityLabel="Close"
            style={styles.previewCloseButton}>
            <IconSymbol name="xmark" size={18} color={border} />
          </Pressable>

          {editing ? (
            <View style={styles.previewEditRow}>
              <TextInput
                value={draftText}
                onChangeText={setDraftText}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
                style={[styles.input, styles.previewEditInput, { color: text, borderColor: border }]}
              />
              <Pressable
                onPress={handleSaveName}
                hitSlop={8}
                accessibilityLabel="Save name"
                style={[styles.previewSaveButton, { backgroundColor: accent }]}>
                <IconSymbol name="checkmark" size={18} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={startEditing} style={styles.previewTitleRow} accessibilityLabel="Edit name">
              <ThemedText type="subtitle" style={styles.previewTitle}>
                {item?.text}
              </ThemedText>
              <IconSymbol name="pencil" size={16} color={border} />
            </Pressable>
          )}
          <ThemedText style={[styles.previewSubtitle, { color: border }]}>
            How much you need, by recipe
          </ThemedText>

          <View style={styles.previewList}>
            {item?.sources.map((source, index) => (
              <View key={index} style={styles.previewRow}>
                <IconSymbol name="fork.knife" size={16} color={accent} />
                <View style={styles.previewRowText}>
                  <ThemedText style={styles.previewOriginal}>{source.originalText}</ThemedText>
                  <ThemedText style={[styles.previewRecipe, { color: border }]}>
                    {source.recipeTitle ?? 'Added manually'}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

function SectionNameModal({
  visible,
  title,
  initialName,
  onClose,
  onSave,
}: {
  visible: boolean;
  title: string;
  initialName: string;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const border = useThemeColor({}, 'icon');
  const text = useThemeColor({}, 'text');
  const accent = useThemeColor({}, 'accent');
  const [draftName, setDraftName] = useState(initialName);

  const handleSave = () => {
    if (!draftName.trim()) return;
    onSave(draftName);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.previewBackdrop}>
        {visible ? (
          <ThemedView key={initialName} style={[styles.previewCard, { borderColor: border }]}>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityLabel="Close"
              style={styles.previewCloseButton}>
              <IconSymbol name="xmark" size={18} color={border} />
            </Pressable>
            <ThemedText type="subtitle" style={styles.previewTitle}>
              {title}
            </ThemedText>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              placeholder="e.g. Costco"
              placeholderTextColor={border}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSave}
              style={[styles.input, { color: text, borderColor: border, marginTop: 12 }]}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={onClose} style={styles.modalSecondaryButton}>
                <ThemedText style={{ color: accent }}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={!draftName.trim()}
                style={[
                  styles.modalPrimaryButton,
                  { backgroundColor: accent, opacity: draftName.trim() ? 1 : 0.5 },
                ]}>
                <ThemedText style={styles.modalPrimaryButtonText}>Save</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        ) : null}
      </View>
    </Modal>
  );
}

function DeleteSectionConfirm({
  visible,
  sectionName,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  sectionName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const border = useThemeColor({}, 'icon');
  const accent = useThemeColor({}, 'accent');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.previewBackdrop}>
        <ThemedView style={[styles.previewCard, { borderColor: border }]}>
          <ThemedText type="subtitle" style={styles.previewTitle}>
            Delete &quot;{sectionName}&quot;?
          </ThemedText>
          <ThemedText style={{ color: border, marginTop: 4 }}>
            Items in this section move back to their automatic category. Nothing is removed from
            your list.
          </ThemedText>
          <View style={styles.modalActions}>
            <Pressable onPress={onCancel} style={styles.modalSecondaryButton}>
              <ThemedText style={{ color: accent }}>Cancel</ThemedText>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={[styles.modalPrimaryButton, { backgroundColor: '#d64545' }]}>
              <ThemedText style={styles.modalPrimaryButtonText}>Delete</ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

function MoveItemModal({
  item,
  sections,
  onClose,
  onSelect,
}: {
  item: GroceryItem | null;
  sections: string[];
  onClose: () => void;
  onSelect: (section: string | undefined) => void;
}) {
  const border = useThemeColor({}, 'icon');
  const accent = useThemeColor({}, 'accent');
  const current = item ? effectiveSection(item.text, item.sectionOverride) : undefined;

  return (
    <Modal visible={item !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.previewBackdrop}>
        <ThemedView style={[styles.previewCard, { borderColor: border }]}>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close" style={styles.previewCloseButton}>
            <IconSymbol name="xmark" size={18} color={border} />
          </Pressable>
          <ThemedText type="subtitle" style={styles.previewTitle}>
            Move &quot;{item?.text}&quot;
          </ThemedText>
          <View style={styles.movePickerList}>
            {sections.map((section) => {
              const selected = section === current;
              return (
                <Pressable
                  key={section}
                  onPress={() => {
                    onSelect(section);
                    onClose();
                  }}
                  style={styles.movePickerRow}>
                  <IconSymbol
                    name={selected ? 'checkmark.circle.fill' : 'circle'}
                    size={20}
                    color={selected ? accent : border}
                  />
                  <ThemedText style={selected ? { color: accent, fontWeight: '600' } : undefined}>
                    {section}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          {item?.sectionOverride ? (
            <Pressable
              onPress={() => {
                onSelect(undefined);
                onClose();
              }}
              style={styles.moveResetButton}>
              <ThemedText style={{ color: accent }}>Use automatic category</ThemedText>
            </Pressable>
          ) : null}
        </ThemedView>
      </View>
    </Modal>
  );
}

function SectionHeaderRow({
  section,
  isCustom,
  onRename,
  onDelete,
}: {
  section: string;
  isCustom: boolean;
  onRename: () => void;
  onDelete: () => void;
}) {
  const border = useThemeColor({}, 'icon');

  return (
    <View style={styles.sectionLabelRow}>
      <ThemedText style={[styles.sectionLabel, { color: border }]}>{section.toUpperCase()}</ThemedText>
      {isCustom ? (
        <View style={styles.sectionLabelActions}>
          <Pressable onPress={onRename} hitSlop={8} accessibilityLabel={`Rename ${section} section`}>
            <IconSymbol name="pencil" size={14} color={border} />
          </Pressable>
          <Pressable onPress={onDelete} hitSlop={8} accessibilityLabel={`Delete ${section} section`}>
            <IconSymbol name="trash" size={14} color={border} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function DraggableGroceryRow({
  item,
  drag,
  isActive,
  onToggleChecked,
  onPreview,
  onMove,
  onRemove,
}: {
  item: GroceryItem;
  drag: () => void;
  isActive: boolean;
  onToggleChecked: () => void;
  onPreview: () => void;
  onMove: () => void;
  onRemove: () => void;
}) {
  const accent = useThemeColor({}, 'accent');
  const border = useThemeColor({}, 'icon');
  const recipeTitles = Array.from(
    new Set(item.sources.map((s) => s.recipeTitle).filter((title): title is string => Boolean(title)))
  );

  return (
    <ScaleDecorator>
      <View style={[styles.groceryRow, isActive && { opacity: 0.7 }]}>
        <Pressable
          onPressIn={drag}
          hitSlop={8}
          accessibilityLabel={`Drag ${item.text} to reorder or move it`}
          style={styles.dragHandle}>
          <IconSymbol name="line.3.horizontal" size={16} color={border} />
        </Pressable>
        <Pressable
          onPress={onToggleChecked}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityLabel={`Mark ${item.text} as ${item.checked ? 'not bought' : 'bought'}`}
          style={styles.groceryCheckbox}>
          <IconSymbol
            name={item.checked ? 'checkmark.circle.fill' : 'circle'}
            size={22}
            color={item.checked ? accent : border}
          />
        </Pressable>
        <Pressable
          onPress={onPreview}
          accessibilityRole="button"
          accessibilityLabel={`Preview ${item.text} details`}
          style={styles.groceryTextBlock}>
          <ThemedText style={item.checked ? styles.groceryTextChecked : undefined}>{item.text}</ThemedText>
          {recipeTitles.length > 0 ? (
            <ThemedText style={styles.groceryRecipeLabel}>{recipeTitles.join(', ')}</ThemedText>
          ) : null}
        </Pressable>
        <Pressable onPress={onMove} hitSlop={8} accessibilityLabel={`Move ${item.text} to another section`}>
          <IconSymbol name="folder" size={16} color={border} />
        </Pressable>
        <Pressable onPress={onRemove} hitSlop={8}>
          <IconSymbol name="xmark" size={16} color={border} />
        </Pressable>
      </View>
    </ScaleDecorator>
  );
}

export default function GroceryScreen() {
  const {
    groceryItems,
    toggleGroceryItemChecked,
    removeGroceryItem,
    addManualItem,
    clearCheckedItems,
    customSections,
    addGrocerySection,
    renameGrocerySection,
    removeGrocerySection,
    setGroceryItemSection,
    updateGroceryItemText,
    reorderGroceryItems,
  } = useGrocery();
  const text = useThemeColor({}, 'text');
  const border = useThemeColor({}, 'icon');
  const accent = useThemeColor({}, 'accent');

  const [manualItemText, setManualItemText] = useState('');
  const [previewItem, setPreviewItem] = useState<GroceryItem | null>(null);
  const [moveItem, setMoveItem] = useState<GroceryItem | null>(null);
  const [addingSection, setAddingSection] = useState(false);
  const [renamingSection, setRenamingSection] = useState<string | null>(null);
  const [deletingSection, setDeletingSection] = useState<string | null>(null);

  const handleAddManualItem = () => {
    if (!manualItemText.trim()) return;
    addManualItem(manualItemText);
    setManualItemText('');
  };

  const allSections = [...GROCERY_SECTIONS, ...customSections];
  const itemCountBySection = new Map<string, number>();
  for (const item of groceryItems) {
    const section = effectiveSection(item.text, item.sectionOverride);
    itemCountBySection.set(section, (itemCountBySection.get(section) ?? 0) + 1);
  }
  // Fixed default sections stay hidden while empty, same as before. Custom
  // sections always show — otherwise a newly-added one with nothing moved
  // into it yet would vanish, with no way to rename or delete it.
  const visibleSections = allSections.filter(
    (section) => (itemCountBySection.get(section) ?? 0) > 0 || customSections.includes(section)
  );
  const rows = groceryItems.length > 0 ? buildRows(visibleSections, groceryItems, customSections) : [];
  const checkedItems = groceryItems.filter((item) => item.checked);

  const handleDragEnd = ({ data }: { data: Row[] }) => {
    let currentSection = visibleSections[0] ?? GROCERY_SECTIONS[0];
    let orderInSection = 0;
    const updates: { id: string; section: string; order: number }[] = [];
    for (const row of data) {
      if (row.rowType === 'header') {
        currentSection = row.section;
        orderInSection = 0;
      } else if (row.rowType === 'item') {
        updates.push({ id: row.item.id, section: currentSection, order: orderInSection });
        orderInSection += 1;
      }
    }
    reorderGroceryItems(updates);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <DraggableFlatList
        data={rows}
        keyExtractor={(row) => row.key}
        onDragEnd={handleDragEnd}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <InviteBanner />
            <View style={styles.listHeaderBlock}>
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

              {rows.length === 0 ? (
                <ThemedText style={styles.emptyHint}>
                  Tap ingredients on a recipe, or add an item above.
                </ThemedText>
              ) : null}
            </View>
          </>
        }
        renderItem={({ item: row, drag, isActive }: RenderItemParams<Row>) => {
          if (row.rowType === 'header') {
            return (
              <SectionHeaderRow
                section={row.section}
                isCustom={row.isCustom}
                onRename={() => setRenamingSection(row.section)}
                onDelete={() => setDeletingSection(row.section)}
              />
            );
          }
          if (row.rowType === 'empty-hint') {
            return (
              <ThemedText style={[styles.sectionEmptyHint, { color: border }]}>
                No items yet — move one here with the folder icon, or drag one in.
              </ThemedText>
            );
          }
          return (
            <DraggableGroceryRow
              item={row.item}
              drag={drag}
              isActive={isActive}
              onToggleChecked={() => toggleGroceryItemChecked(row.item.id)}
              onPreview={() => setPreviewItem(row.item)}
              onMove={() => setMoveItem(row.item)}
              onRemove={() => removeGroceryItem(row.item.id)}
            />
          );
        }}
        ListFooterComponent={
          <View style={styles.listFooterBlock}>
            <Pressable onPress={() => setAddingSection(true)} style={styles.addSectionButton}>
              <IconSymbol name="plus" size={16} color={accent} />
              <ThemedText style={{ color: accent }}>Add Section</ThemedText>
            </Pressable>
            <SharingSection />
          </View>
        }
      />

      <GroceryItemPreview
        item={previewItem}
        onClose={() => setPreviewItem(null)}
        onRename={(newText) => previewItem && updateGroceryItemText(previewItem.id, newText)}
      />
      <MoveItemModal
        item={moveItem}
        sections={allSections}
        onClose={() => setMoveItem(null)}
        onSelect={(section) => moveItem && setGroceryItemSection(moveItem.id, section)}
      />
      <SectionNameModal
        visible={addingSection}
        title="Add Section"
        initialName=""
        onClose={() => setAddingSection(false)}
        onSave={addGrocerySection}
      />
      <SectionNameModal
        visible={renamingSection !== null}
        title={`Rename ${renamingSection ?? ''}`}
        initialName={renamingSection ?? ''}
        onClose={() => setRenamingSection(null)}
        onSave={(newName) => renamingSection && renameGrocerySection(renamingSection, newName)}
      />
      <DeleteSectionConfirm
        visible={deletingSection !== null}
        sectionName={deletingSection ?? ''}
        onCancel={() => setDeletingSection(null)}
        onConfirm={() => {
          if (deletingSection) removeGrocerySection(deletingSection);
          setDeletingSection(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  section: {
    gap: 12,
  },
  listHeaderBlock: {
    gap: 12,
    marginBottom: 16,
  },
  listFooterBlock: {
    gap: 12,
    marginTop: 16,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emptyHint: {
    opacity: 0.6,
  },
  dragHandle: {
    padding: 2,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionLabelActions: {
    flexDirection: 'row',
    gap: 14,
  },
  sectionEmptyHint: {
    fontSize: 13,
    opacity: 0.6,
    paddingVertical: 4,
  },
  addSectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  groceryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 6,
  },
  groceryCheckbox: {
    padding: 2,
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
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  previewCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    gap: 4,
  },
  previewCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
    padding: 4,
  },
  previewTitle: {
    marginRight: 20,
  },
  previewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 20,
  },
  previewEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 20,
  },
  previewEditInput: {
    flex: 1,
  },
  previewSaveButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewSubtitle: {
    fontSize: 13,
    marginBottom: 12,
    marginTop: 4,
  },
  previewList: {
    gap: 14,
  },
  previewRow: {
    flexDirection: 'row',
    gap: 10,
  },
  previewRowText: {
    flex: 1,
    gap: 2,
  },
  previewOriginal: {
    fontSize: 16,
    fontWeight: '600',
  },
  previewRecipe: {
    fontSize: 13,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 16,
  },
  modalSecondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 8,
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
  movePickerList: {
    gap: 2,
    marginTop: 12,
  },
  movePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  moveResetButton: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: 8,
  },
});
