// Main interactive session
export { InteractiveSession } from "./InteractiveSession.js";
export type { SessionState } from "./InteractiveSession.js";

// Components
export { CommandPrompt } from "./components/CommandPrompt.js";
export type { CommandSuggestion } from "./components/CommandPrompt.js";
export { DescriptionPrompt } from "./components/DescriptionPrompt.js";
export { UnifiedPrompt } from "./components/UnifiedPrompt.js";
export type { PromptMode } from "./components/UnifiedPrompt.js";
export { StreamingOutput } from "./components/StreamingOutput.js";
export type { StreamingLine } from "./components/StreamingOutput.js";
export { SimpleSelector } from "./components/SimpleSelector.js";
export type { SimpleSelectorOption } from "./components/SimpleSelector.js";
export { TaskSelector } from "./components/TaskSelector.js";
export type { TaskListItem } from "./components/TaskSelector.js";

// UI Primitives
export { PromptBox } from "./PromptBox.js";
export { SelectInput } from "./SelectInput.js";
export { TextInput } from "./TextInput.js";

// Standalone flows (for backward compatibility)
export { runAuthLoginUI } from "./AuthLoginFlow.js";
export { runModelSelectUI } from "./ModelSelectFlow.js";
export { runProviderSelectUI } from "./components/SelectProvider.js";
