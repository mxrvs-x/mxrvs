import { useTheme } from "@/lib/theme";
import * as ImagePicker from "expo-image-picker";
import { Camera, Download, Image as ImageIcon, Share2, X } from "lucide-react-native";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ExportAction = "save" | "share";

type ExportBackgroundPickerProps = {
  action: ExportAction | null;
  exporting: boolean;
  selectedUri: string | null;
  visible: boolean;
  onClose: () => void;
  onExport: () => void;
  onSelect: (uri: string | null) => void;
};

export default function ExportBackgroundPicker({
  action,
  exporting,
  selectedUri,
  visible,
  onClose,
  onExport,
  onSelect,
}: ExportBackgroundPickerProps) {
  const theme = useTheme();

  async function pickFromGallery() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow photo library access to choose an export background.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [4, 5],
      mediaTypes: ["images"],
      quality: 0.95,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      onSelect(result.assets[0].uri);
    }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow camera access to take an export background photo.",
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.95,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      onSelect(result.assets[0].uri);
    }
  }

  const actionText = action === "share" ? "Share PNG" : "Save PNG";
  const ActionIcon = action === "share" ? Share2 : Download;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView
        edges={["top", "bottom"]}
        style={{ flex: 1, backgroundColor: theme.colors.background }}
      >
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Pressable
            onPress={onClose}
            disabled={exporting}
            style={{
              width: 46,
              height: 46,
              alignItems: "center",
              justifyContent: "center",
              opacity: exporting ? 0.5 : 1,
            }}
          >
            <X size={30} color={theme.colors.text} />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: theme.colors.text,
                fontSize: 22,
                fontWeight: "900",
              }}
            >
              Customize Background
            </Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 3 }}>
              Choose a photo before exporting.
            </Text>
          </View>
        </View>

        <View style={{ flex: 1, padding: 16 }}>
          <View
            style={{
              flex: 1,
              borderRadius: 20,
              overflow: "hidden",
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {selectedUri ? (
              <Image
                source={{ uri: selectedUri }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : (
              <View style={{ alignItems: "center", padding: 24 }}>
                <ImageIcon size={42} color={theme.colors.textMuted} />
                <Text
                  style={{
                    color: theme.colors.text,
                    fontSize: 18,
                    fontWeight: "900",
                    marginTop: 14,
                  }}
                >
                  Default background
                </Text>
                <Text
                  style={{
                    color: theme.colors.textMuted,
                    textAlign: "center",
                    marginTop: 6,
                    lineHeight: 20,
                  }}
                >
                  Export now, or add a photo from your gallery or camera.
                </Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
            <OptionButton
              icon={<ImageIcon size={18} color={theme.colors.text} />}
              label="Gallery"
              onPress={pickFromGallery}
              disabled={exporting}
            />
            <OptionButton
              icon={<Camera size={18} color={theme.colors.text} />}
              label="Camera"
              onPress={takePhoto}
              disabled={exporting}
            />
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
            {selectedUri ? (
              <Pressable
                onPress={() => onSelect(null)}
                disabled={exporting}
                style={{
                  minHeight: 48,
                  paddingHorizontal: 16,
                  borderRadius: 16,
                  backgroundColor: theme.colors.surfaceAlt,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: exporting ? 0.5 : 1,
                }}
              >
                <Text style={{ color: theme.colors.text, fontWeight: "900" }}>
                  Clear
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={onExport}
              disabled={exporting}
              style={{
                flex: 1,
                minHeight: 48,
                borderRadius: 16,
                backgroundColor: theme.colors.primary,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 8,
                opacity: exporting ? 0.5 : 1,
              }}
            >
              {exporting ? (
                <ActivityIndicator color={theme.colors.textInverse} />
              ) : (
                <ActionIcon size={18} color={theme.colors.textInverse} />
              )}
              <Text
                style={{
                  color: theme.colors.textInverse,
                  fontWeight: "900",
                }}
              >
                {actionText}
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function OptionButton({
  disabled,
  icon,
  label,
  onPress,
}: {
  disabled: boolean;
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        flex: 1,
        minHeight: 48,
        borderRadius: 16,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon}
      <Text style={{ color: theme.colors.text, fontWeight: "900" }}>
        {label}
      </Text>
    </Pressable>
  );
}
