import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
  type DocumentData,
  type QuerySnapshot,
} from 'firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { subscribeWithRetry } from '@/utils/firestore-retry';

type FollowContextValue = {
  /** uids of people I follow, live. */
  followingIds: string[];
  /** uids of people who follow me, live. */
  followerIds: string[];
  isFollowing: (uid: string) => boolean;
  follow: (uid: string) => Promise<void>;
  unfollow: (uid: string) => Promise<void>;
};

const FollowContext = createContext<FollowContextValue | undefined>(undefined);

export function FollowProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const myUid = user?.uid;

  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [followerIds, setFollowerIds] = useState<string[]>([]);

  useEffect(() => {
    if (!myUid) {
      setFollowingIds([]);
      return;
    }
    const q = query(collection(db, 'follows'), where('followerId', '==', myUid));
    return subscribeWithRetry<QuerySnapshot<DocumentData>>(
      (onNext, onError) => onSnapshot(q, onNext, onError),
      (snapshot) => setFollowingIds(snapshot.docs.map((d) => d.data().followedId as string)),
      (err) => console.error('Following listener error', err)
    );
  }, [myUid]);

  useEffect(() => {
    if (!myUid) {
      setFollowerIds([]);
      return;
    }
    const q = query(collection(db, 'follows'), where('followedId', '==', myUid));
    return subscribeWithRetry<QuerySnapshot<DocumentData>>(
      (onNext, onError) => onSnapshot(q, onNext, onError),
      (snapshot) => setFollowerIds(snapshot.docs.map((d) => d.data().followerId as string)),
      (err) => console.error('Followers listener error', err)
    );
  }, [myUid]);

  const value = useMemo<FollowContextValue>(
    () => ({
      followingIds,
      followerIds,
      isFollowing: (uid) => followingIds.includes(uid),
      follow: async (uid) => {
        if (!myUid || myUid === uid) return;
        await setDoc(doc(db, 'follows', `${myUid}_${uid}`), {
          followerId: myUid,
          followedId: uid,
          createdAt: Date.now(),
        });
      },
      unfollow: async (uid) => {
        if (!myUid) return;
        await deleteDoc(doc(db, 'follows', `${myUid}_${uid}`));
      },
    }),
    [followingIds, followerIds, myUid]
  );

  return <FollowContext.Provider value={value}>{children}</FollowContext.Provider>;
}

export function useFollow() {
  const context = useContext(FollowContext);
  if (!context) {
    throw new Error('useFollow must be used within a FollowProvider');
  }
  return context;
}
