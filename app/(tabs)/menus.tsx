import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MonthCalendar } from '@/components/month-calendar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useGrocery } from '@/context/grocery-context';
import { useRecipeDoc } from '@/context/recipes-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { Menu } from '@/types/grocery';
import { formatDateRangeLabel, isDateInRange, parseISODate, startOfMonth } from '@/utils/calendar';
import { menuDisplayName, menuLabel } from '@/utils/menu-labels';

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

function MenuSection({
  menuIndex,
  name,
  recipeIds,
  startDate,
  endDate,
  onEditName,
  onEditDates,
  onStartNextMenu,
  onDelete,
}: {
  menuIndex: number;
  name: string | undefined;
  recipeIds: string[];
  startDate: string | undefined;
  endDate: string | undefined;
  onEditName: () => void;
  onEditDates: () => void;
  onStartNextMenu?: () => void;
  onDelete: () => void;
}) {
  const accent = useThemeColor({}, 'accent');
  const border = useThemeColor({}, 'icon');
  const dateLabel = formatDateRangeLabel(startDate, endDate);
  const displayName = menuDisplayName({ name }, menuIndex);

  return (
    <View style={styles.section}>
      <View style={styles.listHeaderRow}>
        <View style={styles.menuTitleRow}>
          <Pressable onPress={onEditName} hitSlop={6} style={styles.menuNameButton}>
            <ThemedText type="subtitle">{displayName}</ThemedText>
            <IconSymbol name="pencil" size={13} color={border} />
          </Pressable>
          <Pressable onPress={onEditDates} hitSlop={6} style={styles.menuDatesButton}>
            <IconSymbol name="calendar" size={13} color={border} />
            <ThemedText style={[styles.menuDatesText, { color: border }]}>
              {dateLabel ?? 'Set dates'}
            </ThemedText>
          </Pressable>
        </View>
        <View style={styles.menuHeaderActions}>
          {onStartNextMenu ? (
            <Pressable onPress={onStartNextMenu}>
              <ThemedText style={{ color: accent, fontSize: 13 }}>Start Next Menu →</ThemedText>
            </Pressable>
          ) : null}
          <Pressable onPress={onDelete} hitSlop={8} accessibilityLabel={`Delete ${displayName}`}>
            <IconSymbol name="trash" size={16} color={border} />
          </Pressable>
        </View>
      </View>
      {recipeIds.length === 0 ? (
        <ThemedText style={styles.emptyHint}>
          Open a recipe and tap &quot;{displayName}&quot; to queue it here.
        </ThemedText>
      ) : (
        <>
          <View style={styles.queuedList}>
            {recipeIds.map((recipeId) => (
              <QueuedRecipeCard key={recipeId} recipeId={recipeId} />
            ))}
          </View>
          <ThemedText style={styles.sectionHint}>Open a recipe to remove it from this menu.</ThemedText>
        </>
      )}
    </View>
  );
}

