import path from "node:path";
import { writeJsonFileAtomic } from "../utils/json";

export async function writeAgentLog(agentLogDir: string, prefix: string, payload: unknown) {
  const timestamp = Date.now();
  const filePath = path.join(agentLogDir, `${prefix}-${timestamp}.json`);
  await writeJsonFileAtomic(filePath, payload);
  return filePath;
}
