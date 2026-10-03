import { Image } from 'expo-image';
import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, type ColorValue } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useActiveTab } from '@/context/active-tab';
import { useAuth } from '@/context/auth-context';
import { useUserProfile } from '@/context/user-profile';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Shows the user's own avatar photo in place of the generic person icon,
// once they've set one — falls back to the default icon otherwise.
function ProfileTabIcon({ color, size }: { color: ColorValue; size: number }) {
  const { user } = useAuth();
  const profile = useUserProfile(user?.uid);

  if (profile?.photoUri) {
    return (
      <Image
        source={{ uri: profile.photoUri }}
        style={[styles.avatarIcon, { width: size, height: size, borderRadius: size / 2, borderColor: color }]}
      />
    );
  }

  return <IconSymbol size={size} name="person.crop.circle" color={color} />;
}

export default function TabLayout() {
  // `useColorScheme()` can also return 'unspecified' — treat anything but an
  // explicit 'dark' as light.
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const { setActiveTab } = useActiveTab();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Recipes',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="fork.knife" color={color} />,
        }}
        listeners={{ focus: () => setActiveTab('Recipes') }}
      />
      <Tabs.Screen
        name="menus"
        options={{
          title: 'Menus',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="list.bullet" color={color} />,
        }}
        listeners={{ focus: () => setActiveTab('Menus') }}
      />
      <Tabs.Screen
        name="grocery"
        options={{
          title: 'Grocery',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="cart.fill" color={color} />,
        }}
        listeners={{ focus: () => setActiveTab('Grocery') }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <ProfileTabIcon color={color} size={28} />,
        }}
        listeners={{ focus: () => setActiveTab('Profile') }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  avatarIcon: {
    borderWidth: 1.5,
  },
});