function DateRangePickerContent({
  menuIndex,
  menuName,
  initialStart,
  initialEnd,
  onClose,
  onSave,
}: {
  menuIndex: number;
  menuName: string | undefined;
  initialStart: string | undefined;
  initialEnd: string | undefined;
  onClose: () => void;
  onSave: (start: string | undefined, end: string | undefined) => void;
}) {
  const border = useThemeColor({}, 'icon');
  const accent = useThemeColor({}, 'accent');
  const [pendingStart, setPendingStart] = useState<string | undefined>(initialStart);
  const [pendingEnd, setPendingEnd] = useState<string | undefined>(initialEnd);
  const [monthCursor, setMonthCursor] = useState(() =>
    startOfMonth(initialStart ? parseISODate(initialStart) : new Date())
  );

  const handleDayPress = (iso: string) => {
    if (!pendingStart || pendingEnd) {
      // No selection yet, or a complete range already — start fresh.
      setPendingStart(iso);
      setPendingEnd(undefined);
    } else if (iso < pendingStart) {
      setPendingEnd(pendingStart);
      setPendingStart(iso);
    } else {
      setPendingEnd(iso);
    }
  };

  const handleSave = () => {
    onSave(pendingStart, pendingEnd);
    onClose();
  };

  return (
    <ThemedView style={[styles.modalCard, { borderColor: border }]}>
      <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close" style={styles.modalCloseButton}>
        <IconSymbol name="xmark" size={18} color={border} />
      </Pressable>
      <ThemedText type="subtitle" style={styles.modalTitle}>
        {menuDisplayName({ name: menuName }, menuIndex)} Dates
      </ThemedText>
      <ThemedText style={[styles.datePickerHint, { color: border }]}>
        {pendingStart
          ? formatDateRangeLabel(pendingStart, pendingEnd)
          : 'Optional — tap a day to start, tap again to set the end'}
      </ThemedText>
      <MonthCalendar
        monthCursor={monthCursor}
        onMonthChange={setMonthCursor}
        isHighlighted={(iso) => isDateInRange(iso, pendingStart, pendingEnd)}
        onDayPress={handleDayPress}
      />
      <View style={styles.modalActions}>
        <Pressable
          onPress={() => {
            setPendingStart(undefined);
            setPendingEnd(undefined);
          }}
          style={styles.modalSecondaryButton}>
          <ThemedText style={{ color: accent }}>Clear</ThemedText>
        </Pressable>
        <Pressable onPress={handleSave} style={[styles.modalPrimaryButton, { backgroundColor: accent }]}>
          <ThemedText style={styles.modalPrimaryButtonText}>Save</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

function DateRangePickerModal({
  visible,
  menuIndex,
  menuName,
  initialStart,
  initialEnd,
  onClose,
  onSave,
}: {
  visible: boolean;
  menuIndex: number;
  menuName: string | undefined;
  initialStart: string | undefined;
  initialEnd: string | undefined;
  onClose: () => void;
  onSave: (start: string | undefined, end: string | undefined) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        {visible ? (
          // Keyed by menu so opening it for a different menu starts from a
          // fresh, correctly-initialized draft instead of needing an effect
          // to re-sync state after the props change.
          <DateRangePickerContent
            key={menuIndex}
            menuIndex={menuIndex}
            menuName={menuName}
            initialStart={initialStart}
            initialEnd={initialEnd}
            onClose={onClose}
            onSave={onSave}
          />
        ) : null}
      </View>
    </Modal>
  );
}

function RenameMenuContent({
  menuIndex,
  initialName,
  onClose,
  onSave,
}: {
  menuIndex: number;
  initialName: string | undefined;
  onClose: () => void;
  onSave: (name: string | undefined) => void;
}) {
  const border = useThemeColor({}, 'icon');
  const text = useThemeColor({}, 'text');
  const accent = useThemeColor({}, 'accent');
  const [draftName, setDraftName] = useState(initialName ?? '');

  const handleSave = () => {
    onSave(draftName);
    onClose();
  };

  return (
    <ThemedView style={[styles.modalCard, { borderColor: border }]}>
      <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close" style={styles.modalCloseButton}>
        <IconSymbol name="xmark" size={18} color={border} />
      </Pressable>
      <ThemedText type="subtitle" style={styles.modalTitle}>
        Rename {menuLabel(menuIndex)}
      </ThemedText>
      <TextInput
        value={draftName}
        onChangeText={setDraftName}
        placeholder={menuLabel(menuIndex)}
        placeholderTextColor={border}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={handleSave}
        style={[styles.input, { color: text, borderColor: border }]}
      />
      <View style={styles.modalActions}>
        <Pressable onPress={() => setDraftName('')} style={styles.modalSecondaryButton}>
          <ThemedText style={{ color: accent }}>Clear</ThemedText>
        </Pressable>
        <Pressable onPress={handleSave} style={[styles.modalPrimaryButton, { backgroundColor: accent }]}>
          <ThemedText style={styles.modalPrimaryButtonText}>Save</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

function RenameMenuModal({
  visible,
  menuIndex,
  initialName,
  onClose,
  onSave,
}: {
  visible: boolean;
  menuIndex: number;
  initialName: string | undefined;
  onClose: () => void;
  onSave: (name: string | undefined) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        {visible ? (
          // Keyed by menu so opening it for a different menu starts from a
          // fresh, correctly-initialized draft instead of needing an effect
          // to re-sync state after the props change.
          <RenameMenuContent
            key={menuIndex}
            menuIndex={menuIndex}
            initialName={initialName}
            onClose={onClose}
            onSave={onSave}
          />
        ) : null}
      </View>
    </Modal>
  );
}

function DeleteMenuConfirm({
  visible,
  menuIndex,
  menuName,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  menuIndex: number;
  menuName: string | undefined;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const border = useThemeColor({}, 'icon');
  const accent = useThemeColor({}, 'accent');
  const displayName = menuDisplayName({ name: menuName }, menuIndex);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <ThemedView style={[styles.modalCard, { borderColor: border }]}>
          <ThemedText type="subtitle" style={styles.modalTitle}>
            Delete {displayName}?
          </ThemedText>
          <ThemedText style={{ color: border }}>
            This removes it from your list. Recipes stay in your library, and nothing on your
            grocery list is affected.
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

function CalendarView({
  menus,
  onSelectDatedMenu,
}: {
  menus: Menu[];
  onSelectDatedMenu: (menuIndex: number) => void;
}) {
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));

  const findMenuForDate = (iso: string) =>
    menus.findIndex((m) => isDateInRange(iso, m.startDate, m.endDate));

  return (
    <View style={styles.section}>
      <MonthCalendar
        monthCursor={monthCursor}
        onMonthChange={setMonthCursor}
        isHighlighted={(iso) => findMenuForDate(iso) !== -1}
        onDayPress={(iso) => {
          const menuIndex = findMenuForDate(iso);
          if (menuIndex !== -1) onSelectDatedMenu(menuIndex);
        }}
      />
      {menus.every((m) => !m.startDate) ? (
        <ThemedText style={styles.emptyHint}>
          No menus have dates yet — switch to List and tap a menu&apos;s date to set one.
        </ThemedText>
      ) : null}
    </View>
  );
}

export default function MenusScreen() {
  const { menus, startNextMenu, addNewMenu, deleteMenu, setMenuDates, setMenuName } = useGrocery();
  const border = useThemeColor({}, 'icon');
  const accent = useThemeColor({}, 'accent');

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [editingDatesMenu, setEditingDatesMenu] = useState<number | null>(null);
  const [editingNameMenu, setEditingNameMenu] = useState<number | null>(null);
  const [deletingMenu, setDeletingMenu] = useState<number | null>(null);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Menus</ThemedText>
      </ThemedView>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.viewModeRow, { borderColor: border }]}>
          <Pressable
            onPress={() => setViewMode('list')}
            style={[styles.viewModeButton, viewMode === 'list' && { backgroundColor: accent }]}>
            <IconSymbol name="list.bullet" size={15} color={viewMode === 'list' ? '#fff' : border} />
            <ThemedText style={{ color: viewMode === 'list' ? '#fff' : border, fontWeight: '600' }}>
              List
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setViewMode('calendar')}
            style={[styles.viewModeButton, viewMode === 'calendar' && { backgroundColor: accent }]}>
            <IconSymbol name="calendar" size={15} color={viewMode === 'calendar' ? '#fff' : border} />
            <ThemedText style={{ color: viewMode === 'calendar' ? '#fff' : border, fontWeight: '600' }}>
              Calendar
            </ThemedText>
          </Pressable>
        </View>

        {viewMode === 'calendar' ? (
          <CalendarView menus={menus} onSelectDatedMenu={() => setViewMode('list')} />
        ) : (
          <>
            {Array.from({ length: Math.max(menus.length, 1) }, (_, menuIndex) => (
              <MenuSection
                key={menuIndex}
                menuIndex={menuIndex}
                name={menus[menuIndex]?.name}
                recipeIds={menus[menuIndex]?.recipeIds ?? []}
                startDate={menus[menuIndex]?.startDate}
                endDate={menus[menuIndex]?.endDate}
                onEditName={() => setEditingNameMenu(menuIndex)}
                onEditDates={() => setEditingDatesMenu(menuIndex)}
                onStartNextMenu={menuIndex === 0 ? startNextMenu : undefined}
                onDelete={() => setDeletingMenu(menuIndex)}
              />
            ))}

            <Pressable onPress={addNewMenu} style={styles.addMenuButton}>
              <IconSymbol name="plus" size={16} color={border} />
              <ThemedText style={{ color: border }}>Plan Another Menu</ThemedText>
            </Pressable>
          </>
        )}
      </ScrollView>

      <DateRangePickerModal
        visible={editingDatesMenu !== null}
        menuIndex={editingDatesMenu ?? 0}
        menuName={editingDatesMenu !== null ? menus[editingDatesMenu]?.name : undefined}
        initialStart={editingDatesMenu !== null ? menus[editingDatesMenu]?.startDate : undefined}
        initialEnd={editingDatesMenu !== null ? menus[editingDatesMenu]?.endDate : undefined}
        onClose={() => setEditingDatesMenu(null)}
        onSave={(start, end) => {
          if (editingDatesMenu !== null) setMenuDates(editingDatesMenu, start, end);
        }}
      />
      <RenameMenuModal
        visible={editingNameMenu !== null}
        menuIndex={editingNameMenu ?? 0}
        initialName={editingNameMenu !== null ? menus[editingNameMenu]?.name : undefined}
        onClose={() => setEditingNameMenu(null)}
        onSave={(name) => {
          if (editingNameMenu !== null) setMenuName(editingNameMenu, name);
        }}
      />
      <DeleteMenuConfirm
        visible={deletingMenu !== null}
        menuIndex={deletingMenu ?? 0}
        menuName={deletingMenu !== null ? menus[deletingMenu]?.name : undefined}
        onCancel={() => setDeletingMenu(null)}
        onConfirm={() => {
          if (deletingMenu !== null) deleteMenu(deletingMenu);
          setDeletingMenu(null);
        }}
      />
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
  addMenuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
  },
  menuTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  menuNameButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  menuDatesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  menuDatesText: {
    fontSize: 12,
  },
  viewModeRow: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    gap: 3,
  },
  viewModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
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
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
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
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    gap: 16,
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
  datePickerHint: {
    fontSize: 13,
    marginTop: -10,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalPrimaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  modalPrimaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalSecondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
});
