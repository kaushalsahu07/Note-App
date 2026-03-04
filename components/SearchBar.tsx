import React, { useState, useMemo } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, interpolateColor,
} from 'react-native-reanimated';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export default function SearchBar({ value, onChangeText, placeholder = 'Search notes...' }: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Capture theme colors as plain strings for use in animated worklet closures
  const borderBase = colors.border;
  const borderFocused = colors.accent + 'AA';

  // 0 = blurred, 1 = focused
  const focusAnim = useSharedValue(0);

  const containerAnimStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focusAnim.value,
      [0, 1],
      [borderBase, borderFocused],
    ),

  }));

  const iconAnimStyle = useAnimatedStyle(() => ({
    opacity: withTiming(0.55 + focusAnim.value * 0.3, { duration: 250 }),
  }));

  const handleFocus = () => {
    setIsFocused(true);
    focusAnim.value = withTiming(1, { duration: 250 });
  };

  const handleBlur = () => {
    setIsFocused(false);
    focusAnim.value = withTiming(0, { duration: 250 });
  };

  return (
    <Animated.View style={[styles.container, containerAnimStyle]}>
      <Animated.View style={iconAnimStyle}>
        <Ionicons
          name="search"
          size={18}
          color={isFocused ? colors.accent : colors.icon}
          style={styles.icon}
        />
      </Animated.View>

      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.icon}
        onFocus={handleFocus}
        onBlur={handleBlur}
        returnKeyType="search"
        clearButtonMode="never"
      />

      {value.length > 0 && (
        <Ionicons
          name="close-circle"
          size={18}
          color={colors.icon}
          onPress={() => onChangeText('')}
          style={styles.clearIcon}
        />
      )}
    </Animated.View>
  );
}

type ThemeColors = typeof Colors.dark;

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSolid,
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  icon: {
    marginRight: 10,
  },
  clearIcon: {
    marginLeft: 8,
    padding: 2,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
    paddingVertical: 0,
  },
  });
}