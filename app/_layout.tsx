import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../constants/Colors';
import { CustomAlertProvider } from '../components/CustomAlert';

export default function Layout() {
  return (
    <CustomAlertProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: Colors.dark.background,
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
    </CustomAlertProvider>
  );
}