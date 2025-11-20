import { indexRepo } from "./indexer.js";
const cwd = process.cwd();
(async () => {
  const res = await indexRepo(cwd);
  console.log("Index result:", JSON.stringify(res, null, 2));
})();
