import React, { useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
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

  // 0 = blurred, 1 = focused — drives ALL animated values so the worklet
  // never needs to read JS-side state (which would crash on the UI thread).
  const focusAnim = useSharedValue(0);

  const containerAnimStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focusAnim.value,
      [0, 1],
      [Colors.dark.border, Colors.dark.accent + 'AA'], // softer — semi-transparent accent
    ),
    shadowOpacity: withTiming(focusAnim.value * 0.12, { duration: 250 }),
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
          color={isFocused ? Colors.dark.accent : Colors.dark.icon}
          style={styles.icon}
        />
      </Animated.View>

      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.dark.icon}
        onFocus={handleFocus}
        onBlur={handleBlur}
        returnKeyType="search"
        clearButtonMode="never"
      />

      {value.length > 0 && (
        <Ionicons
          name="close-circle"
          size={18}
          color={Colors.dark.icon}
          onPress={() => onChangeText('')}
          style={styles.clearIcon}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surfaceSolid,
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 18,
    borderWidth: 1.5,
    shadowColor: Colors.dark.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
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
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '500',
    // No fixed height — let the text render at its natural line height
    paddingVertical: 0, // prevents extra vertical padding on Android
  },
});