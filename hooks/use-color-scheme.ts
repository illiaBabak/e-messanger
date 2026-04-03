/**
 * Файл: hooks/use-color-scheme.ts
 *
 * Реэкспорт нативного хука useColorScheme из React Native.
 * Возвращает 'light' | 'dark' | null в зависимости от системной темы.
 *
 * Вынесен в отдельный файл, чтобы потом можно было:
 * - Добавить ручное переключение темы
 * - Сохранять выбор в AsyncStorage
 * - Использовать Context для темы
 */

export { useColorScheme } from "react-native";
