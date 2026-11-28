import PaginationControls from "@/components/PaginationControls";
import ThemedAlert from "@/components/ThemedAlert";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { Pencil, Trash2, X } from "lucide-react-native";
import { useState } from "react";
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatMacroDate, isMacroDate, macroFields, macroToday, type DailyMacroLog } from "@/lib/dailyMacros";
import { useDailyMacroHistory, useDailyMacros, useMacroLogEditor } from "@/lib/useDailyMacros";

export default function MacrosScreen() {
  const { colors } = useTheme();
  const [date, setDate] = useState(macroToday);
  const today = macroToday();
  const validDate = isMacroDate(date) && date <= today;
  const history = useDailyMacroHistory(supabase, 5);
  const [selectedLog, setSelectedLog] = useState<DailyMacroLog | null>(null);
  const [notice, setNotice] = useState<"logged" | "deleted" | null>(null);
  const [formRevision, setFormRevision] = useState(0);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 20, gap: 16 }}>
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 28, fontWeight: "800" }}>Daily Macros</Text>
        <View style={{ padding: 16, gap: 14, borderRadius: 18, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>Date (YYYY-MM-DD)</Text>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setDate(today)}>
              <Text style={{ color: colors.primary, fontWeight: "800" }}>Today</Text>
            </Pressable>
          </View>
          <TextInput
            accessibilityLabel="Date (YYYY-MM-DD)"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={10}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textMuted}
            value={date}
            onChangeText={setDate}
            style={inputStyle(colors)}
          />
          {validDate ? <MacroForm key={`${date}:${formRevision}`} date={date} onSaved={() => {
            Keyboard.dismiss();
            history.refresh();
            setNotice("logged");
          }} /> : (
            <Text style={{ color: colors.textMuted }}>Enter today or an earlier date.</Text>
          )}
        </View>
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}>Macro History</Text>
            <Pressable accessibilityRole="button" hitSlop={8} disabled={history.loading} onPress={history.refresh}>
              <Text style={{ color: colors.primary, fontWeight: "800" }}>{history.error ? "Retry" : "Refresh"}</Text>
            </Pressable>
          </View>
          {history.loading && <Text style={{ color: colors.textMuted }}>Loading history…</Text>}
          {history.error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{history.error}</Text> : null}
          {!history.loading && !history.error && history.rows.length === 0 && (
            <Text style={{ color: colors.textMuted }}>No macro logs yet.</Text>
          )}
          {history.rows.map((row) => (
            <Pressable
              key={row.log_date}
              accessibilityRole="button"
              accessibilityHint="Opens this day's macro log"
              onPress={() => setSelectedLog(row)}
              style={{ padding: 16, gap: 10, borderRadius: 18, backgroundColor: colors.surface }}
            >
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>{formatMacroDate(row.log_date)}</Text>
              <MacroValues row={row} />
            </Pressable>
          ))}
          <PaginationControls page={history.page} totalPages={history.totalPages} onPageChange={history.setPage} />
        </View>
      </ScrollView>
      {selectedLog && (
        <MacroLogModal
          row={selectedLog}
          onClose={() => setSelectedLog(null)}
          onSaved={history.refreshPage}
          onDeleted={() => {
            if (date === selectedLog.log_date) setFormRevision((value) => value + 1);
            setSelectedLog(null);
            history.refresh();
            setNotice("deleted");
          }}
        />
      )}
      <ThemedAlert
        visible={notice !== null}
        title={notice === "deleted" ? "Deleted" : "Logged"}
        message={notice === "deleted" ? "Your macro log was deleted." : "Your daily macros were saved."}
        onClose={() => setNotice(null)}
      />
    </SafeAreaView>
  );
}

function inputStyle(colors: ReturnType<typeof useTheme>["colors"]) {
  return {
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 48,
    fontSize: 16,
  };
}

