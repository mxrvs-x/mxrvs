import ThemedAlert from "@/components/ThemedAlert";
import PaginationControls from "@/components/PaginationControls";
import {
  type CreatineLog,
  deleteCreatineLog,
  loadCreatineLogs,
} from "@/lib/creatine";
import { syncCreatineReminderState } from "@/lib/creatineNotifications";
import { useTheme } from "@/lib/theme";
import { useFocusEffect, useRouter } from "expo-router";
import { Check, ChevronLeft, Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const PAGE_SIZE = 10;

export default function CreatineHistoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [logs, setLogs] = useState<CreatineLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [logToDelete, setLogToDelete] = useState<CreatineLog | null>(null);
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
  const paginatedLogs = useMemo(
    () => logs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [logs, page],
  );

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const loadLogs = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    setLogs(await loadCreatineLogs());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadLogs(true);
    }, [loadLogs]),
  );

  async function refresh() {
    setRefreshing(true);
    await loadLogs();
  }

  async function confirmDelete() {
    if (!logToDelete || deletingId) return;

    const target = logToDelete;
    setLogToDelete(null);
    setDeletingId(target.id);
    await deleteCreatineLog(target);
    await loadLogs();
    await syncCreatineReminderState({ allowImmediate: false });
    setDeletingId(null);
  }

  if (loading) {
    return (
      <SafeAreaView
        edges={["top", "bottom"]}
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <FlatList
        data={paginatedLogs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 20,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        ListHeaderComponent={
          <View style={{ paddingTop: 8, paddingBottom: 18 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to creatine"
              onPress={() => router.back()}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: theme.colors.surface,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}
            >
              <ChevronLeft size={25} color={theme.colors.text} />
            </Pressable>

            <Text
              style={{
                color: theme.colors.text,
                fontSize: 30,
                fontWeight: "900",
                marginTop: 18,
              }}
            >
              Creatine History
            </Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 5 }}>
              {logs.length} total log{logs.length === 1 ? "" : "s"}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View
            style={{
              padding: 22,
              borderRadius: theme.radius.lg,
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.border,
              alignItems: "center",
            }}
          >
            <Text style={{ color: theme.colors.textMuted }}>
              No creatine logs yet.
            </Text>
          </View>
        }
        ListFooterComponent={
          <PaginationControls
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        }
        renderItem={({ item }) => (
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: theme.colors.border,
              padding: 16,
              marginBottom: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: theme.colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Check size={19} color={theme.colors.primary} />
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: 16,
                  fontWeight: "900",
                }}
              >
                {formatDate(item.date)}
              </Text>
              <Text
                style={{
                  color: theme.colors.textMuted,
                  marginTop: 3,
                  fontWeight: "700",
                }}
              >
                {item.grams}g{item.offline ? " · waiting to sync" : ""}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Delete creatine log from ${formatDate(item.date)}`}
              disabled={Boolean(deletingId)}
              onPress={() => setLogToDelete(item)}
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                backgroundColor: theme.colors.surfaceAlt,
                alignItems: "center",
                justifyContent: "center",
                opacity: deletingId === item.id ? 0.5 : 1,
              }}
            >
              {deletingId === item.id ? (
                <ActivityIndicator size="small" color={theme.colors.danger} />
              ) : (
                <Trash2 size={18} color={theme.colors.danger} />
              )}
            </Pressable>
          </View>
        )}
      />

      <ThemedAlert
        visible={Boolean(logToDelete)}
        title="Delete Creatine Log?"
        message={
          logToDelete
            ? `Remove the ${formatDate(logToDelete.date)} log?`
            : "Remove this creatine log?"
        }
        confirmText="Delete"
        cancelText="Cancel"
        danger
        onClose={() => setLogToDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </SafeAreaView>
  );
}
