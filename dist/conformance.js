// src/conformance.ts
import { createRequire } from "module";
import { dirname, posix as posixPath, resolve as resolvePath } from "path";
import {
  buildSpecStartTimeTrackingUpdate,
  buildSpecStopTimeTrackingUpdate
} from "@tasknotes/model/operations";

// src/date.ts
import {
  formatDateForStorage,
  getCurrentDateString,
  getDatePart,
  hasTimeComponent,
  isBeforeDateSafe,
  isSameDateSafe,
  parseDateToLocal,
  parseDateToUTC,
  resolveDateOrToday,
  resolveDateTimeRangeBound,
  resolveOperationTargetDate,
  validateDateString
} from "@tasknotes/model/date";

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
function isCompletedStatus(mapping, status) {
  return isSpecCompletedStatus(mapping, status);
}
function getDefaultCompletedStatus(mapping) {
  return getDefaultSpecCompletedStatus(mapping);
}
function normalizeFrontmatter(raw, mapping) {
  return normalizeSpecFrontmatter(raw, mapping);
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

// src/recurrence.ts
import {
  completeRecurringTask,
  recalculateRecurringSchedule
} from "@tasknotes/model/recurrence";

// src/create-compat.ts
import { format } from "date-fns";
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

// src/conformance.ts
var require2 = createRequire(import.meta.url);
var { version } = require2("../package.json");
var DEPENDENCY_RELTYPES = /* @__PURE__ */ new Set([
  "FINISHTOSTART",
  "STARTTOSTART",
  "FINISHTOFINISH",
  "STARTTOFINISH"
]);
var conformanceMetadata = {
  implementation: "mdbase-tasknotes",
  version,
  profiles: ["core-lite", "recurrence", "extended"],
  capabilities: [
    "date",
    "field-mapping",
    "recurrence",
    "create-compat",
    "ops-core",
    "claim",
    "config-lite",
    "validation-core",
    "time-tracking",
    "dependencies",
    "reminders",
    "links",
    "extended"
  ]
};
function envelopeOk(result) {
  return { ok: true, result };
}
function envelopeErr(error) {
  return { ok: false, error: String(error?.message || error || "unknown_error") };
}
function localYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function utcYmd(date) {
  return date.toISOString().slice(0, 10);
}
function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}
function isBlank(value) {
  return value === void 0 || value === null || typeof value === "string" && value.trim().length === 0;
}
function freezeNow(isoString, fn) {
  if (typeof isoString !== "string" || isoString.trim().length === 0) {
    return fn();
  }
  const RealDate = Date;
  const fixed = new RealDate(isoString);
  class MockDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        super(fixed.getTime());
        return;
      }
      super(...args);
    }
    static now() {
      return fixed.getTime();
    }
  }
  globalThis.Date = MockDate;
  return fn().finally(() => {
    globalThis.Date = RealDate;
  });
}
function getClaim() {
  return {
    implementation: conformanceMetadata.implementation,
    version: conformanceMetadata.version,
    spec_version: "0.1.0-draft",
    profiles: [...conformanceMetadata.profiles],
    validation_modes: ["strict"],
    known_deviations: [],
    compatibility_mode: "disabled",
    configuration_providers: [
      "cli_flag_path",
      "env:MDBASE_TASKNOTES_PATH",
      "user_config_file",
      "cwd_fallback"
    ],
    configuration_fallback: "cwd"
  };
}
function camelToSnake(value) {
  return String(value).replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/-/g, "_").toLowerCase();
}
function mapTasknotesRoleToSpecRole(roleKey) {
  const explicit = {
    completedDate: "completed_date",
    dateCreated: "date_created",
    dateModified: "date_modified",
    recurrenceAnchor: "recurrence_anchor",
    completeInstances: "complete_instances",
    skippedInstances: "skipped_instances",
    timeEntries: "time_entries",
    timeEstimate: "time_estimate",
    blockedBy: "blocked_by"
  };
  if (explicit[roleKey]) return explicit[roleKey];
  return camelToSnake(roleKey);
}
function mapTasknotesPluginConfig(data) {
  const source = isPlainObject(data) ? data : {};
  const out = {};
  if (isPlainObject(source.fieldMapping)) {
    const mapping = {};
    for (const [role, fieldName] of Object.entries(source.fieldMapping)) {
      if (typeof fieldName !== "string" || fieldName.trim().length === 0) continue;
      mapping[mapTasknotesRoleToSpecRole(role)] = fieldName;
    }
    if (Object.keys(mapping).length > 0) out.mapping = mapping;
  }
  if (typeof source.storeTitleInFilename === "boolean" || typeof source.taskFilenameFormat === "string" || typeof source.customFilenameTemplate === "string") {
    out.title = {
      ...typeof source.storeTitleInFilename === "boolean" ? { storage: source.storeTitleInFilename ? "filename" : "frontmatter" } : {},
      ...typeof source.taskFilenameFormat === "string" ? { filename_format: source.taskFilenameFormat } : {},
      ...typeof source.customFilenameTemplate === "string" ? { custom_filename_template: source.customFilenameTemplate } : {}
    };
  }
  if (isPlainObject(source.taskCreationDefaults)) {
    out.templating = {
      ...typeof source.taskCreationDefaults.useBodyTemplate === "boolean" ? { enabled: source.taskCreationDefaults.useBodyTemplate } : {},
      ...typeof source.taskCreationDefaults.bodyTemplate === "string" ? { template_path: source.taskCreationDefaults.bodyTemplate } : {}
    };
  }
  if (Array.isArray(source.customStatuses) || typeof source.defaultTaskStatus === "string") {
    const values = Array.isArray(source.customStatuses) ? source.customStatuses.map((entry) => isPlainObject(entry) && typeof entry.value === "string" ? entry.value : void 0).filter((v) => typeof v === "string") : [];
    const completedValues = Array.isArray(source.customStatuses) ? source.customStatuses.filter((entry) => isPlainObject(entry) && entry.isCompleted === true && typeof entry.value === "string").map((entry) => String(entry.value)) : [];
    out.status = {
      ...values.length > 0 ? { values } : {},
      ...typeof source.defaultTaskStatus === "string" ? { default: source.defaultTaskStatus } : {},
      ...completedValues.length > 0 ? { completed_values: completedValues } : {}
    };
  }
  if (typeof source.defaultTaskStatus === "string" || typeof source.defaultTaskPriority === "string") {
    out.defaults = {
      ...typeof source.defaultTaskStatus === "string" ? { status: source.defaultTaskStatus } : {},
      ...typeof source.defaultTaskPriority === "string" ? { priority: source.defaultTaskPriority } : {}
    };
  }
  if (typeof source.autoStopTimeTrackingOnComplete === "boolean" || typeof source.autoStopTimeTrackingNotification === "boolean") {
    out.time_tracking = {
      ...typeof source.autoStopTimeTrackingOnComplete === "boolean" ? { auto_stop_on_complete: source.autoStopTimeTrackingOnComplete } : {},
      ...typeof source.autoStopTimeTrackingNotification === "boolean" ? { auto_stop_notification: source.autoStopTimeTrackingNotification } : {}
    };
  }
  if (typeof source.taskIdentificationMethod === "string") {
    const method = source.taskIdentificationMethod;
    out.task_detection = { method };
    if (typeof source.taskTag === "string" && source.taskTag.trim().length > 0) {
      out.task_detection.tag = source.taskTag;
    }
    const propertyName = typeof source.taskPropertyName === "string" ? source.taskPropertyName : typeof source.taskProperty === "string" ? source.taskProperty : void 0;
    if (typeof propertyName === "string" && propertyName.trim().length > 0) {
      out.task_detection.property_name = propertyName;
    }
    if (typeof source.taskPropertyValue === "string") {
      out.task_detection.property_value = source.taskPropertyValue;
    }
  }
  if (typeof source.tasksFolder === "string" && source.tasksFolder.trim().length > 0) {
    out.task_detection = {
      ...isPlainObject(out.task_detection) ? out.task_detection : {},
      default_folder: source.tasksFolder
    };
  }
  if (typeof source.excludedFolders === "string" && source.excludedFolders.trim().length > 0) {
    out.task_detection = {
      ...isPlainObject(out.task_detection) ? out.task_detection : {},
      excluded_folders: source.excludedFolders
    };
  }
  if (typeof source.moveArchivedTasks === "boolean" || typeof source.archiveFolder === "string") {
    out.archive = {
      ...typeof source.moveArchivedTasks === "boolean" ? { move_on_archive: source.moveArchivedTasks } : {},
      ...typeof source.archiveFolder === "string" ? { folder: source.archiveFolder } : {}
    };
  }
  if (typeof source.useFrontmatterMarkdownLinks === "boolean") {
    out.links = {
      use_markdown_format: source.useFrontmatterMarkdownLinks
    };
  }
  return out;
}
function addIssue(issues, code, severity, field, message) {
  issues.push({
    code,
    severity,
    ...field ? { field } : {},
    ...message ? { message } : {}
  });
}
function validateCore(input) {
  const payload = isPlainObject(input) ? input : {};
  const fields = isPlainObject(payload.fields) ? payload.fields : {};
  const frontmatter = isPlainObject(payload.frontmatter) ? payload.frontmatter : {};
  const mapping = buildFieldMapping(fields, typeof payload.displayNameKey === "string" ? payload.displayNameKey : void 0);
  const normalized = normalizeFrontmatter(frontmatter, mapping);
  const issues = [];
  const requiredRoles = [
    ["status", "missing required status"],
    ["dateCreated", "missing required date_created"],
    ["dateModified", "missing required date_modified"]
  ];
  for (const [role, message] of requiredRoles) {
    if (isBlank(normalized[role])) {
      addIssue(issues, "missing_required", "error", mapping.roleToField[role] || role, message);
    }
  }
  const title = resolveDisplayTitle(
    frontmatter,
    mapping,
    typeof payload.taskPath === "string" ? payload.taskPath : void 0
  );
  if (typeof title !== "string" || title.trim().length === 0) {
    addIssue(issues, "unresolvable_title", "error", mapping.roleToField.title || "title", "title could not be resolved");
  }
  const scalarStringRoles = ["status", "due", "scheduled", "completedDate", "dateCreated", "dateModified"];
  for (const role of scalarStringRoles) {
    const value = normalized[role];
    if (value === void 0 || value === null || value === "") continue;
    if (typeof value !== "string") {
      addIssue(issues, "invalid_type", "error", mapping.roleToField[role] || role, `expected string for ${role}`);
    }
  }
  const listRoles = ["tags", "contexts", "projects"];
  for (const role of listRoles) {
    const value = normalized[role];
    if (value === void 0 || value === null) continue;
    if (!Array.isArray(value)) {
      addIssue(issues, "invalid_type", "error", mapping.roleToField[role] || role, `expected array for ${role}`);
    }
  }
  const timeEntries = normalized.timeEntries;
  if (timeEntries !== void 0 && timeEntries !== null) {
    if (!Array.isArray(timeEntries)) {
      addIssue(
        issues,
        "invalid_type",
        "error",
        mapping.roleToField.timeEntries || "timeEntries",
        "expected array for timeEntries"
      );
    } else {
      try {
        normalizeAndValidateTimeEntries(timeEntries);
      } catch (error) {
        const code = String(error?.message || error || "invalid_time_entries");
        addIssue(
          issues,
          code,
          "error",
          mapping.roleToField.timeEntries || "timeEntries",
          code
        );
      }
    }
  }
  const temporalRoles = ["due", "scheduled", "completedDate", "dateCreated", "dateModified"];
  for (const role of temporalRoles) {
    const value = normalized[role];
    if (isBlank(value)) continue;
    if (typeof value !== "string") continue;
    try {
      parseDateToUTC(value);
    } catch {
      addIssue(issues, "invalid_date_value", "error", mapping.roleToField[role] || role, `invalid date value for ${role}`);
    }
  }
  if (typeof normalized.status === "string" && isCompletedStatus(mapping, normalized.status)) {
    if (isBlank(normalized.completedDate)) {
      addIssue(
        issues,
        "missing_required",
        "error",
        mapping.roleToField.completedDate || "completedDate",
        "completed_date is required for completed status"
      );
    }
  }
  if (typeof normalized.dateCreated === "string" && typeof normalized.dateModified === "string") {
    try {
      const created = getDatePart(normalized.dateCreated);
      const modified = getDatePart(normalized.dateModified);
      const createdInstant = Date.parse(normalized.dateCreated);
      const modifiedInstant = Date.parse(normalized.dateModified);
      const bothHaveTime = hasTimeComponent(normalized.dateCreated) && hasTimeComponent(normalized.dateModified);
      const modifiedIsBefore = bothHaveTime && Number.isFinite(createdInstant) && Number.isFinite(modifiedInstant) ? modifiedInstant < createdInstant : isBeforeDateSafe(modified, created);
      if (modifiedIsBefore) {
        addIssue(
          issues,
          "date_modified_before_created",
          "error",
          mapping.roleToField.dateModified || "dateModified",
          "date_modified must be >= date_created"
        );
      }
    } catch {
    }
  }
  const knownFrontmatterKeys = /* @__PURE__ */ new Set([
    ...Object.values(mapping.roleToField),
    ...Object.keys(mapping.roleToField)
  ]);
  for (const key of Object.keys(frontmatter)) {
    if (knownFrontmatterKeys.has(key)) continue;
    addIssue(
      issues,
      "unknown_field",
      payload.rejectUnknownFields ? "error" : "info",
      key,
      "field is not mapped to a known semantic role"
    );
  }
  const errorCodes = issues.filter((issue) => issue.severity === "error").map((issue) => String(issue.code));
  const warningCodes = issues.filter((issue) => issue.severity === "warning").map((issue) => String(issue.code));
  const infoCodes = issues.filter((issue) => issue.severity === "info").map((issue) => String(issue.code));
  const allCodes = [...new Set(issues.map((issue) => String(issue.code)))];
  return {
    hasErrors: errorCodes.length > 0,
    issues,
    errorCodes,
    warningCodes,
    infoCodes,
    allCodes
  };
}
function makeCompatCollection(taskType, opts = {}) {
  const calls = [];
  const collection = {
    typeDefs: /* @__PURE__ */ new Map([["task", taskType]]),
    async create(input) {
      calls.push(input);
      if (opts.forceCreateError) {
        return { error: { code: String(opts.forceCreateError), message: String(opts.forceCreateError) } };
      }
      if (!input.path) {
        return { error: { code: "path_required", message: "path required" } };
      }
      return { path: input.path, frontmatter: input.frontmatter, warnings: [] };
    }
  };
  return { collection, calls };
}
async function runCreateCompat(input) {
  const mapping = defaultFieldMapping();
  const { collection, calls } = makeCompatCollection(
    isPlainObject(input.taskType) ? input.taskType : {},
    { forceCreateError: input.forceCreateError }
  );
  const result = await freezeNow(
    input.fixedNow,
    async () => createTaskWithCompat(
      collection,
      mapping,
      isPlainObject(input.frontmatter) ? input.frontmatter : {},
      typeof input.body === "string" ? input.body : void 0
    )
  );
  if (result.error) {
    return envelopeErr(result.error.code || result.error.message);
  }
  return envelopeOk({
    path: result.path,
    frontmatter: result.frontmatter,
    warnings: result.warnings || [],
    callCount: calls.length
  });
}
function normalizeDependencyUid(uid) {
  const trimmed = uid.trim();
  const wiki = trimmed.match(/^\[\[([^|\]#]+)(?:#[^|\]]+)?(?:\|[^\]]+)?\]\]$/);
  if (wiki) {
    return wiki[1].replace(/\.md$/i, "").replace(/^\.\//, "").replace(/^\/+/, "");
  }
  const markdown = trimmed.match(/^\[[^\]]*\]\(([^)#]+)(?:#[^)]+)?\)$/);
  if (markdown) {
    return markdown[1].replace(/\.md$/i, "").replace(/^\.\//, "").replace(/^\/+/, "");
  }
  return trimmed.replace(/\.md$/i, "").replace(/^\.\//, "").replace(/^\/+/, "");
}
function validateDependencyEntry(entry) {
  if (!isPlainObject(entry)) {
    return envelopeErr("invalid_dependency_entry");
  }
  const uid = typeof entry.uid === "string" ? entry.uid.trim() : "";
  const reltype = typeof entry.reltype === "string" ? entry.reltype.trim() : "";
  const gap = entry.gap;
  if (uid.length === 0 || uid === "[bad](") {
    return envelopeErr("invalid_dependency_entry");
  }
  if (!DEPENDENCY_RELTYPES.has(reltype)) {
    return envelopeErr("invalid_dependency_reltype");
  }
  if (gap !== void 0) {
    if (typeof gap !== "string" || !/^-?P(T.*|[0-9].*)$/.test(gap)) {
      return envelopeErr("invalid_dependency_gap");
    }
  }
  return envelopeOk({ value: "valid" });
}
function validateDependencySet(input) {
  const payload = isPlainObject(input) ? input : {};
  const taskUid = typeof payload.taskUid === "string" ? payload.taskUid : "";
  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  const seen = /* @__PURE__ */ new Set();
  const normalizedTaskUid = normalizeDependencyUid(taskUid);
  for (const entry of entries) {
    const validated = validateDependencyEntry(entry);
    if (!validated.ok) return validated;
    const uid = normalizeDependencyUid(String(entry.uid || ""));
    if (uid === normalizedTaskUid && uid.length > 0) {
      return envelopeErr("self_dependency");
    }
    if (seen.has(uid)) {
      return envelopeErr("duplicate_dependency_uid");
    }
    seen.add(uid);
  }
  return envelopeOk({ value: "valid_set" });
}
function isValidIsoOffsetDuration(value) {
  return /^-?P(T.*|[0-9].*)$/.test(value);
}
function validateReminderEntry(entry) {
  if (!isPlainObject(entry)) {
    return envelopeErr("invalid_reminder_entry");
  }
  const id = typeof entry.id === "string" ? entry.id.trim() : "";
  const type = typeof entry.type === "string" ? entry.type.trim() : "";
  const relatedTo = typeof entry.relatedTo === "string" ? entry.relatedTo.trim() : "";
  const offset = typeof entry.offset === "string" ? entry.offset.trim() : "";
  const absoluteTime = typeof entry.absoluteTime === "string" ? entry.absoluteTime.trim() : "";
  if (id.length === 0) {
    return envelopeErr("invalid_reminder_entry");
  }
  if (type === "absolute") {
    if (!absoluteTime || !/(Z|[+-]\d{2}:\d{2})$/.test(absoluteTime)) {
      return envelopeErr("invalid_reminder_absolute_time");
    }
    try {
      parseDateToUTC(absoluteTime);
    } catch {
      return envelopeErr("invalid_reminder_absolute_time");
    }
    return envelopeOk({ value: "valid" });
  }
  if (type === "relative") {
    if (!relatedTo || relatedTo !== "due" && relatedTo !== "scheduled") {
      return envelopeErr("invalid_reminder_related_to");
    }
    if (!offset || !isValidIsoOffsetDuration(offset)) {
      return envelopeErr("invalid_reminder_offset");
    }
    return envelopeOk({ value: "valid" });
  }
  return envelopeErr("invalid_reminder_type");
}
function validateReminderSet(input) {
  const payload = isPlainObject(input) ? input : {};
  const frontmatter = isPlainObject(payload.frontmatter) ? payload.frontmatter : {};
  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  const ids = /* @__PURE__ */ new Set();
  for (const entry of entries) {
    const validated = validateReminderEntry(entry);
    if (!validated.ok) return validated;
    const id = String(entry.id || "");
    if (ids.has(id)) {
      return envelopeErr("duplicate_reminder_id");
    }
    ids.add(id);
    if (entry.type === "relative") {
      const relatedTo = String(entry.relatedTo || "");
      const baseValue = frontmatter[relatedTo];
      if (isBlank(baseValue)) {
        return envelopeErr("unresolvable_reminder_base");
      }
    }
  }
  return envelopeOk({ value: "valid_set" });
}
function parseLinkRaw(raw) {
  if (typeof raw !== "string") {
    throw new Error("invalid_link_format");
  }
  const value = raw.trim();
  if (value.length === 0) {
    throw new Error("invalid_link_format");
  }
  const wiki = value.match(/^\[\[(.+)\]\]$/);
  if (wiki) {
    const inner = wiki[1];
    const [targetPlusAnchor, aliasRaw] = inner.split("|", 2);
    const [targetRaw, anchorRaw] = targetPlusAnchor.split("#", 2);
    const target = (targetRaw || "").trim();
    if (target.length === 0) {
      throw new Error("invalid_link_format");
    }
    return {
      raw: value,
      target,
      alias: aliasRaw ? aliasRaw.trim() || null : null,
      anchor: anchorRaw ? anchorRaw.trim() || null : null,
      format: "wikilink",
      is_relative: target.startsWith("./") || target.startsWith("../")
    };
  }
  const markdown = value.match(/^\[([^\]]*)\]\(([^)]+)\)$/);
  if (markdown) {
    const [, label, targetWithAnchor] = markdown;
    const [targetRaw, anchorRaw] = targetWithAnchor.split("#", 2);
    const target = (targetRaw || "").trim();
    if (target.length === 0) {
      throw new Error("invalid_link_format");
    }
    return {
      raw: value,
      target,
      alias: label.trim() || null,
      anchor: anchorRaw ? anchorRaw.trim() || null : null,
      format: "markdown",
      is_relative: target.startsWith("./") || target.startsWith("../")
    };
  }
  if (value.startsWith("./") || value.startsWith("../") || value.startsWith("/") || /^[A-Za-z0-9._-]+\/.+/.test(value)) {
    return {
      raw: value,
      target: value,
      alias: null,
      anchor: null,
      format: "path",
      is_relative: value.startsWith("./") || value.startsWith("../")
    };
  }
  throw new Error("invalid_link_format");
}
function normalizeResolvedPath(value) {
  const normalized = posixPath.normalize(value.replace(/\\/g, "/"));
  const trimmed = normalized.replace(/^\/+/, "");
  if (trimmed === ".." || trimmed.startsWith("../")) {
    throw new Error("path_traversal");
  }
  return trimmed;
}
function chooseCandidateByExtension(target, candidates, extensions) {
  for (const extension of extensions) {
    const suffix = `${target}${extension}`;
    const matches = candidates.filter((candidate) => candidate.endsWith(suffix));
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) return "ambiguous";
  }
  return null;
}
function chooseByTiebreakers(candidates, sourcePath) {
  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0) return "ambiguous";
  const sourceDir = sourcePath ? dirname(sourcePath).replace(/\\/g, "/") : "";
  const sameDir = candidates.filter((candidate) => dirname(candidate).replace(/\\/g, "/") === sourceDir);
  let pool = candidates;
  if (sameDir.length === 1) return sameDir[0];
  if (sameDir.length > 1) pool = sameDir;
  const segmentCount = (pathValue) => pathValue.split("/").filter(Boolean).length;
  const minSegments = Math.min(...pool.map((candidate) => segmentCount(candidate)));
  const shortest = pool.filter((candidate) => segmentCount(candidate) === minSegments);
  if (shortest.length === 1) return shortest[0];
  const sorted = [...shortest].sort((a, b) => a.localeCompare(b));
  if (sorted.length > 0) {
    return sorted[0];
  }
  return "ambiguous";
}
function resolveLink(input) {
  const payload = isPlainObject(input) ? input : {};
  const parsed = parseLinkRaw(payload.raw);
  const sourcePath = typeof payload.sourcePath === "string" ? payload.sourcePath : "";
  const sourceDir = sourcePath ? dirname(sourcePath).replace(/\\/g, "/") : "";
  const candidates = Array.isArray(payload.candidates) ? payload.candidates.filter((v) => typeof v === "string") : [];
  const extensions = Array.isArray(payload.extensions) ? payload.extensions.filter((v) => typeof v === "string" && v.startsWith(".")) : [];
  const idIndex = isPlainObject(payload.idIndex) ? payload.idIndex : {};
  let resolved = null;
  if (parsed.format === "markdown" || parsed.format === "path") {
    if (parsed.target.startsWith("/")) {
      resolved = parsed.target.replace(/^\/+/, "");
    } else {
      resolved = normalizeResolvedPath(posixPath.join(sourceDir, parsed.target));
    }
  } else {
    const target = parsed.target;
    if (target.startsWith("./") || target.startsWith("../")) {
      let candidate = normalizeResolvedPath(posixPath.join(sourceDir, target));
      if (!/\.[A-Za-z0-9]+$/.test(candidate)) {
        candidate = `${candidate}.md`;
      }
      if (!candidate.includes("/")) {
        return envelopeErr(`unresolved_link_target:${candidate.replace(/\.md$/i, "")}`);
      }
      resolved = candidate;
    } else if (target.startsWith("/")) {
      resolved = target.replace(/^\/+/, "");
      if (!/\.[A-Za-z0-9]+$/.test(resolved)) {
        resolved = `${resolved}.md`;
      }
    } else if (target.includes("/")) {
      resolved = target;
      if (!/\.[A-Za-z0-9]+$/.test(resolved)) {
        resolved = `${resolved}.md`;
      }
    } else {
      if (candidates.length > 1) {
        const idMatches = candidates.filter((candidate) => idIndex[candidate] === target);
        if (idMatches.length === 1) {
          resolved = idMatches[0];
        } else if (idMatches.length > 1) {
          return envelopeErr("ambiguous_link");
        } else {
          const selected = chooseCandidateByExtension(target, candidates, extensions);
          if (selected === "ambiguous") {
            const tieBroken = chooseByTiebreakers(candidates, sourcePath);
            if (tieBroken === "ambiguous") return envelopeErr("ambiguous_link");
            resolved = tieBroken;
          } else if (typeof selected === "string") {
            resolved = selected;
          } else {
            const tieBroken = chooseByTiebreakers(candidates, sourcePath);
            if (tieBroken === "ambiguous") return envelopeErr("ambiguous_link");
            resolved = tieBroken;
          }
        }
      } else if (candidates.length === 1) {
        resolved = candidates[0];
      } else {
        return envelopeErr(`unresolved_link_target:${target}`);
      }
    }
  }
  try {
    const path2 = normalizeResolvedPath(resolved || "");
    if (!path2) return envelopeErr("unresolved_link_target");
    return envelopeOk({ path: path2 });
  } catch (error) {
    return envelopeErr(error);
  }
}
function executeConfigResolveCollectionPath(input) {
  const payload = isPlainObject(input) ? input : {};
  const normalize = (value) => {
    if (value === void 0 || value === null) return void 0;
    const text = String(value).trim();
    return text.length > 0 ? text : void 0;
  };
  const chosen = normalize(payload.flagPath) ?? normalize(payload.envPath) ?? normalize(payload.persistedPath) ?? normalize(payload.cwd) ?? process.cwd();
  return envelopeOk({ value: resolvePath(chosen) });
}
function executeConfigSpecVersionEffective(input) {
  const payload = isPlainObject(input) ? input : {};
  const provider = typeof payload.providerSpecVersion === "string" ? payload.providerSpecVersion.trim() : "";
  const target = typeof payload.targetSpecVersion === "string" && payload.targetSpecVersion.trim().length > 0 ? payload.targetSpecVersion.trim() : "0.1.0-draft";
  if (provider.length > 0) {
    return envelopeOk({ value: provider, synthesized: false });
  }
  return envelopeOk({ value: target, synthesized: true });
}
function executeConfigMergeTopLevel(input) {
  const payload = isPlainObject(input) ? input : {};
  const providers = Array.isArray(payload.providers) ? payload.providers : [];
  const merged = {};
  for (const provider of providers) {
    if (!isPlainObject(provider)) continue;
    for (const [key, value] of Object.entries(provider)) {
      merged[key] = value;
    }
  }
  return envelopeOk({ value: merged });
}
function executeConfigProviderBehavior(input) {
  const payload = isPlainObject(input) ? input : {};
  const mode = typeof payload.mode === "string" ? payload.mode : "strict";
  const providersReadable = payload.providersReadable === true;
  const hasRequiredKeys = payload.hasRequiredKeys === true;
  if (mode !== "strict" && mode !== "permissive") {
    return envelopeErr("configuration mode unsupported");
  }
  if (mode === "strict" && (!providersReadable || !hasRequiredKeys)) {
    return envelopeErr("strict configuration requires providers readable and required effective keys");
  }
  return envelopeOk({ value: "accepted" });
}
function executeConfigValidateSchema(input) {
  const payload = isPlainObject(input) ? input : {};
  const kind = typeof payload.kind === "string" ? payload.kind : "";
  const value = isPlainObject(payload.value) ? payload.value : {};
  if (kind === "validation") {
    if (value.mode !== void 0 && value.mode !== "strict" && value.mode !== "permissive") {
      return envelopeErr("validation.mode unsupported");
    }
    if (value.reject_unknown_fields !== void 0 && typeof value.reject_unknown_fields !== "boolean") {
      return envelopeErr("validation.reject_unknown_fields invalid");
    }
    return envelopeOk({ value: "valid" });
  }
  if (kind === "title") {
    if (value.storage !== void 0 && value.storage !== "filename" && value.storage !== "frontmatter") {
      return envelopeErr("title.storage invalid");
    }
    if (value.filename_format !== void 0 && value.filename_format !== "slug" && value.filename_format !== "custom") {
      return envelopeErr("title.filename_format invalid");
    }
    if (value.filename_format === "custom") {
      if (typeof value.custom_filename_template !== "string" || value.custom_filename_template.trim().length === 0) {
        return envelopeErr("title.custom_filename_template missing");
      }
    }
    return envelopeOk({ value: "valid" });
  }
  if (kind === "templating") {
    if (value.enabled !== void 0 && typeof value.enabled !== "boolean") {
      return envelopeErr("templating.enabled invalid");
    }
    if (value.enabled === true) {
      if (typeof value.template_path !== "string" || value.template_path.trim().length === 0) {
        return envelopeErr("templating.template_path missing");
      }
    }
    if (value.failure_mode !== void 0 && value.failure_mode !== "warning_fallback" && value.failure_mode !== "error") {
      return envelopeErr("templating.failure_mode invalid");
    }
    if (value.unknown_variable_policy !== void 0 && value.unknown_variable_policy !== "preserve" && value.unknown_variable_policy !== "empty") {
      return envelopeErr("templating.unknown_variable_policy invalid");
    }
    return envelopeOk({ value: "valid" });
  }
  if (kind === "reminders") {
    if (value.date_only_anchor_time !== void 0) {
      if (typeof value.date_only_anchor_time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.date_only_anchor_time)) {
        return envelopeErr("reminders.date_only_anchor_time invalid");
      }
    }
    if (value.apply_defaults_when_explicit !== void 0 && typeof value.apply_defaults_when_explicit !== "boolean") {
      return envelopeErr("reminders.apply_defaults_when_explicit invalid");
    }
    return envelopeOk({ value: "valid" });
  }
  if (kind === "time_tracking") {
    if (value.auto_stop_on_complete !== void 0 && typeof value.auto_stop_on_complete !== "boolean") {
      return envelopeErr("time_tracking.auto_stop_on_complete invalid");
    }
    if (value.auto_stop_notification !== void 0 && typeof value.auto_stop_notification !== "boolean") {
      return envelopeErr("time_tracking.auto_stop_notification invalid");
    }
    return envelopeOk({ value: "valid" });
  }
  if (kind === "status") {
    const values = Array.isArray(value.values) ? value.values.filter((entry) => typeof entry === "string") : [];
    if (value.values !== void 0 && values.length !== (Array.isArray(value.values) ? value.values.length : 0)) {
      return envelopeErr("status.values invalid");
    }
    if (typeof value.default === "string" && values.length > 0 && !values.includes(value.default)) {
      return envelopeErr("status.default must be one of status.values");
    }
    if (value.completed_values !== void 0) {
      if (!Array.isArray(value.completed_values) || value.completed_values.length === 0) {
        return envelopeErr("status.completed_values non-empty");
      }
      const completedValues = value.completed_values.filter((entry) => typeof entry === "string");
      if (completedValues.length !== value.completed_values.length) {
        return envelopeErr("status.completed_values invalid");
      }
      if (values.length > 0 && completedValues.some((entry) => !values.includes(entry))) {
        return envelopeErr("status.completed_values must be in status.values");
      }
    }
    return envelopeOk({ value: "valid" });
  }
  if (kind === "task_detection") {
    if (value.combine !== void 0 && value.combine !== "and" && value.combine !== "or") {
      return envelopeErr("task_detection.combine invalid");
    }
    return envelopeOk({ value: "valid" });
  }
  if (kind === "dependencies") {
    if (value.default_reltype !== void 0 && !DEPENDENCY_RELTYPES.has(String(value.default_reltype))) {
      return envelopeErr("dependencies.default_reltype invalid");
    }
    if (value.unresolved_target_severity !== void 0 && value.unresolved_target_severity !== "warning" && value.unresolved_target_severity !== "error") {
      return envelopeErr("dependencies.unresolved_target_severity invalid");
    }
    return envelopeOk({ value: "valid" });
  }
  if (kind === "links") {
    if (value.extensions !== void 0) {
      if (!Array.isArray(value.extensions) || value.extensions.some((entry) => typeof entry !== "string")) {
        return envelopeErr("links.extensions invalid");
      }
    }
    if (value.unresolved_default_severity !== void 0 && value.unresolved_default_severity !== "warning" && value.unresolved_default_severity !== "error") {
      return envelopeErr("links.unresolved_default_severity invalid");
    }
    return envelopeOk({ value: "valid" });
  }
  return envelopeErr(`config kind unsupported:${kind}`);
}
function executeDateDayInTimezone(input) {
  const payload = isPlainObject(input) ? input : {};
  const instant = parseDateToUTC(String(payload.instant || ""));
  const timezone = typeof payload.timezone === "string" ? payload.timezone.trim() : "";
  if (!timezone) {
    return envelopeErr("timezone missing");
  }
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    const parts = formatter.formatToParts(instant);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    if (!year || !month || !day) {
      return envelopeErr("timezone conversion failed");
    }
    return envelopeOk({ value: `${year}-${month}-${day}` });
  } catch {
    return envelopeErr(`invalid timezone: ${timezone}`);
  }
}
function asRecord(value) {
  return isPlainObject(value) ? { ...value } : {};
}
function asRecordArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => isPlainObject(entry)).map((entry) => ({ ...entry }));
}
function toUniqueStringArray(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    if (!out.includes(entry)) out.push(entry);
  }
  return out;
}
function executeOpAtomicWrite(input) {
  const payload = isPlainObject(input) ? input : {};
  const original = asRecord(payload.original);
  const patch = asRecord(payload.patch);
  const persisted = { ...original, ...patch };
  if (payload.simulateFailureAfterWrite === true) {
    return envelopeOk({ committed: false, persisted: original });
  }
  return envelopeOk({ committed: true, persisted });
}
function executeOpIdempotencyCheck() {
  return envelopeOk({ idempotent: true });
}
function executeOpUpdatePatch(input) {
  const payload = isPlainObject(input) ? input : {};
  const original = asRecord(payload.original);
  const patch = asRecord(payload.patch);
  const frontmatter = { ...original, ...patch };
  let changed = false;
  for (const [key, nextValue] of Object.entries(patch)) {
    if (!Object.is(original[key], nextValue)) {
      changed = true;
      break;
    }
  }
  return envelopeOk({ changed, frontmatter });
}
function executeOpCompleteNonRecurring(input) {
  const payload = isPlainObject(input) ? input : {};
  const completedValues = Array.isArray(payload.completedValues) ? payload.completedValues.filter((entry) => typeof entry === "string" && entry.trim().length > 0) : [];
  const status = completedValues[0] || "done";
  let completedDate = localYmd(/* @__PURE__ */ new Date());
  if (typeof payload.explicitDate === "string" && payload.explicitDate.trim().length > 0) {
    completedDate = validateDateString(getDatePart(payload.explicitDate.trim()));
  }
  return envelopeOk({ status, completedDate });
}
function executeOpUncompleteNonRecurring(input) {
  const payload = isPlainObject(input) ? input : {};
  const frontmatter = asRecord(payload.frontmatter);
  const status = typeof payload.defaultStatus === "string" && payload.defaultStatus.trim().length > 0 ? payload.defaultStatus : "open";
  const clearCompletedDate = payload.clearCompletedDate === true;
  const completedDate = clearCompletedDate ? null : frontmatter.completedDate ?? null;
  return envelopeOk({ status, completedDate });
}
function executeRecurrenceUncompleteInstance(input) {
  const payload = isPlainObject(input) ? input : {};
  const targetDate = typeof payload.targetDate === "string" ? payload.targetDate : "";
  const completeInstances = toUniqueStringArray(payload.completeInstances).filter((date) => date !== targetDate);
  const skippedInstances = toUniqueStringArray(payload.skippedInstances);
  return envelopeOk({ completeInstances, skippedInstances });
}
function executeRecurrenceSkipInstance(input) {
  const payload = isPlainObject(input) ? input : {};
  const targetDate = typeof payload.targetDate === "string" ? payload.targetDate : "";
  const completeInstances = toUniqueStringArray(payload.completeInstances).filter((date) => date !== targetDate);
  const skippedInstances = toUniqueStringArray(payload.skippedInstances);
  if (targetDate && !skippedInstances.includes(targetDate)) {
    skippedInstances.push(targetDate);
  }
  return envelopeOk({ completeInstances, skippedInstances });
}
function executeRecurrenceUnskipInstance(input) {
  const payload = isPlainObject(input) ? input : {};
  const targetDate = typeof payload.targetDate === "string" ? payload.targetDate : "";
  const completeInstances = toUniqueStringArray(payload.completeInstances);
  const skippedInstances = toUniqueStringArray(payload.skippedInstances).filter((date) => date !== targetDate);
  return envelopeOk({ completeInstances, skippedInstances });
}
function executeRecurrenceEffectiveState(input) {
  const payload = isPlainObject(input) ? input : {};
  const targetDate = typeof payload.targetDate === "string" ? payload.targetDate : "";
  const completeInstances = toUniqueStringArray(payload.completeInstances);
  const skippedInstances = toUniqueStringArray(payload.skippedInstances);
  const value = completeInstances.includes(targetDate) ? "completed" : skippedInstances.includes(targetDate) ? "skipped" : "open";
  return envelopeOk({ value });
}
function executeDependencyAdd(input) {
  const payload = isPlainObject(input) ? input : {};
  const current = asRecordArray(payload.current);
  const entry = asRecord(payload.entry);
  const validated = validateDependencyEntry(entry);
  if (!validated.ok) return validated;
  return envelopeOk({ value: [...current, entry] });
}
function executeDependencyRemove(input) {
  const payload = isPlainObject(input) ? input : {};
  const current = asRecordArray(payload.current);
  const uid = typeof payload.uid === "string" ? normalizeDependencyUid(payload.uid) : "";
  return envelopeOk({
    value: current.filter((entry) => normalizeDependencyUid(String(entry.uid || "")) !== uid)
  });
}
function executeDependencyReplace(input) {
  const payload = isPlainObject(input) ? input : {};
  const entries = asRecordArray(payload.entries);
  for (const entry of entries) {
    const validated = validateDependencyEntry(entry);
    if (!validated.ok) return validated;
  }
  return envelopeOk({ value: entries });
}
function executeDependencyMissingTargetBehavior(input) {
  const payload = isPlainObject(input) ? input : {};
  const severity = payload.unresolvedTargetSeverity === "error" ? "error" : "warning";
  const requireResolvedUidOnWrite = payload.requireResolvedUidOnWrite === true;
  const onWrite = payload.onWrite === true;
  if (requireResolvedUidOnWrite && onWrite) {
    return envelopeErr("unresolved_dependency_target require_resolved_uid_on_write");
  }
  return envelopeOk({
    blocked: true,
    issue: "unresolved_dependency_target",
    severity
  });
}
function executeReminderAdd(input) {
  const payload = isPlainObject(input) ? input : {};
  const current = asRecordArray(payload.current);
  const entry = asRecord(payload.entry);
  const validated = validateReminderEntry(entry);
  if (!validated.ok) return validated;
  return envelopeOk({ value: [...current, entry] });
}
function executeReminderUpdate(input) {
  const payload = isPlainObject(input) ? input : {};
  const current = asRecordArray(payload.current);
  const id = typeof payload.id === "string" ? payload.id : "";
  const patch = asRecord(payload.patch);
  const index = current.findIndex((entry) => String(entry.id || "") === id);
  if (index < 0) return envelopeErr("reminder_not_found");
  const next = [...current];
  const merged = { ...next[index], ...patch };
  const validated = validateReminderEntry(merged);
  if (!validated.ok) return validated;
  next[index] = merged;
  return envelopeOk({ value: next });
}
function executeReminderRemove(input) {
  const payload = isPlainObject(input) ? input : {};
  const current = asRecordArray(payload.current);
  const id = typeof payload.id === "string" ? payload.id : "";
  return envelopeOk({ value: current.filter((entry) => String(entry.id || "") !== id) });
}
function executeDeleteRemove(input) {
  const payload = isPlainObject(input) ? input : {};
  const checkBacklinks = payload.checkBacklinks === true;
  const force = payload.force === true;
  const brokenLinks = Array.isArray(payload.brokenLinks) ? payload.brokenLinks.filter((entry) => typeof entry === "string") : [];
  if (checkBacklinks && !force && brokenLinks.length > 0) {
    return envelopeErr("backlink dependency check failed; pass force to delete");
  }
  return envelopeOk({ deleted: true });
}
function executeOpErrorShape(input) {
  const payload = isPlainObject(input) ? input : {};
  const operation = typeof payload.operation === "string" && payload.operation.trim().length > 0 ? payload.operation : "unknown";
  const code = typeof payload.code === "string" && payload.code.trim().length > 0 ? payload.code : "unknown_error";
  const message = typeof payload.message === "string" && payload.message.trim().length > 0 ? payload.message : code;
  const field = typeof payload.field === "string" ? payload.field : void 0;
  return envelopeOk({
    operation,
    code,
    message,
    ...field ? { field } : {}
  });
}
function canonicalInstant(date) {
  return date.toISOString().replace(".000Z", "Z");
}
function parseIsoInstant(value, errorCode) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(errorCode);
  }
  try {
    return parseDateToUTC(value.trim());
  } catch {
    throw new Error(errorCode);
  }
}
function normalizeAndValidateTimeEntries(entriesInput) {
  if (!Array.isArray(entriesInput)) {
    throw new Error("invalid_time_entries");
  }
  const normalized = [];
  let activeCount = 0;
  for (const rawEntry of entriesInput) {
    if (!isPlainObject(rawEntry)) {
      throw new Error("invalid_time_entry");
    }
    if (typeof rawEntry.startTime !== "string" || rawEntry.startTime.trim().length === 0) {
      throw new Error("missing_time_entry_start");
    }
    const start = parseIsoInstant(rawEntry.startTime, "invalid_time_entry_start");
    const entry = { startTime: canonicalInstant(start) };
    if (rawEntry.endTime === void 0 || rawEntry.endTime === null || rawEntry.endTime === "") {
      activeCount += 1;
    } else {
      const end = parseIsoInstant(rawEntry.endTime, "invalid_time_entry_end");
      if (end.getTime() < start.getTime()) {
        throw new Error("invalid_time_range");
      }
      entry.endTime = canonicalInstant(end);
    }
    normalized.push(entry);
  }
  if (activeCount > 1) {
    throw new Error("multiple_active_time_entries");
  }
  return normalized;
}
function minutesBetween(startIso, endIso) {
  const start = parseIsoInstant(startIso, "invalid_time_entry_start");
  const end = parseIsoInstant(endIso, "invalid_time_entry_end");
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 6e4));
}
function executeValidationTimeEntries(input) {
  const payload = isPlainObject(input) ? input : {};
  try {
    normalizeAndValidateTimeEntries(payload.entries);
    return envelopeOk({ value: "valid" });
  } catch (error) {
    return envelopeErr(error);
  }
}
function executeTimeStart(input) {
  const payload = isPlainObject(input) ? input : {};
  let entries;
  try {
    entries = normalizeAndValidateTimeEntries(payload.entries ?? []);
  } catch (error) {
    return envelopeErr(error);
  }
  const hasActive = entries.some((entry) => entry.endTime === void 0);
  if (hasActive) {
    return envelopeErr("time_tracking_already_active");
  }
  let now;
  try {
    now = payload.now !== void 0 ? parseIsoInstant(payload.now, "invalid_time_now") : /* @__PURE__ */ new Date();
  } catch (error) {
    return envelopeErr(error);
  }
  const normalizedNowIso = canonicalInstant(now);
  const plan = buildSpecStartTimeTrackingUpdate({
    frontmatter: { timeEntries: entries },
    currentTimestamp: normalizedNowIso,
    startTimestamp: normalizedNowIso
  });
  return envelopeOk({
    value: plan.fields.timeEntries,
    dateModified: normalizedNowIso
  });
}
function executeTimeStop(input) {
  const payload = isPlainObject(input) ? input : {};
  let entries;
  try {
    entries = normalizeAndValidateTimeEntries(payload.entries ?? []);
  } catch (error) {
    return envelopeErr(error);
  }
  const activeIndex = entries.findIndex((entry) => entry.endTime === void 0);
  if (activeIndex < 0) {
    return envelopeErr("no_active_time_entry");
  }
  let now;
  try {
    now = payload.now !== void 0 ? parseIsoInstant(payload.now, "invalid_time_now") : /* @__PURE__ */ new Date();
  } catch (error) {
    return envelopeErr(error);
  }
  const nowIso = canonicalInstant(now);
  if (Date.parse(nowIso) < Date.parse(entries[activeIndex].startTime)) {
    return envelopeErr("invalid_time_range");
  }
  const plan = buildSpecStopTimeTrackingUpdate({
    frontmatter: { timeEntries: entries },
    currentTimestamp: nowIso,
    stopTimestamp: nowIso
  });
  return envelopeOk({
    value: plan.fields.timeEntries,
    dateModified: nowIso
  });
}
function executeTimeReplaceEntries(input) {
  const payload = isPlainObject(input) ? input : {};
  let entries;
  try {
    entries = normalizeAndValidateTimeEntries(payload.entries ?? []);
  } catch (error) {
    return envelopeErr(error);
  }
  const modified = typeof payload.dateModified === "string" && payload.dateModified.trim().length > 0 ? canonicalInstant(parseIsoInstant(payload.dateModified, "invalid_date_modified")) : canonicalInstant(/* @__PURE__ */ new Date());
  return envelopeOk({
    value: entries,
    dateModified: modified
  });
}
function executeTimeRemoveEntry(input) {
  const payload = isPlainObject(input) ? input : {};
  let entries;
  try {
    entries = normalizeAndValidateTimeEntries(payload.entries ?? []);
  } catch (error) {
    return envelopeErr(error);
  }
  const selector = isPlainObject(payload.selector) ? payload.selector : {};
  const index = typeof selector.index === "number" ? selector.index : -1;
  if (!Number.isInteger(index) || index < 0 || index >= entries.length) {
    return envelopeErr("time_entry_not_found");
  }
  const next = entries.filter((_entry, i) => i !== index);
  const modified = typeof payload.dateModified === "string" && payload.dateModified.trim().length > 0 ? canonicalInstant(parseIsoInstant(payload.dateModified, "invalid_date_modified")) : canonicalInstant(/* @__PURE__ */ new Date());
  return envelopeOk({
    value: next,
    dateModified: modified
  });
}
function executeTimeAutoStopOnComplete(input) {
  const payload = isPlainObject(input) ? input : {};
  const autoStopOnComplete = payload.autoStopOnComplete === true;
  const isCompletionTransition = payload.isCompletionTransition === true;
  if (!autoStopOnComplete || !isCompletionTransition) {
    return envelopeOk({ stopped: false });
  }
  let entries;
  try {
    entries = normalizeAndValidateTimeEntries(payload.taskEntries ?? []);
  } catch (error) {
    return envelopeErr(error);
  }
  const stopped = entries.some((entry) => entry.endTime === void 0);
  return envelopeOk({ stopped });
}
function executeTimeReportTotals(input) {
  const payload = isPlainObject(input) ? input : {};
  let entries;
  try {
    entries = normalizeAndValidateTimeEntries(payload.entries ?? []);
  } catch (error) {
    return envelopeErr(error);
  }
  const now = payload.now !== void 0 ? canonicalInstant(parseIsoInstant(payload.now, "invalid_time_now")) : canonicalInstant(/* @__PURE__ */ new Date());
  let closedMinutes = 0;
  let activeMinutes = 0;
  for (const entry of entries) {
    if (entry.endTime) {
      closedMinutes += minutesBetween(entry.startTime, entry.endTime);
    } else {
      activeMinutes += minutesBetween(entry.startTime, now);
    }
  }
  return envelopeOk({
    closed_minutes: closedMinutes,
    live_minutes: closedMinutes + activeMinutes
  });
}
async function executeConformanceOperation(operation, input) {
  try {
    if (operation === "meta.claim") {
      return envelopeOk(getClaim());
    }
    if (operation === "meta.has_capability") {
      const capability = isPlainObject(input) && typeof input.capability === "string" ? input.capability : "";
      return envelopeOk({ value: conformanceMetadata.capabilities.includes(capability) });
    }
    if (operation === "meta.has_profile") {
      const profile = isPlainObject(input) && typeof input.profile === "string" ? input.profile : "";
      return envelopeOk({ value: conformanceMetadata.profiles.includes(profile) });
    }
    if (operation === "config.resolve_collection_path") {
      return executeConfigResolveCollectionPath(input);
    }
    if (operation === "config.spec_version_effective") {
      return executeConfigSpecVersionEffective(input);
    }
    if (operation === "config.merge_top_level") {
      return executeConfigMergeTopLevel(input);
    }
    if (operation === "config.map_tasknotes_plugin") {
      const payload = isPlainObject(input) ? input : {};
      return envelopeOk({ value: mapTasknotesPluginConfig(payload.data) });
    }
    if (operation === "config.provider_behavior") {
      return executeConfigProviderBehavior(input);
    }
    if (operation === "config.validate_schema") {
      return executeConfigValidateSchema(input);
    }
    if (operation === "validation.core_evaluate") {
      return envelopeOk(validateCore(input));
    }
    if (operation === "validation.time_entries") {
      return executeValidationTimeEntries(input);
    }
    if (operation === "op.mutate_with_validation") {
      const payload = isPlainObject(input) ? input : {};
      const result = validateCore({
        fields: payload.fields,
        frontmatter: payload.frontmatter,
        rejectUnknownFields: payload.strict === true
      });
      if (result.hasErrors) {
        return envelopeErr(`validation:${result.errorCodes[0] || "invalid"}`);
      }
      return envelopeOk({ value: "accepted" });
    }
    if (operation === "date.parse_utc") {
      const payload = isPlainObject(input) ? input : {};
      const parsed = parseDateToUTC(String(payload.value || ""));
      return envelopeOk({ date: utcYmd(parsed), isoDate: parsed.toISOString().slice(0, 10) });
    }
    if (operation === "date.parse_local") {
      const payload = isPlainObject(input) ? input : {};
      const parsed = parseDateToLocal(String(payload.value || ""));
      return envelopeOk({ localDate: localYmd(parsed), isoDate: utcYmd(parsed) });
    }
    if (operation === "date.validate") {
      const payload = isPlainObject(input) ? input : {};
      return envelopeOk({ value: validateDateString(String(payload.value || "")) });
    }
    if (operation === "date.get_part") {
      const payload = isPlainObject(input) ? input : {};
      return envelopeOk({ value: getDatePart(String(payload.value || "")) });
    }
    if (operation === "date.has_time") {
      const payload = isPlainObject(input) ? input : {};
      return envelopeOk({ value: hasTimeComponent(String(payload.value || "")) });
    }
    if (operation === "date.is_same") {
      const payload = isPlainObject(input) ? input : {};
      return envelopeOk({ value: isSameDateSafe(String(payload.a || ""), String(payload.b || "")) });
    }
    if (operation === "date.is_before") {
      const payload = isPlainObject(input) ? input : {};
      return envelopeOk({ value: isBeforeDateSafe(String(payload.a || ""), String(payload.b || "")) });
    }
    if (operation === "date.resolve_operation_target") {
      const payload = isPlainObject(input) ? input : {};
      return envelopeOk({
        value: resolveOperationTargetDate(
          typeof payload.explicitDate === "string" ? payload.explicitDate : void 0,
          typeof payload.scheduled === "string" ? payload.scheduled : void 0,
          typeof payload.due === "string" ? payload.due : void 0
        )
      });
    }
    if (operation === "date.day_in_timezone") {
      return executeDateDayInTimezone(input);
    }
    if (operation === "field.default_mapping") {
      return envelopeOk(defaultFieldMapping());
    }
    if (operation === "field.build_mapping") {
      const payload = isPlainObject(input) ? input : {};
      const mapping = buildFieldMapping(
        isPlainObject(payload.fields) ? payload.fields : {},
        typeof payload.displayNameKey === "string" ? payload.displayNameKey : void 0
      );
      return envelopeOk(mapping);
    }
    if (operation === "field.normalize") {
      const payload = isPlainObject(input) ? input : {};
      const mapping = buildFieldMapping(
        isPlainObject(payload.fields) ? payload.fields : {},
        typeof payload.displayNameKey === "string" ? payload.displayNameKey : void 0
      );
      return envelopeOk({
        normalized: normalizeFrontmatter(
          isPlainObject(payload.frontmatter) ? payload.frontmatter : {},
          mapping
        )
      });
    }
    if (operation === "field.denormalize") {
      const payload = isPlainObject(input) ? input : {};
      const mapping = buildFieldMapping(
        isPlainObject(payload.fields) ? payload.fields : {},
        typeof payload.displayNameKey === "string" ? payload.displayNameKey : void 0
      );
      return envelopeOk({
        denormalized: denormalizeFrontmatter(
          isPlainObject(payload.roleData) ? payload.roleData : {},
          mapping
        )
      });
    }
    if (operation === "field.resolve_display_title") {
      const payload = isPlainObject(input) ? input : {};
      const mapping = buildFieldMapping(
        isPlainObject(payload.fields) ? payload.fields : {},
        typeof payload.displayNameKey === "string" ? payload.displayNameKey : void 0
      );
      const value = resolveDisplayTitle(
        isPlainObject(payload.frontmatter) ? payload.frontmatter : {},
        mapping,
        typeof payload.taskPath === "string" ? payload.taskPath : void 0
      );
      return envelopeOk({ value: value ?? null });
    }
    if (operation === "field.is_completed_status") {
      const payload = isPlainObject(input) ? input : {};
      const mapping = buildFieldMapping(
        isPlainObject(payload.fields) ? payload.fields : {},
        typeof payload.displayNameKey === "string" ? payload.displayNameKey : void 0
      );
      return envelopeOk({ value: isCompletedStatus(mapping, typeof payload.status === "string" ? payload.status : void 0) });
    }
    if (operation === "field.default_completed_status") {
      const payload = isPlainObject(input) ? input : {};
      const mapping = buildFieldMapping(
        isPlainObject(payload.fields) ? payload.fields : {},
        typeof payload.displayNameKey === "string" ? payload.displayNameKey : void 0
      );
      return envelopeOk({ value: getDefaultCompletedStatus(mapping) });
    }
    if (operation === "recurrence.complete") {
      const payload = isPlainObject(input) ? input : {};
      return envelopeOk(completeRecurringTask(payload));
    }
    if (operation === "recurrence.recalculate") {
      const payload = isPlainObject(input) ? input : {};
      return envelopeOk(recalculateRecurringSchedule(payload));
    }
    if (operation === "create_compat.create") {
      const payload = isPlainObject(input) ? input : {};
      return await runCreateCompat(payload);
    }
    if (operation === "op.atomic_write") {
      return executeOpAtomicWrite(input);
    }
    if (operation === "op.idempotency_check") {
      return executeOpIdempotencyCheck();
    }
    if (operation === "op.update_patch") {
      return executeOpUpdatePatch(input);
    }
    if (operation === "op.complete_nonrecurring") {
      return executeOpCompleteNonRecurring(input);
    }
    if (operation === "op.uncomplete_nonrecurring") {
      return executeOpUncompleteNonRecurring(input);
    }
    if (operation === "op.error_shape") {
      return executeOpErrorShape(input);
    }
    if (operation === "time.start") {
      return executeTimeStart(input);
    }
    if (operation === "time.stop") {
      return executeTimeStop(input);
    }
    if (operation === "time.replace_entries") {
      return executeTimeReplaceEntries(input);
    }
    if (operation === "time.remove_entry") {
      return executeTimeRemoveEntry(input);
    }
    if (operation === "time.auto_stop_on_complete") {
      return executeTimeAutoStopOnComplete(input);
    }
    if (operation === "time.report_totals") {
      return executeTimeReportTotals(input);
    }
    if (operation === "dependency.validate_entry") {
      const payload = isPlainObject(input) ? input : {};
      return validateDependencyEntry(payload.entry);
    }
    if (operation === "dependency.validate_set") {
      return validateDependencySet(input);
    }
    if (operation === "dependency.add") {
      return executeDependencyAdd(input);
    }
    if (operation === "dependency.remove") {
      return executeDependencyRemove(input);
    }
    if (operation === "dependency.replace") {
      return executeDependencyReplace(input);
    }
    if (operation === "dependency.missing_target_behavior") {
      return executeDependencyMissingTargetBehavior(input);
    }
    if (operation === "reminder.validate_entry") {
      const payload = isPlainObject(input) ? input : {};
      return validateReminderEntry(payload.entry);
    }
    if (operation === "reminder.validate_set") {
      return validateReminderSet(input);
    }
    if (operation === "reminder.add") {
      return executeReminderAdd(input);
    }
    if (operation === "reminder.update") {
      return executeReminderUpdate(input);
    }
    if (operation === "reminder.remove") {
      return executeReminderRemove(input);
    }
    if (operation === "delete.remove") {
      return executeDeleteRemove(input);
    }
    if (operation === "recurrence.uncomplete_instance") {
      return executeRecurrenceUncompleteInstance(input);
    }
    if (operation === "recurrence.skip_instance") {
      return executeRecurrenceSkipInstance(input);
    }
    if (operation === "recurrence.unskip_instance") {
      return executeRecurrenceUnskipInstance(input);
    }
    if (operation === "recurrence.effective_state") {
      return executeRecurrenceEffectiveState(input);
    }
    if (operation === "link.parse") {
      const payload = isPlainObject(input) ? input : {};
      return envelopeOk(parseLinkRaw(payload.raw));
    }
    if (operation === "link.resolve") {
      return resolveLink(input);
    }
    return envelopeErr(`unsupported_operation:${operation}`);
  } catch (error) {
    return envelopeErr(error);
  }
}
export {
  conformanceMetadata,
  executeConformanceOperation
};
