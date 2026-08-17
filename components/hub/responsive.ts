import { useWindowDimensions } from "react-native";

/** Shared breakpoints for a portrait-first UI that can expand gracefully on web and tablets. */
export function useResponsiveLayout() {
  const { width } = useWindowDimensions();
  const isCompact = width < 390;
  const isWide = width >= 760;
  const contentMaxWidth = width >= 1180 ? 1100 : width >= 760 ? 920 : undefined;
  return { width, isCompact, isWide, contentMaxWidth };
}
