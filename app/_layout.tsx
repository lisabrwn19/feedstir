import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { GroceryProvider } from '@/context/grocery-context';
import { RecipesProvider } from '@/context/recipes-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <RecipesProvider>
        <GroceryProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            <Stack.Screen
              name="recipe/new"
              options={{ presentation: 'modal', title: 'New Recipe' }}
            />
            <Stack.Screen name="recipe/[id]" options={{ title: 'Recipe' }} />
          </Stack>
        </GroceryProvider>
      </RecipesProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
