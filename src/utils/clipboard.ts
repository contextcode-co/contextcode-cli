import clipboard from "clipboardy";

export async function copyToClipboard(value: string) {
  try {
    await clipboard.write(value);
    console.log("Copied task content to clipboard.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to copy task content: ${message}`);
    throw error;
  }
}
