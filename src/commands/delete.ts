import { withCollection, resolveTaskPath } from "../collection.js";
import { showError, showSuccess, showWarning } from "../format.js";

export async function deleteCommand(
  pathOrTitle: string,
  options: { path?: string; force?: boolean },
): Promise<void> {
  try {
    await withCollection(async (collection, mapping) => {
      const taskPath = await resolveTaskPath(collection, pathOrTitle, mapping);

      // Check backlinks unless forced
      if (!options.force) {
        const result = await collection.delete(taskPath, { check_backlinks: true });

        if (result.broken_links && result.broken_links.length > 0) {
          showWarning(`Task has ${result.broken_links.length} backlink(s):`);
          for (const link of result.broken_links) {
            console.log(`  - ${link.path}`);
          }
          throw new Error("Use --force to delete anyway.");
        }

        if (result.error) {
          throw new Error(`Failed to delete task: ${result.error.message}`);
        }

        showSuccess(`Deleted: ${taskPath}`);
      } else {
        const result = await collection.delete(taskPath);

        if (result.error) {
          throw new Error(`Failed to delete task: ${result.error.message}`);
        }

        showSuccess(`Deleted: ${taskPath}`);
      }
    }, options.path);
  } catch (err) {
    showError((err as Error).message);
    // process.exit aqui abortava no Windows (UV_HANDLE_CLOSING) porque a colecao
    // ainda estava fechando; exitCode deixa o loop drenar e sair com 1 de verdade.
    process.exitCode = 1;
  }
}
