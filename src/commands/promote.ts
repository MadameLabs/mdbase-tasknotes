import { withCollection } from "../collection.js";
import { denormalizeFrontmatter } from "../field-mapping.js";
import { showError, showSuccess } from "../format.js";

export async function promoteCommand(
  taskPath: string,
  options: { path?: string; responsavel: string; marca: string; projeto: string },
): Promise<void> {
  try {
    if (!taskPath.endsWith(".md")) throw new Error("exact_markdown_path_required");
    await withCollection(async (collection, mapping) => {
      const read = await collection.read(taskPath);
      if (read.error) throw new Error(`Failed to read note: ${read.error.message}`);
      const frontmatter = read.frontmatter as Record<string, unknown>;
      const tags = Array.isArray(frontmatter.tags) ? [...frontmatter.tags] : [];
      if (!tags.includes("task")) tags.push("task");
      // Os campos passam pelo mapeamento da colecao, como no update: `status`
      // e nome canonico do contrato, e o vault decide como ele se chama no
      // disco -- no ENGENHARIA, `Status`. Escrever a chave canonica direto
      // gravava `status:` numa colecao que le `Status:`, e a nota promovida
      // ficava sem status aos olhos do TaskNotes. A colecao criada por `init`
      // mapeia status para si mesmo, entao o defeito nao aparecia nos testes.
      // Responsavel, Marca e Projeto nao tem nome canonico -- sao user field e
      // o nome mapeado de projects neste vault -- e atravessam sem traducao.
      const result = await collection.update({
        path: taskPath,
        fields: denormalizeFrontmatter({
          tags,
          status: "to-do",
          Responsavel: [options.responsavel],
          Marca: [options.marca],
          Projeto: [options.projeto],
        }, mapping),
      });
      if (result.error) throw new Error(`Failed to promote note: ${result.error.message}`);
      showSuccess(`Promoted: ${taskPath}`);
    }, options.path);
  } catch (err) {
    showError((err as Error).message);
    process.exitCode = 1;
  }
}
