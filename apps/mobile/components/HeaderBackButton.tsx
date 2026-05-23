import { useTheme } from "@/lib/theme";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Pressable, View } from "react-native";

type HeaderBackButtonProps = {
  onPress?: () => void;
};

export default function HeaderBackButton({ onPress }: HeaderBackButtonProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.colors.background,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        paddingHorizontal: 8,
      }}
    >
      <Pressable
        onPress={onPress || (() => router.back())}
        style={({ pressed }) => ({
          width: 46,
          height: 46,
          borderRadius: theme.radius.lg,
          justifyContent: "center",
          alignItems: "center",
          marginRight: 14,
          backgroundColor: pressed ? theme.colors.surfaceAlt : "transparent",
        })}
      >
        <ChevronLeft size={30} color={theme.colors.text} />
      </Pressable>
    </View>
  );
}
