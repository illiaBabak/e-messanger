/**
 * Файл: components/ui/text-input.tsx
 *
 * Кастомный TextInput для форм авторизации и регистрации.
 *
 * Props:
 * - leftIcon: имя иконки Ionicons (отображается слева)
 * - rightIcon / onRightIconPress: иконка-кнопка справа
 * - error: текст ошибки валидации (показывается под полем красным)
 * - Все стандартные TextInputProps тоже работают (placeholder, value, и т.д.)
 *
 * При наличии error рамка становится красной вместо primary.
 */

import { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSizes, BorderRadius, Spacing } from '@/constants/theme';

interface TextInputProps extends RNTextInputProps {
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  error?: string;
}

const AnimatedView = Animated.createAnimatedComponent(View);

export function TextInput({
  leftIcon,
  rightIcon,
  onRightIconPress,
  error,
  style,
  ...rest
}: TextInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useSharedValue(0);

  const hasError = !!error;

  const handleFocus = () => {
    setIsFocused(true);
    focusAnim.value = withTiming(1, { duration: 200 });
  };

  const handleBlur = () => {
    setIsFocused(false);
    focusAnim.value = withTiming(0, { duration: 200 });
  };

  const containerStyle = useAnimatedStyle(() => ({
    borderColor: hasError
      ? Colors.error
      : interpolateColor(
          focusAnim.value,
          [0, 1],
          [Colors.border, Colors.primary]
        ),
  }));

  const iconColor = hasError
    ? Colors.error
    : isFocused
      ? Colors.primary
      : Colors.textMuted;

  return (
    <View>
      <AnimatedView style={[styles.container, containerStyle]}>
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={20}
            color={iconColor}
            style={styles.leftIcon}
          />
        )}

        <RNTextInput
          style={[styles.input, style]}
          placeholderTextColor={Colors.textMuted}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...rest}
        />

        {rightIcon && (
          <Pressable onPress={onRightIconPress} style={styles.rightIcon}>
            <Ionicons name={rightIcon} size={20} color={Colors.textMuted} />
          </Pressable>
        )}
      </AnimatedView>

      {hasError && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 52,
  },
  leftIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    height: '100%',
  },
  rightIcon: {
    marginLeft: Spacing.sm,
    padding: Spacing.xs,
  },
  errorText: {
    color: Colors.error,
    fontSize: FontSizes.xs,
    marginTop: Spacing.xs,
    marginLeft: Spacing.xs,
  },
});
