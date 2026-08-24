import { withCollection, resolveTaskPath } from "../collection.js";
import { formatTaskDetailForDate, showError } from "../format.js";
import { normalizeFrontmatter, resolveDisplayTitle } from "../field-mapping.js";
import type { TaskResult } from "../types.js";
import { validateDateString } from "../date.js";

export async function showCommand(
  pathOrTitle: string,
  options: { path?: string; on?: string },
): Promise<void> {
  try {
    const asOfDate = options.on ? validateDateString(options.on) : undefined;
    await withCollection(async (collection, mapping) => {
      const taskPath = await resolveTaskPath(collection, pathOrTitle, mapping);
      const result = await collection.read(taskPath);

      if (result.error) {
        throw new Error(`Failed to read task: ${result.error.message}`);
      }

      const fm = normalizeFrontmatter(result.frontmatter as Record<string, unknown>, mapping);
      const displayTitle = resolveDisplayTitle(fm, mapping, taskPath);
      if (displayTitle) {
        fm.title = displayTitle;
      }

      const task: TaskResult = {
        path: taskPath,
        frontmatter: fm as any,
        body: result.body,
      };

      console.log(formatTaskDetailForDate(task, asOfDate));
    }, options.path);
  } catch (err) {
    showError((err as Error).message);
    // process.exit aqui abortava no Windows (UV_HANDLE_CLOSING) porque a colecao
    // ainda estava fechando; exitCode deixa o loop drenar e sair com 1 de verdade.
    process.exitCode = 1;
  }
}
