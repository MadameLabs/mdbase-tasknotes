import chalk from "chalk";
import { basename, dirname } from "node:path";
import { withCollection } from "../collection.js";
import { formatTask, showError } from "../format.js";
import { normalizeFrontmatter, resolveDisplayTitle, isCompletedStatus, taskFilter } from "../field-mapping.js";
import type { TaskResult, TaskFrontmatter } from "../types.js";
import type { Collection } from "@callumalpass/mdbase";
import type { FieldMapping } from "../field-mapping.js";

type InternalResolverContext = {
  files: string[];
  fileCache: Map<string, any>;
  nonMdSet: Set<string>;
};

function fallbackProjectName(raw: string): string {
  const trimmed = raw.trim();
  const wiki = trimmed.match(/^\[\[([\s\S]+)\]\]$/);
  const inner = wiki ? wiki[1] : trimmed;

  const pipeIdx = inner.indexOf("|");
  const target = pipeIdx >= 0 ? inner.slice(0, pipeIdx) : inner;
  const alias = pipeIdx >= 0 ? inner.slice(pipeIdx + 1) : "";

  if (alias.trim().length > 0) {
    return alias.trim();
  }

  const noAnchor = target.split("#")[0].trim();
  const leaf = noAnchor.split("/").pop() || noAnchor;
  return leaf.trim();
}

async function buildResolverContext(collection: Collection): Promise<InternalResolverContext | null> {
  const coll = collection as any;
  if (
    typeof coll.scanFiles !== "function" ||
    typeof coll.buildFileCache !== "function" ||
    typeof coll.scanAllFiles !== "function" ||
    typeof coll.buildNonMarkdownSet !== "function"
  ) {
    return null;
  }

  try {
    const files = await coll.scanFiles();
    const fileCache = await coll.buildFileCache(files);
    const allFiles = await coll.scanAllFiles();
    const nonMdSet = coll.buildNonMarkdownSet(allFiles);
    return { files, fileCache, nonMdSet };
  } catch {
    return null;
  }
}

async function resolveProjectName(
  collection: Collection,
  mapping: FieldMapping,
  sourcePath: string,
  rawProject: string,
  resolverContext: InternalResolverContext | null,
  nameCache: Map<string, string>,
  readCache: Map<string, Record<string, unknown>>,
): Promise<string> {
  const cacheKey = `${dirname(sourcePath)}::${rawProject}`;
  const cached = nameCache.get(cacheKey);
  if (cached) return cached;

  let resolvedName = fallbackProjectName(rawProject);

  try {
    const coll = collection as any;

    if (resolverContext && typeof coll.resolveLinkFullWithFiles === "function") {
      const resolution = coll.resolveLinkFullWithFiles(
        rawProject,
        sourcePath,
        resolverContext.files,
        undefined,
        resolverContext.fileCache,
        resolverContext.nonMdSet,
      );

      const resolvedPath = resolution?.resolved;
      if (typeof resolvedPath === "string" && resolvedPath.length > 0) {
        let targetFm = readCache.get(resolvedPath);

        if (!targetFm) {
          const readResult = await collection.read(resolvedPath);
          if (!readResult.error) {
            targetFm = normalizeFrontmatter(
              (readResult.frontmatter || {}) as Record<string, unknown>,
              mapping,
            );
            readCache.set(resolvedPath, targetFm);
          }
        }

        if (targetFm) {
          const display =
            resolveDisplayTitle(targetFm, mapping, resolvedPath) ||
            (typeof targetFm.title === "string" ? targetFm.title : undefined) ||
            basename(resolvedPath, ".md");

          if (display && display.trim().length > 0) {
            resolvedName = display.trim();
          }
        }
      }
    }
  } catch {
    // Fall back to local extraction when resolution is unavailable or fails.
  }

  nameCache.set(cacheKey, resolvedName);
  return resolvedName;
}

async function resolveTaskProjectNames(
  collection: Collection,
  mapping: FieldMapping,
  task: TaskResult,
  resolverContext: InternalResolverContext | null,
  nameCache: Map<string, string>,
  readCache: Map<string, Record<string, unknown>>,
): Promise<string[]> {
  const rawProjects = Array.isArray(task.frontmatter.projects)
    ? (task.frontmatter.projects as string[])
    : [];

  const names: string[] = [];
  for (const raw of rawProjects) {
    if (typeof raw !== "string" || raw.trim().length === 0) continue;
    const name = await resolveProjectName(
      collection,
      mapping,
      task.path,
      raw,
      resolverContext,
      nameCache,
      readCache,
    );
    if (name.length > 0) {
      names.push(name);
    }
  }

  return names;
}

