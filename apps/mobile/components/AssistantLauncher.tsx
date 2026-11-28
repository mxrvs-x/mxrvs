import { ASSISTANT_FULL_NAME, ASSISTANT_NAME, CHAT_PROMPT_LIMIT, createAssistantStorage } from "@/lib/assistantChat";
import { formatAssistantReply, type InlineText, type ReplyTable } from "@/lib/assistantReply";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { useAssistantChat } from "@/lib/useAssistantChat";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Maximize2, Minimize2, Plus, Send, Sparkles, X } from "lucide-react-native";
import { useRef, useState, type ComponentRef } from "react";
import {
  Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

function assistantEndpoint() {
  try {
    const url = new URL(process.env.EXPO_PUBLIC_AI_API_URL ?? "");
    if (url.username || url.password) return "";
    if (url.protocol === "https:" || (__DEV__ && url.protocol === "http:")) return url.href;
  } catch {
    return "";
  }
  return "";
}

const endpoint = assistantEndpoint();
const storage = createAssistantStorage(AsyncStorage);

export default function AssistantLauncher({ tabBarHeight, keyboardOpen }: { tabBarHeight: number; keyboardOpen: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const chat = useAssistantChat(supabase, endpoint, storage);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const transcript = useRef<ComponentRef<typeof ScrollView>>(null);
  const sendDisabled = !endpoint || !chat.ready || !chat.draft.trim() || chat.sending;

  function close() {
    Keyboard.dismiss();
    setOpen(false);
  }

  return (
    <>
      {!open && !keyboardOpen && (
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${ASSISTANT_NAME}`} onPress={() => setOpen(true)}
          style={[styles.launcher, {
            bottom: (tabBarHeight || 64 + Math.max(insets.bottom, 8)) + 12,
            right: insets.right + 16,
            backgroundColor: colors.primaryFill,
          }]}>
          <Sparkles size={25} color={colors.textInverse} />
        </Pressable>
      )}
      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <KeyboardAvoidingView style={styles.overlay} behavior="padding">
          <SafeAreaView style={styles.overlayContent}>
            <Pressable onPress={close} importantForAccessibility="no" style={StyleSheet.absoluteFill} />
            <View accessibilityViewIsModal style={[styles.screen, expanded || keyboardOpen ? styles.expanded : styles.compact, {
              backgroundColor: colors.background,
              borderColor: colors.border,
            }]}>
              <View style={styles.header}>
                <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{ASSISTANT_NAME}</Text>
                <View style={styles.actions}>
                  <Pressable accessibilityRole="button" accessibilityLabel="New chat" accessibilityState={{ disabled: !chat.ready }}
                    disabled={!chat.ready} onPress={chat.clear}
                    style={[styles.action, { backgroundColor: colors.surfaceAlt, opacity: chat.ready ? 1 : 0.55 }]}>
                    <Plus size={17} color={colors.text} />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={expanded ? "Shrink chat" : "Expand chat"}
                    onPress={() => setExpanded((current) => !current)} style={[styles.action, { backgroundColor: colors.surfaceAlt }]}>
                    {expanded ? <Minimize2 size={17} color={colors.text} /> : <Maximize2 size={17} color={colors.text} />}
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="Close chat" onPress={close}
                    style={[styles.action, { backgroundColor: colors.surfaceAlt }]}>
                    <X size={20} color={colors.text} />
                  </Pressable>
                </View>
              </View>
              <ScrollView ref={transcript} style={styles.transcript} contentContainerStyle={styles.messages} keyboardShouldPersistTaps="handled"
                onContentSizeChange={() => transcript.current?.scrollToEnd({ animated: true })}
                onLayout={() => transcript.current?.scrollToEnd({ animated: false })}>
                {!endpoint ? (
                  <Text accessibilityRole="alert" style={{ color: colors.textMuted }}>
                    {__DEV__
                      ? "Set EXPO_PUBLIC_AI_API_URL to the web server’s /api/assistant URL, then restart Expo."
                      : "This build needs the deployed assistant’s HTTPS URL."}
                  </Text>
                ) : !chat.ready ? (
                  <Text accessibilityLiveRegion="polite" style={{ color: colors.textMuted }}>
                    {chat.signedOut ? "Sign in to use the assistant." : "Loading chat…"}
                  </Text>
                ) : !chat.messages.length && (
                  <View style={[styles.empty, { backgroundColor: colors.surface }]}>
                    <Sparkles size={28} color={colors.primary} />
                    <Text style={[styles.heading, { color: colors.text }]}>What are you working on?</Text>
                    <Text style={{ color: colors.textMuted }}>{ASSISTANT_FULL_NAME}</Text>
                    {chat.starters.map((prompt) => (
                      <Pressable accessibilityRole="button" key={prompt} onPress={() => chat.send(prompt)}
                        style={[styles.prompt, { backgroundColor: colors.surfaceAlt }]}>
                        <Text style={{ color: colors.text, fontWeight: "700" }}>{prompt}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                {chat.messages.map((message, index) => {
                  const fromUser = message.role === "user";
                  return (
                    <View key={index} style={[styles.message, {
                      alignSelf: fromUser ? "flex-end" : "flex-start",
                      backgroundColor: fromUser ? colors.primarySoft : colors.surface,
                    }]}>
                      <Text style={[styles.label, { color: colors.primary }]}>{fromUser ? "You" : ASSISTANT_NAME}</Text>
                      {fromUser ? (
                        <Text selectable style={[styles.body, { color: colors.text }]}>{message.content}</Text>
                      ) : (
                        <AssistantReply content={message.content} color={colors.text} />
                      )}
                    </View>
                  );
                })}
                {chat.sending && <Text accessibilityLiveRegion="polite" style={{ color: colors.textMuted }}>Thinking…</Text>}
                {chat.error ? (
                  <View style={styles.empty}>
                    <Text accessibilityRole="alert" style={{ color: colors.danger }}>{chat.error}</Text>
                    <Pressable accessibilityRole="button" onPress={chat.retry} style={[styles.prompt, { backgroundColor: colors.surfaceAlt }]}>
                      <Text style={{ color: colors.text, fontWeight: "700" }}>Retry</Text>
                    </Pressable>
                  </View>
                ) : null}
                {chat.storageError ? <Text style={{ color: colors.textMuted }}>{chat.storageError}</Text> : null}
              </ScrollView>
              <View style={styles.composer}>
                <TextInput accessibilityLabel="Message" placeholder="Ask about workouts, nutrition, or recovery"
                  placeholderTextColor={colors.textMuted} value={chat.draft} onChangeText={chat.setDraft}
                  editable={Boolean(endpoint) && chat.ready} multiline maxLength={CHAT_PROMPT_LIMIT}
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} />
                <Pressable accessibilityRole="button" accessibilityLabel="Send message" accessibilityState={{ disabled: sendDisabled }}
                  disabled={sendDisabled} onPress={() => chat.send(chat.draft)}
                  style={[styles.send, { backgroundColor: colors.primaryFill, opacity: sendDisabled ? 0.55 : 1 }]}>
                  <Send size={20} color={colors.textInverse} />
                </Pressable>
              </View>
              <Text style={[styles.privacy, { color: colors.textMuted }]}>
                Your messages and relevant records are sent to Groq to answer your questions.
              </Text>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function ReplyText({ parts }: { parts: InlineText[] }) {
  return parts.map(({ text, style }, index) => (
    <Text key={index} style={[
      (style === "bold" || style === "boldItalic") && styles.bold,
      (style === "italic" || style === "boldItalic") && styles.italic,
      style === "code" && styles.code,
    ]}>{text}</Text>
  ));
}

function AssistantReply({ content, color }: { content: string; color: string }) {
  const body = [styles.body, { color }];
  return (
    <View style={styles.reply}>
      {formatAssistantReply(content).map((block, index) => {
        if (block.kind === "table") return <AssistantTable key={index} table={block} />;
        if (block.kind === "list") {
          return <View key={index} style={styles.list}>{block.items.map((item, itemIndex) => (
            <View key={itemIndex} style={styles.listItem}>
              <Text style={body}>{block.ordered ? `${item.number}.` : "•"}</Text>
              <Text selectable style={[...body, styles.listText]}><ReplyText parts={item.text} /></Text>
            </View>
          ))}</View>;
        }
        return <Text key={index} selectable style={[...body, block.kind === "heading" && styles.bold]}>
          <ReplyText parts={block.text} />
        </Text>;
      })}
    </View>
  );
}

function AssistantTable({ table }: { table: ReplyTable }) {
  const { colors } = useTheme();
  const rows = [table.headers, ...table.rows];
  const widths = table.headers.map((_, column) => {
    const lengths = rows.map((row) => row[column].reduce((length, part) => length + part.text.length, 0));
    return Math.min(240, Math.max(100, 20 + 7 * Math.max(...lengths)));
  });

  return (
    <View style={[styles.table, { borderColor: colors.border }]}>
      <ScrollView style={styles.tableScroll} horizontal nestedScrollEnabled showsHorizontalScrollIndicator keyboardShouldPersistTaps="handled">
        <View>
          {rows.map((row, index) => (
            <View key={index} style={[styles.tableRow, {
              backgroundColor: index === 0 ? colors.primarySoft : colors.surfaceAlt,
              borderBottomColor: colors.border,
              borderBottomWidth: index < rows.length - 1 ? StyleSheet.hairlineWidth : 0,
            }]}>
              {row.map((cell, column) => (
                <View key={column} style={[styles.tableCell, { width: widths[column] }]}>
                  <Text selectable accessibilityRole={index === 0 ? "header" : undefined} style={[
                    styles.body, index === 0 && styles.bold, { color: colors.text, textAlign: table.alignment[column] },
                  ]}>
                    <ReplyText parts={cell} />
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  launcher: { position: "absolute", zIndex: 20, elevation: 7, width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  overlay: { flex: 1, backgroundColor: "rgba(4,10,18,0.6)" },
  overlayContent: { flex: 1, justifyContent: "flex-end", padding: 8 },
  screen: { minHeight: 0, padding: 12, borderWidth: 1, borderRadius: 20 },
  expanded: { flex: 1 },
  compact: { height: "70%" },
  transcript: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  title: { fontSize: 21, fontWeight: "900" },
  heading: { fontSize: 19, fontWeight: "800" },
  actions: { flexDirection: "row", gap: 6 },
  action: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  messages: { gap: 12, paddingVertical: 14 },
  empty: { borderRadius: 18, padding: 14, gap: 10 },
  prompt: { minHeight: 44, borderRadius: 12, justifyContent: "center", paddingHorizontal: 12, paddingVertical: 8 },
  message: { maxWidth: "92%", borderRadius: 16, padding: 13, gap: 4 },
  label: { fontSize: 12, fontWeight: "800" },
  body: { fontSize: 15, lineHeight: 22, flexShrink: 1 },
  reply: { gap: 8 },
  list: { gap: 4 },
  listItem: { flexDirection: "row", gap: 8 },
  listText: { flex: 1 },
  table: { borderWidth: 1, borderRadius: 12, overflow: "hidden", maxWidth: "100%" },
  tableScroll: { flexGrow: 0 },
  tableRow: { flexDirection: "row" },
  tableCell: { paddingHorizontal: 10, paddingVertical: 8 },
  bold: { fontWeight: "800" },
  italic: { fontStyle: "italic" },
  code: { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  input: { flex: 1, minHeight: 48, maxHeight: 116, borderRadius: 14, borderWidth: 1, padding: 12, fontSize: 15 },
  send: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  privacy: { fontSize: 12, marginTop: 8 },
});
