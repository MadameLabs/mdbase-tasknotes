// src/create-compat.ts
import { format } from "date-fns";

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

// src/config.ts
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
var HOME_DIR = process.env.HOME || os.homedir();
var CONFIG_DIR = path.join(HOME_DIR, ".config", "mdbase-tasknotes");
var CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

// src/field-mapping.ts
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
function denormalizeFrontmatter(roleData, mapping) {
  return denormalizeSpecFrontmatter(roleData, mapping);
}
function resolveField(mapping, role) {
  return mapping.roleToField[role];
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

// src/create-compat.ts
async function createTaskWithCompat(collection, mapping, roleFrontmatter, body) {
  const taskType = getTaskTypeDef(collection);
  const denormalized = denormalizeFrontmatter(roleFrontmatter, mapping);
  applyFieldDefaults(denormalized, taskType);
  applyTimestampDefaults(denormalized, mapping, taskType);
  applyMatchDefaults(denormalized, taskType);
  const input = {
    type: "task",
    frontmatter: denormalized,
    body
  };
  const firstAttempt = await collection.create(input);
  if (!firstAttempt.error || firstAttempt.error.code !== "path_required") {
    return firstAttempt;
  }
  const pathResolution = derivePathFromType(
    taskType,
    denormalized,
    mapping,
    /* @__PURE__ */ new Date()
  );
  if (!pathResolution.path) {
    if (pathResolution.errorMessage) {
      return {
        ...firstAttempt,
        error: {
          ...firstAttempt.error,
          message: pathResolution.errorMessage
        }
      };
    }
    if (pathResolution.missingKeys && pathResolution.missingKeys.length > 0) {
      const missing = pathResolution.missingKeys.join(", ");
      return {
        ...firstAttempt,
        warnings: [
          `Cannot resolve path_pattern "${pathResolution.template}": missing template values for ${missing}.`
        ]
      };
    }
    return firstAttempt;
  }
  return await collection.create({
    ...input,
    path: pathResolution.path
  });
}
function getTaskTypeDef(collection) {
  const maybeCollection = collection;
  if (!maybeCollection.typeDefs || typeof maybeCollection.typeDefs.get !== "function") {
    return void 0;
  }
  const taskType = maybeCollection.typeDefs.get("task");
  if (!taskType) return void 0;
  const normalized = normalizeTaskTypeDefinition(taskType);
  return { ...taskType, fields: normalized.fields };
}
function applyTimestampDefaults(frontmatter, mapping, taskType) {
  const fields = taskType?.fields;
  if (!fields) return;
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const createdField = resolveField(mapping, "dateCreated");
  if (fields[createdField] && !hasValue(frontmatter[createdField])) {
    frontmatter[createdField] = nowIso;
  }
  const modifiedField = resolveField(mapping, "dateModified");
  if (fields[modifiedField] && !hasValue(frontmatter[modifiedField])) {
    frontmatter[modifiedField] = nowIso;
  }
}
function applyFieldDefaults(frontmatter, taskType) {
  const fields = taskType?.fields;
  if (!fields) return;
  for (const [fieldName, fieldDef] of Object.entries(fields)) {
    if (fieldDef.default !== void 0 && !hasValue(frontmatter[fieldName])) {
      frontmatter[fieldName] = fieldDef.default;
    }
  }
}
function applyMatchDefaults(frontmatter, taskType) {
  const where = taskType?.match?.where;
  if (!where || typeof where !== "object") return;
  for (const [field, condition] of Object.entries(where)) {
    if (condition === null || condition === void 0) continue;
    if (typeof condition !== "object" || Array.isArray(condition)) {
      if (!hasValue(frontmatter[field])) {
        frontmatter[field] = condition;
      }
      continue;
    }
    const ops = condition;
    if ("eq" in ops && !hasValue(frontmatter[field])) {
      frontmatter[field] = ops.eq;
      continue;
    }
    if ("contains" in ops) {
      const expected = ops.contains;
      const current = frontmatter[field];
      if (Array.isArray(current)) {
        if (!current.some((v) => String(v) === String(expected))) {
          current.push(expected);
          frontmatter[field] = current;
        }
        continue;
      }
      if (typeof current === "string") {
        if (!current.includes(String(expected))) {
          frontmatter[field] = `${current} ${String(expected)}`.trim();
        }
        continue;
      }
      if (!hasValue(current)) {
        frontmatter[field] = [expected];
      }
      continue;
    }
    if ("exists" in ops && ops.exists === true && !hasValue(frontmatter[field])) {
      frontmatter[field] = true;
    }
  }
}
function derivePathFromType(taskType, frontmatter, mapping, now) {
  const pathMetadata = taskType?.collection?.path;
  const genericPattern = readString(taskType?.path_pattern) ?? readString(pathMetadata?.pattern);
  const runtimeTemplate = pathMetadata?.runtime === "tasknotes" ? readString(pathMetadata.template) : void 0;
  const runtimeFolder = readString(pathMetadata?.folder);
  const pathTemplate = genericPattern ?? (runtimeTemplate ? [runtimeFolder, runtimeTemplate].filter(Boolean).join("/") : void 0);
  if (!taskType || !pathTemplate) {
    return {
      errorMessage: buildMissingPathPatternMessage(taskType)
    };
  }
  const values = buildTemplateValues(frontmatter, mapping, now);
  const renderedPattern = renderTemplate(pathTemplate, values);
  if (renderedPattern.path) {
    return { path: ensureMarkdownExt(renderedPattern.path), template: pathTemplate };
  }
  return {
    template: pathTemplate,
    missingKeys: renderedPattern.missingKeys
  };
}
function buildMissingPathPatternMessage(taskType) {
  const pathGlob = readString(taskType?.match?.path_glob);
  if (!pathGlob) {
    return [
      "Cannot create task because the task type does not define path_pattern.",
      "Add path_pattern to _types/task.md to tell mtn where new task files should be written."
    ].join(" ");
  }
  const suggestion = suggestPathPatternFromGlob(pathGlob);
  return [
    `Cannot create task because _types/task.md defines match.path_glob "${pathGlob}" but no path_pattern.`,
    "match.path_glob only identifies existing files; it is not a template for creating new files.",
    `Add path_pattern to tell mtn where to write new tasks, for example: ${suggestion}.`
  ].join(" ");
}
function suggestPathPatternFromGlob(pathGlob) {
  const normalized = normalizeRelativePath(pathGlob);
  const withoutGlob = normalized.replace(/\*\*\/\*\.md$/u, "{{titleKebab}}.md").replace(/\*\.md$/u, "{{titleKebab}}.md").replace(/\*\*$/u, "{{titleKebab}}.md").replace(/\*$/u, "{{titleKebab}}.md");
  const suggestion = withoutGlob === normalized || withoutGlob.length === 0 ? "tasks/{{titleKebab}}.md" : withoutGlob;
  return `path_pattern: "${suggestion}"`;
}
function renderTemplate(template, values) {
  const missingKeys = /* @__PURE__ */ new Set();
  const rendered = template.replace(/\{\{(\w+)\}\}|\{(\w+)\}/g, (_, a, b) => {
    const key = a ?? b;
    const value = values[key];
    if (value === void 0 || value === null || String(value).trim().length === 0) {
      missingKeys.add(key);
      return "";
    }
    return String(value);
  });
  if (missingKeys.size > 0) {
    return { missingKeys: Array.from(missingKeys).sort() };
  }
  const normalized = normalizeRelativePath(rendered);
  if (!normalized || normalized.includes("..") || normalized.includes("\0")) {
    return { missingKeys: [] };
  }
  return { path: normalized, missingKeys: [] };
}
function buildTemplateValues(frontmatter, mapping, now) {
  const values = {};
  const titleField = resolveField(mapping, "title");
  const priorityField = resolveField(mapping, "priority");
  const statusField = resolveField(mapping, "status");
  const dueField = resolveField(mapping, "due");
  const scheduledField = resolveField(mapping, "scheduled");
  const contextsField = resolveField(mapping, "contexts");
  const projectsField = resolveField(mapping, "projects");
  const tagsField = resolveField(mapping, "tags");
  const estimateField = resolveField(mapping, "timeEstimate");
  const rawTitle = readString(frontmatter[titleField]) || readString(frontmatter.title) || "task";
  const title = sanitizeForPathSegment(rawTitle);
  const priority = sanitizeForPathSegment(
    readString(frontmatter[priorityField]) || readString(frontmatter.priority) || "normal"
  );
  const status = sanitizeForPathSegment(
    readString(frontmatter[statusField]) || readString(frontmatter.status) || "open"
  );
  const dueDateRaw = readString(frontmatter[dueField]) || readString(frontmatter.due) || "";
  const scheduledDateRaw = readString(frontmatter[scheduledField]) || readString(frontmatter.scheduled) || "";
  const todayDate = format(now, "yyyy-MM-dd");
  const dueDate = dueDateRaw || scheduledDateRaw || todayDate;
  const scheduledDate = scheduledDateRaw || dueDateRaw || todayDate;
  const contexts = readStringList(frontmatter[contextsField] ?? frontmatter.contexts).map((v) => sanitizeForPathSegment(v)).filter(Boolean);
  const projects = readStringList(frontmatter[projectsField] ?? frontmatter.projects).map(extractProjectName).map((v) => sanitizeForPathSegment(v)).filter(Boolean);
  const tags = readStringList(frontmatter[tagsField] ?? frontmatter.tags).map((v) => sanitizeForPathSegment(v)).filter(Boolean);
  const timeEstimate = frontmatter[estimateField] ?? frontmatter.timeEstimate;
  const zettel = generateZettel(now);
  const titleLower = title.toLowerCase();
  const titleUpper = title.toUpperCase();
  const titleSnake = titleLower.replace(/\s+/g, "_");
  const titleKebab = titleLower.replace(/\s+/g, "-");
  const titleCamel = toCamelCase(title, false);
  const titlePascal = toCamelCase(title, true);
  const base = {
    title,
    priority,
    status,
    dueDate,
    scheduledDate,
    context: contexts[0] ?? "",
    contexts: contexts.join("/"),
    project: projects[0] ?? "",
    projects: projects.join("/"),
    tags: tags.join(", "),
    hashtags: tags.map((t) => `#${t}`).join(" "),
    timeEstimate: timeEstimate != null ? String(timeEstimate) : "",
    details: "",
    parentNote: "",
    date: format(now, "yyyy-MM-dd"),
    time: format(now, "HHmmss"),
    timestamp: format(now, "yyyy-MM-dd-HHmmss"),
    dateTime: format(now, "yyyy-MM-dd-HHmm"),
    year: format(now, "yyyy"),
    month: format(now, "MM"),
    day: format(now, "dd"),
    hour: format(now, "HH"),
    minute: format(now, "mm"),
    second: format(now, "ss"),
    shortDate: format(now, "yyMMdd"),
    shortYear: format(now, "yy"),
    monthName: format(now, "MMMM"),
    monthNameShort: format(now, "MMM"),
    dayName: format(now, "EEEE"),
    dayNameShort: format(now, "EEE"),
    week: format(now, "ww"),
    quarter: format(now, "q"),
    time12: sanitizeForPathSegment(format(now, "hh:mm a")),
    time24: sanitizeForPathSegment(format(now, "HH:mm")),
    hourPadded: format(now, "HH"),
    hour12: format(now, "hh"),
    ampm: format(now, "a"),
    unix: String(Math.floor(now.getTime() / 1e3)),
    unixMs: String(now.getTime()),
    milliseconds: format(now, "SSS"),
    ms: format(now, "SSS"),
    timezone: sanitizeForPathSegment(format(now, "xxx")),
    timezoneShort: sanitizeForPathSegment(format(now, "xx")),
    utcOffset: sanitizeForPathSegment(format(now, "xxx")),
    utcOffsetShort: sanitizeForPathSegment(format(now, "xx")),
    utcZ: "Z",
    priorityShort: priority ? priority.substring(0, 1).toUpperCase() : "",
    statusShort: status ? status.substring(0, 1).toUpperCase() : "",
    titleLower,
    titleUpper,
    titleSnake,
    titleKebab,
    titleCamel,
    titlePascal,
    zettel,
    nano: `${Date.now()}${Math.random().toString(36).slice(2, 7)}`
  };
  Object.assign(values, base);
  values[titleField] = title;
  values[priorityField] = priority;
  values[statusField] = status;
  values[dueField] = dueDate;
  values[scheduledField] = scheduledDate;
  for (const [key, value] of Object.entries(frontmatter)) {
    if (values[key] !== void 0) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      values[key] = sanitizeForPathSegment(String(value));
    }
  }
  return values;
}
function readString(value) {
  if (typeof value !== "string") return void 0;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : void 0;
}
function readStringList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === "string").map((v) => v.trim()).filter(Boolean);
}
function extractProjectName(project) {
  const wiki = project.match(/\[\[(?:.*\/)?([^\]|]+)(?:\|[^\]]+)?\]\]/);
  if (wiki) return wiki[1];
  return project;
}
function toCamelCase(value, pascal) {
  const words = value.replace(/[^a-zA-Z0-9\s]/g, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  return words.map((word, index) => {
    const lower = word.toLowerCase();
    if (index === 0 && !pascal) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join("");
}
function generateZettel(now) {
  const datePart = format(now, "yyMMdd");
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const secondsSinceMidnight = Math.floor((now.getTime() - midnight.getTime()) / 1e3);
  return `${datePart}${secondsSinceMidnight.toString(36)}`;
}
function sanitizeForPathSegment(value) {
  return value.trim().replace(/\s+/g, " ").replace(/[<>:"/\\|?*#[\]]/g, "").replace(/[\u0000-\u001f\u007f-\u009f]/g, "").replace(/^\.+|\.+$/g, "").trim();
}
function normalizeRelativePath(value) {
  return value.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/+|\/+$/g, "").trim();
}
function ensureMarkdownExt(pathValue) {
  const normalized = normalizeRelativePath(pathValue);
  if (!normalized) return normalized;
  if (normalized.toLowerCase().endsWith(".md")) return normalized;
  return `${normalized}.md`;
}
function hasValue(value) {
  return value !== null && value !== void 0;
}
export {
  createTaskWithCompat
};