export async function projectsListCommand(
  options: { path?: string; stats?: boolean },
): Promise<void> {
  try {
    await withCollection(async (collection, mapping) => {
      const result = await collection.query({
        where: taskFilter(mapping),
        limit: 500,
      });

      const rawTasks = (result.results || []) as TaskResult[];
      const tasks = rawTasks.map((t) => {
        const fm = normalizeFrontmatter(t.frontmatter as Record<string, unknown>, mapping);
        const displayTitle = resolveDisplayTitle(fm, mapping, t.path);
        if (displayTitle) {
          fm.title = displayTitle;
        }
        return {
          ...t,
          frontmatter: fm as any as TaskFrontmatter,
        };
      });

      const resolverContext = await buildResolverContext(collection);
      const projectNameCache = new Map<string, string>();
      const readCache = new Map<string, Record<string, unknown>>();

      // Extract unique projects and count tasks
      const projectMap = new Map<
        string,
        { total: number; done: number; open: number }
      >();

      for (const task of tasks) {
        const projects = await resolveTaskProjectNames(
          collection,
          mapping,
          task,
          resolverContext,
          projectNameCache,
          readCache,
        );
        for (const project of projects) {
          const entry = projectMap.get(project) || { total: 0, done: 0, open: 0 };
          entry.total++;
          if (isCompletedStatus(mapping, task.frontmatter.status)) {
            entry.done++;
          } else {
            entry.open++;
          }
          projectMap.set(project, entry);
        }
      }

      if (projectMap.size === 0) {
        console.log(chalk.dim("No projects found."));
        return;
      }

      const sorted = [...projectMap.entries()].sort((a, b) =>
        a[0].localeCompare(b[0]),
      );

      for (const [name, counts] of sorted) {
        if (options.stats) {
          const pct =
            counts.total > 0
              ? Math.round((counts.done / counts.total) * 100)
              : 0;
          console.log(
            `  ${chalk.blue(`+${name}`)}  ${counts.open} open, ${counts.done} done (${pct}%)`,
          );
        } else {
          console.log(`  ${chalk.blue(`+${name}`)}`);
        }
      }
    }, options.path);
  } catch (err) {
    showError((err as Error).message);
    // process.exit aqui abortava no Windows (UV_HANDLE_CLOSING) porque a colecao
    // ainda estava fechando; exitCode deixa o loop drenar e sair com 1 de verdade.
    process.exitCode = 1;
  }
}

export async function projectsShowCommand(
  name: string,
  options: { path?: string },
): Promise<void> {
  try {
    await withCollection(async (collection, mapping) => {
      const result = await collection.query({
        where: taskFilter(mapping),
        limit: 500,
      });

      const rawTasks = (result.results || []) as TaskResult[];
      const tasks = rawTasks.map((t) => {
        const fm = normalizeFrontmatter(t.frontmatter as Record<string, unknown>, mapping);
        const displayTitle = resolveDisplayTitle(fm, mapping, t.path);
        if (displayTitle) {
          fm.title = displayTitle;
        }
        return {
          ...t,
          frontmatter: fm as any as TaskFrontmatter,
        };
      });

      const resolverContext = await buildResolverContext(collection);
      const projectNameCache = new Map<string, string>();
      const readCache = new Map<string, Record<string, unknown>>();

      const filtered: TaskResult[] = [];
      for (const task of tasks) {
        const projects = await resolveTaskProjectNames(
          collection,
          mapping,
          task,
          resolverContext,
          projectNameCache,
          readCache,
        );
        if (projects.some((p) => p.toLowerCase() === name.toLowerCase())) {
          filtered.push(task);
        }
      }

      if (filtered.length === 0) {
        console.log(chalk.dim(`No tasks in project "${name}".`));
        return;
      }

      console.log(chalk.bold(`Project: +${name}\n`));
      for (const task of filtered) {
        console.log(formatTask(task));
      }
    }, options.path);
  } catch (err) {
    showError((err as Error).message);
    // process.exit aqui abortava no Windows (UV_HANDLE_CLOSING) porque a colecao
    // ainda estava fechando; exitCode deixa o loop drenar e sair com 1 de verdade.
    process.exitCode = 1;
  }
}
