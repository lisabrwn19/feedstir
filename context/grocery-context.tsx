import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type QuerySnapshot,
} from 'firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import type { GroceryInvite, GroceryItem, GrocerySource, Menu } from '@/types/grocery';
import { subscribeWithRetry } from '@/utils/firestore-retry';
import { GROCERY_SECTIONS } from '@/utils/grocery-sections';
import { displayIngredientName, normalizeIngredientKey } from '@/utils/parse-ingredient';

type GroceryContextValue = {
  loading: boolean;
  /** uid of the grocery list currently in use — your own, or an owner's list you collaborate on. */
  activeListId: string | undefined;
  isOwnList: boolean;
  collaboratorIds: string[];

  /** Numbered menu slots — index 0 is the one you're actively cooking from. Not tied to weeks or any calendar cadence. */
  menus: Menu[];
  isQueuedInMenu: (recipeId: string, menuIndex: number) => boolean;
  /** Every menu index (in order) that currently includes this recipe. */
  menusContainingRecipe: (recipeId: string) => number[];
  addRecipeToMenu: (recipeId: string, menuIndex: number) => void;
  removeRecipeFromMenu: (recipeId: string, menuIndex: number) => void;
  /** Creates a new empty menu after the last one and queues this recipe into it, in one step. */
  addRecipeToNewMenu: (recipeId: string) => void;
  /** Creates a new empty menu after the last one, for planning ahead without a recipe yet. */
  addNewMenu: () => void;
  /** Shifts every menu down one slot (menu 2 becomes menu 1, etc.), dropping the old menu 1. */
  startNextMenu: () => void;
  /** Removes a menu entirely and renumbers the rest to stay contiguous. Doesn't touch the grocery list. */
  deleteMenu: (menuIndex: number) => void;
  /** Sets or clears a menu's optional calendar date range (YYYY-MM-DD). Pass undefined for either to clear it. */
  setMenuDates: (menuIndex: number, startDate: string | undefined, endDate: string | undefined) => void;
  /** Sets or clears a menu's optional custom name. Pass undefined (or blank) to fall back to its positional label. */
  setMenuName: (menuIndex: number, name: string | undefined) => void;

  /** User-added sections (e.g. "Costco"), beyond the fixed defaults in `GROCERY_SECTIONS`. */
  customSections: string[];
  addGrocerySection: (name: string) => void;
  renameGrocerySection: (oldName: string, newName: string) => void;
  /** Removing a section clears `sectionOverride` on any item that pointed at it, falling back to automatic categorization. */
  removeGrocerySection: (name: string) => void;

  groceryItems: GroceryItem[];
  isIngredientAdded: (recipeId: string, text: string) => boolean;
  toggleGroceryIngredient: (recipeId: string, recipeTitle: string, text: string) => void;
  toggleGroceryItemChecked: (id: string) => void;
  removeGroceryItem: (id: string) => void;
  removeItemsForRecipe: (recipeId: string) => void;
  addManualItem: (text: string) => void;
  clearCheckedItems: () => void;
  /** Pass undefined to clear the override and fall back to automatic categorization. */
  setGroceryItemSection: (id: string, section: string | undefined) => void;
  /** Renames an item's merged display name (what every source collapses into) — not a per-source edit. */
  updateGroceryItemText: (id: string, newText: string) => void;

  inviteCollaborator: (email: string) => Promise<void>;
  pendingInvite: GroceryInvite | undefined;
  acceptInvite: () => Promise<void>;
  declineInvite: () => Promise<void>;
};

const GroceryContext = createContext<GroceryContextValue | undefined>(undefined);

// Firestore rejects `undefined` array-element fields, so manual entries
// (no recipeId/recipeTitle) must omit those keys rather than set them.
function buildSource(
  recipeId: string | undefined,
  recipeTitle: string | undefined,
  originalText: string
): GrocerySource {
  const source: GrocerySource = { originalText };
  if (recipeId) source.recipeId = recipeId;
  if (recipeTitle) source.recipeTitle = recipeTitle;
  return source;
}

