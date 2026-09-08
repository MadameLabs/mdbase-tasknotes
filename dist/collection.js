// src/collection.ts
import { Collection } from "@callumalpass/mdbase";
import { basename } from "path";

// src/config.ts
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
var HOME_DIR = process.env.HOME || os.homedir();
var CONFIG_DIR = path.join(HOME_DIR, ".config", "mdbase-tasknotes");
var CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
var DEFAULT_CONFIG = {
  collectionPath: null,
  language: "en"
};
function load() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}
function resolveUserPath(userPath) {
  return path.resolve(expandHomeDirectory(userPath));
}
function resolveCollectionPath(flagPath) {
  if (flagPath) return resolveUserPath(flagPath);
  const envPath = process.env.MDBASE_TASKNOTES_PATH;
  if (envPath) return resolveUserPath(envPath);
  const config = load();
  if (config.collectionPath) return resolveUserPath(config.collectionPath);
  return process.cwd();
}
function expandHomeDirectory(userPath) {
  if (userPath === "~") {
    return HOME_DIR;
  }
  if (userPath.startsWith("~/") || userPath.startsWith("~\\")) {
    return path.join(HOME_DIR, userPath.slice(2));
  }
  return userPath;
}

// src/field-mapping.ts
import { loadConfig, getType } from "@callumalpass/mdbase";
import {
  buildSpecFieldMapping,
  defaultSpecFieldMapping,
  denormalizeSpecFrontmatter,
  getDefaultSpecCompletedStatus,
  isSpecCompletedStatus,
  normalizeSpecFrontmatter,
  resolveDisplayTitle
} from "@tasknotes/model/config";
function defaultFieldMapping() {
  return defaultSpecFieldMapping();
}
function buildFieldMapping(fields, displayNameKey) {
  return buildSpecFieldMapping(fields, displayNameKey);
}
function normalizeTaskTypeDefinition(value) {
  if (!isRecord(value)) return { fields: {} };
  const legacyFields = isRecord(value.fields) ? value.fields : void 0;
  if (legacyFields) {
    return {
      fields: legacyFields,
      displayNameKey: typeString(value.display_name_key) ?? typeString(value.displayNameKey)
    };
  }
  const schema = isRecord(value.schema) && isRecord(value.schema.value) ? value.schema.value : {};
  const properties = isRecord(schema.properties) ? schema.properties : {};
  const fields = {};
  for (const [fieldName, property] of Object.entries(properties)) {
    fields[fieldName] = jsonSchemaToLegacyField(property);
  }
  const collection = isRecord(value.collection) ? value.collection : {};
  const readDefaults = isRecord(collection.read_defaults) ? collection.read_defaults : {};
  for (const [fieldName, defaultValue] of Object.entries(readDefaults)) {
    fields[fieldName] ??= {};
    fields[fieldName].default = defaultValue;
  }
  const implementation = Array.isArray(value.implements) ? value.implements.find(
    (candidate) => isRecord(candidate) && candidate.contract === "tasknotes.task" && typeof candidate.version === "string"
  ) : void 0;
  const roles = isRecord(implementation) && isRecord(implementation.fields) ? implementation.fields : {};
  for (const [role, fieldNameValue] of Object.entries(roles)) {
    const fieldName = typeString(fieldNameValue);
    if (!fieldName) continue;
    fields[fieldName] ??= {};
    fields[fieldName].tn_role = role;
  }
  const binding = isRecord(implementation) && isRecord(implementation.binding) ? implementation.binding : {};
  const status = isRecord(binding.status) ? binding.status : {};
  const statusField = typeString(roles.status);
  if (statusField && Array.isArray(status.completed_values)) {
    fields[statusField] ??= {};
    fields[statusField].tn_completed_values = status.completed_values;
  }
  const display = isRecord(collection.display) ? collection.display : {};
  return {
    fields,
    displayNameKey: typeString(display.name_field)
  };
}
async function loadFieldMapping(flagPath) {
  try {
    const collectionPath = resolveCollectionPath(flagPath);
    const configResult = await loadConfig(collectionPath);
    if (!configResult.valid || !configResult.config) {
      return defaultFieldMapping();
    }
    const typeResult = await getType(collectionPath, configResult.config, "task");
    if (!typeResult.valid || !typeResult.type) {
      return defaultFieldMapping();
    }
    const normalized = normalizeTaskTypeDefinition(typeResult.type);
    return buildFieldMapping(normalized.fields, normalized.displayNameKey);
  } catch {
    return defaultFieldMapping();
  }
}
function resolveField(mapping, role) {
  return mapping.roleToField[role];
}
function taskFilter(mapping) {
  return { or: [{ type: { eq: "task" } }, { [resolveField(mapping, "tags")]: { contains: "task" } }] };
}
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function typeString(value) {
  return typeof value === "string" && value.length > 0 ? value : void 0;
}
function jsonSchemaToLegacyField(value) {
  if (!isRecord(value)) return {};
  const field = {};
  if (Array.isArray(value.enum)) {
    field.type = "enum";
    field.values = value.enum;
  } else {
    switch (value.type) {
      case "string":
        field.type = value.format === "date" ? "date" : value.format === "date-time" ? "datetime" : value.format === "time" ? "time" : "string";
        break;
      case "integer":
      case "number":
      case "boolean":
        field.type = value.type;
        break;
      case "array":
        field.type = "list";
        field.items = jsonSchemaToLegacyField(value.items);
        break;
      case "object": {
        field.type = "object";
        const properties = isRecord(value.properties) ? value.properties : {};
        field.fields = Object.fromEntries(
          Object.entries(properties).map(([name, property]) => [
            name,
            jsonSchemaToLegacyField(property)
          ])
        );
        break;
      }
      default:
        field.type = "any";
    }
  }
  if (value.default !== void 0) field.default = value.default;
  if (value.description !== void 0) field.description = value.description;
  return field;
}

