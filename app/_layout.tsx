import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { ThemedView } from '@/components/themed-view';
import { ActiveTabProvider, useActiveTab } from '@/context/active-tab';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { CategoryEmojisProvider } from '@/context/category-emojis';
import { FavoritesProvider } from '@/context/favorites-context';
import { FollowProvider } from '@/context/follow-context';
import { GroceryProvider } from '@/context/grocery-context';
import { RecipesProvider } from '@/context/recipes-context';
import { SavedRecipesProvider } from '@/context/saved-recipes';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

function AppNavigator() {
  const { user, initializing } = useAuth();
  // Labels the back button on every screen pushed from a tab with the name
  // of the tab it was pushed from (e.g. "< Grocery"), rather than the
  // literal "(tabs)" route-group name React Navigation falls back to
  // otherwise.
  const { activeTab } = useActiveTab();

  if (initializing) {
    return <ThemedView style={{ flex: 1 }} />;
  }

  return (
    <Stack>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="recipe/new" options={{ presentation: 'modal', title: 'New Recipe' }} />
        <Stack.Screen name="recipe/[id]" options={{ title: 'Recipe', headerBackTitle: activeTab }} />
        <Stack.Screen name="recipe/discover" options={{ title: 'Discover', headerBackTitle: activeTab }} />
        <Stack.Screen name="recipe/favorites" options={{ title: 'Favorites', headerBackTitle: activeTab }} />
        <Stack.Screen name="recipe/category/[name]" options={{ title: 'Category', headerBackTitle: activeTab }} />
        <Stack.Screen name="user/[uid]" options={{ title: 'Profile', headerBackTitle: activeTab }} />
      </Stack.Protected>

      <Stack.Protected guard={!user}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <FollowProvider>
          <FavoritesProvider>
            <CategoryEmojisProvider>
              <SavedRecipesProvider>
                <RecipesProvider>
                  <GroceryProvider>
                    <ActiveTabProvider>
                      <AppNavigator />
                    </ActiveTabProvider>
                  </GroceryProvider>
                </RecipesProvider>
              </SavedRecipesProvider>
            </CategoryEmojisProvider>
          </FavoritesProvider>
        </FollowProvider>
      </AuthProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