function sourcesEqual(a: GrocerySource, b: GrocerySource) {
  return a.recipeId === b.recipeId && a.originalText === b.originalText;
}

// `menus` is stored as a map keyed by index ("0", "1", ...) rather than a
// Firestore array, so each menu's `recipeIds` can be updated atomically with
// arrayUnion/arrayRemove without touching (or racing) any other menu.
function parseMenusMap(menusField: Record<string, unknown>): Menu[] {
  const indexes = Object.keys(menusField)
    .map((k) => parseInt(k, 10))
    .filter((n) => Number.isInteger(n) && n >= 0);
  if (indexes.length === 0) return [];
  const maxIndex = Math.max(...indexes);
  const result: Menu[] = [];
  for (let i = 0; i <= maxIndex; i++) {
    const entry = menusField[String(i)] as
      | { recipeIds?: unknown; name?: unknown; startDate?: unknown; endDate?: unknown }
      | undefined;
    result.push({
      recipeIds: Array.isArray(entry?.recipeIds) ? (entry.recipeIds as string[]) : [],
      name: typeof entry?.name === 'string' ? entry.name : undefined,
      startDate: typeof entry?.startDate === 'string' ? entry.startDate : undefined,
      endDate: typeof entry?.endDate === 'string' ? entry.endDate : undefined,
    });
  }
  return result;
}

function recipeInAnyMenu(menus: Menu[], recipeId: string, excludeIndex?: number) {
  return menus.some((m, i) => i !== excludeIndex && m.recipeIds.includes(recipeId));
}

// Only the recipe's owner can write this field — expected to fail with
// permission-denied when queuing a followed user's recipe onto your own
// list, since you already have read access to it via the follow relationship,
// not via this pointer. Swallowed rather than surfaced as an error.
function trySetQueuedOnListId(recipeId: string, listId: string | null | undefined) {
  updateDoc(doc(db, 'recipes', recipeId), { queuedOnListId: listId ?? null }).catch(() => {});
}

// Firestore rejects a literal `undefined` field value outright — parsed
// Menu objects always carry name/startDate/endDate keys (set to undefined
// when unset), so a wholesale re-write of one (e.g. shifting them during
// startNextMenu) must drop those keys rather than pass them through as-is.
function stripUndefinedMenuFields(menu: Menu): Menu {
  const clean: Menu = { recipeIds: menu.recipeIds };
  if (menu.name !== undefined) clean.name = menu.name;
  if (menu.startDate !== undefined) clean.startDate = menu.startDate;
  if (menu.endDate !== undefined) clean.endDate = menu.endDate;
  return clean;
}

function mapInvite(id: string, data: DocumentData): GroceryInvite {
  return {
    id,
    listOwnerId: data.listOwnerId,
    listOwnerEmail: data.listOwnerEmail ?? '',
    invitedEmail: data.invitedEmail,
    status: data.status ?? 'pending',
    createdAt: data.createdAt ?? 0,
  };
}


