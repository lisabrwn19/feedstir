import {
  collection,
  doc,
  onSnapshot,
  type DocumentData,
  type DocumentSnapshot,
  type QuerySnapshot,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from '@/lib/firebase';
import type { UserProfile } from '@/types/user-profile';
import { subscribeWithRetry } from '@/utils/firestore-retry';

export function displayNameFromEmail(email: string): string {
  return email.split('@')[0] || email;
}

function mapUserProfile(uid: string, data: DocumentData): UserProfile {
  const email: string = data.email ?? '';
  return {
    uid,
    email,
    displayName: data.displayName?.trim() || displayNameFromEmail(email),
    photoUri: data.photoUri ?? undefined,
  };
}

/** Live profile for any user (yourself or someone you follow) by uid. */
export function useUserProfile(uid: string | undefined) {
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);

  useEffect(() => {
    if (!uid) {
      setProfile(undefined);
      return;
    }
    setProfile(undefined);
    return subscribeWithRetry<DocumentSnapshot<DocumentData>>(
      (onNext, onError) => onSnapshot(doc(db, 'users', uid), onNext, onError),
      (snapshot) => setProfile(snapshot.exists() ? mapUserProfile(snapshot.id, snapshot.data()) : null),
      (err) => {
        console.error('User profile listener error', uid, err);
        setProfile(null);
      }
    );
  }, [uid]);

  return profile;
}

/**
 * Live list of every signed-up user's profile, for searching/browsing
 * people to follow by name. There's no server-side search index — this app
 * is small enough that fetching the whole collection and filtering by name
 * client-side is simplest.
 */
export function useAllUsers() {
  const [profiles, setProfiles] = useState<UserProfile[] | undefined>(undefined);

  useEffect(() => {
    return subscribeWithRetry<QuerySnapshot<DocumentData>>(
      (onNext, onError) => onSnapshot(collection(db, 'users'), onNext, onError),
      (snapshot) => setProfiles(snapshot.docs.map((d) => mapUserProfile(d.id, d.data()))),
      (err) => {
        console.error('All-users listener error', err);
        setProfiles([]);
      }
    );
  }, []);

  return profiles;
}
