import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/auth-context';
import { useFollow } from '@/context/follow-context';
import { useAllUsers, useUserProfile } from '@/context/user-profile';
import { useThemeColor } from '@/hooks/use-theme-color';
import { isLocalPhotoUri, uploadProfilePhoto } from '@/utils/upload-photo';

function FollowingRow({ uid }: { uid: string }) {
  const router = useRouter();
  const profile = useUserProfile(uid);
  const border = useThemeColor({}, 'icon');
  const { unfollow } = useFollow();
  const [unfollowing, setUnfollowing] = useState(false);

  const handleUnfollow = async () => {
    setUnfollowing(true);
    try {
      await unfollow(uid);
    } finally {
      setUnfollowing(false);
    }
  };

  if (!profile) return null;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/user/[uid]', params: { uid } })}
      style={[styles.followingRow, { borderColor: border }]}>
      {profile.photoUri ? (
        <Image source={{ uri: profile.photoUri }} style={styles.followingAvatar} />
      ) : (
        <View
          style={[styles.followingAvatar, styles.followingAvatarPlaceholder, { borderColor: border }]}>
          <IconSymbol name="person.crop.circle" size={20} color={border} />
        </View>
      )}
      <ThemedText style={styles.followingName} numberOfLines={1}>
        {profile.displayName}
      </ThemedText>
      <Pressable onPress={handleUnfollow} disabled={unfollowing} hitSlop={8}>
        {unfollowing ? (
          <ActivityIndicator size="small" color={border} />
        ) : (
          <ThemedText style={{ color: border, fontSize: 13 }}>Unfollow</ThemedText>
        )}
      </Pressable>
    </Pressable>
  );
}

