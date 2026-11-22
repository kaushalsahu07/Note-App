import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';

interface SplashScreenProps {
  isReady: boolean;
  onAnimationComplete?: () => void;
}

export default function SplashScreen({ isReady, onAnimationComplete }: SplashScreenProps) {
  const { colors, isDark } = useTheme();
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0.92);
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 14, stiffness: 100 });
    contentOpacity.value = withTiming(1, { duration: 400 });
  }, []);

  useEffect(() => {
    if (isReady) {
      opacity.value = withTiming(
        0,
        { duration: 350, easing: Easing.out(Easing.ease) },
        (finished) => {
          if (finished && onAnimationComplete) {
            runOnJS(onAnimationComplete)();
          }
        }
      );
    }
  }, [isReady]);

  const containerAnimStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: contentOpacity.value,
  }));

  return (
    <Animated.View
      pointerEvents={isReady ? 'none' : 'auto'}
      style={[styles.container, { backgroundColor: colors.background }, containerAnimStyle]}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Animated.View style={[styles.content, iconAnimStyle]}>
        <View style={[styles.iconWrap, { borderColor: colors.border, backgroundColor: colors.surfaceSolid }]}>
          <Image
            source={require('../assets/icon.png')}
            style={styles.iconImage}
            resizeMode="contain"
          />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Notes</Text>
        <Text style={[styles.subtitle, { color: colors.icon }]}>Private & Encrypted</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  iconImage: {
    width: 96,
    height: 96,
    borderRadius: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
});
