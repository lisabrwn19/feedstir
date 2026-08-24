import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
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
import type { GroceryInvite, GroceryItem, GrocerySource } from '@/types/grocery';
import { subscribeWithRetry } from '@/utils/firestore-retry';
import { displayIngredientName, normalizeIngredientKey } from '@/utils/parse-ingredient';

type GroceryContextValue = {
  loading: boolean;
  /** uid of the grocery list currently in use — your own, or an owner's list you collaborate on. */
  activeListId: string | undefined;
  isOwnList: boolean;
  collaboratorIds: string[];

  queuedRecipeIds: string[];
  isQueued: (recipeId: string) => boolean;
  toggleQueued: (recipeId: string) => void;

  groceryItems: GroceryItem[];
  isIngredientAdded: (recipeId: string, text: string) => boolean;
  toggleGroceryIngredient: (recipeId: string, recipeTitle: string, text: string) => void;
  toggleGroceryItemChecked: (id: string) => void;
  removeGroceryItem: (id: string) => void;
  removeItemsForRecipe: (recipeId: string) => void;
  addManualItem: (text: string) => void;
  clearCheckedItems: () => void;

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
  const [listDoc, setListDoc] = useState<{ collaboratorIds: string[]; queuedRecipeIds: string[] }>({
    collaboratorIds: [],
    queuedRecipeIds: [],
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
      setListDoc({ collaboratorIds: [], queuedRecipeIds: [] });
      setGroceryItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubList = subscribeWithRetry<DocumentSnapshot<DocumentData>>(
      (onNext, onError) => onSnapshot(doc(db, 'groceryLists', activeListId), onNext, onError),
      (snapshot) => {
        const data = snapshot.data();
        setListDoc({
          collaboratorIds: data?.collaboratorIds ?? [],
          queuedRecipeIds: data?.queuedRecipeIds ?? [],
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

      queuedRecipeIds: listDoc.queuedRecipeIds,
      isQueued: (recipeId) => listDoc.queuedRecipeIds.includes(recipeId),
      toggleQueued: (recipeId) => {
        if (!listRef) return;
        const alreadyQueued = listDoc.queuedRecipeIds.includes(recipeId);
        setDoc(
          listRef,
          {
            ownerId: activeListId,
            queuedRecipeIds: alreadyQueued ? arrayRemove(recipeId) : arrayUnion(recipeId),
          },
          { merge: true }
        );
        // Recipe read access for other list members is granted by the
        // security rules checking live list membership via this pointer —
        // no need to keep a separate list of shared uids in sync.
        updateDoc(doc(db, 'recipes', recipeId), {
          queuedOnListId: alreadyQueued ? null : activeListId,
        });
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
          await setDoc(listRef, { ownerId: myUid, collaboratorIds: [], queuedRecipeIds: [] });
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
