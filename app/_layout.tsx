import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CustomAlertProvider } from '../components/CustomAlert';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import E2EESetupDialog from '../components/E2EESetupDialog';
import SplashScreen from '../components/SplashScreen';
import {
  isE2EEEnabled, verifyE2EEPassphrase, setSessionPassphrase,
  notifyNotesChanged,
} from '../utils/storage';
import { startAutoSync } from '../utils/cloudSync';

function AppStack() {
  const { colors, isDark } = useTheme();
  const [isLocked, setIsLocked] = useState(false);
  const [checkingE2EE, setCheckingE2EE] = useState(true);
  const [splashVisible, setSplashVisible] = useState(true);

  useEffect(() => {
    checkE2EELock();
  }, []);

  const checkE2EELock = async () => {
    const startTime = Date.now();
    try {
      const enabled = await isE2EEEnabled();
      setIsLocked(enabled);
    } catch {
      setIsLocked(false);
    } finally {
      // Ensure splash is visible for at least 650ms for a smooth entrance and exit
      const elapsed = Date.now() - startTime;
      const minDuration = 650;
      if (elapsed < minDuration) {
        await new Promise((resolve) => setTimeout(resolve, minDuration - elapsed));
      }
      setCheckingE2EE(false);
      // Start auto-sync listener (runs in background)
      startAutoSync();
    }
  };

  const handleUnlock = async (passphrase: string): Promise<boolean> => {
    const valid = await verifyE2EEPassphrase(passphrase);
    if (valid) {
      await setSessionPassphrase(passphrase);
      setIsLocked(false);
      // Reload notes now that we can decrypt them
      await notifyNotesChanged();
      return true;
    }
    return false;
  };

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

        {/* Archive screen */}
        <Stack.Screen
          name="archive"
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

      {/* E2EE unlock dialog — shown on app start if E2EE is enabled */}
      <E2EESetupDialog
        visible={isLocked && !checkingE2EE}
        mode="unlock"
        onClose={() => {
          // User cannot dismiss the unlock dialog — they must enter their passphrase
          // But we allow closing it so the app doesn't hard-lock (they'll see empty data)
          setIsLocked(false);
        }}
        onSubmit={handleUnlock}
      />

      {/* Animated Splash Screen Overlay */}
      {splashVisible && (
        <SplashScreen
          isReady={!checkingE2EE}
          onAnimationComplete={() => setSplashVisible(false)}
        />
      )}
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