function PersonSearchRow({
  uid,
  displayName,
  photoUri,
}: {
  uid: string;
  displayName: string;
  photoUri: string | undefined;
}) {
  const router = useRouter();
  const border = useThemeColor({}, 'icon');
  const accent = useThemeColor({}, 'accent');
  const { isFollowing, follow, unfollow } = useFollow();
  const [busy, setBusy] = useState(false);
  const following = isFollowing(uid);

  const handleToggle = async () => {
    setBusy(true);
    try {
      await (following ? unfollow(uid) : follow(uid));
    } catch (err) {
      console.error('Failed to toggle follow', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/user/[uid]', params: { uid } })}
      style={[styles.followingRow, { borderColor: border }]}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.followingAvatar} />
      ) : (
        <View
          style={[styles.followingAvatar, styles.followingAvatarPlaceholder, { borderColor: border }]}>
          <IconSymbol name="person.crop.circle" size={20} color={border} />
        </View>
      )}
      <ThemedText style={styles.followingName} numberOfLines={1}>
        {displayName}
      </ThemedText>
      <Pressable onPress={handleToggle} disabled={busy} hitSlop={8}>
        {busy ? (
          <ActivityIndicator size="small" color={border} />
        ) : (
          <ThemedText style={{ color: following ? border : accent, fontSize: 13, fontWeight: '600' }}>
            {following ? 'Following' : 'Follow'}
          </ThemedText>
        )}
      </Pressable>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { user, signOut, updateProfile } = useAuth();
  const profile = useUserProfile(user?.uid);
  const { followingIds } = useFollow();
  const allUsers = useAllUsers();
  const text = useThemeColor({}, 'text');
  const border = useThemeColor({}, 'icon');
  const accent = useThemeColor({}, 'accent');

  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const searchResults = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed || !allUsers) return [];
    return allUsers
      .filter((u) => u.uid !== user?.uid && u.displayName.toLowerCase().includes(trimmed))
      .slice(0, 20);
  }, [allUsers, searchQuery, user?.uid]);

  const handleStartEditName = () => {
    setDraftName(profile?.displayName ?? '');
    setEditingName(true);
  };

  const handleSaveName = async () => {
    setSavingName(true);
    try {
      await updateProfile({ displayName: draftName });
      setEditingName(false);
    } catch (err) {
      console.error('Failed to update display name', err);
      Alert.alert('Could not save', 'Something went wrong. Try again.');
    } finally {
      setSavingName(false);
    }
  };

  const pickPhoto = async () => {
    if (!user) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to set a profile photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingPhoto(true);
    try {
      const uri = result.assets[0].uri;
      const finalUri = isLocalPhotoUri(uri) ? await uploadProfilePhoto(uri, user.uid) : uri;
      await updateProfile({ photoUri: finalUri });
    } catch (err) {
      console.error('Failed to update profile photo', err);
      Alert.alert('Could not update photo', 'Something went wrong. Try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={followingIds}
        keyExtractor={(uid) => uid}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => <FollowingRow uid={item} />}
        ListHeaderComponent={
          <View style={styles.profileBlock}>
            <View style={styles.avatarRow}>
              <Pressable onPress={pickPhoto} style={styles.avatarWrap}>
                {profile?.photoUri ? (
                  <Image source={{ uri: profile.photoUri }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder, { borderColor: border }]}>
                    <IconSymbol name="person.crop.circle" size={40} color={border} />
                  </View>
                )}
                <View style={[styles.avatarEditBadge, { backgroundColor: accent }]}>
                  {uploadingPhoto ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <IconSymbol name="pencil" size={12} color="#fff" />
                  )}
                </View>
              </Pressable>
              <Pressable onPress={() => signOut()} hitSlop={8} accessibilityLabel="Sign out">
                <IconSymbol name="rectangle.portrait.and.arrow.right" size={20} color={border} />
              </Pressable>
            </View>

            {editingName ? (
              <View style={styles.nameEditRow}>
                <TextInput
                  value={draftName}
                  onChangeText={setDraftName}
                  placeholder="Your name"
                  placeholderTextColor={border}
                  autoFocus
                  onSubmitEditing={handleSaveName}
                  returnKeyType="done"
                  style={[styles.nameInput, { color: text, borderColor: border }]}
                />
                <Pressable
                  onPress={handleSaveName}
                  disabled={savingName}
                  hitSlop={8}
                  accessibilityLabel="Save name">
                  {savingName ? (
                    <ActivityIndicator />
                  ) : (
                    <IconSymbol name="checkmark" size={20} color={accent} />
                  )}
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={handleStartEditName}
                style={styles.nameRow}
                accessibilityLabel="Edit name">
                <ThemedText type="title">{profile?.displayName ?? '…'}</ThemedText>
                <IconSymbol name="pencil" size={16} color={border} />
              </Pressable>
            )}
            <ThemedText style={{ color: border }}>{profile?.email}</ThemedText>

            <View style={styles.section}>
              <ThemedText type="subtitle">Find people</ThemedText>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by name"
                placeholderTextColor={border}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, { color: text, borderColor: border }]}
              />
              {searchQuery.trim() && searchResults.length === 0 ? (
                <ThemedText style={[styles.emptyHint, { color: border }]}>
                  No one found with that name.
                </ThemedText>
              ) : null}
              {searchResults.map((result) => (
                <PersonSearchRow
                  key={result.uid}
                  uid={result.uid}
                  displayName={result.displayName}
                  photoUri={result.photoUri}
                />
              ))}
            </View>

            <ThemedText type="subtitle">
              Following{followingIds.length > 0 ? ` (${followingIds.length})` : ''}
            </ThemedText>
            {followingIds.length === 0 ? (
              <ThemedText style={[styles.emptyHint, { color: border }]}>
                Search for someone above to see their recipes here.
              </ThemedText>
            ) : null}
          </View>
        }
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
  profileBlock: {
    gap: 10,
    paddingBottom: 8,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  avatarWrap: {
    alignSelf: 'flex-start',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  nameInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 18,
    fontWeight: '700',
  },
  section: {
    gap: 8,
    marginTop: 20,
    marginBottom: 4,
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  emptyHint: {
    opacity: 0.8,
  },
  followingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  followingAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  followingAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  followingName: {
    flex: 1,
  },
});
