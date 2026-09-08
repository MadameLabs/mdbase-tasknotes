import { withCollection, resolveTaskPath } from "../collection.js";
import { showError, showSuccess } from "../format.js";
import { normalizeFrontmatter, denormalizeFrontmatter, resolveDisplayTitle } from "../field-mapping.js";

export async function updateCommand(
  pathOrTitle: string,
  options: {
    path?: string;
    status?: string;
    priority?: string;
    due?: string;
    scheduled?: string;
    title?: string;
    addTag?: string[];
    removeTag?: string[];
    addContext?: string[];
    removeContext?: string[];
    set?: string[];
    setNew?: string[];
    setNewList?: string[];
  },
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
      const fields: Record<string, unknown> = {};

      if (options.status) fields.status = options.status;
      if (options.priority) fields.priority = options.priority;
      if (options.due) fields.due = options.due;
      if (options.scheduled) fields.scheduled = options.scheduled;
      if (options.title) fields.title = options.title;

      // --set e exato de proposito: so escreve o que ja esta no frontmatter,
      // para uma tarefa errada nunca ganhar campo por engano. Promover uma
      // nota comum precisa do oposto, e por isso --set-new e uma flag separada
      // em vez de um relaxamento do guard.
      const assign = (assignment: string, allowNew: boolean): void => {
        const separator = assignment.indexOf("=");
        if (separator <= 0) throw new Error("invalid_set_assignment");
        const field = assignment.slice(0, separator).trim();
        const value = assignment.slice(separator + 1);
        if (!field) throw new Error("invalid_set_assignment");
        if (!allowNew && !(field in (read.frontmatter as Record<string, unknown>))) {
          throw new Error(`unknown_field:${field}`);
        }
        fields[field] = value;
      };

      for (const assignment of options.set ?? []) assign(assignment, false);
      for (const assignment of options.setNew ?? []) assign(assignment, true);

      // Campo de lista segue o padrao de --add-tag: a flag monta o array. A
      // primeira atribuicao substitui o que estava la, e as seguintes do mesmo
      // campo acumulam, para promover duas vezes nao duplicar o valor.
      const listed = new Set<string>();
      for (const assignment of options.setNewList ?? []) {
        const separator = assignment.indexOf("=");
        if (separator <= 0) throw new Error("invalid_set_assignment");
        const field = assignment.slice(0, separator).trim();
        const value = assignment.slice(separator + 1);
        if (!field) throw new Error("invalid_set_assignment");
        if (!listed.has(field)) {
          listed.add(field);
          fields[field] = [];
        }
        (fields[field] as unknown[]).push(value);
      }

      // Handle tag modifications
      if (options.addTag || options.removeTag) {
        let tags = Array.isArray(fm.tags) ? [...(fm.tags as string[])] : [];
        if (options.addTag) {
          for (const t of options.addTag) {
            if (!tags.includes(t)) tags.push(t);
          }
        }
        if (options.removeTag) {
          tags = tags.filter((t) => !options.removeTag!.includes(t));
        }
        fields.tags = tags;
      }

      // Handle context modifications
      if (options.addContext || options.removeContext) {
        let contexts = Array.isArray(fm.contexts) ? [...(fm.contexts as string[])] : [];
        if (options.addContext) {
          for (const c of options.addContext) {
            if (!contexts.includes(c)) contexts.push(c);
          }
        }
        if (options.removeContext) {
          contexts = contexts.filter((c) => !options.removeContext!.includes(c));
        }
        fields.contexts = contexts;
      }

      if (Object.keys(fields).length === 0) {
        throw new Error("No fields to update. Use flags like --status, --priority, --due, etc.");
      }

      const result = await collection.update({
        path: taskPath,
        fields: denormalizeFrontmatter(fields, mapping),
      });

      if (result.error) {
        throw new Error(`Failed to update task: ${result.error.message}`);
      }

      showSuccess(`Updated: ${taskTitle}`);
    }, options.path);
  } catch (err) {
    showError((err as Error).message);
    process.exitCode = 1;
  }
}
