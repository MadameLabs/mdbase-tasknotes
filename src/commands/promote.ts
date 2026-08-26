import { withCollection } from "../collection.js";
import { showError, showSuccess } from "../format.js";

export async function promoteCommand(
  taskPath: string,
  options: { path?: string; responsavel: string; marca: string; projeto: string },
): Promise<void> {
  try {
    if (!taskPath.endsWith(".md")) throw new Error("exact_markdown_path_required");
    await withCollection(async (collection) => {
      const read = await collection.read(taskPath);
      if (read.error) throw new Error(`Failed to read note: ${read.error.message}`);
      const frontmatter = read.frontmatter as Record<string, unknown>;
      const tags = Array.isArray(frontmatter.tags) ? [...frontmatter.tags] : [];
      if (!tags.includes("task")) tags.push("task");
      const result = await collection.update({
        path: taskPath,
        fields: {
          tags,
          status: "to-do",
          Responsavel: [options.responsavel],
          Marca: [options.marca],
          Projeto: [options.projeto],
        },
      });
      if (result.error) throw new Error(`Failed to promote note: ${result.error.message}`);
      showSuccess(`Promoted: ${taskPath}`);
    }, options.path);
  } catch (err) {
    showError((err as Error).message);
    process.exitCode = 1;
  }
}
