// =============================================================================
// TUI - Terminal User Interface Components
// =============================================================================
// 
// Organized structure:
//   primitives/  - Basic building blocks (TextInput, SelectInput)
//   layouts/     - Container/structure components (PromptBox)
//   components/  - Composite UI components (SimpleSelector, TaskSelector)
//   flows/       - Multi-step interactive screens (AuthLoginFlow, etc.)
//
// =============================================================================

// Primitives - Basic UI building blocks
export { TextInput } from "./primitives/TextInput.js";
export type { TextInputProps } from "./primitives/TextInput.js";
export { SelectInput } from "./primitives/SelectInput.js";
export type { SelectOption, SelectInputProps } from "./primitives/SelectInput.js";

// Layouts - Container and structure components
export { PromptBox } from "./layouts/PromptBox.js";
export type { Step, PromptBoxProps } from "./layouts/PromptBox.js";

// Components - Composite UI components
export { SimpleSelector } from "./components/SimpleSelector.js";
export type { SimpleSelectorOption, SimpleSelectorProps } from "./components/SimpleSelector.js";
export { TaskSelector } from "./components/TaskSelector.js";
export type { TaskListItem, TaskSelectorProps } from "./components/TaskSelector.js";
export { DescriptionPrompt } from "./components/DescriptionPrompt.js";
export type { DescriptionPromptProps } from "./components/DescriptionPrompt.js";

// Flows - Multi-step interactive screens
export { AuthLoginFlow, runAuthLoginUI } from "./flows/AuthLoginFlow.js";
export { ModelSelectFlow, runModelSelectUI } from "./flows/ModelSelectFlow.js";
export { ProviderSelectFlow, runProviderSelectUI } from "./flows/ProviderSelectFlow.js";
export type { ProviderOption } from "./flows/ProviderSelectFlow.js";
