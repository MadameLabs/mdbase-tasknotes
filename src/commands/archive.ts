import { withCollection, resolveTaskPath } from "../collection.js";
import { showError, showSuccess } from "../format.js";
import { normalizeFrontmatter, denormalizeFrontmatter, resolveDisplayTitle } from "../field-mapping.js";

export async function archiveCommand(
  pathOrTitle: string,
  options: { path?: string },
): Promise<void> {
  try {
    await withCollection(async (collection, mapping) => {
      const taskPath = await resolveTaskPath(collection, pathOrTitle, mapping);
      const read = await collection.read(taskPath);

      if (read.error) {
        throw new Error(`Failed to read task: ${read.error.message}`);
      }

      const fm = normalizeFrontmatter(read.frontmatter as Record<string, unknown>, mapping);
      const taskTitle = resolveDisplayTitle(fm, mapping, taskPath) || taskPath;
      const tags = Array.isArray(fm.tags) ? [...(fm.tags as string[])] : [];

      if (tags.includes("archive")) {
        showSuccess(`Task "${taskTitle}" is already archived.`);
        return;
      }

      tags.push("archive");

      const result = await collection.update({
        path: taskPath,
        fields: denormalizeFrontmatter({ tags }, mapping),
      });

      if (result.error) {
        throw new Error(`Failed to archive task: ${result.error.message}`);
      }

      showSuccess(`Archived: ${taskTitle}`);
    }, options.path);
  } catch (err) {
    showError((err as Error).message);
    // process.exit aqui abortava no Windows (UV_HANDLE_CLOSING) porque a colecao
    // ainda estava fechando; exitCode deixa o loop drenar e sair com 1 de verdade.
    process.exitCode = 1;
  }
}
