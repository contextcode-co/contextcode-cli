declare module "ink-text-input" {
  import type { ComponentType } from "react";

  export type InkTextInputProps = {
    value: string;
    placeholder?: string;
    focus?: boolean;
    showCursor?: boolean;
    highlightPastedText?: boolean;
    onChange: (value: string) => void;
    onSubmit?: (value: string) => void;
  };

  const TextInput: ComponentType<InkTextInputProps>;
  export default TextInput;
}
