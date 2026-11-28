import PaginationControls from "@/components/PaginationControls";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { formatOverallActivity, useOverallActivityHistory } from "@/lib/useOverallActivityHistory";
import { useIsFocused } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function DailyActivityHistory() {
  const { colors } = useTheme();
  const [page, setPage] = useState(1);
  const focused = useIsFocused();
  const history = useOverallActivityHistory(supabase, page, focused);

  return (
    <View style={[styles.content, { backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Daily totals</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: history.loading }}
          disabled={history.loading} onPress={history.refresh}
          style={[styles.button, { backgroundColor: colors.surfaceAlt, opacity: history.loading ? 0.6 : 1 }]}>
          <Text style={{ color: colors.text, fontWeight: "800" }}>{history.error ? "Retry" : "Refresh"}</Text>
        </Pressable>
      </View>
      {history.loading && <Text accessibilityLiveRegion="polite" style={{ color: colors.textMuted }}>Loading activity records…</Text>}
      {history.error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{history.error}</Text> : null}
      {!history.loading && !history.error && history.rows.length === 0 && (
        <Text style={{ color: colors.textMuted }}>{page === 1 ? "No daily activity has synced yet." : "No records on this page."}</Text>
      )}
      {history.rows.map((record) => {
        const activity = formatOverallActivity(record);
        const stats = [
          ["Steps", activity.steps],
          ["Moving time", activity.movingTime],
          ["Est. calories", activity.calories],
        ];

        return (
          <View key={record.id} style={[styles.record, { borderColor: colors.border }]}>
            <Text accessibilityRole="header" style={[styles.date, { color: colors.text }]}>{activity.date}</Text>
            <View style={styles.stats}>
              {stats.map(([label, value]) => (
                <View key={label} style={styles.stat}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
                  <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
        );
      })}
      <PaginationControls page={page} totalPages={Math.max(page, history.totalPages)} onPageChange={setPage} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, borderRadius: 20, gap: 8 },
  header: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { fontSize: 18, fontWeight: "900" },
  button: { minHeight: 44, paddingHorizontal: 14, borderRadius: 12, justifyContent: "center" },
  record: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 10, gap: 6 },
  date: { fontSize: 15, fontWeight: "800" },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stat: { flexGrow: 1, flexBasis: 78, paddingVertical: 2 },
  label: { fontSize: 12, fontWeight: "700" },
  value: { fontSize: 15, fontWeight: "800", marginTop: 2 },
});
