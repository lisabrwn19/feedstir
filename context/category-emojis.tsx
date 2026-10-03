import { deleteField, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { categoryEmoji } from '@/utils/categories';

type CategoryEmojisContextValue = {
  /** Resolves a folder's emoji — your own override if you've set one, otherwise the default. */
  getEmoji: (folderKey: string) => string;
  setCategoryEmoji: (folderKey: string, emoji: string) => Promise<void>;
  resetCategoryEmoji: (folderKey: string) => Promise<void>;
};

const CategoryEmojisContext = createContext<CategoryEmojisContextValue | undefined>(undefined);

export function CategoryEmojisProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const myUid = user?.uid;
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!myUid) {
      setOverrides({});
      return;
    }
    return onSnapshot(doc(db, 'users', myUid), (snapshot) => {
      const data = snapshot.data()?.categoryEmojis;
      setOverrides(data && typeof data === 'object' ? data : {});
    });
  }, [myUid]);

  const value = useMemo<CategoryEmojisContextValue>(
    () => ({
      getEmoji: (folderKey) => overrides[folderKey] ?? categoryEmoji(folderKey),
      setCategoryEmoji: async (folderKey, emoji) => {
        if (!myUid || !emoji.trim()) return;
        await updateDoc(doc(db, 'users', myUid), { [`categoryEmojis.${folderKey}`]: emoji.trim() });
      },
      resetCategoryEmoji: async (folderKey) => {
        if (!myUid) return;
        await updateDoc(doc(db, 'users', myUid), { [`categoryEmojis.${folderKey}`]: deleteField() });
      },
    }),
    [overrides, myUid]
  );

  return <CategoryEmojisContext.Provider value={value}>{children}</CategoryEmojisContext.Provider>;
}

export function useCategoryEmojis() {
  const context = useContext(CategoryEmojisContext);
  if (!context) {
    throw new Error('useCategoryEmojis must be used within a CategoryEmojisProvider');
  }
  return context;
}