export function GroceryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const myUid = user?.uid;
  const myEmail = user?.email ?? undefined;

  // A user collaborates on at most one other list in this phase; if none,
  // they use their own.
  const [collaboratingListId, setCollaboratingListId] = useState<string | undefined>();
  const [listDoc, setListDoc] = useState<{ collaboratorIds: string[]; menus: Menu[]; sections: string[] }>({
    collaboratorIds: [],
    menus: [],
    sections: [],
  });
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [pendingInvite, setPendingInvite] = useState<GroceryInvite | undefined>();
  const [loading, setLoading] = useState(true);

  const activeListId = collaboratingListId ?? myUid;
  const isOwnList = activeListId === myUid;

  // Find a list where I'm a collaborator, if any.
  useEffect(() => {
    if (!myUid) {
      setCollaboratingListId(undefined);
      return;
    }
    const q = query(collection(db, 'groceryLists'), where('collaboratorIds', 'array-contains', myUid));
    return onSnapshot(
      q,
      (snapshot) => setCollaboratingListId(snapshot.empty ? undefined : snapshot.docs[0].id),
      (err) => console.error('Collaborating-list query error', err)
    );
  }, [myUid]);

  // Listen to the active list's doc + items.
  useEffect(() => {
    if (!activeListId) {
      setListDoc({ collaboratorIds: [], menus: [], sections: [] });
      setGroceryItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubList = subscribeWithRetry<DocumentSnapshot<DocumentData>>(
      (onNext, onError) => onSnapshot(doc(db, 'groceryLists', activeListId), onNext, onError),
      (snapshot) => {
        const data = snapshot.data();
        const menusField = data?.menus;
        let menus: Menu[];
        if (menusField && typeof menusField === 'object' && !Array.isArray(menusField)) {
          menus = parseMenusMap(menusField);
        } else {
          // Older data shapes, checked oldest-first so a doc only ever
          // migrates one step even if it's several versions behind: the
          // very first shape was a flat `queuedRecipeIds` array (always
          // "what's queued right now"), then a `weeks` map identical in
          // structure to today's `menus` map, just under the old name.
          // Migrating immediately means later writes to menu 0 don't
          // silently diverge from a field nothing reads anymore.
          const weeksField = data?.weeks;
          if (weeksField && typeof weeksField === 'object' && !Array.isArray(weeksField)) {
            menus = parseMenusMap(weeksField);
            setDoc(doc(db, 'groceryLists', activeListId), { menus: weeksField }, { merge: true });
          } else {
            const legacy = Array.isArray(data?.queuedRecipeIds) ? (data.queuedRecipeIds as string[]) : [];
            menus = legacy.length > 0 ? [{ recipeIds: legacy }] : [];
            if (legacy.length > 0) {
              setDoc(
                doc(db, 'groceryLists', activeListId),
                { menus: { '0': { recipeIds: legacy } } },
                { merge: true }
              );
            }
          }
        }
        setListDoc({
          collaboratorIds: data?.collaboratorIds ?? [],
          menus,
          sections: Array.isArray(data?.sections) ? (data.sections as string[]) : [],
        });
        setLoading(false);
      },
      (err) => console.error('Grocery list listener error', err)
    );
    const unsubItems = subscribeWithRetry<QuerySnapshot<DocumentData>>(
      (onNext, onError) =>
        onSnapshot(collection(db, 'groceryLists', activeListId, 'items'), onNext, onError),
      (snapshot) => {
        setGroceryItems(
          snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              text: data.text,
              checked: data.checked ?? false,
              sources: Array.isArray(data.sources) ? data.sources : [],
              addedBy: data.addedBy,
              sectionOverride: data.sectionOverride ?? undefined,
            };
          })
        );
      },
      (err) => console.error('Grocery items listener error', err)
    );

    return () => {
      unsubList();
      unsubItems();
    };
  }, [activeListId]);

  // Find an invite addressed to me.
  useEffect(() => {
    if (!myEmail) {
      setPendingInvite(undefined);
      return;
    }
    const q = query(
      collection(db, 'groceryListInvites'),
      where('invitedEmail', '==', myEmail.toLowerCase()),
      where('status', '==', 'pending')
    );
    return onSnapshot(q, (snapshot) => {
      setPendingInvite(snapshot.empty ? undefined : mapInvite(snapshot.docs[0].id, snapshot.docs[0].data()));
    });
  }, [myEmail]);

  const value = useMemo<GroceryContextValue>(() => {
    const listRef = activeListId ? doc(db, 'groceryLists', activeListId) : undefined;

    return {
      loading,
      activeListId,
      isOwnList,
      collaboratorIds: listDoc.collaboratorIds,

      menus: listDoc.menus,
      isQueuedInMenu: (recipeId, menuIndex) =>
        listDoc.menus[menuIndex]?.recipeIds.includes(recipeId) ?? false,
      menusContainingRecipe: (recipeId) =>
        listDoc.menus.reduce<number[]>((acc, m, i) => {
          if (m.recipeIds.includes(recipeId)) acc.push(i);
          return acc;
        }, []),
      addRecipeToMenu: (recipeId, menuIndex) => {
        if (!listRef) return;
        setDoc(
          listRef,
          { ownerId: activeListId, menus: { [String(menuIndex)]: { recipeIds: arrayUnion(recipeId) } } },
          { merge: true }
        );
        // Recipe read access for other list members is granted by the
        // security rules checking live list membership via this pointer —
        // no need to keep a separate list of shared uids in sync.
        if (!recipeInAnyMenu(listDoc.menus, recipeId)) {
          trySetQueuedOnListId(recipeId, activeListId);
        }
      },
      removeRecipeFromMenu: (recipeId, menuIndex) => {
        if (!listRef) return;
        setDoc(
          listRef,
          { menus: { [String(menuIndex)]: { recipeIds: arrayRemove(recipeId) } } },
          { merge: true }
        );
        if (!recipeInAnyMenu(listDoc.menus, recipeId, menuIndex)) {
          trySetQueuedOnListId(recipeId, null);
        }
      },
      addRecipeToNewMenu: (recipeId) => {
        if (!listRef) return;
        const nextIndex = listDoc.menus.length;
        setDoc(
          listRef,
          { ownerId: activeListId, menus: { [String(nextIndex)]: { recipeIds: [recipeId] } } },
          { merge: true }
        );
        if (!recipeInAnyMenu(listDoc.menus, recipeId)) {
          trySetQueuedOnListId(recipeId, activeListId);
        }
      },
      addNewMenu: () => {
        if (!listRef) return;
        const nextIndex = listDoc.menus.length;
        setDoc(
          listRef,
          { ownerId: activeListId, menus: { [String(nextIndex)]: { recipeIds: [] } } },
          { merge: true }
        );
      },
      startNextMenu: () => {
        if (!listRef || listDoc.menus.length === 0) return;
        const shifted = listDoc.menus.slice(1);
        const nextMenus = shifted.length > 0 ? shifted : [{ recipeIds: [] }];
        const menusMap: Record<string, Menu> = {};
        nextMenus.forEach((m, i) => {
          menusMap[String(i)] = stripUndefinedMenuFields(m);
        });
        // A plain (non-dotted) field assignment via updateDoc replaces the
        // whole `menus` map wholesale, which is what drops the old trailing
        // menu — setDoc(merge:true) would deep-merge instead and leave it.
        updateDoc(listRef, { menus: menusMap });
      },
      deleteMenu: (menuIndex) => {
        if (!listRef) return;
        const menuToDelete = listDoc.menus[menuIndex];
        if (!menuToDelete) return;

        const remaining = listDoc.menus.filter((_, i) => i !== menuIndex);
        const nextMenus = remaining.length > 0 ? remaining : [{ recipeIds: [] }];
        const menusMap: Record<string, Menu> = {};
        nextMenus.forEach((m, i) => {
          menusMap[String(i)] = stripUndefinedMenuFields(m);
        });
        updateDoc(listRef, { menus: menusMap });

        // Any recipe that was only queued on the menu being deleted is no
        // longer queued anywhere — clear its read-access pointer.
        menuToDelete.recipeIds.forEach((recipeId) => {
          if (!recipeInAnyMenu(listDoc.menus, recipeId, menuIndex)) {
            trySetQueuedOnListId(recipeId, null);
          }
        });
      },
      setMenuDates: (menuIndex, startDate, endDate) => {
        if (!listRef) return;
        // setDoc(merge) both creates the list doc if this is its very first
        // write (e.g. dates set on the default-rendered menu 1 before
        // anything's ever been queued) and deep-merges the nested `menus`
        // map, so this can't clobber that menu's recipeIds or any other menu.
        setDoc(
          listRef,
          {
            ownerId: activeListId,
            menus: {
              [String(menuIndex)]: {
                startDate: startDate ?? deleteField(),
                endDate: endDate ?? deleteField(),
              },
            },
          },
          { merge: true }
        );
      },
      setMenuName: (menuIndex, name) => {
        if (!listRef) return;
        const trimmed = name?.trim();
        setDoc(
          listRef,
          {
            ownerId: activeListId,
            menus: {
              [String(menuIndex)]: {
                name: trimmed || deleteField(),
              },
            },
          },
          { merge: true }
        );
      },

      customSections: listDoc.sections,
      addGrocerySection: (name) => {
        if (!listRef) return;
        const trimmed = name.trim();
        if (!trimmed) return;
        const existing = [...GROCERY_SECTIONS, ...listDoc.sections].map((s) => s.toLowerCase());
        if (existing.includes(trimmed.toLowerCase())) return;
        setDoc(listRef, { ownerId: activeListId, sections: arrayUnion(trimmed) }, { merge: true });
      },
      renameGrocerySection: (oldName, newName) => {
        if (!listRef || !activeListId) return;
        const trimmed = newName.trim();
        if (!trimmed || !listDoc.sections.includes(oldName)) return;
        const nextSections = listDoc.sections.map((s) => (s === oldName ? trimmed : s));
        updateDoc(listRef, { sections: nextSections });
        groceryItems
          .filter((item) => item.sectionOverride === oldName)
          .forEach((item) => {
            updateDoc(doc(db, 'groceryLists', activeListId, 'items', item.id), {
              sectionOverride: trimmed,
            });
          });
      },
      removeGrocerySection: (name) => {
        if (!listRef || !activeListId) return;
        updateDoc(listRef, { sections: listDoc.sections.filter((s) => s !== name) });
        groceryItems
          .filter((item) => item.sectionOverride === name)
          .forEach((item) => {
            updateDoc(doc(db, 'groceryLists', activeListId, 'items', item.id), {
              sectionOverride: deleteField(),
            });
          });
      },
      setGroceryItemSection: (id, section) => {
        if (!activeListId) return;
        updateDoc(doc(db, 'groceryLists', activeListId, 'items', id), {
          sectionOverride: section ?? deleteField(),
        });
      },
      updateGroceryItemText: (id, newText) => {
        if (!activeListId) return;
        const trimmed = displayIngredientName(newText);
        if (!trimmed) return;
        updateDoc(doc(db, 'groceryLists', activeListId, 'items', id), { text: trimmed });
      },

      groceryItems,
      // Ingredients are matched and merged by their clean, quantity-stripped
      // name (e.g. "1/4 cup basil" and "2 tbsp basil" both key to "basil"),
      // so the same item from different recipes collapses into one row.
      // Checked-off items no longer count as "added" from the recipe's point
      // of view — once you've bought it, the recipe should let you add it
      // again rather than showing it as still on the list.
      isIngredientAdded: (recipeId, text) => {
        const key = normalizeIngredientKey(text);
        return groceryItems.some(
          (item) =>
            !item.checked &&
            item.text.toLowerCase() === key &&
            item.sources.some((s) => s.recipeId === recipeId && s.originalText === text)
        );
      },
      toggleGroceryIngredient: (recipeId, recipeTitle, text) => {
        if (!activeListId || !myUid) return;
        const key = normalizeIngredientKey(text);
        const source = buildSource(recipeId, recipeTitle, text);

        // This exact recipe line is already an active (unchecked) source —
        // remove just that source, dropping the whole item if it was the
        // only one.
        const activeItem = groceryItems.find(
          (item) =>
            !item.checked &&
            item.text.toLowerCase() === key &&
            item.sources.some((s) => sourcesEqual(s, source))
        );
        if (activeItem) {
          const itemRef = doc(db, 'groceryLists', activeListId, 'items', activeItem.id);
          if (activeItem.sources.length <= 1) {
            deleteDoc(itemRef);
          } else {
            updateDoc(itemRef, { sources: arrayRemove(source) });
          }
          return;
        }

        // Otherwise merge into any existing item with the same clean name
        // (checked or not), re-activating it rather than creating a
        // duplicate row.
        const mergeTarget = groceryItems.find((item) => item.text.toLowerCase() === key);
        if (mergeTarget) {
          updateDoc(doc(db, 'groceryLists', activeListId, 'items', mergeTarget.id), {
            sources: arrayUnion(source),
            checked: false,
          });
        } else {
          addDoc(collection(db, 'groceryLists', activeListId, 'items'), {
            text: displayIngredientName(text),
            checked: false,
            addedBy: myUid,
            sources: [source],
          });
        }
      },
      toggleGroceryItemChecked: (id) => {
        if (!activeListId) return;
        const item = groceryItems.find((i) => i.id === id);
        if (!item) return;
        updateDoc(doc(db, 'groceryLists', activeListId, 'items', id), { checked: !item.checked });
      },
      removeGroceryItem: (id) => {
        if (!activeListId) return;
        deleteDoc(doc(db, 'groceryLists', activeListId, 'items', id));
      },
      removeItemsForRecipe: (recipeId) => {
        if (!activeListId) return;
        groceryItems.forEach((item) => {
          const remaining = item.sources.filter((s) => s.recipeId !== recipeId);
          if (remaining.length === item.sources.length) return;
          const itemRef = doc(db, 'groceryLists', activeListId, 'items', item.id);
          if (remaining.length === 0) {
            deleteDoc(itemRef);
          } else {
            updateDoc(itemRef, { sources: remaining });
          }
        });
      },
      addManualItem: (text) => {
        if (!activeListId || !myUid) return;
        const trimmed = text.trim();
        if (!trimmed) return;
        const key = normalizeIngredientKey(trimmed);
        const alreadyExists = groceryItems.some((item) => item.text.toLowerCase() === key);
        if (alreadyExists) return;
        addDoc(collection(db, 'groceryLists', activeListId, 'items'), {
          text: displayIngredientName(trimmed),
          checked: false,
          addedBy: myUid,
          sources: [buildSource(undefined, undefined, trimmed)],
        });
      },
      clearCheckedItems: () => {
        if (!activeListId) return;
        groceryItems
          .filter((item) => item.checked)
          .forEach((item) => deleteDoc(doc(db, 'groceryLists', activeListId, 'items', item.id)));
      },

      inviteCollaborator: async (email) => {
        if (!myUid || !myEmail) throw new Error('Must be signed in to invite a collaborator');
        const normalized = email.trim().toLowerCase();
        // Ensure the list doc exists (with empty arrays) so the invite can
        // later be accepted onto it. Only set on first creation — merging
        // `collaboratorIds: []` on every invite would silently wipe out
        // collaborators added by a previous invite.
        const listRef = doc(db, 'groceryLists', myUid);
        const listSnap = await getDoc(listRef);
        if (!listSnap.exists()) {
          await setDoc(listRef, { ownerId: myUid, collaboratorIds: [] });
        }
        await addDoc(collection(db, 'groceryListInvites'), {
          listOwnerId: myUid,
          listOwnerEmail: myEmail,
          invitedEmail: normalized,
          status: 'pending',
          createdAt: Date.now(),
        });
      },
      pendingInvite,
      acceptInvite: async () => {
        if (!pendingInvite || !myUid) return;
        await setDoc(
          doc(db, 'groceryLists', pendingInvite.listOwnerId),
          { collaboratorIds: arrayUnion(myUid) },
          { merge: true }
        );
        await updateDoc(doc(db, 'groceryListInvites', pendingInvite.id), { status: 'accepted' });
      },
      declineInvite: async () => {
        if (!pendingInvite) return;
        await updateDoc(doc(db, 'groceryListInvites', pendingInvite.id), { status: 'declined' });
      },
    };
  }, [activeListId, isOwnList, listDoc, groceryItems, pendingInvite, loading, myUid, myEmail]);

  return <GroceryContext.Provider value={value}>{children}</GroceryContext.Provider>;
}

export function useGrocery() {
  const context = useContext(GroceryContext);
  if (!context) {
    throw new Error('useGrocery must be used within a GroceryProvider');
  }
  return context;
}
