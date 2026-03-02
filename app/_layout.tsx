import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CustomAlertProvider } from '../components/CustomAlert';
import { ThemeProvider, useTheme } from '../context/ThemeContext';

function AppStack() {
  const { colors, isDark } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        {/* Home screen — notes grid */}
        <Stack.Screen name="index" />

        {/* Type picker modal — shown before creating any item */}
        <Stack.Screen
          name="select-type"
          options={{ presentation: 'modal' }}
        />

        {/* Create screens */}
        <Stack.Screen
          name="new"
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="new-todo"
          options={{ presentation: 'modal' }}
        />

        {/* View / read a note */}
        <Stack.Screen
          name="note/[id]"
          options={{ presentation: 'modal' }}
        />

        {/* Edit a to-do list */}
        <Stack.Screen
          name="edit/todo/[id]"
          options={{ presentation: 'modal' }}
        />
      </Stack>
    </View>
  );
}

export default function Layout() {
  return (
    <ThemeProvider>
      <CustomAlertProvider>
        <AppStack />
      </CustomAlertProvider>
    </ThemeProvider>
  );
}