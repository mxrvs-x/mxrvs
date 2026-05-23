import { useTheme } from "@/lib/theme";
import { Pressable, Text, View } from "react-native";

type Props = {
  visible: boolean;
  title: string;
  message: string;

  confirmText?: string;
  cancelText?: string;
  neutralText?: string;

  danger?: boolean;
  neutralDanger?: boolean;

  onClose: () => void;
  onConfirm?: () => void;
  onNeutral?: () => void;
};

export default function ThemedAlert({
  visible,
  title,
  message,
  confirmText = "OK",
  cancelText,
  neutralText,
  danger = false,
  neutralDanger = false,
  onClose,
  onConfirm,
  onNeutral,
}: Props) {
  const theme = useTheme();

  if (!visible) return null;

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Pressable
        onPress={onClose}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.45)",
        }}
      />

      <View
        style={{
          width: "88%",
          backgroundColor: theme.colors.surface,
          borderRadius: 28,
          padding: 22,
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}
      >
        <Text
          style={{
            color: theme.colors.text,
            fontSize: 24,
            fontWeight: "900",
            marginBottom: 12,
          }}
        >
          {title}
        </Text>

        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: 16,
            lineHeight: 24,
          }}
        >
          {message}
        </Text>

        <View
          style={{
            flexDirection: "row",
            gap: 10,
            marginTop: 24,
          }}
        >
          {cancelText ? (
            <Pressable
              onPress={onClose}
              style={{
                flex: 1,
                height: 50,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: theme.colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: theme.colors.text,
                  fontWeight: "900",
                  fontSize: 16,
                }}
              >
                {cancelText}
              </Text>
            </Pressable>
          ) : null}

          {neutralText ? (
            <Pressable
              onPress={() => {
                if (onNeutral) {
                  onNeutral();
                } else {
                  onClose();
                }
              }}
              style={{
                flex: 1,
                height: 50,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: neutralDanger
                  ? theme.colors.danger ?? "#ef4444"
                  : theme.colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: neutralDanger
                    ? theme.colors.danger ?? "#ef4444"
                    : theme.colors.text,
                  fontWeight: "900",
                  fontSize: 16,
                }}
              >
                {neutralText}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => {
              if (onConfirm) {
                onConfirm();
              } else {
                onClose();
              }
            }}
            style={{
              flex: 1,
              height: 50,
              borderRadius: 18,
              backgroundColor: danger
                ? theme.colors.danger ?? "#ef4444"
                : theme.colors.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: theme.colors.background,
                fontWeight: "900",
                fontSize: 16,
              }}
            >
              {confirmText}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