// src/collection.ts
async function openCollection(flagPath) {
  const collectionPath = resolveCollectionPath(flagPath);
  const { collection, error } = await Collection.open(collectionPath);
  if (error) {
    throw new Error(`Failed to open collection at ${collectionPath}: ${error.message}`);
  }
  return collection;
}
async function withCollection(fn, flagPath) {
  const collection = await openCollection(flagPath);
  const mapping = await loadFieldMapping(flagPath);
  try {
    return await fn(collection, mapping);
  } finally {
    await collection.close();
  }
}
async function resolveTaskPath(collection, pathOrTitle, mapping) {
  if (pathOrTitle.includes("/") || pathOrTitle.endsWith(".md")) {
    return pathOrTitle;
  }
  const titleField = resolveField(mapping, "title");
  const query = pathOrTitle.trim();
  const escaped = query.replace(/"/g, '\\"');
  const exact = await queryTasks(collection, mapping, `${titleField} == "${escaped}"`, 20);
  if (exact.length === 1) {
    return exact[0].path;
  }
  if (exact.length > 1) {
    throw new Error(formatAmbiguousTaskError(query, exact, titleField));
  }
  const exactBasename = dedupeByPath([
    ...await queryTasks(collection, mapping, `file.basename == "${escaped}"`, 20),
    ...await queryTasks(collection, mapping, `file.name == "${escaped}.md"`, 20)
  ]);
  if (exactBasename.length === 1) {
    return exactBasename[0].path;
  }
  if (exactBasename.length > 1) {
    throw new Error(formatAmbiguousTaskError(query, exactBasename, titleField));
  }
  const fuzzyTitle = await queryTasks(collection, mapping, `${titleField}.contains("${escaped}")`, 20);
  const fuzzyBasename = dedupeByPath([
    ...await queryTasks(collection, mapping, `file.basename.contains("${escaped}")`, 20),
    ...await queryTasks(collection, mapping, `file.name.contains("${escaped}")`, 20)
  ]);
  const fuzzy = dedupeByPath([...fuzzyTitle, ...fuzzyBasename]);
  if (fuzzy.length === 1) {
    return fuzzy[0].path;
  }
  if (fuzzy.length > 1) {
    throw new Error(
      formatAmbiguousTaskError(
        query,
        rankCandidates(query, fuzzy, titleField),
        titleField
      )
    );
  }
  throw new Error(`No task found matching "${query}"`);
}
async function queryTasks(collection, mapping, where, limit) {
  try {
    const result = await collection.query({
      where: { and: [taskFilter(mapping), where] },
      limit
    });
    return result.results || [];
  } catch {
    return [];
  }
}
function dedupeByPath(candidates) {
  const seen = /* @__PURE__ */ new Set();
  const deduped = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.path)) continue;
    seen.add(candidate.path);
    deduped.push(candidate);
  }
  return deduped;
}
function rankCandidates(query, candidates, titleField) {
  const q = query.toLowerCase();
  return [...candidates].sort((a, b) => {
    const scoreA = scoreCandidate(q, a, titleField);
    const scoreB = scoreCandidate(q, b, titleField);
    if (scoreA !== scoreB) return scoreB - scoreA;
    const titleA = getTaskTitle(a, titleField).toLowerCase();
    const titleB = getTaskTitle(b, titleField).toLowerCase();
    if (titleA !== titleB) return titleA.localeCompare(titleB);
    return a.path.localeCompare(b.path);
  });
}
function scoreCandidate(query, candidate, titleField) {
  const title = getTaskTitle(candidate, titleField).toLowerCase();
  const path2 = candidate.path.toLowerCase();
  let score = 0;
  if (title === query) score += 100;
  if (title.startsWith(query)) score += 50;
  if (title.includes(query)) score += 25;
  if (path2.includes(query)) score += 10;
  score += Math.max(0, 10 - Math.abs(title.length - query.length));
  return score;
}
function formatAmbiguousTaskError(query, candidates, titleField) {
  const preview = candidates.slice(0, 5).map((candidate, index) => {
    const title = getTaskTitle(candidate, titleField);
    return `  ${index + 1}. ${title} (${candidate.path})`;
  }).join("\n");
  const more = candidates.length > 5 ? `
  ...and ${candidates.length - 5} more` : "";
  const examplePath = candidates[0]?.path || "tasks/<task>.md";
  return [
    `Ambiguous task reference "${query}".`,
    "Matches (best first):",
    `${preview}${more}`,
    `Use a full path to disambiguate (for example: ${examplePath}).`
  ].join("\n");
}
function getTaskTitle(candidate, titleField) {
  if (candidate.frontmatter && titleField) {
    const raw = candidate.frontmatter[titleField];
    if (typeof raw === "string" && raw.trim().length > 0) {
      return raw;
    }
  }
  const fromPath = basename(candidate.path, ".md").trim();
  return fromPath.length > 0 ? fromPath : candidate.path;
}
export {
  openCollection,
  resolveTaskPath,
  withCollection
};
