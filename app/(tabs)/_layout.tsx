import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 10 : Math.max(insets.bottom, 8);
  const tabBarHeight = 60 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.muted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          elevation: 12,
          shadowColor: colors.foreground,
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
        },
        tabBarItemStyle: { maxWidth: 150 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", marginTop: 1 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "الرئيسية",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="agents"
        options={{
          title: "الوكلاء",
          tabBarIcon: ({ color }) => <IconSymbol size={25} name="person.3.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: "المهام",
          tabBarIcon: ({ color }) => <IconSymbol size={25} name="checklist" color={color} />,
        }}
      />
      <Tabs.Screen
        name="control"
        options={{
          title: "التحكم",
          tabBarIcon: ({ color }) => <IconSymbol size={25} name="slider.horizontal.3" color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "المحادثة",
          tabBarIcon: ({ color }) => <IconSymbol size={25} name="bubble.left.and.bubble.right.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
