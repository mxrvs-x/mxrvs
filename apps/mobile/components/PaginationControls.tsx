import { useTheme } from "@/lib/theme";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

type Props = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export default function PaginationControls({
  page,
  totalPages,
  onPageChange,
}: Props) {
  const theme = useTheme();
  if (totalPages <= 1) return null;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        paddingVertical: 18,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous page"
        disabled={page <= 1}
        onPress={() => onPageChange(page - 1)}
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
          alignItems: "center",
          justifyContent: "center",
          opacity: page <= 1 ? 0.4 : 1,
        }}
      >
        <ChevronLeft size={20} color={theme.colors.text} />
      </Pressable>

      <Text style={{ color: theme.colors.text, fontWeight: "900" }}>
        {page} / {totalPages}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next page"
        disabled={page >= totalPages}
        onPress={() => onPageChange(page + 1)}
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
          alignItems: "center",
          justifyContent: "center",
          opacity: page >= totalPages ? 0.4 : 1,
        }}
      >
        <ChevronRight size={20} color={theme.colors.text} />
      </Pressable>
    </View>
  );
}
