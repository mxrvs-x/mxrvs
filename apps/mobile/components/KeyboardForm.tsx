import { createContext, useContext, useEffect, useRef, type ComponentRef } from "react";
import { ScrollView, TextInput, type ScrollViewProps, type TextInputProps } from "react-native";

type Input = ComponentRef<typeof TextInput>;
const RevealField = createContext<((input: Input) => void) | null>(null);
const FIELD_GAP = 12;

export function KeyboardFormInput({ onFocus, ...props }: TextInputProps) {
  const input = useRef<Input>(null);
  const reveal = useContext(RevealField);

  return (
    <TextInput
      {...props}
      ref={input}
      onFocus={(event) => {
        if (input.current) reveal?.(input.current);
        onFocus?.(event);
      }}
    />
  );
}

export function KeyboardFormScrollView({
  onLayout,
  onScroll,
  onContentSizeChange,
  keyboardShouldPersistTaps = "handled",
  ...props
}: ScrollViewProps) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const field = useRef<Input | null>(null);
  const viewportHeight = useRef(0);
  const scrollY = useRef(0);
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => () => {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
  }, []);

  function revealField() {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = undefined;
      const input = field.current;
      const content = scroll.current?.getInnerViewRef();
      const height = viewportHeight.current;
      if (!input?.isFocused() || !content || height <= 0) return;

      input.measureLayout(content, (_x, top, _width, inputHeight) => {
        if (field.current !== input || !input.isFocused()) return;
        const offset = scrollY.current;
        const leading = top - FIELD_GAP;
        const trailing = top + inputHeight + FIELD_GAP;
        let next = offset;
        if (leading < offset) next = Math.max(0, leading);
        else if (trailing > offset + height) next = Math.max(0, Math.min(leading, trailing - height));
        if (next !== offset) {
          scroll.current?.scrollTo({ y: next, animated: false });
        }
      });
    });
  }

  return (
    <RevealField.Provider value={(input) => {
      field.current = input;
      revealField();
    }}>
      <ScrollView
        {...props}
        ref={scroll}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        scrollEventThrottle={16}
        onLayout={(event) => {
          viewportHeight.current = event.nativeEvent.layout.height;
          revealField();
          onLayout?.(event);
        }}
        onScroll={(event) => {
          scrollY.current = event.nativeEvent.contentOffset.y;
          onScroll?.(event);
        }}
        onContentSizeChange={(width, height) => {
          revealField();
          onContentSizeChange?.(width, height);
        }}
      />
    </RevealField.Provider>
  );
}