function MacroForm({ date, onSaved }: { date: string; onSaved: () => void }) {
  const { colors } = useTheme();
  const log = useDailyMacros(supabase, date, onSaved);

  if (log.loading) return <Text style={{ color: colors.textMuted }}>Loading macros…</Text>;
  const disabled = log.saving || (log.ready && !log.canSave);

  return (
    <>
      {log.ready && macroFields.map(({ key, label, unit }) => (
        <View key={key} style={{ gap: 6 }}>
          <Text style={{ color: colors.text, fontWeight: "700" }}>{label} ({unit})</Text>
          <TextInput
            accessibilityLabel={`${label} (${unit})`}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            value={log.draft[key]}
            editable={!log.saving && !log.existing}
            onChangeText={(value) => log.edit(key, value)}
            style={inputStyle(colors)}
          />
        </View>
      ))}
      {log.error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{log.error}</Text> : null}
      {log.existing && !log.error ? (
        <Text style={{ color: colors.textMuted }}>Already logged. Open the entry in Macro History to edit it.</Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={log.ready ? () => void log.save() : log.reload}
        style={{
          minHeight: 48,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primaryFill,
          borderRadius: 12,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <Text style={{ color: colors.textInverse, fontWeight: "800" }}>
          {log.saving ? "Saving…" : !log.ready ? "Retry" : "Save macros"}
        </Text>
      </Pressable>
    </>
  );
}

function MacroValues({ row }: { row: DailyMacroLog }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {macroFields.map(({ key, label, unit }) => (
        <Text key={key} style={{ color: colors.textMuted, width: "47%" }}>
          {label} <Text style={{ color: colors.text, fontWeight: "700" }}>{row[key]} {unit}</Text>
        </Text>
      ))}
    </View>
  );
}

function MacroLogModal({ row, onClose, onSaved, onDeleted }: {
  row: DailyMacroLog;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const { colors } = useTheme();
  const editor = useMacroLogEditor(supabase, row, onSaved, onDeleted);

  function dismiss() {
    if (editor.saving || editor.deleting) return;
    if (editor.confirmingDelete) editor.setDeleteConfirmation(false);
    else if (editor.editing) editor.cancel();
    else onClose();
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: "center", padding: 16 }}
        >
          <View
            accessibilityViewIsModal
            style={{
              width: "100%", maxWidth: 460, maxHeight: "100%", alignSelf: "center",
              backgroundColor: colors.surface, borderRadius: 18,
              borderWidth: 1, borderColor: colors.border,
            }}
          >
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <Text accessibilityRole="header" style={{ flex: 1, color: colors.text, fontSize: 22, fontWeight: "800" }}>
                  {formatMacroDate(row.log_date)}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  disabled={editor.saving || editor.deleting}
                  onPress={onClose}
                  style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
                >
                  <X size={22} color={colors.text} />
                </Pressable>
              </View>
              {editor.editing ? macroFields.map(({ key, label, unit }) => (
                <View key={key} style={{ gap: 6 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>{label} ({unit})</Text>
                  <TextInput
                    accessibilityLabel={`${label} (${unit})`}
                    style={inputStyle(colors)}
                    value={editor.draft[key]}
                    keyboardType="decimal-pad"
                    editable={!editor.saving}
                    onChangeText={(value) => editor.edit(key, value)}
                  />
                </View>
              )) : <MacroValues row={editor.row} />}
              {editor.confirmingDelete && <Text style={{ color: colors.text }}>Delete this day’s macro log? This can’t be undone.</Text>}
              {editor.error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{editor.error}</Text> : null}
              {editor.confirmingDelete ? (
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <MacroModalAction
                    label={editor.deleting ? "Deleting…" : "Delete log"}
                    danger
                    disabled={editor.deleting}
                    onPress={() => void editor.remove()}
                  />
                  <MacroModalAction label="Cancel" disabled={editor.deleting} onPress={dismiss} />
                </View>
              ) : <View style={{ flexDirection: "row", gap: 10 }}>
                <MacroModalAction
                  label={editor.saving ? "Saving…" : editor.editing ? "Save" : "Update"}
                  icon={editor.editing ? undefined : Pencil}
                  primary
                  disabled={editor.saving}
                  onPress={editor.editing ? () => void editor.save() : editor.startEditing}
                />
                {editor.editing ? (
                  <MacroModalAction label="Cancel" disabled={editor.saving} onPress={dismiss} />
                ) : (
                  <MacroModalAction label="Delete" icon={Trash2} danger disabled={false} onPress={() => editor.setDeleteConfirmation(true)} />
                )}
              </View>}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function MacroModalAction({ label, icon: Icon, primary = false, danger = false, disabled, onPress }: {
  label: string;
  icon?: typeof Pencil;
  primary?: boolean;
  danger?: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const color = primary || danger ? colors.textInverse : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={{
        flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1,
        borderColor: danger ? colors.danger : primary ? colors.primary : colors.border,
        backgroundColor: danger ? colors.danger : primary ? colors.primaryFill : colors.surfaceAlt,
        alignItems: "center", justifyContent: "center", opacity: disabled ? 0.6 : 1,
      }}
    >
      {Icon ? <Icon color={color} size={20} /> : <Text style={{ color, fontWeight: "800" }}>{label}</Text>}
    </Pressable>
  );
}
