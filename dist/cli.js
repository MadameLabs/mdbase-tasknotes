#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/cli.ts
import { readFileSync as readFileSync2 } from "fs";
import { Command } from "commander";

// src/commands/init.ts
import chalk from "chalk";

// src/init.ts
import * as fs2 from "fs";
import * as path2 from "path";
import { buildTaskNotesMdbaseResources } from "@tasknotes/model/mdbase";

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
function save(config) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n");
}
function getConfig() {
  return load();
}
function setConfig(key, value) {
  const config = load();
  if (key === "collectionPath") {
    config.collectionPath = value;
  } else if (key === "language") {
    config.language = value ?? "en";
  }
  save(config);
}
function getConfigPath() {
  return CONFIG_FILE;
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

// src/init.ts
var DEFAULTS = {
  tasksFolder: "tasks",
  statuses: ["open", "in-progress", "done", "cancelled"],
  priorities: ["low", "normal", "high", "urgent"],
  defaultStatus: "open",
  defaultPriority: "normal"
};
function buildInitResources(opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  return buildTaskNotesMdbaseResources({
    tasksFolder: o.tasksFolder,
    collection: {
      name: "TaskNotes",
      description: "Task collection managed by mdbase-tasknotes",
      validation: "warn"
    },
    path: {
      template: "{{title}}",
      runtime: "tasknotes",
      generatedBy: "tasknotes.filename.create"
    },
    title: {
      filenameFormat: "title"
    },
    modelConfig: {
      fieldMapping: {
        recurrenceAnchor: "recurrenceAnchor",
        recurrenceParent: "recurrenceParent",
        occurrenceDate: "occurrenceDate",
        occurrenceMaterialization: "occurrenceMaterialization",
        occurrenceNextTrigger: "occurrenceNextTrigger",
        occurrenceTemplate: "occurrenceTemplate",
        occurrencePastHorizon: "occurrencePastHorizon",
        occurrenceFutureHorizon: "occurrenceFutureHorizon",
        completeInstances: "completeInstances",
        skippedInstances: "skippedInstances"
      },
      statuses: o.statuses.map((value, order) => {
        const lower = value.toLowerCase();
        const isCompleted = lower.includes("done") || lower.includes("complete");
        const isSkipped = lower.includes("cancel") || lower.includes("skip");
        return {
          id: value,
          value,
          label: value,
          color: "",
          isCompleted,
          ...isSkipped ? { isSkipped: true } : {},
          order,
          autoArchive: false,
          autoArchiveDelay: 0
        };
      }),
      priorities: o.priorities.map((value, weight) => ({
        id: value,
        value,
        label: value,
        color: "",
        weight
      })),
      defaults: {
        status: o.defaultStatus,
        priority: o.defaultPriority
      }
    }
  });
}
function writeCollectionResources(targetPath, force) {
  const absPath = resolveUserPath(targetPath);
  const resources = buildInitResources();
  const files = [
    [resources.paths.config, resources.configDocument],
    [resources.paths.contract, resources.contractDocument],
    [resources.paths.type, resources.typeDocument],
    [resources.paths.taskSchema, resources.taskSchemaDocument],
    [resources.paths.bindingSchema, resources.bindingSchemaDocument]
  ];
  if (!force) {
    const existing = files.find(
      ([relativePath]) => fs2.existsSync(path2.join(absPath, relativePath))
    );
    if (existing) {
      throw new Error(
        `${existing[0]} already exists at ${absPath}. Use --force to overwrite.`
      );
    }
  }
  fs2.mkdirSync(absPath, { recursive: true });
  for (const [relativePath, document] of files) {
    const destination = path2.join(absPath, relativePath);
    fs2.mkdirSync(path2.dirname(destination), { recursive: true });
    fs2.writeFileSync(destination, document);
  }
  fs2.mkdirSync(path2.join(absPath, resources.paths.records), { recursive: true });
  return {
    created: [
      ...files.map(([relativePath]) => relativePath),
      `${resources.paths.records}/`
    ]
  };
}
async function initCollection(targetPath) {
  return writeCollectionResources(targetPath, false);
}
async function initCollectionForce(targetPath) {
  return writeCollectionResources(targetPath, true);
}

// src/commands/init.ts
async function initCommand(targetPath, options) {
  const target = targetPath || process.cwd();
  try {
    const init = options.force ? initCollectionForce : initCollection;
    const { created } = await init(target);
    console.log(chalk.green("\u2713") + " Initialized mdbase-tasknotes collection:");
    for (const file of created) {
      console.log(chalk.dim("  " + file));
    }
    console.log("");
    console.log(`Collection path: ${chalk.cyan(target)}`);
    console.log(`Create tasks with: ${chalk.cyan('mtn create "Buy groceries tomorrow #shopping"')}`);
  } catch (err) {
    console.error(chalk.red("\u2717") + ` ${err.message}`);
    process.exitCode = 1;
  }
}

// src/commands/create.ts
import chalk3 from "chalk";

// src/collection.ts
import { Collection } from "@callumalpass/mdbase";
import { basename } from "path";

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
function isCompletedStatus(mapping, status) {
  return isSpecCompletedStatus(mapping, status);
}
function getDefaultCompletedStatus(mapping) {
  return getDefaultSpecCompletedStatus(mapping);
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
function normalizeFrontmatter(raw, mapping) {
  return normalizeSpecFrontmatter(raw, mapping);
}
function denormalizeFrontmatter(roleData, mapping) {
  return denormalizeSpecFrontmatter(roleData, mapping);
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
  const path3 = candidate.path.toLowerCase();
  let score = 0;
  if (title === query) score += 100;
  if (title.startsWith(query)) score += 50;
  if (title.includes(query)) score += 25;
  if (path3.includes(query)) score += 10;
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

// src/nlp.ts
import { loadConfig as loadConfig2, getType as getType2 } from "@callumalpass/mdbase";

// node_modules/tasknotes-nlp-core/dist/defaults.js
var DEFAULT_NLP_TRIGGERS = {
  triggers: [
    { propertyId: "tags", trigger: "#", enabled: true },
    { propertyId: "contexts", trigger: "@", enabled: true },
    { propertyId: "projects", trigger: "+", enabled: true },
    { propertyId: "status", trigger: "*", enabled: true },
    { propertyId: "priority", trigger: "!", enabled: false }
  ]
};

// node_modules/tasknotes-nlp-core/dist/languages/en.js
var enConfig = {
  code: "en",
  name: "English",
  chronoLocale: "en",
  dateTriggers: {
    due: ["due", "deadline", "must be done by", "by"],
    scheduled: ["scheduled for", "start on", "begin on", "work on", "on", "scheduled", "start"]
  },
  recurrence: {
    frequencies: {
      daily: ["daily", "every day"],
      weekly: ["weekly", "every week"],
      monthly: ["monthly", "every month"],
      yearly: ["yearly", "annually", "every year"]
    },
    every: ["every"],
    other: ["other"],
    weekdays: {
      monday: ["monday"],
      tuesday: ["tuesday"],
      wednesday: ["wednesday"],
      thursday: ["thursday"],
      friday: ["friday"],
      saturday: ["saturday"],
      sunday: ["sunday"]
    },
    pluralWeekdays: {
      monday: ["mondays"],
      tuesday: ["tuesdays"],
      wednesday: ["wednesdays"],
      thursday: ["thursdays"],
      friday: ["fridays"],
      saturday: ["saturdays"],
      sunday: ["sundays"]
    },
    ordinals: {
      first: ["first"],
      second: ["second"],
      third: ["third"],
      fourth: ["fourth"],
      last: ["last"]
    },
    periods: {
      day: ["day", "days"],
      week: ["week", "weeks"],
      month: ["month", "months"],
      year: ["year", "years"]
    }
  },
  timeEstimate: {
    hours: ["h", "hr", "hrs", "hour", "hours"],
    minutes: ["m", "min", "mins", "minute", "minutes"]
  },
  fallbackStatus: {
    open: ["todo", "to do", "open"],
    inProgress: ["in progress", "in-progress", "doing"],
    done: ["done", "completed", "finished"],
    cancelled: ["cancelled", "canceled"],
    waiting: ["waiting", "blocked", "on hold"]
  },
  fallbackPriority: {
    urgent: ["urgent", "critical", "highest"],
    high: ["high", "important"],
    normal: ["medium", "normal"],
    low: ["low", "minor"]
  }
};

// node_modules/tasknotes-nlp-core/dist/languages/es.js
var esConfig = {
  code: "es",
  name: "Espa\xF1ol",
  chronoLocale: "es",
  // Note: chrono-node has partial Spanish support
  dateTriggers: {
    due: ["vence", "fecha l\xEDmite", "debe terminarse", "para el", "antes del"],
    scheduled: [
      "programado para",
      "programado el",
      "comenzar el",
      "empezar el",
      "trabajar en",
      "el"
    ]
  },
  recurrence: {
    frequencies: {
      daily: ["diario", "diaria", "diariamente", "cada d\xEDa", "todos los d\xEDas", "a diario"],
      weekly: ["semanal", "semanalmente", "cada semana", "todas las semanas", "por semana"],
      monthly: ["mensual", "mensualmente", "cada mes", "todos los meses", "por mes"],
      yearly: ["anual", "anualmente", "cada a\xF1o", "todos los a\xF1os", "por a\xF1o"]
    },
    every: ["cada", "todos los", "todas las"],
    other: ["otro", "otra"],
    weekdays: {
      monday: ["lunes"],
      tuesday: ["martes"],
      wednesday: ["mi\xE9rcoles"],
      thursday: ["jueves"],
      friday: ["viernes"],
      saturday: ["s\xE1bado"],
      sunday: ["domingo"]
    },
    pluralWeekdays: {
      monday: ["lunes"],
      tuesday: ["martes"],
      wednesday: ["mi\xE9rcoles"],
      thursday: ["jueves"],
      friday: ["viernes"],
      saturday: ["s\xE1bados"],
      sunday: ["domingos"]
    },
    ordinals: {
      first: ["primer", "primera", "primero"],
      second: ["segundo", "segunda"],
      third: ["tercer", "tercera", "tercero"],
      fourth: ["cuarto", "cuarta"],
      last: ["\xFAltimo", "\xFAltima"]
    },
    periods: {
      day: ["d\xEDa", "d\xEDas"],
      week: ["semana", "semanas"],
      month: ["mes", "meses"],
      year: ["a\xF1o", "a\xF1os"]
    }
  },
  timeEstimate: {
    hours: ["h", "hr", "hrs", "hora", "horas"],
    minutes: ["m", "min", "mins", "minuto", "minutos"]
  },
  fallbackStatus: {
    open: ["pendiente", "por hacer", "abierto", "todo"],
    inProgress: ["en progreso", "en curso", "haciendo", "trabajando"],
    done: ["hecho", "terminado", "completado", "finalizado"],
    cancelled: ["cancelado", "anulado"],
    waiting: ["esperando", "bloqueado", "en espera"]
  },
  fallbackPriority: {
    urgent: ["urgente", "cr\xEDtico", "cr\xEDtica", "m\xE1ximo", "m\xE1xima", "prioritario", "prioritaria"],
    high: ["alto", "alta", "importante", "elevado", "elevada"],
    normal: ["medio", "media", "normal", "regular", "est\xE1ndar"],
    low: ["bajo", "baja", "menor", "m\xEDnimo", "m\xEDnima"]
  }
};

// node_modules/tasknotes-nlp-core/dist/languages/fr.js
var frConfig = {
  code: "fr",
  name: "Fran\xE7ais",
  chronoLocale: "fr",
  // chrono-node has full French support
  dateTriggers: {
    due: ["\xE9ch\xE9ance", "date limite", "doit \xEAtre termin\xE9", "pour le", "avant le"],
    scheduled: [
      "programm\xE9 pour",
      "programm\xE9 le",
      "commencer le",
      "d\xE9buter le",
      "travailler sur",
      "le"
    ]
  },
  recurrence: {
    frequencies: {
      daily: [
        "quotidien",
        "quotidienne",
        "quotidiennement",
        "chaque jour",
        "tous les jours",
        "journalier",
        "journali\xE8re"
      ],
      weekly: ["hebdomadaire", "chaque semaine", "toutes les semaines", "par semaine"],
      monthly: [
        "mensuel",
        "mensuelle",
        "mensuellement",
        "chaque mois",
        "tous les mois",
        "par mois"
      ],
      yearly: [
        "annuel",
        "annuelle",
        "annuellement",
        "chaque ann\xE9e",
        "tous les ans",
        "par an",
        "par ann\xE9e"
      ]
    },
    every: ["chaque", "tous les", "toutes les"],
    other: ["autre"],
    weekdays: {
      monday: ["lundi"],
      tuesday: ["mardi"],
      wednesday: ["mercredi"],
      thursday: ["jeudi"],
      friday: ["vendredi"],
      saturday: ["samedi"],
      sunday: ["dimanche"]
    },
    pluralWeekdays: {
      monday: ["lundis"],
      tuesday: ["mardis"],
      wednesday: ["mercredis"],
      thursday: ["jeudis"],
      friday: ["vendredis"],
      saturday: ["samedis"],
      sunday: ["dimanches"]
    },
    ordinals: {
      first: ["premier", "premi\xE8re"],
      second: ["deuxi\xE8me", "second", "seconde"],
      third: ["troisi\xE8me"],
      fourth: ["quatri\xE8me"],
      last: ["dernier", "derni\xE8re"]
    },
    periods: {
      day: ["jour", "jours"],
      week: ["semaine", "semaines"],
      month: ["mois"],
      year: ["an", "ans", "ann\xE9e", "ann\xE9es"]
    }
  },
  timeEstimate: {
    hours: ["h", "hr", "hrs", "heure", "heures"],
    minutes: ["m", "min", "mins", "minute", "minutes"]
  },
  fallbackStatus: {
    open: ["\xE0 faire", "ouvert", "en attente", "todo"],
    inProgress: ["en cours", "en progression", "en train de faire"],
    done: ["termin\xE9", "fini", "accompli", "fait"],
    cancelled: ["annul\xE9", "abandonn\xE9"],
    waiting: ["en attente", "bloqu\xE9", "suspendu"]
  },
  fallbackPriority: {
    urgent: ["urgent", "urgente", "critique", "maximum", "prioritaire"],
    high: [
      "\xE9lev\xE9",
      "\xE9lev\xE9e",
      "haut",
      "haute",
      "important",
      "importante",
      "sup\xE9rieur",
      "sup\xE9rieure"
    ],
    normal: ["moyen", "moyenne", "normal", "normale", "standard", "r\xE9gulier", "r\xE9guli\xE8re"],
    low: ["faible", "bas", "basse", "mineur", "mineure", "minimum"]
  }
};

// node_modules/tasknotes-nlp-core/dist/languages/de.js
var deConfig = {
  code: "de",
  name: "Deutsch",
  chronoLocale: "de",
  // chrono-node has partial German support
  dateTriggers: {
    due: ["f\xE4llig", "termin", "abgabe", "deadline", "bis zum", "bis"],
    scheduled: ["geplant f\xFCr", "geplant am", "beginnen am", "anfangen am", "arbeiten an", "am", "geplant", "starten"]
  },
  recurrence: {
    frequencies: {
      daily: ["t\xE4glich", "jeden Tag", "alle Tage", "tagaus tagein"],
      weekly: ["w\xF6chentlich", "jede Woche", "alle Wochen"],
      monthly: ["monatlich", "jeden Monat", "alle Monate"],
      yearly: ["j\xE4hrlich", "jedes Jahr", "alle Jahre"]
    },
    every: ["jede", "jeden", "jedes", "alle"],
    other: ["andere", "anderen", "anderes"],
    weekdays: {
      monday: ["montag"],
      tuesday: ["dienstag"],
      wednesday: ["mittwoch"],
      thursday: ["donnerstag"],
      friday: ["freitag"],
      saturday: ["samstag"],
      sunday: ["sonntag"]
    },
    pluralWeekdays: {
      monday: ["montags"],
      tuesday: ["dienstags"],
      wednesday: ["mittwochs"],
      thursday: ["donnerstags"],
      friday: ["freitags"],
      saturday: ["samstags"],
      sunday: ["sonntags"]
    },
    ordinals: {
      first: ["erste", "ersten", "erster"],
      second: ["zweite", "zweiten", "zweiter"],
      third: ["dritte", "dritten", "dritter"],
      fourth: ["vierte", "vierten", "vierter"],
      last: ["letzte", "letzten", "letzter"]
    },
    periods: {
      day: ["tag", "tage"],
      week: ["woche", "wochen"],
      month: ["monat", "monate"],
      year: ["jahr", "jahre"]
    }
  },
  timeEstimate: {
    hours: ["h", "std", "stunde", "stunden"],
    minutes: ["m", "min", "minute", "minuten"]
  },
  fallbackStatus: {
    open: ["offen", "zu erledigen", "ausstehend", "todo"],
    inProgress: ["in bearbeitung", "wird bearbeitet", "l\xE4uft", "in arbeit"],
    done: ["erledigt", "fertig", "abgeschlossen", "gemacht"],
    cancelled: ["abgebrochen", "storniert", "abgesagt"],
    waiting: ["wartend", "warten", "blockiert", "pausiert"]
  },
  fallbackPriority: {
    urgent: ["dringend", "eilig", "kritisch", "sofort", "h\xF6chste"],
    high: ["hoch", "hohe", "wichtig", "priorit\xE4r"],
    normal: ["normal", "mittel", "mittlere", "standard"],
    low: ["niedrig", "niedrige", "gering", "geringe"]
  }
};

// node_modules/tasknotes-nlp-core/dist/languages/ru.js
var ruConfig = {
  code: "ru",
  name: "\u0420\u0443\u0441\u0441\u043A\u0438\u0439",
  chronoLocale: "ru",
  // chrono-node has Russian support
  dateTriggers: {
    due: ["\u0441\u0440\u043E\u043A", "\u0434\u0435\u0434\u043B\u0430\u0439\u043D", "\u0434\u043E", "\u043A", "\u0441\u0434\u0430\u0442\u044C \u0434\u043E"],
    scheduled: ["\u0437\u0430\u043F\u043B\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u043E \u043D\u0430", "\u043D\u0430\u0447\u0430\u0442\u044C", "\u0440\u0430\u0431\u043E\u0442\u0430\u0442\u044C \u043D\u0430\u0434", "\u043D\u0430"]
  },
  recurrence: {
    frequencies: {
      daily: ["\u0435\u0436\u0435\u0434\u043D\u0435\u0432\u043D\u043E", "\u043A\u0430\u0436\u0434\u044B\u0439 \u0434\u0435\u043D\u044C", "\u0435\u0436\u0435\u0434\u043D\u0435\u0432\u043D\u044B\u0439", "\u043A\u0430\u0436\u0434\u043E\u0434\u043D\u0435\u0432\u043D\u044B\u0439"],
      weekly: ["\u0435\u0436\u0435\u043D\u0435\u0434\u0435\u043B\u044C\u043D\u043E", "\u043A\u0430\u0436\u0434\u0443\u044E \u043D\u0435\u0434\u0435\u043B\u044E", "\u0435\u0436\u0435\u043D\u0435\u0434\u0435\u043B\u044C\u043D\u044B\u0439"],
      monthly: ["\u0435\u0436\u0435\u043C\u0435\u0441\u044F\u0447\u043D\u043E", "\u043A\u0430\u0436\u0434\u044B\u0439 \u043C\u0435\u0441\u044F\u0446", "\u0435\u0436\u0435\u043C\u0435\u0441\u044F\u0447\u043D\u044B\u0439"],
      yearly: ["\u0435\u0436\u0435\u0433\u043E\u0434\u043D\u043E", "\u043A\u0430\u0436\u0434\u044B\u0439 \u0433\u043E\u0434", "\u0435\u0436\u0435\u0433\u043E\u0434\u043D\u044B\u0439"]
    },
    every: ["\u043A\u0430\u0436\u0434\u044B\u0439", "\u043A\u0430\u0436\u0434\u0443\u044E", "\u043A\u0430\u0436\u0434\u043E\u0435", "\u0432\u0441\u0435"],
    other: ["\u0434\u0440\u0443\u0433\u043E\u0439", "\u0434\u0440\u0443\u0433\u0443\u044E", "\u0434\u0440\u0443\u0433\u043E\u0435"],
    weekdays: {
      monday: ["\u043F\u043E\u043D\u0435\u0434\u0435\u043B\u044C\u043D\u0438\u043A"],
      tuesday: ["\u0432\u0442\u043E\u0440\u043D\u0438\u043A"],
      wednesday: ["\u0441\u0440\u0435\u0434\u0430"],
      thursday: ["\u0447\u0435\u0442\u0432\u0435\u0440\u0433"],
      friday: ["\u043F\u044F\u0442\u043D\u0438\u0446\u0430"],
      saturday: ["\u0441\u0443\u0431\u0431\u043E\u0442\u0430"],
      sunday: ["\u0432\u043E\u0441\u043A\u0440\u0435\u0441\u0435\u043D\u044C\u0435"]
    },
    pluralWeekdays: {
      monday: ["\u043F\u043E \u043F\u043E\u043D\u0435\u0434\u0435\u043B\u044C\u043D\u0438\u043A\u0430\u043C"],
      tuesday: ["\u043F\u043E \u0432\u0442\u043E\u0440\u043D\u0438\u043A\u0430\u043C"],
      wednesday: ["\u043F\u043E \u0441\u0440\u0435\u0434\u0430\u043C"],
      thursday: ["\u043F\u043E \u0447\u0435\u0442\u0432\u0435\u0440\u0433\u0430\u043C"],
      friday: ["\u043F\u043E \u043F\u044F\u0442\u043D\u0438\u0446\u0430\u043C"],
      saturday: ["\u043F\u043E \u0441\u0443\u0431\u0431\u043E\u0442\u0430\u043C"],
      sunday: ["\u043F\u043E \u0432\u043E\u0441\u043A\u0440\u0435\u0441\u0435\u043D\u044C\u044F\u043C"]
    },
    ordinals: {
      first: ["\u043F\u0435\u0440\u0432\u044B\u0439", "\u043F\u0435\u0440\u0432\u0430\u044F", "\u043F\u0435\u0440\u0432\u043E\u0435"],
      second: ["\u0432\u0442\u043E\u0440\u043E\u0439", "\u0432\u0442\u043E\u0440\u0430\u044F", "\u0432\u0442\u043E\u0440\u043E\u0435"],
      third: ["\u0442\u0440\u0435\u0442\u0438\u0439", "\u0442\u0440\u0435\u0442\u044C\u044F", "\u0442\u0440\u0435\u0442\u044C\u0435"],
      fourth: ["\u0447\u0435\u0442\u0432\u0435\u0440\u0442\u044B\u0439", "\u0447\u0435\u0442\u0432\u0435\u0440\u0442\u0430\u044F", "\u0447\u0435\u0442\u0432\u0435\u0440\u0442\u043E\u0435"],
      last: ["\u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439", "\u043F\u043E\u0441\u043B\u0435\u0434\u043D\u044F\u044F", "\u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0435\u0435"]
    },
    periods: {
      day: ["\u0434\u0435\u043D\u044C", "\u0434\u043D\u0438"],
      week: ["\u043D\u0435\u0434\u0435\u043B\u044F", "\u043D\u0435\u0434\u0435\u043B\u0438"],
      month: ["\u043C\u0435\u0441\u044F\u0446", "\u043C\u0435\u0441\u044F\u0446\u044B"],
      year: ["\u0433\u043E\u0434", "\u0433\u043E\u0434\u044B"]
    }
  },
  timeEstimate: {
    hours: ["\u0447", "\u0447\u0430\u0441", "\u0447\u0430\u0441\u0430", "\u0447\u0430\u0441\u043E\u0432"],
    minutes: ["\u043C", "\u043C\u0438\u043D", "\u043C\u0438\u043D\u0443\u0442\u0430", "\u043C\u0438\u043D\u0443\u0442\u044B", "\u043C\u0438\u043D\u0443\u0442"]
  },
  fallbackStatus: {
    open: ["\u043E\u0442\u043A\u0440\u044B\u0442\u043E", "\u043A \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u044E", "\u043D\u043E\u0432\u043E\u0435", "todo"],
    inProgress: ["\u0432 \u0440\u0430\u0431\u043E\u0442\u0435", "\u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F", "\u0432 \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u0435"],
    done: ["\u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043E", "\u0433\u043E\u0442\u043E\u0432\u043E", "\u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043E", "\u0441\u0434\u0435\u043B\u0430\u043D\u043E"],
    cancelled: ["\u043E\u0442\u043C\u0435\u043D\u0435\u043D\u043E", "\u043E\u0442\u043C\u0435\u043D\u0451\u043D", "\u043E\u0442\u043C\u0435\u043D\u0435\u043D\u0430"],
    waiting: ["\u043E\u0436\u0438\u0434\u0430\u043D\u0438\u0435", "\u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u043E", "\u043D\u0430 \u043F\u0430\u0443\u0437\u0435"]
  },
  fallbackPriority: {
    urgent: ["\u0441\u0440\u043E\u0447\u043D\u043E", "\u043A\u0440\u0438\u0442\u0438\u0447\u043D\u043E", "\u044D\u043A\u0441\u0442\u0440\u0435\u043D\u043D\u043E", "\u043D\u0435\u043C\u0435\u0434\u043B\u0435\u043D\u043D\u043E"],
    high: ["\u0432\u044B\u0441\u043E\u043A\u0438\u0439", "\u0432\u044B\u0441\u043E\u043A\u0430\u044F", "\u0432\u0430\u0436\u043D\u043E", "\u043F\u0440\u0438\u043E\u0440\u0438\u0442\u0435\u0442\u043D\u043E"],
    normal: ["\u043D\u043E\u0440\u043C\u0430\u043B\u044C\u043D\u044B\u0439", "\u043D\u043E\u0440\u043C\u0430\u043B\u044C\u043D\u0430\u044F", "\u0441\u0440\u0435\u0434\u043D\u0438\u0439", "\u0441\u0440\u0435\u0434\u043D\u044F\u044F"],
    low: ["\u043D\u0438\u0437\u043A\u0438\u0439", "\u043D\u0438\u0437\u043A\u0430\u044F", "\u043D\u0435\u0432\u0430\u0436\u043D\u043E", "\u043C\u043E\u0436\u043D\u043E \u043F\u043E\u0437\u0436\u0435"]
  }
};

// node_modules/tasknotes-nlp-core/dist/languages/zh.js
var zhConfig = {
  code: "zh",
  name: "\u4E2D\u6587",
  chronoLocale: "zh",
  // chrono-node has Chinese support
  dateTriggers: {
    due: ["\u622A\u6B62", "\u5230\u671F", "\u671F\u9650", "\u5728", "\u4E4B\u524D"],
    scheduled: ["\u5B89\u6392\u5728", "\u8BA1\u5212\u5728", "\u5F00\u59CB\u5728", "\u5728"]
  },
  recurrence: {
    frequencies: {
      daily: ["\u6BCF\u5929", "\u6BCF\u65E5", "\u5929\u5929", "\u65E5\u5E38"],
      weekly: ["\u6BCF\u5468", "\u6BCF\u661F\u671F", "\u5468\u5468"],
      monthly: ["\u6BCF\u6708", "\u6BCF\u4E2A\u6708", "\u6708\u6708"],
      yearly: ["\u6BCF\u5E74", "\u5E74\u5E74", "\u6BCF\u4E00\u5E74"]
    },
    every: ["\u6BCF", "\u6BCF\u4E2A", "\u6BCF\u4E00\u4E2A"],
    other: ["\u5176\u4ED6", "\u53E6\u4E00\u4E2A"],
    weekdays: {
      monday: ["\u5468\u4E00", "\u661F\u671F\u4E00", "\u793C\u62DC\u4E00"],
      tuesday: ["\u5468\u4E8C", "\u661F\u671F\u4E8C", "\u793C\u62DC\u4E8C"],
      wednesday: ["\u5468\u4E09", "\u661F\u671F\u4E09", "\u793C\u62DC\u4E09"],
      thursday: ["\u5468\u56DB", "\u661F\u671F\u56DB", "\u793C\u62DC\u56DB"],
      friday: ["\u5468\u4E94", "\u661F\u671F\u4E94", "\u793C\u62DC\u4E94"],
      saturday: ["\u5468\u516D", "\u661F\u671F\u516D", "\u793C\u62DC\u516D"],
      sunday: ["\u5468\u65E5", "\u661F\u671F\u65E5", "\u793C\u62DC\u65E5"]
    },
    pluralWeekdays: {
      monday: ["\u5468\u4E00", "\u661F\u671F\u4E00", "\u793C\u62DC\u4E00"],
      tuesday: ["\u5468\u4E8C", "\u661F\u671F\u4E8C", "\u793C\u62DC\u4E8C"],
      wednesday: ["\u5468\u4E09", "\u661F\u671F\u4E09", "\u793C\u62DC\u4E09"],
      thursday: ["\u5468\u56DB", "\u661F\u671F\u56DB", "\u793C\u62DC\u56DB"],
      friday: ["\u5468\u4E94", "\u661F\u671F\u4E94", "\u793C\u62DC\u4E94"],
      saturday: ["\u5468\u516D", "\u661F\u671F\u516D", "\u793C\u62DC\u516D"],
      sunday: ["\u5468\u65E5", "\u661F\u671F\u65E5", "\u793C\u62DC\u65E5"]
    },
    ordinals: {
      first: ["\u7B2C\u4E00\u4E2A", "\u7B2C\u4E00", "\u9996\u4E2A"],
      second: ["\u7B2C\u4E8C\u4E2A", "\u7B2C\u4E8C"],
      third: ["\u7B2C\u4E09\u4E2A", "\u7B2C\u4E09"],
      fourth: ["\u7B2C\u56DB\u4E2A", "\u7B2C\u56DB"],
      last: ["\u6700\u540E\u4E00\u4E2A", "\u6700\u540E", "\u672B\u5C3E"]
    },
    periods: {
      day: ["\u5929", "\u65E5"],
      week: ["\u5468", "\u661F\u671F"],
      month: ["\u6708", "\u4E2A\u6708"],
      year: ["\u5E74"]
    }
  },
  timeEstimate: {
    hours: ["\u5C0F\u65F6", "\u65F6", "\u4E2A\u5C0F\u65F6"],
    minutes: ["\u5206\u949F", "\u5206", "\u4E2A\u5206\u949F"]
  },
  fallbackStatus: {
    open: ["\u5F85\u529E", "\u672A\u5B8C\u6210", "\u5F00\u653E", "\u65B0\u5EFA"],
    inProgress: ["\u8FDB\u884C\u4E2D", "\u6B63\u5728\u5904\u7406", "\u5904\u7406\u4E2D", "\u5DE5\u4F5C\u4E2D"],
    done: ["\u5B8C\u6210", "\u5DF2\u5B8C\u6210", "\u7ED3\u675F", "\u641E\u5B9A"],
    cancelled: ["\u53D6\u6D88", "\u5DF2\u53D6\u6D88", "\u5E9F\u5F03"],
    waiting: ["\u7B49\u5F85", "\u6682\u505C", "\u963B\u585E", "\u5F85\u5B9A"]
  },
  fallbackPriority: {
    urgent: ["\u7D27\u6025", "\u6025\u8FEB", "\u7ACB\u5373", "\u9A6C\u4E0A"],
    high: ["\u9AD8", "\u91CD\u8981", "\u9AD8\u4F18\u5148\u7EA7"],
    normal: ["\u6B63\u5E38", "\u666E\u901A", "\u4E2D\u7B49", "\u6807\u51C6"],
    low: ["\u4F4E", "\u4E0D\u91CD\u8981", "\u4F4E\u4F18\u5148\u7EA7", "\u6B21\u8981"]
  }
};

// node_modules/tasknotes-nlp-core/dist/languages/ja.js
var jaConfig = {
  code: "ja",
  name: "\u65E5\u672C\u8A9E",
  chronoLocale: "ja",
  // chrono-node has Japanese support
  dateTriggers: {
    due: ["\u671F\u9650", "\u7DE0\u5207", "\u3006\u5207", "\u307E\u3067", "\u307E\u3067\u306B", "\u306B"],
    scheduled: ["\u4E88\u5B9A", "\u8A08\u753B", "\u958B\u59CB", "\u304B\u3089", "\u306B\u958B\u59CB", "\u3092\u958B\u59CB"]
  },
  recurrence: {
    frequencies: {
      daily: ["\u6BCE\u65E5", "\u65E5\u3005", "\u6BCE\u65E5\u6BCE\u65E5", "\u9023\u65E5"],
      weekly: ["\u6BCE\u9031", "\u9031\u6BCE", "\u9031\u4E00", "\u6BCE\u9031\u6BCE\u9031"],
      monthly: ["\u6BCE\u6708", "\u6708\u6BCE", "\u6708\u4E00", "\u6BCE\u6708\u6BCE\u6708"],
      yearly: ["\u6BCE\u5E74", "\u5E74\u6BCE", "\u5E74\u4E00", "\u6BCE\u5E74\u6BCE\u5E74", "\u5E74\u6B21"]
    },
    every: ["\u6BCE", "\u5404", "\u5168\u3066"],
    other: ["\u4ED6\u306E", "\u5225\u306E", "\u7570\u306A\u308B"],
    weekdays: {
      monday: ["\u6708\u66DC\u65E5", "\u6708\u66DC", "\u6708", "\u3052\u3064\u3088\u3046\u3073"],
      tuesday: ["\u706B\u66DC\u65E5", "\u706B\u66DC", "\u706B", "\u304B\u3088\u3046\u3073"],
      wednesday: ["\u6C34\u66DC\u65E5", "\u6C34\u66DC", "\u6C34", "\u3059\u3044\u3088\u3046\u3073"],
      thursday: ["\u6728\u66DC\u65E5", "\u6728\u66DC", "\u6728", "\u3082\u304F\u3088\u3046\u3073"],
      friday: ["\u91D1\u66DC\u65E5", "\u91D1\u66DC", "\u91D1", "\u304D\u3093\u3088\u3046\u3073"],
      saturday: ["\u571F\u66DC\u65E5", "\u571F\u66DC", "\u571F", "\u3069\u3088\u3046\u3073"],
      sunday: ["\u65E5\u66DC\u65E5", "\u65E5\u66DC", "\u65E5", "\u306B\u3061\u3088\u3046\u3073"]
    },
    pluralWeekdays: {
      monday: ["\u6708\u66DC\u65E5", "\u6708\u66DC", "\u6708", "\u3052\u3064\u3088\u3046\u3073"],
      tuesday: ["\u706B\u66DC\u65E5", "\u706B\u66DC", "\u706B", "\u304B\u3088\u3046\u3073"],
      wednesday: ["\u6C34\u66DC\u65E5", "\u6C34\u66DC", "\u6C34", "\u3059\u3044\u3088\u3046\u3073"],
      thursday: ["\u6728\u66DC\u65E5", "\u6728\u66DC", "\u6728", "\u3082\u304F\u3088\u3046\u3073"],
      friday: ["\u91D1\u66DC\u65E5", "\u91D1\u66DC", "\u91D1", "\u304D\u3093\u3088\u3046\u3073"],
      saturday: ["\u571F\u66DC\u65E5", "\u571F\u66DC", "\u571F", "\u3069\u3088\u3046\u3073"],
      sunday: ["\u65E5\u66DC\u65E5", "\u65E5\u66DC", "\u65E5", "\u306B\u3061\u3088\u3046\u3073"]
    },
    ordinals: {
      first: ["\u6700\u521D\u306E", "\u7B2C\u4E00\u306E", "\u4E00\u756A\u76EE\u306E", "\u521D\u56DE"],
      second: ["\u4E8C\u756A\u76EE\u306E", "\u7B2C\u4E8C\u306E", "\u6B21\u306E"],
      third: ["\u4E09\u756A\u76EE\u306E", "\u7B2C\u4E09\u306E"],
      fourth: ["\u56DB\u756A\u76EE\u306E", "\u7B2C\u56DB\u306E"],
      last: ["\u6700\u5F8C\u306E", "\u6700\u7D42\u306E", "\u7D42\u308F\u308A\u306E"]
    },
    periods: {
      day: ["\u65E5", "\u65E5\u9593"],
      week: ["\u9031", "\u9031\u9593"],
      month: ["\u6708", "\u6708\u9593", "\u30F6\u6708"],
      year: ["\u5E74", "\u5E74\u9593"]
    }
  },
  timeEstimate: {
    hours: ["\u6642\u9593", "\u6642", "\u3058\u304B\u3093"],
    minutes: ["\u5206", "\u5206\u9593", "\u3075\u3093", "\u3077\u3093"]
  },
  fallbackStatus: {
    open: ["\u672A\u7740\u624B", "\u65B0\u898F", "\u30AA\u30FC\u30D7\u30F3", "\u958B\u59CB\u524D", "\u5F85\u6A5F"],
    inProgress: ["\u9032\u884C\u4E2D", "\u4F5C\u696D\u4E2D", "\u5B9F\u884C\u4E2D", "\u51E6\u7406\u4E2D", "\u9032\u884C"],
    done: ["\u5B8C\u4E86", "\u7D42\u4E86", "\u6E08\u307F", "\u7D42\u308F\u308A", "\u9054\u6210"],
    cancelled: ["\u30AD\u30E3\u30F3\u30BB\u30EB", "\u4E2D\u6B62", "\u53D6\u6D88", "\u5EC3\u6B62", "\u505C\u6B62"],
    waiting: ["\u5F85\u6A5F", "\u4FDD\u7559", "\u30D6\u30ED\u30C3\u30AF", "\u4E00\u6642\u505C\u6B62", "\u5F85\u3061"]
  },
  fallbackPriority: {
    urgent: ["\u7DCA\u6025", "\u81F3\u6025", "\u6025\u52D9", "\u6700\u512A\u5148", "\u3059\u3050\u306B"],
    high: ["\u9AD8", "\u91CD\u8981", "\u9AD8\u512A\u5148\u5EA6", "\u91CD\u70B9"],
    normal: ["\u666E\u901A", "\u901A\u5E38", "\u6A19\u6E96", "\u4E00\u822C", "\u30CE\u30FC\u30DE\u30EB"],
    low: ["\u4F4E", "\u8EFD\u5FAE", "\u5F8C\u56DE\u3057", "\u4F4E\u512A\u5148\u5EA6", "\u4F59\u88D5"]
  }
};

// node_modules/tasknotes-nlp-core/dist/languages/it.js
var itConfig = {
  code: "it",
  name: "Italiano",
  chronoLocale: "it",
  dateTriggers: {
    due: ["scadenza", "entro", "entro il", "deve essere fatto entro", "per il", "termine"],
    scheduled: ["programmato per", "programmato il", "iniziare il", "lavorare su", "il", "per"]
  },
  recurrence: {
    frequencies: {
      daily: [
        "giornaliero",
        "giornaliera",
        "quotidiano",
        "quotidiana",
        "ogni giorno",
        "tutti i giorni",
        "giornalmente"
      ],
      weekly: [
        "settimanale",
        "ogni settimana",
        "tutte le settimane",
        "settimanalmente",
        "alla settimana"
      ],
      monthly: ["mensile", "ogni mese", "tutti i mesi", "mensilmente", "al mese"],
      yearly: ["annuale", "ogni anno", "tutti gli anni", "annualmente", "all'anno"]
    },
    every: ["ogni", "tutti i", "tutte le"],
    other: ["altro", "altra", "altri", "altre"],
    weekdays: {
      monday: ["luned\xEC"],
      tuesday: ["marted\xEC"],
      wednesday: ["mercoled\xEC"],
      thursday: ["gioved\xEC"],
      friday: ["venerd\xEC"],
      saturday: ["sabato"],
      sunday: ["domenica"]
    },
    pluralWeekdays: {
      monday: ["luned\xEC"],
      tuesday: ["marted\xEC"],
      wednesday: ["mercoled\xEC"],
      thursday: ["gioved\xEC"],
      friday: ["venerd\xEC"],
      saturday: ["sabati"],
      sunday: ["domeniche"]
    },
    ordinals: {
      first: ["primo", "prima"],
      second: ["secondo", "seconda"],
      third: ["terzo", "terza"],
      fourth: ["quarto", "quarta"],
      last: ["ultimo", "ultima"]
    },
    periods: {
      day: ["giorno", "giorni"],
      week: ["settimana", "settimane"],
      month: ["mese", "mesi"],
      year: ["anno", "anni"]
    }
  },
  timeEstimate: {
    hours: ["h", "hr", "ore", "ora", "o"],
    minutes: ["m", "min", "minuto", "minuti"]
  },
  fallbackStatus: {
    open: ["da fare", "aperto", "pendente", "todo", "in sospeso"],
    inProgress: ["in corso", "in progresso", "facendo", "lavorando"],
    done: ["fatto", "completato", "finito", "terminato", "chiuso"],
    cancelled: ["cancellato", "annullato", "rimosso"],
    waiting: ["in attesa", "aspettando", "bloccato", "fermo"]
  },
  fallbackPriority: {
    urgent: [
      "urgente",
      "critico",
      "critica",
      "massimo",
      "massima",
      "prioritario",
      "prioritaria"
    ],
    high: ["alto", "alta", "importante", "elevato", "elevata"],
    normal: ["medio", "media", "normale", "regolare", "standard"],
    low: ["basso", "bassa", "minore", "minimo", "minima"]
  }
};

// node_modules/tasknotes-nlp-core/dist/languages/nl.js
var nlConfig = {
  code: "nl",
  name: "Nederlands",
  chronoLocale: "nl",
  dateTriggers: {
    due: ["vervalt op", "deadline", "moet klaar zijn op", "tegen", "uiterlijk", "voor"],
    scheduled: ["gepland voor", "gepland op", "beginnen op", "werken aan", "op", "voor"]
  },
  recurrence: {
    frequencies: {
      daily: ["dagelijks", "elke dag", "alle dagen", "per dag"],
      weekly: ["wekelijks", "elke week", "alle weken", "per week"],
      monthly: ["maandelijks", "elke maand", "alle maanden", "per maand"],
      yearly: ["jaarlijks", "elk jaar", "alle jaren", "per jaar"]
    },
    every: ["elke", "alle", "iedere"],
    other: ["andere", "ander"],
    weekdays: {
      monday: ["maandag"],
      tuesday: ["dinsdag"],
      wednesday: ["woensdag"],
      thursday: ["donderdag"],
      friday: ["vrijdag"],
      saturday: ["zaterdag"],
      sunday: ["zondag"]
    },
    pluralWeekdays: {
      monday: ["maandagen"],
      tuesday: ["dinsdagen"],
      wednesday: ["woensdagen"],
      thursday: ["donderdagen"],
      friday: ["vrijdagen"],
      saturday: ["zaterdagen"],
      sunday: ["zondagen"]
    },
    ordinals: {
      first: ["eerste"],
      second: ["tweede"],
      third: ["derde"],
      fourth: ["vierde"],
      last: ["laatste"]
    },
    periods: {
      day: ["dag", "dagen"],
      week: ["week", "weken"],
      month: ["maand", "maanden"],
      year: ["jaar", "jaren"]
    }
  },
  timeEstimate: {
    hours: ["u", "uur", "uren", "h"],
    minutes: ["m", "min", "minuut", "minuten"]
  },
  fallbackStatus: {
    open: ["te doen", "open", "nog te doen", "todo", "openstaand"],
    inProgress: ["bezig", "in behandeling", "aan het werk", "lopend", "in uitvoering"],
    done: ["klaar", "voltooid", "gedaan", "afgerond", "gesloten"],
    cancelled: ["geannuleerd", "afgezegd", "ingetrokken"],
    waiting: ["wachtend", "in de wacht", "geblokkeerd", "uitgesteld"]
  },
  fallbackPriority: {
    urgent: ["urgent", "kritiek", "hoogste", "spoed", "direct"],
    high: ["hoog", "hoge", "belangrijk", "belangrijke"],
    normal: ["normaal", "normale", "gemiddeld", "standaard"],
    low: ["laag", "lage", "klein", "kleine", "onbelangrijk"]
  }
};

// node_modules/tasknotes-nlp-core/dist/languages/pt.js
var ptConfig = {
  code: "pt",
  name: "Portugu\xEAs",
  chronoLocale: "pt",
  dateTriggers: {
    due: ["vencimento", "prazo", "deve estar pronto at\xE9", "at\xE9", "para", "limite"],
    scheduled: ["programado para", "agendado para", "come\xE7ar em", "trabalhar em", "em", "no"]
  },
  recurrence: {
    frequencies: {
      daily: ["di\xE1rio", "di\xE1ria", "diariamente", "todos os dias", "cada dia", "por dia"],
      weekly: ["semanal", "semanalmente", "toda semana", "todas as semanas", "por semana"],
      monthly: ["mensal", "mensalmente", "todo m\xEAs", "todos os meses", "por m\xEAs"],
      yearly: ["anual", "anualmente", "todo ano", "todos os anos", "por ano"]
    },
    every: ["todo", "toda", "todos", "todas", "cada"],
    other: ["outro", "outra", "outros", "outras"],
    weekdays: {
      monday: ["segunda", "segunda-feira"],
      tuesday: ["ter\xE7a", "ter\xE7a-feira"],
      wednesday: ["quarta", "quarta-feira"],
      thursday: ["quinta", "quinta-feira"],
      friday: ["sexta", "sexta-feira"],
      saturday: ["s\xE1bado"],
      sunday: ["domingo"]
    },
    pluralWeekdays: {
      monday: ["segundas", "segundas-feiras"],
      tuesday: ["ter\xE7as", "ter\xE7as-feiras"],
      wednesday: ["quartas", "quartas-feiras"],
      thursday: ["quintas", "quintas-feiras"],
      friday: ["sextas", "sextas-feiras"],
      saturday: ["s\xE1bados"],
      sunday: ["domingos"]
    },
    ordinals: {
      first: ["primeiro", "primeira"],
      second: ["segundo", "segunda"],
      third: ["terceiro", "terceira"],
      fourth: ["quarto", "quarta"],
      last: ["\xFAltimo", "\xFAltima"]
    },
    periods: {
      day: ["dia", "dias"],
      week: ["semana", "semanas"],
      month: ["m\xEAs", "meses"],
      year: ["ano", "anos"]
    }
  },
  timeEstimate: {
    hours: ["h", "hr", "hora", "horas"],
    minutes: ["m", "min", "minuto", "minutos"]
  },
  fallbackStatus: {
    open: ["a fazer", "pendente", "aberto", "todo", "por fazer"],
    inProgress: ["em andamento", "em progresso", "fazendo", "trabalhando", "executando"],
    done: ["feito", "conclu\xEDdo", "terminado", "finalizado", "completo"],
    cancelled: ["cancelado", "anulado", "suspenso"],
    waiting: ["aguardando", "esperando", "bloqueado", "em espera"]
  },
  fallbackPriority: {
    urgent: ["urgente", "cr\xEDtico", "cr\xEDtica", "m\xE1ximo", "m\xE1xima", "priorit\xE1rio", "priorit\xE1ria"],
    high: ["alto", "alta", "importante", "elevado", "elevada"],
    normal: ["m\xE9dio", "m\xE9dia", "normal", "regular", "padr\xE3o"],
    low: ["baixo", "baixa", "menor", "m\xEDnimo", "m\xEDnima"]
  }
};

// node_modules/tasknotes-nlp-core/dist/languages/sv.js
var svConfig = {
  code: "sv",
  name: "Svenska",
  chronoLocale: "sv",
  dateTriggers: {
    due: ["f\xF6rfaller", "deadline", "m\xE5ste vara klar", "senast", "till", "innan"],
    scheduled: ["schemalagd", "planerad f\xF6r", "b\xF6rja", "arbeta med", "den", "p\xE5"]
  },
  recurrence: {
    frequencies: {
      daily: ["dagligen", "varje dag", "alla dagar", "per dag"],
      weekly: ["veckovis", "varje vecka", "alla veckor", "per vecka"],
      monthly: ["m\xE5nadsvis", "varje m\xE5nad", "alla m\xE5nader", "per m\xE5nad"],
      yearly: ["\xE5rligen", "varje \xE5r", "alla \xE5r", "per \xE5r"]
    },
    every: ["varje", "alla", "var"],
    other: ["annan", "annat", "andra"],
    weekdays: {
      monday: ["m\xE5ndag"],
      tuesday: ["tisdag"],
      wednesday: ["onsdag"],
      thursday: ["torsdag"],
      friday: ["fredag"],
      saturday: ["l\xF6rdag"],
      sunday: ["s\xF6ndag"]
    },
    pluralWeekdays: {
      monday: ["m\xE5ndagar"],
      tuesday: ["tisdagar"],
      wednesday: ["onsdagar"],
      thursday: ["torsdagar"],
      friday: ["fredagar"],
      saturday: ["l\xF6rdagar"],
      sunday: ["s\xF6ndagar"]
    },
    ordinals: {
      first: ["f\xF6rsta"],
      second: ["andra"],
      third: ["tredje"],
      fourth: ["fj\xE4rde"],
      last: ["sista"]
    },
    periods: {
      day: ["dag", "dagar"],
      week: ["vecka", "veckor"],
      month: ["m\xE5nad", "m\xE5nader"],
      year: ["\xE5r"]
    }
  },
  timeEstimate: {
    hours: ["t", "tim", "timme", "timmar", "h"],
    minutes: ["m", "min", "minut", "minuter"]
  },
  fallbackStatus: {
    open: ["att g\xF6ra", "\xF6ppen", "kvar", "todo", "v\xE4ntande"],
    inProgress: ["p\xE5g\xE5ende", "arbetar", "g\xF6r", "i process", "under arbete"],
    done: ["klar", "f\xE4rdig", "slutf\xF6rd", "avslutad", "gjord"],
    cancelled: ["avbruten", "inst\xE4lld", "avbokad"],
    waiting: ["v\xE4ntar", "blockerad", "pausad", "vilande"]
  },
  fallbackPriority: {
    urgent: ["br\xE5dskande", "kritisk", "h\xF6gsta", "akut", "omedelbar"],
    high: ["h\xF6g", "viktig", "f\xF6rh\xF6jd", "prioriterad"],
    normal: ["normal", "medel", "standard", "vanlig"],
    low: ["l\xE5g", "mindre", "minimal", "obetydlig"]
  }
};

// node_modules/tasknotes-nlp-core/dist/languages/uk.js
var ukConfig = {
  code: "uk",
  name: "\u0423\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u0430",
  chronoLocale: "uk",
  dateTriggers: {
    due: ["\u0442\u0435\u0440\u043C\u0456\u043D", "\u0434\u0435\u0434\u043B\u0430\u0439\u043D", "\u043C\u0430\u0454 \u0431\u0443\u0442\u0438 \u0433\u043E\u0442\u043E\u0432\u043E \u0434\u043E", "\u0434\u043E", "\u043D\u0435 \u043F\u0456\u0437\u043D\u0456\u0448\u0435", "\u043A\u0440\u0430\u0439\u043D\u0456\u0439 \u0442\u0435\u0440\u043C\u0456\u043D"],
    scheduled: ["\u0437\u0430\u043F\u043B\u0430\u043D\u043E\u0432\u0430\u043D\u043E \u043D\u0430", "\u0437\u0430\u043F\u043B\u0430\u043D\u043E\u0432\u0430\u043D\u0438\u0439", "\u043F\u043E\u0447\u0430\u0442\u0438", "\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u0442\u0438 \u043D\u0430\u0434", "\u043D\u0430", "\u0432"]
  },
  recurrence: {
    frequencies: {
      daily: ["\u0449\u043E\u0434\u043D\u044F", "\u0449\u043E\u0434\u0435\u043D\u043D\u043E", "\u043A\u043E\u0436\u0435\u043D \u0434\u0435\u043D\u044C", "\u0432\u0441\u0456 \u0434\u043D\u0456", "\u043D\u0430 \u0434\u0435\u043D\u044C"],
      weekly: ["\u0449\u043E\u0442\u0438\u0436\u043D\u044F", "\u0449\u043E\u0442\u0438\u0436\u043D\u0435\u0432\u043E", "\u043A\u043E\u0436\u0435\u043D \u0442\u0438\u0436\u0434\u0435\u043D\u044C", "\u0432\u0441\u0456 \u0442\u0438\u0436\u043D\u0456", "\u043D\u0430 \u0442\u0438\u0436\u0434\u0435\u043D\u044C"],
      monthly: ["\u0449\u043E\u043C\u0456\u0441\u044F\u0446\u044F", "\u0449\u043E\u043C\u0456\u0441\u044F\u0447\u043D\u043E", "\u043A\u043E\u0436\u0435\u043D \u043C\u0456\u0441\u044F\u0446\u044C", "\u0432\u0441\u0456 \u043C\u0456\u0441\u044F\u0446\u0456", "\u043D\u0430 \u043C\u0456\u0441\u044F\u0446\u044C"],
      yearly: ["\u0449\u043E\u0440\u043E\u043A\u0443", "\u0449\u043E\u0440\u0456\u0447\u043D\u043E", "\u043A\u043E\u0436\u0435\u043D \u0440\u0456\u043A", "\u0432\u0441\u0456 \u0440\u043E\u043A\u0438", "\u043D\u0430 \u0440\u0456\u043A"]
    },
    every: ["\u043A\u043E\u0436\u0435\u043D", "\u043A\u043E\u0436\u043D\u0430", "\u043A\u043E\u0436\u043D\u0435", "\u0432\u0441\u0456"],
    other: ["\u0456\u043D\u0448\u0438\u0439", "\u0456\u043D\u0448\u0430", "\u0456\u043D\u0448\u0435", "\u0456\u043D\u0448\u0456"],
    weekdays: {
      monday: ["\u043F\u043E\u043D\u0435\u0434\u0456\u043B\u043E\u043A"],
      tuesday: ["\u0432\u0456\u0432\u0442\u043E\u0440\u043E\u043A"],
      wednesday: ["\u0441\u0435\u0440\u0435\u0434\u0430"],
      thursday: ["\u0447\u0435\u0442\u0432\u0435\u0440"],
      friday: ["\u043F'\u044F\u0442\u043D\u0438\u0446\u044F"],
      saturday: ["\u0441\u0443\u0431\u043E\u0442\u0430"],
      sunday: ["\u043D\u0435\u0434\u0456\u043B\u044F"]
    },
    pluralWeekdays: {
      monday: ["\u043F\u043E\u043D\u0435\u0434\u0456\u043B\u043A\u0438"],
      tuesday: ["\u0432\u0456\u0432\u0442\u043E\u0440\u043A\u0438"],
      wednesday: ["\u0441\u0435\u0440\u0435\u0434\u0438"],
      thursday: ["\u0447\u0435\u0442\u0432\u0435\u0440\u0433\u0438"],
      friday: ["\u043F'\u044F\u0442\u043D\u0438\u0446\u0456"],
      saturday: ["\u0441\u0443\u0431\u043E\u0442\u0438"],
      sunday: ["\u043D\u0435\u0434\u0456\u043B\u0456"]
    },
    ordinals: {
      first: ["\u043F\u0435\u0440\u0448\u0438\u0439", "\u043F\u0435\u0440\u0448\u0430", "\u043F\u0435\u0440\u0448\u0435"],
      second: ["\u0434\u0440\u0443\u0433\u0438\u0439", "\u0434\u0440\u0443\u0433\u0430", "\u0434\u0440\u0443\u0433\u0435"],
      third: ["\u0442\u0440\u0435\u0442\u0456\u0439", "\u0442\u0440\u0435\u0442\u044F", "\u0442\u0440\u0435\u0442\u0454"],
      fourth: ["\u0447\u0435\u0442\u0432\u0435\u0440\u0442\u0438\u0439", "\u0447\u0435\u0442\u0432\u0435\u0440\u0442\u0430", "\u0447\u0435\u0442\u0432\u0435\u0440\u0442\u0435"],
      last: ["\u043E\u0441\u0442\u0430\u043D\u043D\u0456\u0439", "\u043E\u0441\u0442\u0430\u043D\u043D\u044F", "\u043E\u0441\u0442\u0430\u043D\u043D\u0454"]
    },
    periods: {
      day: ["\u0434\u0435\u043D\u044C", "\u0434\u043D\u0456", "\u0434\u043D\u0456\u0432"],
      week: ["\u0442\u0438\u0436\u0434\u0435\u043D\u044C", "\u0442\u0438\u0436\u043D\u0456", "\u0442\u0438\u0436\u043D\u0456\u0432"],
      month: ["\u043C\u0456\u0441\u044F\u0446\u044C", "\u043C\u0456\u0441\u044F\u0446\u0456", "\u043C\u0456\u0441\u044F\u0446\u0456\u0432"],
      year: ["\u0440\u0456\u043A", "\u0440\u043E\u043A\u0438", "\u0440\u043E\u043A\u0456\u0432"]
    }
  },
  timeEstimate: {
    hours: ["\u0433", "\u0433\u043E\u0434", "\u0433\u043E\u0434\u0438\u043D\u0430", "\u0433\u043E\u0434\u0438\u043D\u0438", "\u0433\u043E\u0434\u0438\u043D"],
    minutes: ["\u0445\u0432", "\u043C\u0456\u043D", "\u0445\u0432\u0438\u043B\u0438\u043D\u0430", "\u0445\u0432\u0438\u043B\u0438\u043D\u0438", "\u0445\u0432\u0438\u043B\u0438\u043D"]
  },
  fallbackStatus: {
    open: ["\u0437\u0440\u043E\u0431\u0438\u0442\u0438", "\u0432\u0456\u0434\u043A\u0440\u0438\u0442\u0438\u0439", "\u043E\u0447\u0456\u043A\u0443\u0454", "todo", "\u0432 \u043E\u0447\u0456\u043A\u0443\u0432\u0430\u043D\u043D\u0456"],
    inProgress: ["\u0432 \u0440\u043E\u0431\u043E\u0442\u0456", "\u0432\u0438\u043A\u043E\u043D\u0443\u0454\u0442\u044C\u0441\u044F", "\u0440\u043E\u0431\u043B\u044E", "\u043F\u0440\u0430\u0446\u044E\u044E", "\u0432 \u043F\u0440\u043E\u0446\u0435\u0441\u0456"],
    done: ["\u0433\u043E\u0442\u043E\u0432\u043E", "\u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043E", "\u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043E", "\u0437\u0430\u043A\u0456\u043D\u0447\u0435\u043D\u043E", "\u0437\u0440\u043E\u0431\u043B\u0435\u043D\u043E"],
    cancelled: ["\u0441\u043A\u0430\u0441\u043E\u0432\u0430\u043D\u043E", "\u0432\u0456\u0434\u043C\u0456\u043D\u0435\u043D\u043E", "\u043F\u0440\u0438\u043F\u0438\u043D\u0435\u043D\u043E"],
    waiting: ["\u0447\u0435\u043A\u0430\u044E", "\u043E\u0447\u0456\u043A\u0443\u044E", "\u0437\u0430\u0431\u043B\u043E\u043A\u043E\u0432\u0430\u043D\u043E", "\u043F\u0440\u0438\u0437\u0443\u043F\u0438\u043D\u0435\u043D\u043E"]
  },
  fallbackPriority: {
    urgent: ["\u0442\u0435\u0440\u043C\u0456\u043D\u043E\u0432\u043E", "\u043A\u0440\u0438\u0442\u0438\u0447\u043D\u043E", "\u043D\u0430\u0439\u0432\u0438\u0449\u0438\u0439", "\u043D\u0435\u0432\u0456\u0434\u043A\u043B\u0430\u0434\u043D\u043E", "\u043F\u0440\u0456\u043E\u0440\u0438\u0442\u0435\u0442\u043D\u043E"],
    high: ["\u0432\u0438\u0441\u043E\u043A\u0438\u0439", "\u0432\u0438\u0441\u043E\u043A\u0430", "\u0432\u0430\u0436\u043B\u0438\u0432\u043E", "\u043F\u0456\u0434\u0432\u0438\u0449\u0435\u043D\u0438\u0439"],
    normal: ["\u0441\u0435\u0440\u0435\u0434\u043D\u0456\u0439", "\u0441\u0435\u0440\u0435\u0434\u043D\u044F", "\u043D\u043E\u0440\u043C\u0430\u043B\u044C\u043D\u043E", "\u0437\u0432\u0438\u0447\u0430\u0439\u043D\u043E", "\u0441\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u043D\u043E"],
    low: ["\u043D\u0438\u0437\u044C\u043A\u0438\u0439", "\u043D\u0438\u0437\u044C\u043A\u0430", "\u043C\u0435\u043D\u0448\u0438\u0439", "\u043C\u0456\u043D\u0456\u043C\u0430\u043B\u044C\u043D\u0438\u0439", "\u043D\u0435\u0437\u043D\u0430\u0447\u043D\u0438\u0439"]
  }
};

// node_modules/tasknotes-nlp-core/dist/languages/index.js
var languageRegistry = {
  en: enConfig,
  es: esConfig,
  fr: frConfig,
  de: deConfig,
  ru: ruConfig,
  zh: zhConfig,
  ja: jaConfig,
  it: itConfig,
  nl: nlConfig,
  pt: ptConfig,
  sv: svConfig,
  uk: ukConfig
};
function getLanguageConfig(languageCode) {
  return languageRegistry[languageCode] || languageRegistry["en"];
}

// node_modules/tasknotes-nlp-core/dist/TriggerConfigService.js
var TriggerConfigService = class {
  constructor(config, userFields = []) {
    this.config = config;
    this.userFields = userFields;
    this.triggerMap = /* @__PURE__ */ new Map();
    this.propertyMap = /* @__PURE__ */ new Map();
    this.buildMaps();
  }
  /**
   * Build lookup maps for efficient queries
   */
  buildMaps() {
    this.triggerMap.clear();
    this.propertyMap.clear();
    for (const triggerConfig of this.config.triggers) {
      if (triggerConfig.enabled) {
        this.triggerMap.set(triggerConfig.trigger, triggerConfig);
        this.propertyMap.set(triggerConfig.propertyId, triggerConfig);
      }
    }
  }
  /**
   * Get trigger config for a specific property
   */
  getTriggerForProperty(propertyId) {
    return this.propertyMap.get(propertyId);
  }
  /**
   * Get property ID for a trigger string
   */
  getPropertyForTrigger(trigger) {
    return this.triggerMap.get(trigger)?.propertyId;
  }
  /**
   * Get all enabled triggers
   */
  getAllEnabledTriggers() {
    return this.config.triggers.filter((t) => t.enabled);
  }
  /**
   * Get all enabled triggers sorted by trigger length (longest first)
   * This ensures multi-character triggers are matched before single-character ones
   */
  getTriggersOrderedByLength() {
    return this.getAllEnabledTriggers().sort((a, b) => b.trigger.length - a.trigger.length);
  }
  /**
   * Check if a trigger is using Obsidian's native tag suggester
   */
  usesNativeTagSuggester() {
    const tagTrigger = this.getTriggerForProperty("tags");
    return tagTrigger?.trigger === "#" && tagTrigger?.enabled;
  }
  /**
   * Get the trigger string for tags (or undefined if disabled)
   */
  getTagTrigger() {
    const config = this.getTriggerForProperty("tags");
    return config?.enabled ? config.trigger : void 0;
  }
  /**
   * Get the trigger string for contexts (or undefined if disabled)
   */
  getContextTrigger() {
    const config = this.getTriggerForProperty("contexts");
    return config?.enabled ? config.trigger : void 0;
  }
  /**
   * Get the trigger string for projects (or undefined if disabled)
   */
  getProjectTrigger() {
    const config = this.getTriggerForProperty("projects");
    return config?.enabled ? config.trigger : void 0;
  }
  /**
   * Get the trigger string for status (or undefined if disabled)
   */
  getStatusTrigger() {
    const config = this.getTriggerForProperty("status");
    return config?.enabled ? config.trigger : void 0;
  }
  /**
   * Get the trigger string for priority (or undefined if disabled)
   */
  getPriorityTrigger() {
    const config = this.getTriggerForProperty("priority");
    return config?.enabled ? config.trigger : void 0;
  }
  /**
   * Get user field definition by ID
   */
  getUserField(fieldId) {
    return this.userFields.find((f) => f.id === fieldId);
  }
  /**
   * Check if a property ID is a user-defined field
   */
  isUserField(propertyId) {
    return this.userFields.some((f) => f.id === propertyId);
  }
  /**
   * Determine suggester type for a property
   */
  getSuggesterType(propertyId) {
    if (propertyId === "tags") {
      return this.usesNativeTagSuggester() ? "native-tag" : "list";
    }
    if (propertyId === "contexts")
      return "list";
    if (propertyId === "projects")
      return "file";
    if (propertyId === "status")
      return "status";
    if (propertyId === "priority")
      return "priority";
    const userField = this.getUserField(propertyId);
    if (userField) {
      switch (userField.type) {
        case "text":
          return userField.autosuggestFilter ? "file" : "list";
        case "list":
          return "list";
        case "boolean":
          return "boolean";
        default:
          return "none";
      }
    }
    return "none";
  }
  /**
   * Update the configuration (rebuilds internal maps)
   */
  updateConfig(config) {
    this.config = config;
    this.buildMaps();
  }
  /**
   * Update user fields (rebuilds internal maps if needed)
   */
  updateUserFields(userFields) {
    this.userFields = userFields;
  }
};

// node_modules/tasknotes-nlp-core/dist/NaturalLanguageParserCore.js
import { format, isValid } from "date-fns";

// node_modules/chrono-node/dist/esm/index.js
var esm_exports = {};
__export(esm_exports, {
  Chrono: () => Chrono,
  Meridiem: () => Meridiem,
  ParsingComponents: () => ParsingComponents,
  ParsingContext: () => ParsingContext,
  ParsingResult: () => ParsingResult,
  ReferenceWithTimezone: () => ReferenceWithTimezone,
  Weekday: () => Weekday,
  casual: () => casual17,
  de: () => de_exports,
  en: () => en_exports,
  es: () => es_exports,
  fi: () => fi_exports,
  fr: () => fr_exports,
  it: () => it_exports,
  ja: () => ja_exports,
  nl: () => nl_exports,
  parse: () => parse17,
  parseDate: () => parseDate17,
  pt: () => pt_exports,
  ru: () => ru_exports,
  strict: () => strict17,
  sv: () => sv_exports,
  uk: () => uk_exports,
  vi: () => vi_exports,
  zh: () => zh_exports
});

// node_modules/chrono-node/dist/esm/locales/en/index.js
var en_exports = {};
__export(en_exports, {
  Chrono: () => Chrono,
  GB: () => GB,
  Meridiem: () => Meridiem,
  ParsingComponents: () => ParsingComponents,
  ParsingResult: () => ParsingResult,
  ReferenceWithTimezone: () => ReferenceWithTimezone,
  Weekday: () => Weekday,
  casual: () => casual,
  configuration: () => configuration,
  parse: () => parse,
  parseDate: () => parseDate,
  strict: () => strict
});

// node_modules/chrono-node/dist/esm/types.js
var Meridiem;
(function(Meridiem2) {
  Meridiem2[Meridiem2["AM"] = 0] = "AM";
  Meridiem2[Meridiem2["PM"] = 1] = "PM";
})(Meridiem || (Meridiem = {}));
var Weekday;
(function(Weekday2) {
  Weekday2[Weekday2["SUNDAY"] = 0] = "SUNDAY";
  Weekday2[Weekday2["MONDAY"] = 1] = "MONDAY";
  Weekday2[Weekday2["TUESDAY"] = 2] = "TUESDAY";
  Weekday2[Weekday2["WEDNESDAY"] = 3] = "WEDNESDAY";
  Weekday2[Weekday2["THURSDAY"] = 4] = "THURSDAY";
  Weekday2[Weekday2["FRIDAY"] = 5] = "FRIDAY";
  Weekday2[Weekday2["SATURDAY"] = 6] = "SATURDAY";
})(Weekday || (Weekday = {}));
var Month;
(function(Month2) {
  Month2[Month2["JANUARY"] = 1] = "JANUARY";
  Month2[Month2["FEBRUARY"] = 2] = "FEBRUARY";
  Month2[Month2["MARCH"] = 3] = "MARCH";
  Month2[Month2["APRIL"] = 4] = "APRIL";
  Month2[Month2["MAY"] = 5] = "MAY";
  Month2[Month2["JUNE"] = 6] = "JUNE";
  Month2[Month2["JULY"] = 7] = "JULY";
  Month2[Month2["AUGUST"] = 8] = "AUGUST";
  Month2[Month2["SEPTEMBER"] = 9] = "SEPTEMBER";
  Month2[Month2["OCTOBER"] = 10] = "OCTOBER";
  Month2[Month2["NOVEMBER"] = 11] = "NOVEMBER";
  Month2[Month2["DECEMBER"] = 12] = "DECEMBER";
})(Month || (Month = {}));

// node_modules/chrono-node/dist/esm/utils/dates.js
function assignSimilarDate(component, target) {
  component.assign("day", target.getDate());
  component.assign("month", target.getMonth() + 1);
  component.assign("year", target.getFullYear());
}
function assignSimilarTime(component, target) {
  component.assign("hour", target.getHours());
  component.assign("minute", target.getMinutes());
  component.assign("second", target.getSeconds());
  component.assign("millisecond", target.getMilliseconds());
  component.assign("meridiem", target.getHours() < 12 ? Meridiem.AM : Meridiem.PM);
}
function implySimilarDate(component, target) {
  component.imply("day", target.getDate());
  component.imply("month", target.getMonth() + 1);
  component.imply("year", target.getFullYear());
}
function implySimilarTime(component, target) {
  component.imply("hour", target.getHours());
  component.imply("minute", target.getMinutes());
  component.imply("second", target.getSeconds());
  component.imply("millisecond", target.getMilliseconds());
  component.imply("meridiem", target.getHours() < 12 ? Meridiem.AM : Meridiem.PM);
}

// node_modules/chrono-node/dist/esm/timezone.js
var TIMEZONE_ABBR_MAP = {
  ACDT: 630,
  ACST: 570,
  ADT: -180,
  AEDT: 660,
  AEST: 600,
  AFT: 270,
  AKDT: -480,
  AKST: -540,
  ALMT: 360,
  AMST: -180,
  AMT: -240,
  ANAST: 720,
  ANAT: 720,
  AQTT: 300,
  ART: -180,
  AST: -240,
  AWDT: 540,
  AWST: 480,
  AZOST: 0,
  AZOT: -60,
  AZST: 300,
  AZT: 240,
  BNT: 480,
  BOT: -240,
  BRST: -120,
  BRT: -180,
  BST: 60,
  BTT: 360,
  CAST: 480,
  CAT: 120,
  CCT: 390,
  CDT: -300,
  CEST: 120,
  CET: {
    timezoneOffsetDuringDst: 2 * 60,
    timezoneOffsetNonDst: 60,
    dstStart: (year3) => getLastWeekdayOfMonth(year3, Month.MARCH, Weekday.SUNDAY, 2),
    dstEnd: (year3) => getLastWeekdayOfMonth(year3, Month.OCTOBER, Weekday.SUNDAY, 3)
  },
  CHADT: 825,
  CHAST: 765,
  CKT: -600,
  CLST: -180,
  CLT: -240,
  COT: -300,
  CST: -360,
  CT: {
    timezoneOffsetDuringDst: -5 * 60,
    timezoneOffsetNonDst: -6 * 60,
    dstStart: (year3) => getNthWeekdayOfMonth(year3, Month.MARCH, Weekday.SUNDAY, 2, 2),
    dstEnd: (year3) => getNthWeekdayOfMonth(year3, Month.NOVEMBER, Weekday.SUNDAY, 1, 2)
  },
  CVT: -60,
  CXT: 420,
  ChST: 600,
  DAVT: 420,
  EASST: -300,
  EAST: -360,
  EAT: 180,
  ECT: -300,
  EDT: -240,
  EEST: 180,
  EET: 120,
  EGST: 0,
  EGT: -60,
  EST: -300,
  ET: {
    timezoneOffsetDuringDst: -4 * 60,
    timezoneOffsetNonDst: -5 * 60,
    dstStart: (year3) => getNthWeekdayOfMonth(year3, Month.MARCH, Weekday.SUNDAY, 2, 2),
    dstEnd: (year3) => getNthWeekdayOfMonth(year3, Month.NOVEMBER, Weekday.SUNDAY, 1, 2)
  },
  FJST: 780,
  FJT: 720,
  FKST: -180,
  FKT: -240,
  FNT: -120,
  GALT: -360,
  GAMT: -540,
  GET: 240,
  GFT: -180,
  GILT: 720,
  GMT: 0,
  GST: 240,
  GYT: -240,
  HAA: -180,
  HAC: -300,
  HADT: -540,
  HAE: -240,
  HAP: -420,
  HAR: -360,
  HAST: -600,
  HAT: -90,
  HAY: -480,
  HKT: 480,
  HLV: -210,
  HNA: -240,
  HNC: -360,
  HNE: -300,
  HNP: -480,
  HNR: -420,
  HNT: -150,
  HNY: -540,
  HOVT: 420,
  ICT: 420,
  IDT: 180,
  IOT: 360,
  IRDT: 270,
  IRKST: 540,
  IRKT: 540,
  IRST: 210,
  IST: 330,
  JST: 540,
  KGT: 360,
  KRAST: 480,
  KRAT: 480,
  KST: 540,
  KUYT: 240,
  LHDT: 660,
  LHST: 630,
  LINT: 840,
  MAGST: 720,
  MAGT: 720,
  MART: -510,
  MAWT: 300,
  MDT: -360,
  MESZ: 120,
  MEZ: 60,
  MHT: 720,
  MMT: 390,
  MSD: 240,
  MSK: 180,
  MST: -420,
  MT: {
    timezoneOffsetDuringDst: -6 * 60,
    timezoneOffsetNonDst: -7 * 60,
    dstStart: (year3) => getNthWeekdayOfMonth(year3, Month.MARCH, Weekday.SUNDAY, 2, 2),
    dstEnd: (year3) => getNthWeekdayOfMonth(year3, Month.NOVEMBER, Weekday.SUNDAY, 1, 2)
  },
  MUT: 240,
  MVT: 300,
  MYT: 480,
  NCT: 660,
  NDT: -90,
  NFT: 690,
  NOVST: 420,
  NOVT: 360,
  NPT: 345,
  NST: -150,
  NUT: -660,
  NZDT: 780,
  NZST: 720,
  OMSST: 420,
  OMST: 420,
  PDT: -420,
  PET: -300,
  PETST: 720,
  PETT: 720,
  PGT: 600,
  PHOT: 780,
  PHT: 480,
  PKT: 300,
  PMDT: -120,
  PMST: -180,
  PONT: 660,
  PST: -480,
  PT: {
    timezoneOffsetDuringDst: -7 * 60,
    timezoneOffsetNonDst: -8 * 60,
    dstStart: (year3) => getNthWeekdayOfMonth(year3, Month.MARCH, Weekday.SUNDAY, 2, 2),
    dstEnd: (year3) => getNthWeekdayOfMonth(year3, Month.NOVEMBER, Weekday.SUNDAY, 1, 2)
  },
  PWT: 540,
  PYST: -180,
  PYT: -240,
  RET: 240,
  SAMT: 240,
  SAST: 120,
  SBT: 660,
  SCT: 240,
  SGT: 480,
  SRT: -180,
  SST: -660,
  TAHT: -600,
  TFT: 300,
  TJT: 300,
  TKT: 780,
  TLT: 540,
  TMT: 300,
  TVT: 720,
  ULAT: 480,
  UTC: 0,
  UYST: -120,
  UYT: -180,
  UZT: 300,
  VET: -210,
  VLAST: 660,
  VLAT: 660,
  VUT: 660,
  WAST: 120,
  WAT: 60,
  WEST: 60,
  WESZ: 60,
  WET: 0,
  WEZ: 0,
  WFT: 720,
  WGST: -120,
  WGT: -180,
  WIB: 420,
  WIT: 540,
  WITA: 480,
  WST: 780,
  WT: 0,
  YAKST: 600,
  YAKT: 600,
  YAPT: 600,
  YEKST: 360,
  YEKT: 360
};
function getNthWeekdayOfMonth(year3, month, weekday, n, hour = 0) {
  let dayOfMonth = 0;
  let i = 0;
  while (i < n) {
    dayOfMonth++;
    const date = new Date(year3, month - 1, dayOfMonth);
    if (date.getDay() === weekday)
      i++;
  }
  return new Date(year3, month - 1, dayOfMonth, hour);
}
function getLastWeekdayOfMonth(year3, month, weekday, hour = 0) {
  const oneIndexedWeekday = weekday === 0 ? 7 : weekday;
  const date = new Date(year3, month - 1 + 1, 1, 12);
  const firstWeekdayNextMonth = date.getDay() === 0 ? 7 : date.getDay();
  let dayDiff;
  if (firstWeekdayNextMonth === oneIndexedWeekday)
    dayDiff = 7;
  else if (firstWeekdayNextMonth < oneIndexedWeekday)
    dayDiff = 7 + firstWeekdayNextMonth - oneIndexedWeekday;
  else
    dayDiff = firstWeekdayNextMonth - oneIndexedWeekday;
  date.setDate(date.getDate() - dayDiff);
  return new Date(year3, month - 1, date.getDate(), hour);
}
function toTimezoneOffset(timezoneInput, date, timezoneOverrides = {}) {
  if (timezoneInput == null) {
    return null;
  }
  if (typeof timezoneInput === "number") {
    return timezoneInput;
  }
  const matchedTimezone = timezoneOverrides[timezoneInput] ?? TIMEZONE_ABBR_MAP[timezoneInput];
  if (matchedTimezone == null) {
    return null;
  }
  if (typeof matchedTimezone == "number") {
    return matchedTimezone;
  }
  if (date == null) {
    return null;
  }
  if (date > matchedTimezone.dstStart(date.getFullYear()) && !(date > matchedTimezone.dstEnd(date.getFullYear()))) {
    return matchedTimezone.timezoneOffsetDuringDst;
  }
  return matchedTimezone.timezoneOffsetNonDst;
}

// node_modules/chrono-node/dist/esm/calculation/duration.js
var EmptyDuration = {
  day: 0,
  second: 0,
  millisecond: 0
};
function addDuration(ref, duration) {
  let date = new Date(ref);
  if (duration["y"]) {
    duration["year"] = duration["y"];
    delete duration["y"];
  }
  if (duration["mo"]) {
    duration["month"] = duration["mo"];
    delete duration["mo"];
  }
  if (duration["M"]) {
    duration["month"] = duration["M"];
    delete duration["M"];
  }
  if (duration["w"]) {
    duration["week"] = duration["w"];
    delete duration["w"];
  }
  if (duration["d"]) {
    duration["day"] = duration["d"];
    delete duration["d"];
  }
  if (duration["h"]) {
    duration["hour"] = duration["h"];
    delete duration["h"];
  }
  if (duration["m"]) {
    duration["minute"] = duration["m"];
    delete duration["m"];
  }
  if (duration["s"]) {
    duration["second"] = duration["s"];
    delete duration["s"];
  }
  if (duration["ms"]) {
    duration["millisecond"] = duration["ms"];
    delete duration["ms"];
  }
  if ("year" in duration) {
    const floor = Math.floor(duration["year"]);
    date.setFullYear(date.getFullYear() + floor);
    const remainingFraction = duration["year"] - floor;
    if (remainingFraction > 0) {
      duration.month = duration?.month ?? 0;
      duration.month += remainingFraction * 12;
    }
  }
  if ("quarter" in duration) {
    const floor = Math.floor(duration["quarter"]);
    date.setMonth(date.getMonth() + floor * 3);
  }
  if ("month" in duration) {
    const floor = Math.floor(duration["month"]);
    date.setMonth(date.getMonth() + floor);
    const remainingFraction = duration["month"] - floor;
    if (remainingFraction > 0) {
      duration.week = duration?.week ?? 0;
      duration.week += remainingFraction * 4;
    }
  }
  if ("week" in duration) {
    const floor = Math.floor(duration["week"]);
    date.setDate(date.getDate() + floor * 7);
    const remainingFraction = duration["week"] - floor;
    if (remainingFraction > 0) {
      duration.day = duration?.day ?? 0;
      duration.day += Math.round(remainingFraction * 7);
    }
  }
  if ("day" in duration) {
    const floor = Math.floor(duration["day"]);
    date.setDate(date.getDate() + floor);
    const remainingFraction = duration["day"] - floor;
    if (remainingFraction > 0) {
      duration.hour = duration?.hour ?? 0;
      duration.hour += Math.round(remainingFraction * 24);
    }
  }
  if ("hour" in duration) {
    const floor = Math.floor(duration["hour"]);
    date.setHours(date.getHours() + floor);
    const remainingFraction = duration["hour"] - floor;
    if (remainingFraction > 0) {
      duration.minute = duration?.minute ?? 0;
      duration.minute += Math.round(remainingFraction * 60);
    }
  }
  if ("minute" in duration) {
    const floor = Math.floor(duration["minute"]);
    date.setMinutes(date.getMinutes() + floor);
    const remainingFraction = duration["minute"] - floor;
    if (remainingFraction > 0) {
      duration.second = duration?.second ?? 0;
      duration.second += Math.round(remainingFraction * 60);
    }
  }
  if ("second" in duration) {
    const floor = Math.floor(duration["second"]);
    date.setSeconds(date.getSeconds() + floor);
    const remainingFraction = duration["second"] - floor;
    if (remainingFraction > 0) {
      duration.millisecond = duration?.millisecond ?? 0;
      duration.millisecond += Math.round(remainingFraction * 1e3);
    }
  }
  if ("millisecond" in duration) {
    const floor = Math.floor(duration["millisecond"]);
    date.setMilliseconds(date.getMilliseconds() + floor);
  }
  return date;
}
function reverseDuration(duration) {
  const reversed = {};
  for (const key in duration) {
    reversed[key] = -duration[key];
  }
  return reversed;
}

// node_modules/chrono-node/dist/esm/results.js
var ReferenceWithTimezone = class _ReferenceWithTimezone {
  instant;
  timezoneOffset;
  constructor(instant, timezoneOffset) {
    this.instant = instant ?? /* @__PURE__ */ new Date();
    this.timezoneOffset = timezoneOffset ?? null;
  }
  static fromDate(date) {
    return new _ReferenceWithTimezone(date);
  }
  static fromInput(input, timezoneOverrides) {
    if (input instanceof Date) {
      return _ReferenceWithTimezone.fromDate(input);
    }
    const instant = input?.instant ?? /* @__PURE__ */ new Date();
    const timezoneOffset = toTimezoneOffset(input?.timezone, instant, timezoneOverrides);
    return new _ReferenceWithTimezone(instant, timezoneOffset);
  }
  getDateWithAdjustedTimezone() {
    const date = new Date(this.instant);
    if (this.timezoneOffset !== null) {
      date.setMinutes(date.getMinutes() - this.getSystemTimezoneAdjustmentMinute(this.instant));
    }
    return date;
  }
  getSystemTimezoneAdjustmentMinute(date, overrideTimezoneOffset) {
    if (!date) {
      date = /* @__PURE__ */ new Date();
    }
    const currentTimezoneOffset = -date.getTimezoneOffset();
    const targetTimezoneOffset = overrideTimezoneOffset ?? this.timezoneOffset ?? currentTimezoneOffset;
    return currentTimezoneOffset - targetTimezoneOffset;
  }
  getTimezoneOffset() {
    return this.timezoneOffset ?? -this.instant.getTimezoneOffset();
  }
};
var ParsingComponents = class _ParsingComponents {
  knownValues;
  impliedValues;
  reference;
  _tags = /* @__PURE__ */ new Set();
  constructor(reference, knownComponents) {
    this.reference = reference;
    this.knownValues = {};
    this.impliedValues = {};
    if (knownComponents) {
      for (const key in knownComponents) {
        this.knownValues[key] = knownComponents[key];
      }
    }
    const date = reference.getDateWithAdjustedTimezone();
    this.imply("day", date.getDate());
    this.imply("month", date.getMonth() + 1);
    this.imply("year", date.getFullYear());
    this.imply("hour", 12);
    this.imply("minute", 0);
    this.imply("second", 0);
    this.imply("millisecond", 0);
  }
  static createRelativeFromReference(reference, duration = EmptyDuration) {
    let date = addDuration(reference.getDateWithAdjustedTimezone(), duration);
    const components = new _ParsingComponents(reference);
    components.addTag("result/relativeDate");
    if ("hour" in duration || "minute" in duration || "second" in duration || "millisecond" in duration) {
      components.addTag("result/relativeDateAndTime");
      assignSimilarTime(components, date);
      assignSimilarDate(components, date);
      components.assign("timezoneOffset", reference.getTimezoneOffset());
    } else {
      implySimilarTime(components, date);
      components.imply("timezoneOffset", reference.getTimezoneOffset());
      if ("day" in duration) {
        components.assign("day", date.getDate());
        components.assign("month", date.getMonth() + 1);
        components.assign("year", date.getFullYear());
        components.assign("weekday", date.getDay());
      } else if ("week" in duration) {
        components.assign("day", date.getDate());
        components.assign("month", date.getMonth() + 1);
        components.assign("year", date.getFullYear());
        components.imply("weekday", date.getDay());
      } else {
        components.imply("day", date.getDate());
        if ("month" in duration) {
          components.assign("month", date.getMonth() + 1);
          components.assign("year", date.getFullYear());
        } else {
          components.imply("month", date.getMonth() + 1);
          if ("year" in duration) {
            components.assign("year", date.getFullYear());
          } else {
            components.imply("year", date.getFullYear());
          }
        }
      }
    }
    return components;
  }
  get(component) {
    if (component in this.knownValues) {
      return this.knownValues[component];
    }
    if (component in this.impliedValues) {
      return this.impliedValues[component];
    }
    return null;
  }
  isCertain(component) {
    return component in this.knownValues;
  }
  getCertainComponents() {
    return Object.keys(this.knownValues);
  }
  imply(component, value) {
    if (component in this.knownValues) {
      return this;
    }
    this.impliedValues[component] = value;
    return this;
  }
  assign(component, value) {
    this.knownValues[component] = value;
    delete this.impliedValues[component];
    return this;
  }
  addDurationAsImplied(duration) {
    const currentDate = this.dateWithoutTimezoneAdjustment();
    const date = addDuration(currentDate, duration);
    if ("day" in duration || "week" in duration || "month" in duration || "year" in duration) {
      this.delete(["day", "weekday", "month", "year"]);
      this.imply("day", date.getDate());
      this.imply("weekday", date.getDay());
      this.imply("month", date.getMonth() + 1);
      this.imply("year", date.getFullYear());
    }
    if ("second" in duration || "minute" in duration || "hour" in duration) {
      this.delete(["second", "minute", "hour"]);
      this.imply("second", date.getSeconds());
      this.imply("minute", date.getMinutes());
      this.imply("hour", date.getHours());
    }
    return this;
  }
  delete(components) {
    if (typeof components === "string") {
      components = [components];
    }
    for (const component of components) {
      delete this.knownValues[component];
      delete this.impliedValues[component];
    }
  }
  clone() {
    const component = new _ParsingComponents(this.reference);
    component.knownValues = {};
    component.impliedValues = {};
    for (const key in this.knownValues) {
      component.knownValues[key] = this.knownValues[key];
    }
    for (const key in this.impliedValues) {
      component.impliedValues[key] = this.impliedValues[key];
    }
    return component;
  }
  isOnlyDate() {
    return !this.isCertain("hour") && !this.isCertain("minute") && !this.isCertain("second");
  }
  isOnlyTime() {
    return !this.isCertain("weekday") && !this.isCertain("day") && !this.isCertain("month") && !this.isCertain("year");
  }
  isOnlyWeekdayComponent() {
    return this.isCertain("weekday") && !this.isCertain("day") && !this.isCertain("month");
  }
  isDateWithUnknownYear() {
    return this.isCertain("month") && !this.isCertain("year");
  }
  isValidDate() {
    const date = new Date(Date.UTC(this.get("year"), this.get("month") - 1, this.get("day"), this.get("hour"), this.get("minute"), this.get("second"), this.get("millisecond")));
    date.setUTCFullYear(this.get("year"));
    if (date.getUTCFullYear() !== this.get("year"))
      return false;
    if (date.getUTCMonth() !== this.get("month") - 1)
      return false;
    if (date.getUTCDate() !== this.get("day"))
      return false;
    if (this.get("hour") != null && date.getUTCHours() != this.get("hour"))
      return false;
    if (this.get("minute") != null && date.getUTCMinutes() != this.get("minute"))
      return false;
    return true;
  }
  toString() {
    return `[ParsingComponents {
            tags: ${JSON.stringify(Array.from(this._tags).sort())}, 
            knownValues: ${JSON.stringify(this.knownValues)}, 
            impliedValues: ${JSON.stringify(this.impliedValues)}}, 
            reference: ${JSON.stringify(this.reference)}]`;
  }
  date() {
    const timezoneOffset = this.get("timezoneOffset") ?? this.reference.timezoneOffset;
    if (timezoneOffset === null || timezoneOffset === void 0) {
      return this.dateWithoutTimezoneAdjustment();
    }
    const date = new Date(Date.UTC(this.get("year"), this.get("month") - 1, this.get("day"), this.get("hour"), this.get("minute"), this.get("second"), this.get("millisecond")));
    date.setUTCFullYear(this.get("year"));
    return new Date(date.getTime() - timezoneOffset * 6e4);
  }
  addTag(tag) {
    this._tags.add(tag);
    return this;
  }
  addTags(tags) {
    for (const tag of tags) {
      this._tags.add(tag);
    }
    return this;
  }
  tags() {
    return new Set(this._tags);
  }
  dateWithoutTimezoneAdjustment() {
    const date = new Date(this.get("year"), this.get("month") - 1, this.get("day"), this.get("hour"), this.get("minute"), this.get("second"), this.get("millisecond"));
    date.setFullYear(this.get("year"));
    return date;
  }
};
var ParsingResult = class _ParsingResult {
  refDate;
  index;
  text;
  reference;
  start;
  end;
  constructor(reference, index, text, start, end) {
    this.reference = reference;
    this.refDate = reference.instant;
    this.index = index;
    this.text = text;
    this.start = start || new ParsingComponents(reference);
    this.end = end;
  }
  clone() {
    const result = new _ParsingResult(this.reference, this.index, this.text);
    result.start = this.start ? this.start.clone() : null;
    result.end = this.end ? this.end.clone() : null;
    return result;
  }
  date() {
    return this.start.date();
  }
  addTag(tag) {
    this.start.addTag(tag);
    if (this.end) {
      this.end.addTag(tag);
    }
    return this;
  }
  addTags(tags) {
    this.start.addTags(tags);
    if (this.end) {
      this.end.addTags(tags);
    }
    return this;
  }
  tags() {
    const combinedTags = new Set(this.start.tags());
    if (this.end) {
      for (const tag of this.end.tags()) {
        combinedTags.add(tag);
      }
    }
    return combinedTags;
  }
  toString() {
    const tags = Array.from(this.tags()).sort();
    return `[ParsingResult {index: ${this.index}, text: '${this.text}', tags: ${JSON.stringify(tags)} ...}]`;
  }
};

// node_modules/chrono-node/dist/esm/utils/pattern.js
function repeatedTimeunitPattern(prefix, singleTimeunitPattern, connectorPattern = "\\s{0,5},?\\s{0,5}") {
  const singleTimeunitPatternNoCapture = singleTimeunitPattern.replace(/\((?!\?)/g, "(?:");
  return `${prefix}${singleTimeunitPatternNoCapture}(?:${connectorPattern}${singleTimeunitPatternNoCapture}){0,10}`;
}
function extractTerms(dictionary) {
  let keys;
  if (dictionary instanceof Array) {
    keys = [...dictionary];
  } else if (dictionary instanceof Map) {
    keys = Array.from(dictionary.keys());
  } else {
    keys = Object.keys(dictionary);
  }
  return keys;
}
function matchAnyPattern(dictionary) {
  const joinedTerms = extractTerms(dictionary).sort((a, b) => b.length - a.length).join("|").replace(/\./g, "\\.");
  return `(?:${joinedTerms})`;
}

// node_modules/chrono-node/dist/esm/calculation/years.js
function findMostLikelyADYear(yearNumber) {
  if (yearNumber < 100) {
    if (yearNumber > 50) {
      yearNumber = yearNumber + 1900;
    } else {
      yearNumber = yearNumber + 2e3;
    }
  }
  return yearNumber;
}
function findYearClosestToRef(refDate, day, month) {
  let date = new Date(refDate);
  date.setMonth(month - 1);
  date.setDate(day);
  const nextYear = addDuration(date, { "year": 1 });
  const lastYear = addDuration(date, { "year": -1 });
  if (Math.abs(nextYear.getTime() - refDate.getTime()) < Math.abs(date.getTime() - refDate.getTime())) {
    date = nextYear;
  } else if (Math.abs(lastYear.getTime() - refDate.getTime()) < Math.abs(date.getTime() - refDate.getTime())) {
    date = lastYear;
  }
  return date.getFullYear();
}

// node_modules/chrono-node/dist/esm/locales/en/constants.js
var WEEKDAY_DICTIONARY = {
  sunday: 0,
  sun: 0,
  "sun.": 0,
  monday: 1,
  mon: 1,
  "mon.": 1,
  tuesday: 2,
  tue: 2,
  "tue.": 2,
  wednesday: 3,
  wed: 3,
  "wed.": 3,
  thursday: 4,
  thurs: 4,
  "thurs.": 4,
  thur: 4,
  "thur.": 4,
  thu: 4,
  "thu.": 4,
  friday: 5,
  fri: 5,
  "fri.": 5,
  saturday: 6,
  sat: 6,
  "sat.": 6
};
var FULL_MONTH_NAME_DICTIONARY = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12
};
var MONTH_DICTIONARY = {
  ...FULL_MONTH_NAME_DICTIONARY,
  jan: 1,
  "jan.": 1,
  feb: 2,
  "feb.": 2,
  mar: 3,
  "mar.": 3,
  apr: 4,
  "apr.": 4,
  jun: 6,
  "jun.": 6,
  jul: 7,
  "jul.": 7,
  aug: 8,
  "aug.": 8,
  sep: 9,
  "sep.": 9,
  sept: 9,
  "sept.": 9,
  oct: 10,
  "oct.": 10,
  nov: 11,
  "nov.": 11,
  dec: 12,
  "dec.": 12
};
var INTEGER_WORD_DICTIONARY = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12
};
var ORDINAL_WORD_DICTIONARY = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
  "twenty first": 21,
  "twenty-first": 21,
  "twenty second": 22,
  "twenty-second": 22,
  "twenty third": 23,
  "twenty-third": 23,
  "twenty fourth": 24,
  "twenty-fourth": 24,
  "twenty fifth": 25,
  "twenty-fifth": 25,
  "twenty sixth": 26,
  "twenty-sixth": 26,
  "twenty seventh": 27,
  "twenty-seventh": 27,
  "twenty eighth": 28,
  "twenty-eighth": 28,
  "twenty ninth": 29,
  "twenty-ninth": 29,
  "thirtieth": 30,
  "thirty first": 31,
  "thirty-first": 31
};
var TIME_UNIT_DICTIONARY_NO_ABBR = {
  second: "second",
  seconds: "second",
  minute: "minute",
  minutes: "minute",
  hour: "hour",
  hours: "hour",
  day: "day",
  days: "day",
  week: "week",
  weeks: "week",
  month: "month",
  months: "month",
  quarter: "quarter",
  quarters: "quarter",
  year: "year",
  years: "year"
};
var TIME_UNIT_DICTIONARY = {
  s: "second",
  sec: "second",
  second: "second",
  seconds: "second",
  m: "minute",
  min: "minute",
  mins: "minute",
  minute: "minute",
  minutes: "minute",
  h: "hour",
  hr: "hour",
  hrs: "hour",
  hour: "hour",
  hours: "hour",
  d: "day",
  day: "day",
  days: "day",
  w: "week",
  week: "week",
  weeks: "week",
  mo: "month",
  mon: "month",
  mos: "month",
  month: "month",
  months: "month",
  qtr: "quarter",
  quarter: "quarter",
  quarters: "quarter",
  y: "year",
  yr: "year",
  year: "year",
  years: "year",
  ...TIME_UNIT_DICTIONARY_NO_ABBR
};
var NUMBER_PATTERN = `(?:${matchAnyPattern(INTEGER_WORD_DICTIONARY)}|[0-9]+|[0-9]+\\.[0-9]+|half(?:\\s{0,2}an?)?|an?\\b(?:\\s{0,2}few)?|few|several|the|a?\\s{0,2}couple\\s{0,2}(?:of)?)`;
function parseNumberPattern(match) {
  const num = match.toLowerCase();
  if (INTEGER_WORD_DICTIONARY[num] !== void 0) {
    return INTEGER_WORD_DICTIONARY[num];
  } else if (num === "a" || num === "an" || num == "the") {
    return 1;
  } else if (num.match(/few/)) {
    return 3;
  } else if (num.match(/half/)) {
    return 0.5;
  } else if (num.match(/couple/)) {
    return 2;
  } else if (num.match(/several/)) {
    return 7;
  }
  return parseFloat(num);
}
var ORDINAL_NUMBER_PATTERN = `(?:${matchAnyPattern(ORDINAL_WORD_DICTIONARY)}|[0-9]{1,2}(?:st|nd|rd|th)?)`;
function parseOrdinalNumberPattern(match) {
  let num = match.toLowerCase();
  if (ORDINAL_WORD_DICTIONARY[num] !== void 0) {
    return ORDINAL_WORD_DICTIONARY[num];
  }
  num = num.replace(/(?:st|nd|rd|th)$/i, "");
  return parseInt(num);
}
var YEAR_PATTERN = `(?:[1-9][0-9]{0,3}\\s{0,2}(?:BE|AD|BC|BCE|CE)|[1-9][0-9]{3}|[0-9]{2}(?!\\w|:\\d|\\s+(?:am|pm|o\\s*clock|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)))`;
function parseYear(match) {
  if (/BE/i.test(match)) {
    match = match.replace(/BE/i, "");
    return parseInt(match) - 543;
  }
  if (/BCE?/i.test(match)) {
    match = match.replace(/BCE?/i, "");
    return -parseInt(match);
  }
  if (/(AD|CE)/i.test(match)) {
    match = match.replace(/(AD|CE)/i, "");
    return parseInt(match);
  }
  const rawYearNumber = parseInt(match);
  return findMostLikelyADYear(rawYearNumber);
}
var SINGLE_TIME_UNIT_PATTERN = `(${NUMBER_PATTERN})\\s{0,3}(${matchAnyPattern(TIME_UNIT_DICTIONARY)})`;
var SINGLE_TIME_UNIT_REGEX = new RegExp(SINGLE_TIME_UNIT_PATTERN, "i");
var SINGLE_TIME_UNIT_NO_ABBR_PATTERN = `(${NUMBER_PATTERN})\\s{0,3}(${matchAnyPattern(TIME_UNIT_DICTIONARY_NO_ABBR)})`;
var TIME_UNIT_CONNECTOR_PATTERN = `\\s{0,5},?(?:\\s*and)?\\s{0,5}`;
var TIME_UNITS_PATTERN = repeatedTimeunitPattern(`(?:(?:about|around)\\s{0,3})?`, SINGLE_TIME_UNIT_PATTERN, TIME_UNIT_CONNECTOR_PATTERN);
var TIME_UNITS_NO_ABBR_PATTERN = repeatedTimeunitPattern(`(?:(?:about|around)\\s{0,3})?`, SINGLE_TIME_UNIT_NO_ABBR_PATTERN, TIME_UNIT_CONNECTOR_PATTERN);
function parseDuration(timeunitText) {
  const fragments = {};
  let remainingText = timeunitText;
  let match = SINGLE_TIME_UNIT_REGEX.exec(remainingText);
  while (match) {
    collectDateTimeFragment(fragments, match);
    remainingText = remainingText.substring(match[0].length).trim();
    match = SINGLE_TIME_UNIT_REGEX.exec(remainingText);
  }
  if (Object.keys(fragments).length == 0) {
    return null;
  }
  return fragments;
}
function collectDateTimeFragment(fragments, match) {
  if (match[0].match(/^[a-zA-Z]+$/)) {
    return;
  }
  const num = parseNumberPattern(match[1]);
  const unit = TIME_UNIT_DICTIONARY[match[2].toLowerCase()];
  fragments[unit] = num;
}

// node_modules/chrono-node/dist/esm/common/parsers/AbstractParserWithWordBoundary.js
var AbstractParserWithWordBoundaryChecking = class {
  innerPatternHasChange(context, currentInnerPattern) {
    return this.innerPattern(context) !== currentInnerPattern;
  }
  patternLeftBoundary() {
    return `(\\W|^)`;
  }
  cachedInnerPattern = null;
  cachedPattern = null;
  pattern(context) {
    if (this.cachedInnerPattern) {
      if (!this.innerPatternHasChange(context, this.cachedInnerPattern)) {
        return this.cachedPattern;
      }
    }
    this.cachedInnerPattern = this.innerPattern(context);
    this.cachedPattern = new RegExp(`${this.patternLeftBoundary()}${this.cachedInnerPattern.source}`, this.cachedInnerPattern.flags);
    return this.cachedPattern;
  }
  extract(context, match) {
    const header = match[1] ?? "";
    match.index = match.index + header.length;
    match[0] = match[0].substring(header.length);
    for (let i = 2; i < match.length; i++) {
      match[i - 1] = match[i];
    }
    return this.innerExtract(context, match);
  }
};

// node_modules/chrono-node/dist/esm/locales/en/parsers/ENTimeUnitWithinFormatParser.js
var PATTERN_WITH_OPTIONAL_PREFIX = new RegExp(`(?:(?:within|in|for)\\s*)?(?:(?:about|around|roughly|approximately|just)\\s*(?:~\\s*)?)?(${TIME_UNITS_PATTERN})(?=\\W|$)`, "i");
var PATTERN_WITH_PREFIX = new RegExp(`(?:within|in|for)\\s*(?:(?:about|around|roughly|approximately|just)\\s*(?:~\\s*)?)?(${TIME_UNITS_PATTERN})(?=\\W|$)`, "i");
var PATTERN_WITH_PREFIX_STRICT = new RegExp(`(?:within|in|for)\\s*(?:(?:about|around|roughly|approximately|just)\\s*(?:~\\s*)?)?(${TIME_UNITS_NO_ABBR_PATTERN})(?=\\W|$)`, "i");
var ENTimeUnitWithinFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  strictMode;
  constructor(strictMode) {
    super();
    this.strictMode = strictMode;
  }
  innerPattern(context) {
    if (this.strictMode) {
      return PATTERN_WITH_PREFIX_STRICT;
    }
    return context.option.forwardDate ? PATTERN_WITH_OPTIONAL_PREFIX : PATTERN_WITH_PREFIX;
  }
  innerExtract(context, match) {
    if (match[0].match(/^for\s*the\s*\w+/)) {
      return null;
    }
    const timeUnits = parseDuration(match[1]);
    if (!timeUnits) {
      return null;
    }
    return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
  }
};

// node_modules/chrono-node/dist/esm/locales/en/parsers/ENMonthNameLittleEndianParser.js
var PATTERN = new RegExp(`(?:on\\s{0,3})?(${ORDINAL_NUMBER_PATTERN})(?:\\s{0,3}(?:to|\\-|\\\u2013|until|through|till)\\s{0,3}(${ORDINAL_NUMBER_PATTERN}))?(?:-|/|\\s{0,3}(?:of)?\\s{0,3})(${matchAnyPattern(MONTH_DICTIONARY)})(?:(?:-|/|,?\\s{0,3})(${YEAR_PATTERN}(?!\\w)))?(?=\\W|$)`, "i");
var DATE_GROUP = 1;
var DATE_TO_GROUP = 2;
var MONTH_NAME_GROUP = 3;
var YEAR_GROUP = 4;
var ENMonthNameLittleEndianParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN;
  }
  innerExtract(context, match) {
    const result = context.createParsingResult(match.index, match[0]);
    const month = MONTH_DICTIONARY[match[MONTH_NAME_GROUP].toLowerCase()];
    const day = parseOrdinalNumberPattern(match[DATE_GROUP]);
    if (day > 31) {
      match.index = match.index + match[DATE_GROUP].length;
      return null;
    }
    result.start.assign("month", month);
    result.start.assign("day", day);
    if (match[YEAR_GROUP]) {
      const yearNumber = parseYear(match[YEAR_GROUP]);
      result.start.assign("year", yearNumber);
    } else {
      const year3 = findYearClosestToRef(context.refDate, day, month);
      result.start.imply("year", year3);
    }
    if (match[DATE_TO_GROUP]) {
      const endDate = parseOrdinalNumberPattern(match[DATE_TO_GROUP]);
      result.end = result.start.clone();
      result.end.assign("day", endDate);
    }
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/en/parsers/ENMonthNameMiddleEndianParser.js
var PATTERN2 = new RegExp(`(${matchAnyPattern(MONTH_DICTIONARY)})(?:-|/|\\s*,?\\s*)(${ORDINAL_NUMBER_PATTERN})(?!\\s*(?:am|pm))\\s*(?:(?:to|\\-)\\s*(${ORDINAL_NUMBER_PATTERN})\\s*)?(?:(?:-|/|\\s*,\\s*|\\s+)(${YEAR_PATTERN}))?(?=\\W|$)(?!\\:\\d)`, "i");
var MONTH_NAME_GROUP2 = 1;
var DATE_GROUP2 = 2;
var DATE_TO_GROUP2 = 3;
var YEAR_GROUP2 = 4;
var ENMonthNameMiddleEndianParser = class extends AbstractParserWithWordBoundaryChecking {
  shouldSkipYearLikeDate;
  constructor(shouldSkipYearLikeDate) {
    super();
    this.shouldSkipYearLikeDate = shouldSkipYearLikeDate;
  }
  innerPattern() {
    return PATTERN2;
  }
  innerExtract(context, match) {
    const month = MONTH_DICTIONARY[match[MONTH_NAME_GROUP2].toLowerCase()];
    const day = parseOrdinalNumberPattern(match[DATE_GROUP2]);
    if (day > 31) {
      return null;
    }
    if (this.shouldSkipYearLikeDate) {
      if (!match[DATE_TO_GROUP2] && !match[YEAR_GROUP2] && match[DATE_GROUP2].match(/^\d{2}$/)) {
        return null;
      }
    }
    const components = context.createParsingComponents({
      day,
      month
    }).addTag("parser/ENMonthNameMiddleEndianParser");
    if (match[YEAR_GROUP2]) {
      const year3 = parseYear(match[YEAR_GROUP2]);
      components.assign("year", year3);
    } else {
      const year3 = findYearClosestToRef(context.refDate, day, month);
      components.imply("year", year3);
    }
    if (!match[DATE_TO_GROUP2]) {
      return components;
    }
    const endDate = parseOrdinalNumberPattern(match[DATE_TO_GROUP2]);
    const result = context.createParsingResult(match.index, match[0]);
    result.start = components;
    result.end = components.clone();
    result.end.assign("day", endDate);
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/en/parsers/ENMonthNameParser.js
var PATTERN3 = new RegExp(`((?:in)\\s*)?(${matchAnyPattern(MONTH_DICTIONARY)})\\s*(?:(?:,|-|of)?\\s*(${YEAR_PATTERN})?)?(?=[^\\s\\w]|\\s+[^0-9]|\\s+$|$)`, "i");
var PREFIX_GROUP = 1;
var MONTH_NAME_GROUP3 = 2;
var YEAR_GROUP3 = 3;
var ENMonthNameParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN3;
  }
  innerExtract(context, match) {
    const monthName = match[MONTH_NAME_GROUP3].toLowerCase();
    if (match[0].length <= 3 && !FULL_MONTH_NAME_DICTIONARY[monthName]) {
      return null;
    }
    const result = context.createParsingResult(match.index + (match[PREFIX_GROUP] || "").length, match.index + match[0].length);
    result.start.imply("day", 1);
    result.start.addTag("parser/ENMonthNameParser");
    const month = MONTH_DICTIONARY[monthName];
    result.start.assign("month", month);
    if (match[YEAR_GROUP3]) {
      const year3 = parseYear(match[YEAR_GROUP3]);
      result.start.assign("year", year3);
    } else {
      const year3 = findYearClosestToRef(context.refDate, 1, month);
      result.start.imply("year", year3);
    }
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/en/parsers/ENYearMonthDayParser.js
var PATTERN4 = new RegExp(`([0-9]{4})[-\\.\\/\\s](?:(${matchAnyPattern(MONTH_DICTIONARY)})|([0-9]{1,2}))[-\\.\\/\\s]([0-9]{1,2})(?=\\W|$)`, "i");
var YEAR_NUMBER_GROUP = 1;
var MONTH_NAME_GROUP4 = 2;
var MONTH_NUMBER_GROUP = 3;
var DATE_NUMBER_GROUP = 4;
var ENYearMonthDayParser = class extends AbstractParserWithWordBoundaryChecking {
  strictMonthDateOrder;
  constructor(strictMonthDateOrder) {
    super();
    this.strictMonthDateOrder = strictMonthDateOrder;
  }
  innerPattern() {
    return PATTERN4;
  }
  innerExtract(context, match) {
    const year3 = parseInt(match[YEAR_NUMBER_GROUP]);
    let day = parseInt(match[DATE_NUMBER_GROUP]);
    let month = match[MONTH_NUMBER_GROUP] ? parseInt(match[MONTH_NUMBER_GROUP]) : MONTH_DICTIONARY[match[MONTH_NAME_GROUP4].toLowerCase()];
    if (month < 1 || month > 12) {
      if (this.strictMonthDateOrder) {
        return null;
      }
      if (day >= 1 && day <= 12) {
        [month, day] = [day, month];
      }
    }
    if (day < 1 || day > 31) {
      return null;
    }
    return {
      day,
      month,
      year: year3
    };
  }
};

// node_modules/chrono-node/dist/esm/locales/en/parsers/ENYearMonthNameParser.js
var YEAR_PATTERN2 = `(?:[1-9][0-9]{0,3}\\s{0,2}(?:BE|AD|BC|BCE|CE)|[1-9][0-9]{3})`;
var PATTERN5 = new RegExp(`(${YEAR_PATTERN2})(?:\\s*[-.\\/,]?\\s*|\\s+of\\s+)(${matchAnyPattern(MONTH_DICTIONARY)})(?=[^\\s\\w]|\\s+[^0-9]|\\s+$|$)`, "i");
var YEAR_GROUP4 = 1;
var MONTH_NAME_GROUP5 = 2;
var ENYearMonthNameParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN5;
  }
  innerExtract(context, match) {
    const year3 = parseYear(match[YEAR_GROUP4]);
    const monthName = match[MONTH_NAME_GROUP5].toLowerCase();
    const month = MONTH_DICTIONARY[monthName];
    const result = context.createParsingResult(match.index, match[0]);
    result.start.imply("day", 1);
    result.start.assign("month", month);
    result.start.assign("year", year3);
    result.start.addTag("parser/ENYearMonthNameParser");
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/en/parsers/ENSlashMonthFormatParser.js
var PATTERN6 = new RegExp("([0-9]|0[1-9]|1[012])/([0-9]{4})", "i");
var MONTH_GROUP = 1;
var YEAR_GROUP5 = 2;
var ENSlashMonthFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN6;
  }
  innerExtract(context, match) {
    const year3 = parseInt(match[YEAR_GROUP5]);
    const month = parseInt(match[MONTH_GROUP]);
    return context.createParsingComponents().imply("day", 1).assign("month", month).assign("year", year3);
  }
};

// node_modules/chrono-node/dist/esm/common/parsers/AbstractTimeExpressionParser.js
function primaryTimePattern(leftBoundary, primaryPrefix, primarySuffix, flags) {
  return new RegExp(`${leftBoundary}${primaryPrefix}(\\d{1,4})(?:(?:\\.|:|\uFF1A)(\\d{1,2})(?:(?::|\uFF1A)(\\d{2})(?:\\.(\\d{1,6}))?)?)?(?:\\s*(a\\.m\\.|p\\.m\\.|am?|pm?))?${primarySuffix}`, flags);
}
function followingTimePatten(followingPhase, followingSuffix) {
  return new RegExp(`^(${followingPhase})(\\d{1,4})(?:(?:\\.|\\:|\\\uFF1A)(\\d{1,2})(?:(?:\\.|\\:|\\\uFF1A)(\\d{1,2})(?:\\.(\\d{1,6}))?)?)?(?:\\s*(a\\.m\\.|p\\.m\\.|am?|pm?))?${followingSuffix}`, "i");
}
var HOUR_GROUP = 2;
var MINUTE_GROUP = 3;
var SECOND_GROUP = 4;
var MILLI_SECOND_GROUP = 5;
var AM_PM_HOUR_GROUP = 6;
var AbstractTimeExpressionParser = class {
  strictMode;
  constructor(strictMode = false) {
    this.strictMode = strictMode;
  }
  patternFlags() {
    return "i";
  }
  primaryPatternLeftBoundary() {
    return `(^|\\s|T|\\b)`;
  }
  primarySuffix() {
    return `(?!/)(?=\\W|$)`;
  }
  followingSuffix() {
    return `(?!/)(?=\\W|$)`;
  }
  pattern(context) {
    return this.getPrimaryTimePatternThroughCache();
  }
  extract(context, match) {
    const startComponents = this.extractPrimaryTimeComponents(context, match);
    if (!startComponents) {
      if (match[0].match(/^\d{4}/)) {
        match.index += 4;
        return null;
      }
      match.index += match[0].length;
      return null;
    }
    const index = match.index + match[1].length;
    const text = match[0].substring(match[1].length);
    const result = context.createParsingResult(index, text, startComponents);
    match.index += match[0].length;
    const remainingText = context.text.substring(match.index);
    const followingPattern = this.getFollowingTimePatternThroughCache();
    const followingMatch = followingPattern.exec(remainingText);
    if (text.match(/^\d{3,4}/) && followingMatch) {
      if (followingMatch[0].match(/^\s*([+-])\s*\d{2,4}$/)) {
        return null;
      }
      if (followingMatch[0].match(/^\s*([+-])\s*\d{2}\W\d{2}/)) {
        return null;
      }
    }
    if (!followingMatch || followingMatch[0].match(/^\s*([+-])\s*\d{3,4}$/)) {
      return this.checkAndReturnWithoutFollowingPattern(result);
    }
    result.end = this.extractFollowingTimeComponents(context, followingMatch, result);
    if (result.end) {
      result.text += followingMatch[0];
    }
    return this.checkAndReturnWithFollowingPattern(result);
  }
  extractPrimaryTimeComponents(context, match, strict18 = false) {
    const components = context.createParsingComponents();
    let minute = 0;
    let meridiem = null;
    let hour = parseInt(match[HOUR_GROUP]);
    if (hour > 100) {
      if (match[HOUR_GROUP].length == 4 && match[MINUTE_GROUP] == null && !match[AM_PM_HOUR_GROUP]) {
        return null;
      }
      if (this.strictMode || match[MINUTE_GROUP] != null) {
        return null;
      }
      minute = hour % 100;
      hour = Math.floor(hour / 100);
    }
    if (hour > 24) {
      return null;
    }
    if (match[MINUTE_GROUP] != null) {
      if (match[MINUTE_GROUP].length == 1 && !match[AM_PM_HOUR_GROUP]) {
        return null;
      }
      minute = parseInt(match[MINUTE_GROUP]);
    }
    if (minute >= 60) {
      return null;
    }
    if (hour > 12) {
      meridiem = Meridiem.PM;
    }
    if (match[AM_PM_HOUR_GROUP] != null) {
      if (hour > 12)
        return null;
      const ampm = match[AM_PM_HOUR_GROUP][0].toLowerCase();
      if (ampm == "a") {
        meridiem = Meridiem.AM;
        if (hour == 12) {
          hour = 0;
        }
      }
      if (ampm == "p") {
        meridiem = Meridiem.PM;
        if (hour != 12) {
          hour += 12;
        }
      }
    }
    components.assign("hour", hour);
    components.assign("minute", minute);
    if (meridiem !== null) {
      components.assign("meridiem", meridiem);
    } else {
      if (hour < 12) {
        components.imply("meridiem", Meridiem.AM);
      } else {
        components.imply("meridiem", Meridiem.PM);
      }
    }
    if (match[MILLI_SECOND_GROUP] != null) {
      const millisecond = parseInt(match[MILLI_SECOND_GROUP].substring(0, 3));
      if (millisecond >= 1e3)
        return null;
      components.assign("millisecond", millisecond);
    }
    if (match[SECOND_GROUP] != null) {
      const second = parseInt(match[SECOND_GROUP]);
      if (second >= 60)
        return null;
      components.assign("second", second);
    }
    return components;
  }
  extractFollowingTimeComponents(context, match, result) {
    const components = context.createParsingComponents();
    if (match[MILLI_SECOND_GROUP] != null) {
      const millisecond = parseInt(match[MILLI_SECOND_GROUP].substring(0, 3));
      if (millisecond >= 1e3)
        return null;
      components.assign("millisecond", millisecond);
    }
    if (match[SECOND_GROUP] != null) {
      const second = parseInt(match[SECOND_GROUP]);
      if (second >= 60)
        return null;
      components.assign("second", second);
    }
    let hour = parseInt(match[HOUR_GROUP]);
    let minute = 0;
    let meridiem = -1;
    if (match[MINUTE_GROUP] != null) {
      minute = parseInt(match[MINUTE_GROUP]);
    } else if (hour > 100) {
      minute = hour % 100;
      hour = Math.floor(hour / 100);
    }
    if (minute >= 60 || hour > 24) {
      return null;
    }
    if (hour >= 12) {
      meridiem = Meridiem.PM;
    }
    if (match[AM_PM_HOUR_GROUP] != null) {
      if (hour > 12) {
        return null;
      }
      const ampm = match[AM_PM_HOUR_GROUP][0].toLowerCase();
      if (ampm == "a") {
        meridiem = Meridiem.AM;
        if (hour == 12) {
          hour = 0;
          if (!components.isCertain("day")) {
            components.imply("day", components.get("day") + 1);
          }
        }
      }
      if (ampm == "p") {
        meridiem = Meridiem.PM;
        if (hour != 12)
          hour += 12;
      }
      if (!result.start.isCertain("meridiem")) {
        if (meridiem == Meridiem.AM) {
          result.start.imply("meridiem", Meridiem.AM);
          if (result.start.get("hour") == 12) {
            result.start.assign("hour", 0);
          }
        } else {
          result.start.imply("meridiem", Meridiem.PM);
          if (result.start.get("hour") != 12) {
            result.start.assign("hour", result.start.get("hour") + 12);
          }
        }
      }
    }
    components.assign("hour", hour);
    components.assign("minute", minute);
    if (meridiem >= 0) {
      components.assign("meridiem", meridiem);
    } else {
      const startAtPM = result.start.isCertain("meridiem") && result.start.get("hour") > 12;
      if (startAtPM) {
        if (result.start.get("hour") - 12 > hour) {
          components.imply("meridiem", Meridiem.AM);
        } else if (hour <= 12) {
          components.assign("hour", hour + 12);
          components.assign("meridiem", Meridiem.PM);
        }
      } else if (hour > 12) {
        components.imply("meridiem", Meridiem.PM);
      } else if (hour <= 12) {
        components.imply("meridiem", Meridiem.AM);
      }
    }
    if (components.date().getTime() < result.start.date().getTime()) {
      components.imply("day", components.get("day") + 1);
    }
    return components;
  }
  checkAndReturnWithoutFollowingPattern(result) {
    if (result.text.match(/^\d$/)) {
      return null;
    }
    if (result.text.match(/^\d\d\d+$/)) {
      return null;
    }
    if (result.text.match(/\d[apAP]$/)) {
      return null;
    }
    const endingWithNumbers = result.text.match(/[^\d:.](\d[\d.]+)$/);
    if (endingWithNumbers) {
      const endingNumbers = endingWithNumbers[1];
      if (this.strictMode) {
        return null;
      }
      if (endingNumbers.includes(".") && !endingNumbers.match(/\d(\.\d{2})+$/)) {
        return null;
      }
      const endingNumberVal = parseInt(endingNumbers);
      if (endingNumberVal > 24) {
        return null;
      }
    }
    return result;
  }
  checkAndReturnWithFollowingPattern(result) {
    if (result.text.match(/^\d+-\d+$/)) {
      return null;
    }
    const endingWithNumbers = result.text.match(/[^\d:.](\d[\d.]+)\s*-\s*(\d[\d.]+)$/);
    if (endingWithNumbers) {
      if (this.strictMode) {
        return null;
      }
      const startingNumbers = endingWithNumbers[1];
      const endingNumbers = endingWithNumbers[2];
      if (endingNumbers.includes(".") && !endingNumbers.match(/\d(\.\d{2})+$/)) {
        return null;
      }
      const endingNumberVal = parseInt(endingNumbers);
      const startingNumberVal = parseInt(startingNumbers);
      if (endingNumberVal > 24 || startingNumberVal > 24) {
        return null;
      }
    }
    return result;
  }
  cachedPrimaryPrefix = null;
  cachedPrimarySuffix = null;
  cachedPrimaryTimePattern = null;
  getPrimaryTimePatternThroughCache() {
    const primaryPrefix = this.primaryPrefix();
    const primarySuffix = this.primarySuffix();
    if (this.cachedPrimaryPrefix === primaryPrefix && this.cachedPrimarySuffix === primarySuffix) {
      return this.cachedPrimaryTimePattern;
    }
    this.cachedPrimaryTimePattern = primaryTimePattern(this.primaryPatternLeftBoundary(), primaryPrefix, primarySuffix, this.patternFlags());
    this.cachedPrimaryPrefix = primaryPrefix;
    this.cachedPrimarySuffix = primarySuffix;
    return this.cachedPrimaryTimePattern;
  }
  cachedFollowingPhase = null;
  cachedFollowingSuffix = null;
  cachedFollowingTimePatten = null;
  getFollowingTimePatternThroughCache() {
    const followingPhase = this.followingPhase();
    const followingSuffix = this.followingSuffix();
    if (this.cachedFollowingPhase === followingPhase && this.cachedFollowingSuffix === followingSuffix) {
      return this.cachedFollowingTimePatten;
    }
    this.cachedFollowingTimePatten = followingTimePatten(followingPhase, followingSuffix);
    this.cachedFollowingPhase = followingPhase;
    this.cachedFollowingSuffix = followingSuffix;
    return this.cachedFollowingTimePatten;
  }
};

// node_modules/chrono-node/dist/esm/locales/en/parsers/ENTimeExpressionParser.js
var ENTimeExpressionParser = class extends AbstractTimeExpressionParser {
  constructor(strictMode) {
    super(strictMode);
  }
  followingPhase() {
    return "\\s*(?:\\-|\\\u2013|\\~|\\\u301C|to|until|through|till|\\?)\\s*";
  }
  primaryPrefix() {
    return "(?:(?:at|from)\\s*)??";
  }
  primarySuffix() {
    return "(?:\\s*(?:o\\W*clock|at\\s*night|in\\s*the\\s*(?:morning|afternoon)))?(?!/)(?=\\W|$)";
  }
  extractPrimaryTimeComponents(context, match) {
    const components = super.extractPrimaryTimeComponents(context, match);
    if (!components) {
      return components;
    }
    if (match[0].endsWith("night")) {
      const hour = components.get("hour");
      if (hour >= 6 && hour < 12) {
        components.assign("hour", components.get("hour") + 12);
        components.assign("meridiem", Meridiem.PM);
      } else if (hour < 6) {
        components.assign("meridiem", Meridiem.AM);
      }
    }
    if (match[0].endsWith("afternoon")) {
      components.assign("meridiem", Meridiem.PM);
      const hour = components.get("hour");
      if (hour >= 0 && hour <= 6) {
        components.assign("hour", components.get("hour") + 12);
      }
    }
    if (match[0].endsWith("morning")) {
      components.assign("meridiem", Meridiem.AM);
      const hour = components.get("hour");
      if (hour < 12) {
        components.assign("hour", components.get("hour"));
      }
    }
    return components.addTag("parser/ENTimeExpressionParser");
  }
  extractFollowingTimeComponents(context, match, result) {
    const followingComponents = super.extractFollowingTimeComponents(context, match, result);
    if (followingComponents) {
      followingComponents.addTag("parser/ENTimeExpressionParser");
    }
    return followingComponents;
  }
};

// node_modules/chrono-node/dist/esm/locales/en/parsers/ENTimeUnitAgoFormatParser.js
var PATTERN7 = new RegExp(`(${TIME_UNITS_PATTERN})\\s{0,5}(?:ago|before|earlier)(?=\\W|$)`, "i");
var STRICT_PATTERN = new RegExp(`(${TIME_UNITS_NO_ABBR_PATTERN})\\s{0,5}(?:ago|before|earlier)(?=\\W|$)`, "i");
var ENTimeUnitAgoFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  strictMode;
  constructor(strictMode) {
    super();
    this.strictMode = strictMode;
  }
  innerPattern() {
    return this.strictMode ? STRICT_PATTERN : PATTERN7;
  }
  innerExtract(context, match) {
    const duration = parseDuration(match[1]);
    if (!duration) {
      return null;
    }
    return ParsingComponents.createRelativeFromReference(context.reference, reverseDuration(duration));
  }
};

// node_modules/chrono-node/dist/esm/locales/en/parsers/ENTimeUnitLaterFormatParser.js
var PATTERN8 = new RegExp(`(${TIME_UNITS_PATTERN})\\s{0,5}(?:later|after|from now|henceforth|forward|out)(?=(?:\\W|$))`, "i");
var STRICT_PATTERN2 = new RegExp(`(${TIME_UNITS_NO_ABBR_PATTERN})\\s{0,5}(later|after|from now)(?=\\W|$)`, "i");
var GROUP_NUM_TIMEUNITS = 1;
var ENTimeUnitLaterFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  strictMode;
  constructor(strictMode) {
    super();
    this.strictMode = strictMode;
  }
  innerPattern() {
    return this.strictMode ? STRICT_PATTERN2 : PATTERN8;
  }
  innerExtract(context, match) {
    const timeUnits = parseDuration(match[GROUP_NUM_TIMEUNITS]);
    if (!timeUnits) {
      return null;
    }
    return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
  }
};

// node_modules/chrono-node/dist/esm/common/abstractRefiners.js
var Filter = class {
  refine(context, results) {
    return results.filter((r) => this.isValid(context, r));
  }
};
var MergingRefiner = class {
  refine(context, results) {
    if (results.length < 2) {
      return results;
    }
    const mergedResults = [];
    let curResult = results[0];
    let nextResult = null;
    for (let i = 1; i < results.length; i++) {
      nextResult = results[i];
      const textBetween = context.text.substring(curResult.index + curResult.text.length, nextResult.index);
      if (!this.shouldMergeResults(textBetween, curResult, nextResult, context)) {
        mergedResults.push(curResult);
        curResult = nextResult;
      } else {
        const left = curResult;
        const right = nextResult;
        const mergedResult = this.mergeResults(textBetween, left, right, context);
        context.debug(() => {
          console.log(`${this.constructor.name} merged ${left} and ${right} into ${mergedResult}`);
        });
        curResult = mergedResult;
      }
    }
    if (curResult != null) {
      mergedResults.push(curResult);
    }
    return mergedResults;
  }
};

// node_modules/chrono-node/dist/esm/common/refiners/AbstractMergeDateRangeRefiner.js
var AbstractMergeDateRangeRefiner = class extends MergingRefiner {
  shouldMergeResults(textBetween, currentResult, nextResult) {
    return !currentResult.end && !nextResult.end && textBetween.match(this.patternBetween()) != null;
  }
  mergeResults(textBetween, fromResult, toResult) {
    if (!fromResult.start.isOnlyWeekdayComponent() && !toResult.start.isOnlyWeekdayComponent()) {
      toResult.start.getCertainComponents().forEach((key) => {
        if (!fromResult.start.isCertain(key)) {
          fromResult.start.imply(key, toResult.start.get(key));
        }
      });
      fromResult.start.getCertainComponents().forEach((key) => {
        if (!toResult.start.isCertain(key)) {
          toResult.start.imply(key, fromResult.start.get(key));
        }
      });
    }
    if (fromResult.start.date() > toResult.start.date()) {
      let fromDate = fromResult.start.date();
      let toDate = toResult.start.date();
      if (toResult.start.isOnlyWeekdayComponent() && addDuration(toDate, { day: 7 }) > fromDate) {
        toDate = addDuration(toDate, { day: 7 });
        toResult.start.imply("day", toDate.getDate());
        toResult.start.imply("month", toDate.getMonth() + 1);
        toResult.start.imply("year", toDate.getFullYear());
      } else if (fromResult.start.isOnlyWeekdayComponent() && addDuration(fromDate, { day: -7 }) < toDate) {
        fromDate = addDuration(fromDate, { day: -7 });
        fromResult.start.imply("day", fromDate.getDate());
        fromResult.start.imply("month", fromDate.getMonth() + 1);
        fromResult.start.imply("year", fromDate.getFullYear());
      } else if (toResult.start.isDateWithUnknownYear() && addDuration(toDate, { year: 1 }) > fromDate) {
        toDate = addDuration(toDate, { year: 1 });
        toResult.start.imply("year", toDate.getFullYear());
      } else if (fromResult.start.isDateWithUnknownYear() && addDuration(fromDate, { year: -1 }) < toDate) {
        fromDate = addDuration(fromDate, { year: -1 });
        fromResult.start.imply("year", fromDate.getFullYear());
      } else {
        [toResult, fromResult] = [fromResult, toResult];
      }
    }
    const result = fromResult.clone();
    result.start = fromResult.start;
    result.end = toResult.start;
    result.index = Math.min(fromResult.index, toResult.index);
    if (fromResult.index < toResult.index) {
      result.text = fromResult.text + textBetween + toResult.text;
    } else {
      result.text = toResult.text + textBetween + fromResult.text;
    }
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/en/refiners/ENMergeDateRangeRefiner.js
var ENMergeDateRangeRefiner = class extends AbstractMergeDateRangeRefiner {
  patternBetween() {
    return /^\s*(to|-|–|until|through|till)\s*$/i;
  }
};

// node_modules/chrono-node/dist/esm/calculation/mergingCalculation.js
function mergeDateTimeResult(dateResult, timeResult) {
  const result = dateResult.clone();
  const beginDate = dateResult.start;
  const beginTime = timeResult.start;
  result.start = mergeDateTimeComponent(beginDate, beginTime);
  if (dateResult.end != null || timeResult.end != null) {
    const endDate = dateResult.end == null ? dateResult.start : dateResult.end;
    const endTime = timeResult.end == null ? timeResult.start : timeResult.end;
    const endDateTime = mergeDateTimeComponent(endDate, endTime);
    if (dateResult.end == null && endDateTime.date().getTime() < result.start.date().getTime()) {
      const nextDay = new Date(endDateTime.date().getTime());
      nextDay.setDate(nextDay.getDate() + 1);
      if (endDateTime.isCertain("day")) {
        assignSimilarDate(endDateTime, nextDay);
      } else {
        implySimilarDate(endDateTime, nextDay);
      }
    }
    result.end = endDateTime;
  }
  return result;
}
function mergeDateTimeComponent(dateComponent, timeComponent) {
  const dateTimeComponent = dateComponent.clone();
  if (timeComponent.isCertain("hour")) {
    dateTimeComponent.assign("hour", timeComponent.get("hour"));
    dateTimeComponent.assign("minute", timeComponent.get("minute"));
    if (timeComponent.isCertain("second")) {
      dateTimeComponent.assign("second", timeComponent.get("second"));
      if (timeComponent.isCertain("millisecond")) {
        dateTimeComponent.assign("millisecond", timeComponent.get("millisecond"));
      } else {
        dateTimeComponent.imply("millisecond", timeComponent.get("millisecond"));
      }
    } else {
      dateTimeComponent.imply("second", timeComponent.get("second"));
      dateTimeComponent.imply("millisecond", timeComponent.get("millisecond"));
    }
  } else {
    dateTimeComponent.imply("hour", timeComponent.get("hour"));
    dateTimeComponent.imply("minute", timeComponent.get("minute"));
    dateTimeComponent.imply("second", timeComponent.get("second"));
    dateTimeComponent.imply("millisecond", timeComponent.get("millisecond"));
  }
  if (timeComponent.isCertain("timezoneOffset")) {
    dateTimeComponent.assign("timezoneOffset", timeComponent.get("timezoneOffset"));
  }
  const dateHasMeaningfulMeridiem = dateComponent.get("meridiem") != null && (dateComponent.isCertain("meridiem") || Array.from(dateComponent.tags()).some((t) => t.startsWith("casualReference/")));
  if (timeComponent.isCertain("meridiem")) {
    dateTimeComponent.assign("meridiem", timeComponent.get("meridiem"));
  } else if (timeComponent.get("meridiem") != null && !dateHasMeaningfulMeridiem) {
    dateTimeComponent.imply("meridiem", timeComponent.get("meridiem"));
  }
  if (dateTimeComponent.get("meridiem") == Meridiem.PM && dateTimeComponent.get("hour") < 12) {
    if (timeComponent.isCertain("hour")) {
      dateTimeComponent.assign("hour", dateTimeComponent.get("hour") + 12);
    } else {
      dateTimeComponent.imply("hour", dateTimeComponent.get("hour") + 12);
    }
  }
  dateTimeComponent.addTags(dateComponent.tags());
  dateTimeComponent.addTags(timeComponent.tags());
  return dateTimeComponent;
}

// node_modules/chrono-node/dist/esm/common/refiners/AbstractMergeDateTimeRefiner.js
var AbstractMergeDateTimeRefiner = class extends MergingRefiner {
  shouldMergeResults(textBetween, currentResult, nextResult) {
    return (currentResult.start.isOnlyDate() && nextResult.start.isOnlyTime() || nextResult.start.isOnlyDate() && currentResult.start.isOnlyTime()) && textBetween.match(this.patternBetween()) != null;
  }
  mergeResults(textBetween, currentResult, nextResult) {
    const result = currentResult.start.isOnlyDate() ? mergeDateTimeResult(currentResult, nextResult) : mergeDateTimeResult(nextResult, currentResult);
    result.index = currentResult.index;
    result.text = currentResult.text + textBetween + nextResult.text;
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/en/refiners/ENMergeDateTimeRefiner.js
var ENMergeDateTimeRefiner = class extends AbstractMergeDateTimeRefiner {
  patternBetween() {
    return new RegExp("^\\s*(T|at|after|before|on|of|,|-|\\.|\u2219|:)?\\s*$");
  }
};

// node_modules/chrono-node/dist/esm/common/refiners/ExtractTimezoneAbbrRefiner.js
var TIMEZONE_NAME_PATTERN = new RegExp("^\\s*,?\\s*\\(?([A-Z]{2,4})\\)?(?=\\W|$)", "i");
var ExtractTimezoneAbbrRefiner = class {
  timezoneOverrides;
  constructor(timezoneOverrides) {
    this.timezoneOverrides = timezoneOverrides;
  }
  refine(context, results) {
    const timezoneOverrides = context.option.timezones ?? {};
    results.forEach((result) => {
      const suffix = context.text.substring(result.index + result.text.length);
      const match = TIMEZONE_NAME_PATTERN.exec(suffix);
      if (!match) {
        return;
      }
      const timezoneAbbr = match[1].toUpperCase();
      const refDate = result.start.date() ?? result.refDate ?? /* @__PURE__ */ new Date();
      const tzOverrides = { ...this.timezoneOverrides, ...timezoneOverrides };
      const extractedTimezoneOffset = toTimezoneOffset(timezoneAbbr, refDate, tzOverrides);
      if (extractedTimezoneOffset == null) {
        return;
      }
      context.debug(() => {
        console.log(`Extracting timezone: '${timezoneAbbr}' into: ${extractedTimezoneOffset} for: ${result.start}`);
      });
      const currentTimezoneOffset = result.start.get("timezoneOffset");
      if (currentTimezoneOffset !== null && extractedTimezoneOffset != currentTimezoneOffset) {
        if (result.start.isCertain("timezoneOffset")) {
          return;
        }
        if (timezoneAbbr != match[1]) {
          return;
        }
      }
      if (result.start.isOnlyDate()) {
        if (timezoneAbbr != match[1]) {
          return;
        }
      }
      result.text += match[0];
      if (!result.start.isCertain("timezoneOffset")) {
        result.start.assign("timezoneOffset", extractedTimezoneOffset);
      }
      if (result.end != null && !result.end.isCertain("timezoneOffset")) {
        result.end.assign("timezoneOffset", extractedTimezoneOffset);
      }
    });
    return results;
  }
};

// node_modules/chrono-node/dist/esm/common/refiners/ExtractTimezoneOffsetRefiner.js
var TIMEZONE_OFFSET_PATTERN = new RegExp("^\\s*(?:\\(?(?:GMT|UTC)\\s?)?([+-])(\\d{1,2})(?::?(\\d{2}))?\\)?", "i");
var TIMEZONE_OFFSET_SIGN_GROUP = 1;
var TIMEZONE_OFFSET_HOUR_OFFSET_GROUP = 2;
var TIMEZONE_OFFSET_MINUTE_OFFSET_GROUP = 3;
var ExtractTimezoneOffsetRefiner = class {
  refine(context, results) {
    results.forEach(function(result) {
      if (result.start.isCertain("timezoneOffset")) {
        return;
      }
      const suffix = context.text.substring(result.index + result.text.length);
      const match = TIMEZONE_OFFSET_PATTERN.exec(suffix);
      if (!match) {
        return;
      }
      context.debug(() => {
        console.log(`Extracting timezone: '${match[0]}' into : ${result}`);
      });
      const hourOffset = parseInt(match[TIMEZONE_OFFSET_HOUR_OFFSET_GROUP]);
      const minuteOffset = parseInt(match[TIMEZONE_OFFSET_MINUTE_OFFSET_GROUP] || "0");
      let timezoneOffset = hourOffset * 60 + minuteOffset;
      if (timezoneOffset > 14 * 60) {
        return;
      }
      if (match[TIMEZONE_OFFSET_SIGN_GROUP] === "-") {
        timezoneOffset = -timezoneOffset;
      }
      if (result.end != null) {
        result.end.assign("timezoneOffset", timezoneOffset);
      }
      result.start.assign("timezoneOffset", timezoneOffset);
      result.text += match[0];
    });
    return results;
  }
};

// node_modules/chrono-node/dist/esm/common/refiners/OverlapRemovalRefiner.js
var OverlapRemovalRefiner = class {
  refine(context, results) {
    if (results.length < 2) {
      return results;
    }
    const filteredResults = [];
    let prevResult = results[0];
    for (let i = 1; i < results.length; i++) {
      const result = results[i];
      if (result.index >= prevResult.index + prevResult.text.length) {
        filteredResults.push(prevResult);
        prevResult = result;
        continue;
      }
      let kept = null;
      let removed = null;
      if (result.text.length > prevResult.text.length) {
        kept = result;
        removed = prevResult;
      } else {
        kept = prevResult;
        removed = result;
      }
      context.debug(() => {
        console.log(`${this.constructor.name} remove ${removed} by ${kept}`);
      });
      prevResult = kept;
    }
    if (prevResult != null) {
      filteredResults.push(prevResult);
    }
    return filteredResults;
  }
};

// node_modules/chrono-node/dist/esm/calculation/weekdays.js
function createParsingComponentsAtWeekday(reference, weekday, modifier) {
  const refDate = reference.getDateWithAdjustedTimezone();
  const daysToWeekday = getDaysToWeekday(refDate, weekday, modifier);
  let components = new ParsingComponents(reference);
  components = components.addDurationAsImplied({ day: daysToWeekday });
  components.assign("weekday", weekday);
  return components;
}
function getDaysToWeekday(refDate, weekday, modifier) {
  const refWeekday = refDate.getDay();
  switch (modifier) {
    case "this":
      return getDaysForwardToWeekday(refDate, weekday);
    case "last":
      return getBackwardDaysToWeekday(refDate, weekday);
    case "next":
      if (refWeekday == Weekday.SUNDAY) {
        return weekday == Weekday.SUNDAY ? 7 : weekday;
      }
      if (refWeekday == Weekday.SATURDAY) {
        if (weekday == Weekday.SATURDAY)
          return 7;
        if (weekday == Weekday.SUNDAY)
          return 8;
        return 1 + weekday;
      }
      if (weekday < refWeekday && weekday != Weekday.SUNDAY) {
        return getDaysForwardToWeekday(refDate, weekday);
      } else {
        return getDaysForwardToWeekday(refDate, weekday) + 7;
      }
  }
  return getDaysToWeekdayClosest(refDate, weekday);
}
function getDaysToWeekdayClosest(refDate, weekday) {
  const backward = getBackwardDaysToWeekday(refDate, weekday);
  const forward = getDaysForwardToWeekday(refDate, weekday);
  return forward < -backward ? forward : backward;
}
function getDaysForwardToWeekday(refDate, weekday) {
  const refWeekday = refDate.getDay();
  let forwardCount = weekday - refWeekday;
  if (forwardCount < 0) {
    forwardCount += 7;
  }
  return forwardCount;
}
function getBackwardDaysToWeekday(refDate, weekday) {
  const refWeekday = refDate.getDay();
  let backwardCount = weekday - refWeekday;
  if (backwardCount >= 0) {
    backwardCount -= 7;
  }
  return backwardCount;
}

// node_modules/chrono-node/dist/esm/common/refiners/ForwardDateRefiner.js
var ForwardDateRefiner = class {
  refine(context, results) {
    if (!context.option.forwardDate) {
      return results;
    }
    results.forEach((result) => {
      let refDate = context.reference.getDateWithAdjustedTimezone();
      if (result.start.isOnlyTime() && context.reference.instant > result.start.date()) {
        const refDate2 = context.reference.getDateWithAdjustedTimezone();
        const refFollowingDay = new Date(refDate2);
        refFollowingDay.setDate(refFollowingDay.getDate() + 1);
        implySimilarDate(result.start, refFollowingDay);
        context.debug(() => {
          console.log(`${this.constructor.name} adjusted ${result} time from the ref date (${refDate2}) to the following day (${refFollowingDay})`);
        });
        if (result.end && result.end.isOnlyTime()) {
          implySimilarDate(result.end, refFollowingDay);
          if (result.start.date() > result.end.date()) {
            refFollowingDay.setDate(refFollowingDay.getDate() + 1);
            implySimilarDate(result.end, refFollowingDay);
          }
        }
      }
      if (result.start.isOnlyWeekdayComponent() && refDate > result.start.date()) {
        let daysToAdd = getDaysForwardToWeekday(refDate, result.start.get("weekday")) || 7;
        const forwardedWeekday = addDuration(refDate, { day: daysToAdd });
        implySimilarDate(result.start, forwardedWeekday);
        context.debug(() => {
          console.log(`${this.constructor.name} adjusted ${result} weekday (${result.start})`);
        });
        if (result.end && result.start.date() > result.end.date()) {
          let daysToAdd2 = getDaysForwardToWeekday(refDate, result.start.get("weekday")) || 7;
          const forwardedWeekday2 = addDuration(refDate, { day: daysToAdd2 });
          implySimilarDate(result.end, forwardedWeekday2);
          context.debug(() => {
            console.log(`${this.constructor.name} adjusted ${result} weekday (${result.end})`);
          });
        }
      }
      if (result.start.isDateWithUnknownYear() && refDate > result.start.date()) {
        for (let i = 0; i < 3 && refDate > result.start.date(); i++) {
          result.start.imply("year", result.start.get("year") + 1);
          context.debug(() => {
            console.log(`${this.constructor.name} adjusted ${result} year (${result.start})`);
          });
          if (result.end && !result.end.isCertain("year")) {
            result.end.imply("year", result.end.get("year") + 1);
            context.debug(() => {
              console.log(`${this.constructor.name} adjusted ${result} month (${result.start})`);
            });
          }
        }
      }
    });
    return results;
  }
};

// node_modules/chrono-node/dist/esm/common/refiners/UnlikelyFormatFilter.js
var UnlikelyFormatFilter = class extends Filter {
  strictMode;
  constructor(strictMode) {
    super();
    this.strictMode = strictMode;
  }
  isValid(context, result) {
    if (result.text.replace(" ", "").match(/^\d*(\.\d*)?$/)) {
      context.debug(() => {
        console.log(`Removing unlikely result '${result.text}'`);
      });
      return false;
    }
    if (!result.start.isValidDate()) {
      context.debug(() => {
        console.log(`Removing invalid result: ${result} (${result.start})`);
      });
      return false;
    }
    if (result.end && !result.end.isValidDate()) {
      context.debug(() => {
        console.log(`Removing invalid result: ${result} (${result.end})`);
      });
      return false;
    }
    if (this.strictMode) {
      return this.isStrictModeValid(context, result);
    }
    return true;
  }
  isStrictModeValid(context, result) {
    if (result.start.isOnlyWeekdayComponent()) {
      context.debug(() => {
        console.log(`(Strict) Removing weekday only component: ${result} (${result.end})`);
      });
      return false;
    }
    return true;
  }
};

// node_modules/chrono-node/dist/esm/common/parsers/ISOFormatParser.js
var PATTERN9 = new RegExp("([0-9]{4})\\-([0-9]{1,2})\\-([0-9]{1,2})(?:T([0-9]{1,2}):([0-9]{1,2})(?::([0-9]{1,2})(?:\\.(\\d{1,4}))?)?(Z|([+-]\\d{2}):?(\\d{2})?)?)?(?=\\W|$)", "i");
var YEAR_NUMBER_GROUP2 = 1;
var MONTH_NUMBER_GROUP2 = 2;
var DATE_NUMBER_GROUP2 = 3;
var HOUR_NUMBER_GROUP = 4;
var MINUTE_NUMBER_GROUP = 5;
var SECOND_NUMBER_GROUP = 6;
var MILLISECOND_NUMBER_GROUP = 7;
var TZD_GROUP = 8;
var TZD_HOUR_OFFSET_GROUP = 9;
var TZD_MINUTE_OFFSET_GROUP = 10;
var ISOFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN9;
  }
  innerExtract(context, match) {
    const components = context.createParsingComponents({
      "year": parseInt(match[YEAR_NUMBER_GROUP2]),
      "month": parseInt(match[MONTH_NUMBER_GROUP2]),
      "day": parseInt(match[DATE_NUMBER_GROUP2])
    });
    if (match[HOUR_NUMBER_GROUP] != null) {
      components.assign("hour", parseInt(match[HOUR_NUMBER_GROUP]));
      components.assign("minute", parseInt(match[MINUTE_NUMBER_GROUP]));
      if (match[SECOND_NUMBER_GROUP] != null) {
        components.assign("second", parseInt(match[SECOND_NUMBER_GROUP]));
      }
      if (match[MILLISECOND_NUMBER_GROUP] != null) {
        components.assign("millisecond", parseInt(match[MILLISECOND_NUMBER_GROUP]));
      }
      if (match[TZD_GROUP] != null) {
        let offset = 0;
        if (match[TZD_HOUR_OFFSET_GROUP]) {
          const hourOffset = parseInt(match[TZD_HOUR_OFFSET_GROUP]);
          let minuteOffset = 0;
          if (match[TZD_MINUTE_OFFSET_GROUP] != null) {
            minuteOffset = parseInt(match[TZD_MINUTE_OFFSET_GROUP]);
          }
          offset = hourOffset * 60;
          if (offset < 0) {
            offset -= minuteOffset;
          } else {
            offset += minuteOffset;
          }
        }
        components.assign("timezoneOffset", offset);
      }
    }
    return components.addTag("parser/ISOFormatParser");
  }
};

// node_modules/chrono-node/dist/esm/common/refiners/MergeWeekdayComponentRefiner.js
var MergeWeekdayComponentRefiner = class extends MergingRefiner {
  mergeResults(textBetween, currentResult, nextResult) {
    const newResult = nextResult.clone();
    newResult.index = currentResult.index;
    newResult.text = currentResult.text + textBetween + newResult.text;
    newResult.start.assign("weekday", currentResult.start.get("weekday"));
    if (newResult.end) {
      newResult.end.assign("weekday", currentResult.start.get("weekday"));
    }
    return newResult;
  }
  shouldMergeResults(textBetween, currentResult, nextResult) {
    const weekdayThenNormalDate = currentResult.start.isOnlyWeekdayComponent() && !currentResult.start.isCertain("hour") && nextResult.start.isCertain("day");
    return weekdayThenNormalDate && textBetween.match(/^,?\s*$/) != null;
  }
};

// node_modules/chrono-node/dist/esm/configurations.js
function includeCommonConfiguration(configuration3, strictMode = false) {
  configuration3.parsers.unshift(new ISOFormatParser());
  configuration3.refiners.unshift(new MergeWeekdayComponentRefiner());
  configuration3.refiners.unshift(new ExtractTimezoneOffsetRefiner());
  configuration3.refiners.unshift(new OverlapRemovalRefiner());
  configuration3.refiners.push(new ExtractTimezoneAbbrRefiner());
  configuration3.refiners.push(new OverlapRemovalRefiner());
  configuration3.refiners.push(new ForwardDateRefiner());
  configuration3.refiners.push(new UnlikelyFormatFilter(strictMode));
  return configuration3;
}

// node_modules/chrono-node/dist/esm/common/casualReferences.js
function now(reference) {
  const targetDate = reference.getDateWithAdjustedTimezone();
  const component = new ParsingComponents(reference, {});
  assignSimilarDate(component, targetDate);
  assignSimilarTime(component, targetDate);
  component.assign("timezoneOffset", reference.getTimezoneOffset());
  component.addTag("casualReference/now");
  return component;
}
function today(reference) {
  const targetDate = reference.getDateWithAdjustedTimezone();
  const component = new ParsingComponents(reference, {});
  assignSimilarDate(component, targetDate);
  implySimilarTime(component, targetDate);
  component.delete("meridiem");
  component.addTag("casualReference/today");
  return component;
}
function yesterday(reference) {
  return theDayBefore(reference, 1).addTag("casualReference/yesterday");
}
function tomorrow(reference) {
  return theDayAfter(reference, 1).addTag("casualReference/tomorrow");
}
function theDayBefore(reference, numDay) {
  return theDayAfter(reference, -numDay);
}
function theDayAfter(reference, nDays) {
  const targetDate = reference.getDateWithAdjustedTimezone();
  const component = new ParsingComponents(reference, {});
  const newDate = new Date(targetDate.getTime());
  newDate.setDate(newDate.getDate() + nDays);
  assignSimilarDate(component, newDate);
  implySimilarTime(component, newDate);
  component.delete("meridiem");
  return component;
}
function tonight(reference, implyHour = 22) {
  const targetDate = reference.getDateWithAdjustedTimezone();
  const component = new ParsingComponents(reference, {});
  assignSimilarDate(component, targetDate);
  component.imply("hour", implyHour);
  component.imply("meridiem", Meridiem.PM);
  component.addTag("casualReference/tonight");
  return component;
}
function lastNight(reference, implyHour = 0) {
  let targetDate = reference.getDateWithAdjustedTimezone();
  const component = new ParsingComponents(reference, {});
  if (targetDate.getHours() < 6) {
    targetDate = new Date(targetDate.getTime() - 24 * 60 * 60 * 1e3);
  }
  assignSimilarDate(component, targetDate);
  component.imply("hour", implyHour);
  return component;
}
function evening(reference, implyHour = 20) {
  const component = new ParsingComponents(reference, {});
  component.imply("meridiem", Meridiem.PM);
  component.imply("hour", implyHour);
  component.addTag("casualReference/evening");
  return component;
}
function yesterdayEvening(reference, implyHour = 20) {
  let targetDate = reference.getDateWithAdjustedTimezone();
  const component = new ParsingComponents(reference, {});
  targetDate = new Date(targetDate.getTime() - 24 * 60 * 60 * 1e3);
  assignSimilarDate(component, targetDate);
  component.imply("hour", implyHour);
  component.imply("meridiem", Meridiem.PM);
  component.addTag("casualReference/yesterday");
  component.addTag("casualReference/evening");
  return component;
}
function midnight(reference) {
  const component = new ParsingComponents(reference, {});
  if (reference.getDateWithAdjustedTimezone().getHours() > 2) {
    component.addDurationAsImplied({ day: 1 });
  }
  component.assign("hour", 0);
  component.imply("minute", 0);
  component.imply("second", 0);
  component.imply("millisecond", 0);
  component.addTag("casualReference/midnight");
  return component;
}
function morning(reference, implyHour = 6) {
  const component = new ParsingComponents(reference, {});
  component.imply("meridiem", Meridiem.AM);
  component.imply("hour", implyHour);
  component.imply("minute", 0);
  component.imply("second", 0);
  component.imply("millisecond", 0);
  component.addTag("casualReference/morning");
  return component;
}
function afternoon(reference, implyHour = 15) {
  const component = new ParsingComponents(reference, {});
  component.imply("meridiem", Meridiem.PM);
  component.imply("hour", implyHour);
  component.imply("minute", 0);
  component.imply("second", 0);
  component.imply("millisecond", 0);
  component.addTag("casualReference/afternoon");
  return component;
}
function noon(reference) {
  const component = new ParsingComponents(reference, {});
  component.imply("meridiem", Meridiem.AM);
  component.assign("hour", 12);
  component.imply("minute", 0);
  component.imply("second", 0);
  component.imply("millisecond", 0);
  component.addTag("casualReference/noon");
  return component;
}

// node_modules/chrono-node/dist/esm/locales/en/parsers/ENCasualDateParser.js
var PATTERN10 = /(now|today|tonight|tomorrow|overmorrow|tmr|tmrw|yesterday|last\s*night)(?=\W|$)/i;
var ENCasualDateParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern(context) {
    return PATTERN10;
  }
  innerExtract(context, match) {
    let targetDate = context.refDate;
    const lowerText = match[0].toLowerCase();
    let component = context.createParsingComponents();
    switch (lowerText) {
      case "now":
        component = now(context.reference);
        break;
      case "today":
        component = today(context.reference);
        break;
      case "yesterday":
        component = yesterday(context.reference);
        break;
      case "tomorrow":
      case "tmr":
      case "tmrw":
        component = tomorrow(context.reference);
        break;
      case "tonight":
        component = tonight(context.reference);
        break;
      case "overmorrow":
        component = theDayAfter(context.reference, 2);
        break;
      default:
        if (lowerText.match(/last\s*night/)) {
          if (targetDate.getHours() > 6) {
            const previousDay = new Date(targetDate.getTime());
            previousDay.setDate(previousDay.getDate() - 1);
            targetDate = previousDay;
          }
          assignSimilarDate(component, targetDate);
          component.imply("hour", 0);
        }
        break;
    }
    component.addTag("parser/ENCasualDateParser");
    return component;
  }
};

// node_modules/chrono-node/dist/esm/locales/en/parsers/ENCasualTimeParser.js
var PATTERN11 = /(?:this)?\s{0,3}(morning|afternoon|evening|night|midnight|midday|noon)(?=\W|$)/i;
var ENCasualTimeParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN11;
  }
  innerExtract(context, match) {
    let component = null;
    switch (match[1].toLowerCase()) {
      case "afternoon":
        component = afternoon(context.reference);
        break;
      case "evening":
      case "night":
        component = evening(context.reference);
        break;
      case "midnight":
        component = midnight(context.reference);
        break;
      case "morning":
        component = morning(context.reference);
        break;
      case "noon":
      case "midday":
        component = noon(context.reference);
        break;
    }
    if (component) {
      component.addTag("parser/ENCasualTimeParser");
    }
    return component;
  }
};

// node_modules/chrono-node/dist/esm/locales/en/parsers/ENWeekdayParser.js
var PATTERN12 = new RegExp(`(?:(?:\\,|\\(|\\\uFF08)\\s*)?(?:on\\s*?)?(?:(this|last|past|next)\\s*)?(${matchAnyPattern(WEEKDAY_DICTIONARY)}|weekend|weekday)(?:\\s*(?:\\,|\\)|\\\uFF09))?(?:\\s*(?:of\\s*)?(this|last|past|next)\\s*week)?(?=\\W|$)`, "i");
var PREFIX_GROUP2 = 1;
var WEEKDAY_GROUP = 2;
var POSTFIX_GROUP = 3;
var ENWeekdayParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN12;
  }
  innerExtract(context, match) {
    const prefix = match[PREFIX_GROUP2];
    const postfix = match[POSTFIX_GROUP];
    let modifierWord = prefix || postfix;
    modifierWord = modifierWord || "";
    modifierWord = modifierWord.toLowerCase();
    let modifier = null;
    if (modifierWord == "last" || modifierWord == "past") {
      modifier = "last";
    } else if (modifierWord == "next") {
      modifier = "next";
    } else if (modifierWord == "this") {
      modifier = "this";
    }
    const weekday_word = match[WEEKDAY_GROUP].toLowerCase();
    let weekday;
    if (WEEKDAY_DICTIONARY[weekday_word] !== void 0) {
      weekday = WEEKDAY_DICTIONARY[weekday_word];
    } else if (weekday_word == "weekend") {
      weekday = modifier == "last" ? Weekday.SUNDAY : Weekday.SATURDAY;
    } else if (weekday_word == "weekday") {
      const refWeekday = context.reference.getDateWithAdjustedTimezone().getDay();
      if (refWeekday == Weekday.SUNDAY || refWeekday == Weekday.SATURDAY) {
        weekday = modifier == "last" ? Weekday.FRIDAY : Weekday.MONDAY;
      } else {
        weekday = refWeekday - 1;
        weekday = modifier == "last" ? weekday - 1 : weekday + 1;
        weekday = weekday % 5 + 1;
      }
    } else {
      return null;
    }
    return createParsingComponentsAtWeekday(context.reference, weekday, modifier);
  }
};

// node_modules/chrono-node/dist/esm/locales/en/parsers/ENRelativeDateFormatParser.js
var PATTERN13 = new RegExp(`(this|last|past|next|after\\s*this)\\s*(${matchAnyPattern(TIME_UNIT_DICTIONARY)})(?=\\s*)(?=\\W|$)`, "i");
var MODIFIER_WORD_GROUP = 1;
var RELATIVE_WORD_GROUP = 2;
var ENRelativeDateFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN13;
  }
  innerExtract(context, match) {
    const modifier = match[MODIFIER_WORD_GROUP].toLowerCase();
    const unitWord = match[RELATIVE_WORD_GROUP].toLowerCase();
    const timeunit = TIME_UNIT_DICTIONARY[unitWord];
    if (modifier == "next" || modifier.startsWith("after")) {
      const timeUnits = {};
      timeUnits[timeunit] = 1;
      return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
    }
    if (modifier == "last" || modifier == "past") {
      const timeUnits = {};
      timeUnits[timeunit] = -1;
      return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
    }
    const components = context.createParsingComponents();
    let date = new Date(context.reference.instant.getTime());
    if (unitWord.match(/week/i)) {
      date.setDate(date.getDate() - date.getDay());
      components.imply("day", date.getDate());
      components.imply("month", date.getMonth() + 1);
      components.imply("year", date.getFullYear());
    } else if (unitWord.match(/month/i)) {
      date.setDate(1);
      components.imply("day", date.getDate());
      components.assign("year", date.getFullYear());
      components.assign("month", date.getMonth() + 1);
    } else if (unitWord.match(/year/i)) {
      date.setDate(1);
      date.setMonth(0);
      components.imply("day", date.getDate());
      components.imply("month", date.getMonth() + 1);
      components.assign("year", date.getFullYear());
    }
    return components;
  }
};

// node_modules/chrono-node/dist/esm/common/parsers/SlashDateFormatParser.js
var PATTERN14 = new RegExp("([^\\d]|^)([0-3]{0,1}[0-9]{1})[\\/\\.\\-]([0-3]{0,1}[0-9]{1})(?:[\\/\\.\\-]([0-9]{4}|[0-9]{2}))?(\\W|$)", "i");
var OPENING_GROUP = 1;
var ENDING_GROUP = 5;
var FIRST_NUMBERS_GROUP = 2;
var SECOND_NUMBERS_GROUP = 3;
var YEAR_GROUP6 = 4;
var SlashDateFormatParser = class {
  groupNumberMonth;
  groupNumberDay;
  constructor(littleEndian) {
    this.groupNumberMonth = littleEndian ? SECOND_NUMBERS_GROUP : FIRST_NUMBERS_GROUP;
    this.groupNumberDay = littleEndian ? FIRST_NUMBERS_GROUP : SECOND_NUMBERS_GROUP;
  }
  pattern() {
    return PATTERN14;
  }
  extract(context, match) {
    const index = match.index + match[OPENING_GROUP].length;
    const indexEnd = match.index + match[0].length - match[ENDING_GROUP].length;
    if (index > 0) {
      const textBefore = context.text.substring(0, index);
      if (textBefore.match("\\d/?$")) {
        return;
      }
    }
    if (indexEnd < context.text.length) {
      const textAfter = context.text.substring(indexEnd);
      if (textAfter.match("^/?\\d")) {
        return;
      }
    }
    const text = context.text.substring(index, indexEnd);
    if (text.match(/^\d\.\d$/) || text.match(/^\d\.\d{1,2}\.\d{1,2}\s*$/)) {
      return;
    }
    if (!match[YEAR_GROUP6] && text.indexOf("/") < 0) {
      return;
    }
    const result = context.createParsingResult(index, text);
    let month = parseInt(match[this.groupNumberMonth]);
    let day = parseInt(match[this.groupNumberDay]);
    if (month < 1 || month > 12) {
      if (month > 12) {
        if (day >= 1 && day <= 12 && month <= 31) {
          [day, month] = [month, day];
        } else {
          return null;
        }
      }
    }
    if (day < 1 || day > 31) {
      return null;
    }
    result.start.assign("day", day);
    result.start.assign("month", month);
    if (match[YEAR_GROUP6]) {
      const rawYearNumber = parseInt(match[YEAR_GROUP6]);
      const year3 = findMostLikelyADYear(rawYearNumber);
      result.start.assign("year", year3);
    } else {
      const year3 = findYearClosestToRef(context.refDate, day, month);
      result.start.imply("year", year3);
    }
    return result.addTag("parser/SlashDateFormatParser");
  }
};

// node_modules/chrono-node/dist/esm/locales/en/parsers/ENTimeUnitCasualRelativeFormatParser.js
var PATTERN15 = new RegExp(`(this|last|past|next|after|\\+|-)\\s*(${TIME_UNITS_PATTERN})(?=\\W|$)`, "i");
var PATTERN_NO_ABBR = new RegExp(`(this|last|past|next|after|\\+|-)\\s*(${TIME_UNITS_NO_ABBR_PATTERN})(?=\\W|$)`, "i");
var ENTimeUnitCasualRelativeFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  allowAbbreviations;
  constructor(allowAbbreviations = true) {
    super();
    this.allowAbbreviations = allowAbbreviations;
  }
  innerPattern() {
    return this.allowAbbreviations ? PATTERN15 : PATTERN_NO_ABBR;
  }
  innerExtract(context, match) {
    const prefix = match[1].toLowerCase();
    let duration = parseDuration(match[2]);
    if (!duration) {
      return null;
    }
    switch (prefix) {
      case "last":
      case "past":
      case "-":
        duration = reverseDuration(duration);
        break;
    }
    return ParsingComponents.createRelativeFromReference(context.reference, duration);
  }
};

// node_modules/chrono-node/dist/esm/locales/en/refiners/ENMergeRelativeAfterDateRefiner.js
function IsPositiveFollowingReference(result) {
  return result.text.match(/^[+-]/i) != null;
}
function IsNegativeFollowingReference(result) {
  return result.text.match(/^-/i) != null;
}
var ENMergeRelativeAfterDateRefiner = class extends MergingRefiner {
  shouldMergeResults(textBetween, currentResult, nextResult) {
    if (!textBetween.match(/^\s*$/i)) {
      return false;
    }
    return IsPositiveFollowingReference(nextResult) || IsNegativeFollowingReference(nextResult);
  }
  mergeResults(textBetween, currentResult, nextResult, context) {
    let timeUnits = parseDuration(nextResult.text);
    if (IsNegativeFollowingReference(nextResult)) {
      timeUnits = reverseDuration(timeUnits);
    }
    const components = ParsingComponents.createRelativeFromReference(ReferenceWithTimezone.fromDate(currentResult.start.date()), timeUnits);
    return new ParsingResult(currentResult.reference, currentResult.index, `${currentResult.text}${textBetween}${nextResult.text}`, components);
  }
};

// node_modules/chrono-node/dist/esm/locales/en/refiners/ENMergeRelativeFollowByDateRefiner.js
function hasImpliedEarlierReferenceDate(result) {
  return result.text.match(/\s+(before|from)$/i) != null;
}
function hasImpliedLaterReferenceDate(result) {
  return result.text.match(/\s+(after|since)$/i) != null;
}
var ENMergeRelativeFollowByDateRefiner = class extends MergingRefiner {
  patternBetween() {
    return /^\s*$/i;
  }
  shouldMergeResults(textBetween, currentResult, nextResult) {
    if (!textBetween.match(this.patternBetween())) {
      return false;
    }
    if (!hasImpliedEarlierReferenceDate(currentResult) && !hasImpliedLaterReferenceDate(currentResult)) {
      return false;
    }
    return !!nextResult.start.get("day") && !!nextResult.start.get("month") && !!nextResult.start.get("year");
  }
  mergeResults(textBetween, currentResult, nextResult) {
    let duration = parseDuration(currentResult.text);
    if (hasImpliedEarlierReferenceDate(currentResult)) {
      duration = reverseDuration(duration);
    }
    const components = ParsingComponents.createRelativeFromReference(ReferenceWithTimezone.fromDate(nextResult.start.date()), duration);
    return new ParsingResult(nextResult.reference, currentResult.index, `${currentResult.text}${textBetween}${nextResult.text}`, components);
  }
};

// node_modules/chrono-node/dist/esm/locales/en/refiners/ENExtractYearSuffixRefiner.js
var YEAR_SUFFIX_PATTERN = new RegExp(`^\\s*(${YEAR_PATTERN})`, "i");
var YEAR_GROUP7 = 1;
var ENExtractYearSuffixRefiner = class {
  refine(context, results) {
    results.forEach(function(result) {
      if (!result.start.isDateWithUnknownYear()) {
        return;
      }
      const suffix = context.text.substring(result.index + result.text.length);
      const match = YEAR_SUFFIX_PATTERN.exec(suffix);
      if (!match) {
        return;
      }
      if (match[0].trim().length <= 3) {
        return;
      }
      context.debug(() => {
        console.log(`Extracting year: '${match[0]}' into : ${result}`);
      });
      const year3 = parseYear(match[YEAR_GROUP7]);
      if (result.end != null) {
        result.end.assign("year", year3);
      }
      result.start.assign("year", year3);
      result.text += match[0];
    });
    return results;
  }
};

// node_modules/chrono-node/dist/esm/locales/en/refiners/ENUnlikelyFormatFilter.js
var ENUnlikelyFormatFilter = class extends Filter {
  constructor() {
    super();
  }
  isValid(context, result) {
    const text = result.text.trim();
    if (text === context.text.trim()) {
      return true;
    }
    if (text.toLowerCase() === "may") {
      const textBefore = context.text.substring(0, result.index).trim();
      if (!textBefore.match(/\b(in)$/i)) {
        context.debug(() => {
          console.log(`Removing unlikely result: ${result}`);
        });
        return false;
      }
    }
    if (text.toLowerCase().endsWith("the second")) {
      const textAfter = context.text.substring(result.index + result.text.length).trim();
      if (textAfter.length > 0) {
        context.debug(() => {
          console.log(`Removing unlikely result: ${result}`);
        });
      }
      return false;
    }
    return true;
  }
};

// node_modules/chrono-node/dist/esm/locales/en/configuration.js
var ENDefaultConfiguration = class {
  createCasualConfiguration(littleEndian = false) {
    const option = this.createConfiguration(false, littleEndian);
    option.parsers.push(new ENCasualDateParser());
    option.parsers.push(new ENCasualTimeParser());
    option.parsers.push(new ENMonthNameParser());
    option.parsers.push(new ENRelativeDateFormatParser());
    option.parsers.push(new ENTimeUnitCasualRelativeFormatParser());
    option.refiners.push(new ENUnlikelyFormatFilter());
    return option;
  }
  createConfiguration(strictMode = true, littleEndian = false) {
    const options = includeCommonConfiguration({
      parsers: [
        new SlashDateFormatParser(littleEndian),
        new ENTimeUnitWithinFormatParser(strictMode),
        new ENMonthNameLittleEndianParser(),
        new ENMonthNameMiddleEndianParser(littleEndian),
        new ENWeekdayParser(),
        new ENSlashMonthFormatParser(),
        new ENTimeExpressionParser(strictMode),
        new ENTimeUnitAgoFormatParser(strictMode),
        new ENTimeUnitLaterFormatParser(strictMode),
        new ENYearMonthNameParser()
      ],
      refiners: [new ENMergeDateTimeRefiner()]
    }, strictMode);
    options.parsers.unshift(new ENYearMonthDayParser(strictMode));
    options.refiners.unshift(new ENMergeRelativeFollowByDateRefiner());
    options.refiners.unshift(new ENMergeRelativeAfterDateRefiner());
    options.refiners.unshift(new OverlapRemovalRefiner());
    options.refiners.push(new ENMergeDateTimeRefiner());
    options.refiners.push(new ENExtractYearSuffixRefiner());
    options.refiners.push(new ENMergeDateRangeRefiner());
    return options;
  }
};

// node_modules/chrono-node/dist/esm/chrono.js
var Chrono = class _Chrono {
  parsers;
  refiners;
  defaultConfig = new ENDefaultConfiguration();
  constructor(configuration3) {
    configuration3 = configuration3 || this.defaultConfig.createCasualConfiguration();
    this.parsers = [...configuration3.parsers];
    this.refiners = [...configuration3.refiners];
  }
  clone() {
    return new _Chrono({
      parsers: [...this.parsers],
      refiners: [...this.refiners]
    });
  }
  parseDate(text, referenceDate, option) {
    const results = this.parse(text, referenceDate, option);
    return results.length > 0 ? results[0].start.date() : null;
  }
  parse(text, referenceDate, option) {
    const context = new ParsingContext(text, referenceDate, option);
    let results = [];
    this.parsers.forEach((parser) => {
      const parsedResults = _Chrono.executeParser(context, parser);
      results = results.concat(parsedResults);
    });
    results.sort((a, b) => {
      return a.index - b.index;
    });
    this.refiners.forEach(function(refiner) {
      results = refiner.refine(context, results);
    });
    return results;
  }
  static executeParser(context, parser) {
    const results = [];
    const pattern = parser.pattern(context);
    const originalText = context.text;
    let remainingText = context.text;
    let match = pattern.exec(remainingText);
    while (match) {
      const index = match.index + originalText.length - remainingText.length;
      match.index = index;
      const result = parser.extract(context, match);
      if (!result) {
        remainingText = originalText.substring(match.index + 1);
        match = pattern.exec(remainingText);
        continue;
      }
      let parsedResult = null;
      if (result instanceof ParsingResult) {
        parsedResult = result;
      } else if (result instanceof ParsingComponents) {
        parsedResult = context.createParsingResult(match.index, match[0]);
        parsedResult.start = result;
      } else {
        parsedResult = context.createParsingResult(match.index, match[0], result);
      }
      const parsedIndex = parsedResult.index;
      const parsedText = parsedResult.text;
      context.debug(() => console.log(`${parser.constructor.name} extracted (at index=${parsedIndex}) '${parsedText}'`));
      results.push(parsedResult);
      remainingText = originalText.substring(parsedIndex + parsedText.length);
      match = pattern.exec(remainingText);
    }
    return results;
  }
};
var ParsingContext = class {
  text;
  option;
  reference;
  refDate;
  constructor(text, refDate, option) {
    this.text = text;
    this.option = option ?? {};
    this.reference = ReferenceWithTimezone.fromInput(refDate, this.option.timezones);
    this.refDate = this.reference.instant;
  }
  createParsingComponents(components) {
    if (components instanceof ParsingComponents) {
      return components;
    }
    return new ParsingComponents(this.reference, components);
  }
  createParsingResult(index, textOrEndIndex, startComponents, endComponents) {
    const text = typeof textOrEndIndex === "string" ? textOrEndIndex : this.text.substring(index, textOrEndIndex);
    const start = startComponents ? this.createParsingComponents(startComponents) : null;
    const end = endComponents ? this.createParsingComponents(endComponents) : null;
    return new ParsingResult(this.reference, index, text, start, end);
  }
  debug(block) {
    if (this.option.debug) {
      if (this.option.debug instanceof Function) {
        this.option.debug(block);
      } else {
        const handler = this.option.debug;
        handler.debug(block);
      }
    }
  }
};

// node_modules/chrono-node/dist/esm/locales/en/index.js
var configuration = new ENDefaultConfiguration();
var casual = new Chrono(configuration.createCasualConfiguration(false));
var strict = new Chrono(configuration.createConfiguration(true, false));
var GB = new Chrono(configuration.createCasualConfiguration(true));
function parse(text, ref, option) {
  return casual.parse(text, ref, option);
}
function parseDate(text, ref, option) {
  return casual.parseDate(text, ref, option);
}

// node_modules/chrono-node/dist/esm/locales/de/index.js
var de_exports = {};
__export(de_exports, {
  Chrono: () => Chrono,
  Meridiem: () => Meridiem,
  ParsingComponents: () => ParsingComponents,
  ParsingResult: () => ParsingResult,
  ReferenceWithTimezone: () => ReferenceWithTimezone,
  Weekday: () => Weekday,
  casual: () => casual2,
  createCasualConfiguration: () => createCasualConfiguration,
  createConfiguration: () => createConfiguration,
  parse: () => parse2,
  parseDate: () => parseDate2,
  strict: () => strict2
});

// node_modules/chrono-node/dist/esm/locales/de/parsers/DETimeExpressionParser.js
var DETimeExpressionParser = class extends AbstractTimeExpressionParser {
  primaryPrefix() {
    return "(?:(?:um|von)\\s*)?";
  }
  followingPhase() {
    return "\\s*(?:\\-|\\\u2013|\\~|\\\u301C|bis)\\s*";
  }
  extractPrimaryTimeComponents(context, match) {
    if (match[0].match(/^\s*\d{4}\s*$/)) {
      return null;
    }
    return super.extractPrimaryTimeComponents(context, match);
  }
};

// node_modules/chrono-node/dist/esm/locales/de/constants.js
var WEEKDAY_DICTIONARY2 = {
  "sonntag": 0,
  "so": 0,
  "montag": 1,
  "mo": 1,
  "dienstag": 2,
  "di": 2,
  "mittwoch": 3,
  "mi": 3,
  "donnerstag": 4,
  "do": 4,
  "freitag": 5,
  "fr": 5,
  "samstag": 6,
  "sa": 6
};
var MONTH_DICTIONARY2 = {
  "januar": 1,
  "j\xE4nner": 1,
  "janner": 1,
  "jan": 1,
  "jan.": 1,
  "februar": 2,
  "feber": 2,
  "feb": 2,
  "feb.": 2,
  "m\xE4rz": 3,
  "maerz": 3,
  "m\xE4r": 3,
  "m\xE4r.": 3,
  "mrz": 3,
  "mrz.": 3,
  "april": 4,
  "apr": 4,
  "apr.": 4,
  "mai": 5,
  "juni": 6,
  "jun": 6,
  "jun.": 6,
  "juli": 7,
  "jul": 7,
  "jul.": 7,
  "august": 8,
  "aug": 8,
  "aug.": 8,
  "september": 9,
  "sep": 9,
  "sep.": 9,
  "sept": 9,
  "sept.": 9,
  "oktober": 10,
  "okt": 10,
  "okt.": 10,
  "november": 11,
  "nov": 11,
  "nov.": 11,
  "dezember": 12,
  "dez": 12,
  "dez.": 12
};
var INTEGER_WORD_DICTIONARY2 = {
  "eins": 1,
  "eine": 1,
  "einem": 1,
  "einen": 1,
  "einer": 1,
  "zwei": 2,
  "drei": 3,
  "vier": 4,
  "f\xFCnf": 5,
  "fuenf": 5,
  "sechs": 6,
  "sieben": 7,
  "acht": 8,
  "neun": 9,
  "zehn": 10,
  "elf": 11,
  "zw\xF6lf": 12,
  "zwoelf": 12
};
var TIME_UNIT_DICTIONARY2 = {
  sek: "second",
  sekunde: "second",
  sekunden: "second",
  min: "minute",
  minute: "minute",
  minuten: "minute",
  h: "hour",
  std: "hour",
  stunde: "hour",
  stunden: "hour",
  tag: "day",
  tage: "day",
  tagen: "day",
  woche: "week",
  wochen: "week",
  monat: "month",
  monate: "month",
  monaten: "month",
  monats: "month",
  quartal: "quarter",
  quartals: "quarter",
  quartale: "quarter",
  quartalen: "quarter",
  a: "year",
  j: "year",
  jr: "year",
  jahr: "year",
  jahre: "year",
  jahren: "year",
  jahres: "year"
};
var NUMBER_PATTERN2 = `(?:${matchAnyPattern(INTEGER_WORD_DICTIONARY2)}|[0-9]+|[0-9]+\\.[0-9]+|halb?|halbe?|einigen?|wenigen?|mehreren?)`;
function parseNumberPattern2(match) {
  const num = match.toLowerCase();
  if (INTEGER_WORD_DICTIONARY2[num] !== void 0) {
    return INTEGER_WORD_DICTIONARY2[num];
  } else if (num === "ein" || num === "einer" || num === "einem" || num === "einen" || num === "eine") {
    return 1;
  } else if (num.match(/wenigen/)) {
    return 2;
  } else if (num.match(/halb/) || num.match(/halben/)) {
    return 0.5;
  } else if (num.match(/einigen/)) {
    return 3;
  } else if (num.match(/mehreren/)) {
    return 7;
  }
  return parseFloat(num);
}
var YEAR_PATTERN3 = `(?:[0-9]{1,4}(?:\\s*[vn]\\.?\\s*(?:C(?:hr)?|(?:u\\.?|d\\.?(?:\\s*g\\.?)?)?\\s*Z)\\.?|\\s*(?:u\\.?|d\\.?(?:\\s*g\\.)?)\\s*Z\\.?)?)`;
function parseYear2(match) {
  if (/v/i.test(match)) {
    return -parseInt(match.replace(/[^0-9]+/gi, ""));
  }
  if (/n/i.test(match)) {
    return parseInt(match.replace(/[^0-9]+/gi, ""));
  }
  if (/z/i.test(match)) {
    return parseInt(match.replace(/[^0-9]+/gi, ""));
  }
  const rawYearNumber = parseInt(match);
  return findMostLikelyADYear(rawYearNumber);
}
var SINGLE_TIME_UNIT_PATTERN2 = `(${NUMBER_PATTERN2})\\s{0,5}(${matchAnyPattern(TIME_UNIT_DICTIONARY2)})\\s{0,5}`;
var SINGLE_TIME_UNIT_REGEX2 = new RegExp(SINGLE_TIME_UNIT_PATTERN2, "i");
var TIME_UNITS_PATTERN2 = repeatedTimeunitPattern("", SINGLE_TIME_UNIT_PATTERN2);
function parseDuration2(timeunitText) {
  const fragments = {};
  let remainingText = timeunitText;
  let match = SINGLE_TIME_UNIT_REGEX2.exec(remainingText);
  while (match) {
    collectDateTimeFragment2(fragments, match);
    remainingText = remainingText.substring(match[0].length);
    match = SINGLE_TIME_UNIT_REGEX2.exec(remainingText);
  }
  return fragments;
}
function collectDateTimeFragment2(fragments, match) {
  const num = parseNumberPattern2(match[1]);
  const unit = TIME_UNIT_DICTIONARY2[match[2].toLowerCase()];
  fragments[unit] = num;
}

// node_modules/chrono-node/dist/esm/locales/de/parsers/DEWeekdayParser.js
var PATTERN16 = new RegExp(`(?:(?:\\,|\\(|\\\uFF08)\\s*)?(?:a[mn]\\s*?)?(?:(diese[mn]|letzte[mn]|n(?:\xE4|ae)chste[mn])\\s*)?(${matchAnyPattern(WEEKDAY_DICTIONARY2)})(?:\\s*(?:\\,|\\)|\\\uFF09))?(?:\\s*(diese|letzte|n(?:\xE4|ae)chste)\\s*woche)?(?=\\W|$)`, "i");
var PREFIX_GROUP3 = 1;
var SUFFIX_GROUP = 3;
var WEEKDAY_GROUP2 = 2;
var DEWeekdayParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN16;
  }
  innerExtract(context, match) {
    const dayOfWeek = match[WEEKDAY_GROUP2].toLowerCase();
    const offset = WEEKDAY_DICTIONARY2[dayOfWeek];
    const prefix = match[PREFIX_GROUP3];
    const postfix = match[SUFFIX_GROUP];
    let modifierWord = prefix || postfix;
    modifierWord = modifierWord || "";
    modifierWord = modifierWord.toLowerCase();
    let modifier = null;
    if (modifierWord.match(/letzte/)) {
      modifier = "last";
    } else if (modifierWord.match(/chste/)) {
      modifier = "next";
    } else if (modifierWord.match(/diese/)) {
      modifier = "this";
    }
    return createParsingComponentsAtWeekday(context.reference, offset, modifier);
  }
};

// node_modules/chrono-node/dist/esm/locales/de/parsers/DESpecificTimeExpressionParser.js
var FIRST_REG_PATTERN = new RegExp("(^|\\s|T)(?:(?:um|von)\\s*)?(\\d{1,2})(?:h|:)?(?:(\\d{1,2})(?:m|:)?)?(?:(\\d{1,2})(?:s)?)?(?:\\s*Uhr)?(?:\\s*(morgens|vormittags|nachmittags|abends|nachts|am\\s+(?:Morgen|Vormittag|Nachmittag|Abend)|in\\s+der\\s+Nacht))?(?=\\W|$)", "i");
var SECOND_REG_PATTERN = new RegExp("^\\s*(\\-|\\\u2013|\\~|\\\u301C|bis(?:\\s+um)?|\\?)\\s*(\\d{1,2})(?:h|:)?(?:(\\d{1,2})(?:m|:)?)?(?:(\\d{1,2})(?:s)?)?(?:\\s*Uhr)?(?:\\s*(morgens|vormittags|nachmittags|abends|nachts|am\\s+(?:Morgen|Vormittag|Nachmittag|Abend)|in\\s+der\\s+Nacht))?(?=\\W|$)", "i");
var HOUR_GROUP2 = 2;
var MINUTE_GROUP2 = 3;
var SECOND_GROUP2 = 4;
var AM_PM_HOUR_GROUP2 = 5;
var DESpecificTimeExpressionParser = class _DESpecificTimeExpressionParser {
  pattern(context) {
    return FIRST_REG_PATTERN;
  }
  extract(context, match) {
    const result = context.createParsingResult(match.index + match[1].length, match[0].substring(match[1].length));
    if (result.text.match(/^\d{4}$/)) {
      match.index += match[0].length;
      return null;
    }
    result.start = _DESpecificTimeExpressionParser.extractTimeComponent(result.start.clone(), match);
    if (!result.start) {
      match.index += match[0].length;
      return null;
    }
    const remainingText = context.text.substring(match.index + match[0].length);
    const secondMatch = SECOND_REG_PATTERN.exec(remainingText);
    if (secondMatch) {
      result.end = _DESpecificTimeExpressionParser.extractTimeComponent(result.start.clone(), secondMatch);
      if (result.end) {
        result.text += secondMatch[0];
      }
    }
    return result;
  }
  static extractTimeComponent(extractingComponents, match) {
    let hour = 0;
    let minute = 0;
    let meridiem = null;
    hour = parseInt(match[HOUR_GROUP2]);
    if (match[MINUTE_GROUP2] != null) {
      minute = parseInt(match[MINUTE_GROUP2]);
    }
    if (minute >= 60 || hour > 24) {
      return null;
    }
    if (hour >= 12) {
      meridiem = Meridiem.PM;
    }
    if (match[AM_PM_HOUR_GROUP2] != null) {
      if (hour > 12)
        return null;
      const ampm = match[AM_PM_HOUR_GROUP2].toLowerCase();
      if (ampm.match(/morgen|vormittag/)) {
        meridiem = Meridiem.AM;
        if (hour == 12) {
          hour = 0;
        }
      }
      if (ampm.match(/nachmittag|abend/)) {
        meridiem = Meridiem.PM;
        if (hour != 12) {
          hour += 12;
        }
      }
      if (ampm.match(/nacht/)) {
        if (hour == 12) {
          meridiem = Meridiem.AM;
          hour = 0;
        } else if (hour < 6) {
          meridiem = Meridiem.AM;
        } else {
          meridiem = Meridiem.PM;
          hour += 12;
        }
      }
    }
    extractingComponents.assign("hour", hour);
    extractingComponents.assign("minute", minute);
    if (meridiem !== null) {
      extractingComponents.assign("meridiem", meridiem);
    } else {
      if (hour < 12) {
        extractingComponents.imply("meridiem", Meridiem.AM);
      } else {
        extractingComponents.imply("meridiem", Meridiem.PM);
      }
    }
    if (match[SECOND_GROUP2] != null) {
      const second = parseInt(match[SECOND_GROUP2]);
      if (second >= 60)
        return null;
      extractingComponents.assign("second", second);
    }
    return extractingComponents;
  }
};

// node_modules/chrono-node/dist/esm/locales/de/refiners/DEMergeDateRangeRefiner.js
var DEMergeDateRangeRefiner = class extends AbstractMergeDateRangeRefiner {
  patternBetween() {
    return /^\s*(bis(?:\s*(?:am|zum))?|-)\s*$/i;
  }
};

// node_modules/chrono-node/dist/esm/locales/de/refiners/DEMergeDateTimeRefiner.js
var DEMergeDateTimeRefiner = class extends AbstractMergeDateTimeRefiner {
  patternBetween() {
    return new RegExp("^\\s*(T|um|am|,|-)?\\s*$");
  }
};

// node_modules/chrono-node/dist/esm/locales/de/parsers/DECasualTimeParser.js
var DECasualTimeParser = class _DECasualTimeParser extends AbstractParserWithWordBoundaryChecking {
  innerPattern(context) {
    return /(diesen)?\s*(morgen|vormittag|mittags?|nachmittag|abend|nacht|mitternacht)(?=\W|$)/i;
  }
  innerExtract(context, match) {
    const targetDate = context.refDate;
    const timeKeywordPattern = match[2].toLowerCase();
    const component = context.createParsingComponents();
    implySimilarTime(component, targetDate);
    return _DECasualTimeParser.extractTimeComponents(component, timeKeywordPattern);
  }
  static extractTimeComponents(component, timeKeywordPattern) {
    switch (timeKeywordPattern) {
      case "morgen":
        component.imply("hour", 6);
        component.imply("minute", 0);
        component.imply("second", 0);
        component.imply("meridiem", Meridiem.AM);
        component.addTag("casualReference/morning");
        break;
      case "vormittag":
        component.imply("hour", 9);
        component.imply("minute", 0);
        component.imply("second", 0);
        component.imply("meridiem", Meridiem.AM);
        component.addTag("casualReference/morning");
        break;
      case "mittag":
      case "mittags":
        component.imply("hour", 12);
        component.imply("minute", 0);
        component.imply("second", 0);
        component.imply("meridiem", Meridiem.AM);
        component.addTag("casualReference/noon");
        break;
      case "nachmittag":
        component.imply("hour", 15);
        component.imply("minute", 0);
        component.imply("second", 0);
        component.imply("meridiem", Meridiem.PM);
        component.addTag("casualReference/afternoon");
        break;
      case "abend":
        component.imply("hour", 18);
        component.imply("minute", 0);
        component.imply("second", 0);
        component.imply("meridiem", Meridiem.PM);
        component.addTag("casualReference/evening");
        break;
      case "nacht":
        component.imply("hour", 22);
        component.imply("minute", 0);
        component.imply("second", 0);
        component.imply("meridiem", Meridiem.PM);
        component.addTag("casualReference/evening");
        break;
      case "mitternacht":
        if (component.get("hour") > 1) {
          component.addDurationAsImplied({ "day": 1 });
        }
        component.imply("hour", 0);
        component.imply("minute", 0);
        component.imply("second", 0);
        component.imply("meridiem", Meridiem.AM);
        component.addTag("casualReference/midnight");
        break;
    }
    return component;
  }
};

// node_modules/chrono-node/dist/esm/locales/de/parsers/DECasualDateParser.js
var PATTERN17 = new RegExp(`(jetzt|heute|morgen|\xFCbermorgen|uebermorgen|gestern|vorgestern|letzte\\s*nacht)(?:\\s*(morgen|vormittag|mittags?|nachmittag|abend|nacht|mitternacht))?(?=\\W|$)`, "i");
var DATE_GROUP3 = 1;
var TIME_GROUP = 2;
var DECasualDateParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern(context) {
    return PATTERN17;
  }
  innerExtract(context, match) {
    let targetDate = context.reference.getDateWithAdjustedTimezone();
    const dateKeyword = (match[DATE_GROUP3] || "").toLowerCase();
    const timeKeyword = (match[TIME_GROUP] || "").toLowerCase();
    let component = context.createParsingComponents();
    switch (dateKeyword) {
      case "jetzt":
        component = now(context.reference);
        break;
      case "heute":
        component = today(context.reference);
        break;
      case "morgen":
        targetDate = addDuration(targetDate, { day: 1 });
        assignSimilarDate(component, targetDate);
        implySimilarTime(component, targetDate);
        break;
      case "\xFCbermorgen":
      case "uebermorgen":
        targetDate = addDuration(targetDate, { day: 2 });
        assignSimilarDate(component, targetDate);
        implySimilarTime(component, targetDate);
        break;
      case "gestern":
        targetDate = addDuration(targetDate, { day: -1 });
        assignSimilarDate(component, targetDate);
        implySimilarTime(component, targetDate);
        break;
      case "vorgestern":
        targetDate = addDuration(targetDate, { day: -2 });
        assignSimilarDate(component, targetDate);
        implySimilarTime(component, targetDate);
        break;
      default:
        if (dateKeyword.match(/letzte\s*nacht/)) {
          if (targetDate.getHours() > 6) {
            targetDate = addDuration(targetDate, { day: -1 });
          }
          assignSimilarDate(component, targetDate);
          component.imply("hour", 0);
        }
        break;
    }
    if (timeKeyword) {
      component = DECasualTimeParser.extractTimeComponents(component, timeKeyword);
    }
    return component;
  }
};

// node_modules/chrono-node/dist/esm/locales/de/parsers/DEMonthNameLittleEndianParser.js
var PATTERN18 = new RegExp(`(?:am\\s*?)?(?:den\\s*?)?([0-9]{1,2})\\.(?:\\s*(?:bis(?:\\s*(?:am|zum))?|\\-|\\\u2013|\\s)\\s*([0-9]{1,2})\\.?)?\\s*(${matchAnyPattern(MONTH_DICTIONARY2)})(?:(?:-|/|,?\\s*)(${YEAR_PATTERN3}(?![^\\s]\\d)))?(?=\\W|$)`, "i");
var DATE_GROUP4 = 1;
var DATE_TO_GROUP3 = 2;
var MONTH_NAME_GROUP6 = 3;
var YEAR_GROUP8 = 4;
var DEMonthNameLittleEndianParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN18;
  }
  innerExtract(context, match) {
    const result = context.createParsingResult(match.index, match[0]);
    const month = MONTH_DICTIONARY2[match[MONTH_NAME_GROUP6].toLowerCase()];
    const day = parseInt(match[DATE_GROUP4]);
    if (day > 31) {
      match.index = match.index + match[DATE_GROUP4].length;
      return null;
    }
    result.start.assign("month", month);
    result.start.assign("day", day);
    if (match[YEAR_GROUP8]) {
      const yearNumber = parseYear2(match[YEAR_GROUP8]);
      result.start.assign("year", yearNumber);
    } else {
      const year3 = findYearClosestToRef(context.refDate, day, month);
      result.start.imply("year", year3);
    }
    if (match[DATE_TO_GROUP3]) {
      const endDate = parseInt(match[DATE_TO_GROUP3]);
      result.end = result.start.clone();
      result.end.assign("day", endDate);
    }
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/de/parsers/DETimeUnitRelativeFormatParser.js
var DETimeUnitAgoFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  constructor() {
    super();
  }
  innerPattern() {
    return new RegExp(`(?:\\s*((?:n\xE4chste|kommende|folgende|letzte|vergangene|vorige|vor(?:her|an)gegangene)(?:s|n|m|r)?|vor|in)\\s*)?(${NUMBER_PATTERN2})?(?:\\s*(n\xE4chste|kommende|folgende|letzte|vergangene|vorige|vor(?:her|an)gegangene)(?:s|n|m|r)?)?\\s*(${matchAnyPattern(TIME_UNIT_DICTIONARY2)})(?=\\W|$)`, "i");
  }
  innerExtract(context, match) {
    const num = match[2] ? parseNumberPattern2(match[2]) : 1;
    const unit = TIME_UNIT_DICTIONARY2[match[4].toLowerCase()];
    let timeUnits = {};
    timeUnits[unit] = num;
    let modifier = match[1] || match[3] || "";
    modifier = modifier.toLowerCase();
    if (!modifier) {
      return;
    }
    if (/vor/.test(modifier) || /letzte/.test(modifier) || /vergangen/.test(modifier)) {
      timeUnits = reverseDuration(timeUnits);
    }
    return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
  }
};

// node_modules/chrono-node/dist/esm/locales/de/parsers/DETimeUnitWithinFormatParser.js
var DETimeUnitWithinFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return new RegExp(`(?:in|f\xFCr|w\xE4hrend)\\s*(${TIME_UNITS_PATTERN2})(?=\\W|$)`, "i");
  }
  innerExtract(context, match) {
    const timeUnits = parseDuration2(match[1]);
    return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
  }
};

// node_modules/chrono-node/dist/esm/locales/de/index.js
var casual2 = new Chrono(createCasualConfiguration());
var strict2 = new Chrono(createConfiguration(true));
function parse2(text, ref, option) {
  return casual2.parse(text, ref, option);
}
function parseDate2(text, ref, option) {
  return casual2.parseDate(text, ref, option);
}
function createCasualConfiguration(littleEndian = true) {
  const option = createConfiguration(false, littleEndian);
  option.parsers.unshift(new DECasualTimeParser());
  option.parsers.unshift(new DECasualDateParser());
  option.parsers.unshift(new DETimeUnitAgoFormatParser());
  return option;
}
function createConfiguration(strictMode = true, littleEndian = true) {
  return includeCommonConfiguration({
    parsers: [
      new ISOFormatParser(),
      new SlashDateFormatParser(littleEndian),
      new DETimeExpressionParser(),
      new DESpecificTimeExpressionParser(),
      new DEMonthNameLittleEndianParser(),
      new DEWeekdayParser(),
      new DETimeUnitWithinFormatParser()
    ],
    refiners: [new DEMergeDateRangeRefiner(), new DEMergeDateTimeRefiner()]
  }, strictMode);
}

// node_modules/chrono-node/dist/esm/locales/fr/index.js
var fr_exports = {};
__export(fr_exports, {
  Chrono: () => Chrono,
  Meridiem: () => Meridiem,
  ParsingComponents: () => ParsingComponents,
  ParsingResult: () => ParsingResult,
  ReferenceWithTimezone: () => ReferenceWithTimezone,
  Weekday: () => Weekday,
  casual: () => casual3,
  createCasualConfiguration: () => createCasualConfiguration2,
  createConfiguration: () => createConfiguration2,
  parse: () => parse3,
  parseDate: () => parseDate3,
  strict: () => strict3
});

// node_modules/chrono-node/dist/esm/locales/fr/parsers/FRCasualDateParser.js
var FRCasualDateParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern(context) {
    return /(maintenant|aujourd'hui|demain|hier|cette\s*nuit|la\s*veille)(?=\W|$)/i;
  }
  innerExtract(context, match) {
    const targetDate = context.refDate;
    const lowerText = match[0].toLowerCase();
    const component = context.createParsingComponents();
    switch (lowerText) {
      case "maintenant":
        return now(context.reference);
      case "aujourd'hui":
        return today(context.reference);
      case "hier":
        return yesterday(context.reference);
      case "demain":
        return tomorrow(context.reference);
      default:
        if (lowerText.match(/cette\s*nuit/)) {
          assignSimilarDate(component, targetDate);
          component.imply("hour", 22);
          component.imply("meridiem", Meridiem.PM);
        } else if (lowerText.match(/la\s*veille/)) {
          const previousDay = new Date(targetDate.getTime());
          previousDay.setDate(previousDay.getDate() - 1);
          assignSimilarDate(component, previousDay);
          component.imply("hour", 0);
        }
    }
    return component;
  }
};

// node_modules/chrono-node/dist/esm/locales/fr/parsers/FRCasualTimeParser.js
var FRCasualTimeParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern(context) {
    return /(cet?)?\s*(matin|soir|après-midi|aprem|a midi|à minuit)(?=\W|$)/i;
  }
  innerExtract(context, match) {
    const suffixLower = match[2].toLowerCase();
    const component = context.createParsingComponents();
    switch (suffixLower) {
      case "apr\xE8s-midi":
      case "aprem":
        component.imply("hour", 14);
        component.imply("minute", 0);
        component.imply("meridiem", Meridiem.PM);
        component.addTag("casualReference/afternoon");
        break;
      case "soir":
        component.imply("hour", 18);
        component.imply("minute", 0);
        component.imply("meridiem", Meridiem.PM);
        component.addTag("casualReference/evening");
        break;
      case "matin":
        component.imply("hour", 8);
        component.imply("minute", 0);
        component.imply("meridiem", Meridiem.AM);
        component.addTag("casualReference/morning");
        break;
      case "a midi":
        component.imply("hour", 12);
        component.imply("minute", 0);
        component.imply("meridiem", Meridiem.AM);
        component.addTag("casualReference/noon");
        break;
      case "\xE0 minuit":
        component.imply("hour", 0);
        component.imply("meridiem", Meridiem.AM);
        component.addTag("casualReference/midnight");
        break;
    }
    return component;
  }
};

// node_modules/chrono-node/dist/esm/locales/fr/parsers/FRTimeExpressionParser.js
var FRTimeExpressionParser = class extends AbstractTimeExpressionParser {
  primaryPrefix() {
    return "(?:(?:[\xE0a])\\s*)?";
  }
  followingPhase() {
    return "\\s*(?:\\-|\\\u2013|\\~|\\\u301C|[\xE0a]|\\?)\\s*";
  }
  extractPrimaryTimeComponents(context, match) {
    if (match[0].match(/^\s*\d{4}\s*$/)) {
      return null;
    }
    return super.extractPrimaryTimeComponents(context, match);
  }
};

// node_modules/chrono-node/dist/esm/locales/fr/refiners/FRMergeDateTimeRefiner.js
var FRMergeDateTimeRefiner = class extends AbstractMergeDateTimeRefiner {
  patternBetween() {
    return new RegExp("^\\s*(T|\xE0|a|au|vers|de|,|-)?\\s*$");
  }
};

// node_modules/chrono-node/dist/esm/locales/fr/refiners/FRMergeDateRangeRefiner.js
var FRMergeDateRangeRefiner = class extends AbstractMergeDateRangeRefiner {
  patternBetween() {
    return /^\s*(à|a|au|-)\s*$/i;
  }
};

// node_modules/chrono-node/dist/esm/locales/fr/constants.js
var WEEKDAY_DICTIONARY3 = {
  "dimanche": 0,
  "dim": 0,
  "lundi": 1,
  "lun": 1,
  "mardi": 2,
  "mar": 2,
  "mercredi": 3,
  "mer": 3,
  "jeudi": 4,
  "jeu": 4,
  "vendredi": 5,
  "ven": 5,
  "samedi": 6,
  "sam": 6
};
var MONTH_DICTIONARY3 = {
  "janvier": 1,
  "jan": 1,
  "jan.": 1,
  "janv": 1,
  "janv.": 1,
  "f\xE9vrier": 2,
  "f\xE9v": 2,
  "f\xE9v.": 2,
  "f\xE9vr": 2,
  "f\xE9vr.": 2,
  "fevrier": 2,
  "fev": 2,
  "fev.": 2,
  "fevr": 2,
  "fevr.": 2,
  "mars": 3,
  "mar": 3,
  "mar.": 3,
  "avril": 4,
  "avr": 4,
  "avr.": 4,
  "mai": 5,
  "juin": 6,
  "juin.": 6,
  "jun": 6,
  "jun.": 6,
  "juillet": 7,
  "juil": 7,
  "juil.": 7,
  "jul": 7,
  "jul.": 7,
  "ao\xFBt": 8,
  "ao\xFBt.": 8,
  "aout": 8,
  "aout.": 8,
  "septembre": 9,
  "sep": 9,
  "sep.": 9,
  "sept": 9,
  "sept.": 9,
  "octobre": 10,
  "oct": 10,
  "oct.": 10,
  "novembre": 11,
  "nov": 11,
  "nov.": 11,
  "d\xE9cembre": 12,
  "decembre": 12,
  "dec": 12,
  "dec.": 12,
  "d\xE9c": 12,
  "d\xE9c.": 12
};
var INTEGER_WORD_DICTIONARY3 = {
  "un": 1,
  "deux": 2,
  "trois": 3,
  "quatre": 4,
  "cinq": 5,
  "six": 6,
  "sept": 7,
  "huit": 8,
  "neuf": 9,
  "dix": 10,
  "onze": 11,
  "douze": 12,
  "treize": 13
};
var TIME_UNIT_DICTIONARY3 = {
  "sec": "second",
  "seconde": "second",
  "secondes": "second",
  "min": "minute",
  "mins": "minute",
  "minute": "minute",
  "minutes": "minute",
  "h": "hour",
  "hr": "hour",
  "hrs": "hour",
  "heure": "hour",
  "heures": "hour",
  "jour": "day",
  "jours": "day",
  "semaine": "week",
  "semaines": "week",
  "mois": "month",
  "trimestre": "quarter",
  "trimestres": "quarter",
  "ans": "year",
  "ann\xE9e": "year",
  "ann\xE9es": "year"
};
var NUMBER_PATTERN3 = `(?:${matchAnyPattern(INTEGER_WORD_DICTIONARY3)}|[0-9]+|[0-9]+\\.[0-9]+|une?\\b|quelques?|demi-?)`;
function parseNumberPattern3(match) {
  const num = match.toLowerCase();
  if (INTEGER_WORD_DICTIONARY3[num] !== void 0) {
    return INTEGER_WORD_DICTIONARY3[num];
  } else if (num === "une" || num === "un") {
    return 1;
  } else if (num.match(/quelques?/)) {
    return 3;
  } else if (num.match(/demi-?/)) {
    return 0.5;
  }
  return parseFloat(num);
}
var ORDINAL_NUMBER_PATTERN2 = `(?:[0-9]{1,2}(?:er)?)`;
function parseOrdinalNumberPattern2(match) {
  let num = match.toLowerCase();
  num = num.replace(/(?:er)$/i, "");
  return parseInt(num);
}
var YEAR_PATTERN4 = `(?:[1-9][0-9]{0,3}\\s*(?:AC|AD|p\\.\\s*C(?:hr?)?\\.\\s*n\\.)|[1-2][0-9]{3}|[5-9][0-9])`;
function parseYear3(match) {
  if (/AC/i.test(match)) {
    match = match.replace(/BC/i, "");
    return -parseInt(match);
  }
  if (/AD/i.test(match) || /C/i.test(match)) {
    match = match.replace(/[^\d]+/i, "");
    return parseInt(match);
  }
  let yearNumber = parseInt(match);
  if (yearNumber < 100) {
    if (yearNumber > 50) {
      yearNumber = yearNumber + 1900;
    } else {
      yearNumber = yearNumber + 2e3;
    }
  }
  return yearNumber;
}
var SINGLE_TIME_UNIT_PATTERN3 = `(${NUMBER_PATTERN3})\\s{0,5}(${matchAnyPattern(TIME_UNIT_DICTIONARY3)})\\s{0,5}`;
var SINGLE_TIME_UNIT_REGEX3 = new RegExp(SINGLE_TIME_UNIT_PATTERN3, "i");
var TIME_UNITS_PATTERN3 = repeatedTimeunitPattern("", SINGLE_TIME_UNIT_PATTERN3);
function parseDuration3(timeunitText) {
  const fragments = {};
  let remainingText = timeunitText;
  let match = SINGLE_TIME_UNIT_REGEX3.exec(remainingText);
  while (match) {
    collectDateTimeFragment3(fragments, match);
    remainingText = remainingText.substring(match[0].length);
    match = SINGLE_TIME_UNIT_REGEX3.exec(remainingText);
  }
  return fragments;
}
function collectDateTimeFragment3(fragments, match) {
  const num = parseNumberPattern3(match[1]);
  const unit = TIME_UNIT_DICTIONARY3[match[2].toLowerCase()];
  fragments[unit] = num;
}

// node_modules/chrono-node/dist/esm/locales/fr/parsers/FRWeekdayParser.js
var PATTERN19 = new RegExp(`(?:(?:\\,|\\(|\\\uFF08)\\s*)?(?:(?:ce)\\s*)?(${matchAnyPattern(WEEKDAY_DICTIONARY3)})(?:\\s*(?:\\,|\\)|\\\uFF09))?(?:\\s*(dernier|prochain)\\s*)?(?=\\W|\\d|$)`, "i");
var WEEKDAY_GROUP3 = 1;
var POSTFIX_GROUP2 = 2;
var FRWeekdayParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN19;
  }
  innerExtract(context, match) {
    const dayOfWeek = match[WEEKDAY_GROUP3].toLowerCase();
    const weekday = WEEKDAY_DICTIONARY3[dayOfWeek];
    if (weekday === void 0) {
      return null;
    }
    let suffix = match[POSTFIX_GROUP2];
    suffix = suffix || "";
    suffix = suffix.toLowerCase();
    let modifier = null;
    if (suffix == "dernier") {
      modifier = "last";
    } else if (suffix == "prochain") {
      modifier = "next";
    }
    return createParsingComponentsAtWeekday(context.reference, weekday, modifier);
  }
};

// node_modules/chrono-node/dist/esm/locales/fr/parsers/FRSpecificTimeExpressionParser.js
var FIRST_REG_PATTERN2 = new RegExp("(^|\\s|T)(?:(?:[\xE0a])\\s*)?(\\d{1,2})(?:h|:)?(?:(\\d{1,2})(?:m|:)?)?(?:(\\d{1,2})(?:s|:)?)?(?:\\s*(A\\.M\\.|P\\.M\\.|AM?|PM?))?(?=\\W|$)", "i");
var SECOND_REG_PATTERN2 = new RegExp("^\\s*(\\-|\\\u2013|\\~|\\\u301C|[\xE0a]|\\?)\\s*(\\d{1,2})(?:h|:)?(?:(\\d{1,2})(?:m|:)?)?(?:(\\d{1,2})(?:s|:)?)?(?:\\s*(A\\.M\\.|P\\.M\\.|AM?|PM?))?(?=\\W|$)", "i");
var HOUR_GROUP3 = 2;
var MINUTE_GROUP3 = 3;
var SECOND_GROUP3 = 4;
var AM_PM_HOUR_GROUP3 = 5;
var FRSpecificTimeExpressionParser = class _FRSpecificTimeExpressionParser {
  pattern(context) {
    return FIRST_REG_PATTERN2;
  }
  extract(context, match) {
    const result = context.createParsingResult(match.index + match[1].length, match[0].substring(match[1].length));
    if (result.text.match(/^\d{4}$/)) {
      match.index += match[0].length;
      return null;
    }
    result.start = _FRSpecificTimeExpressionParser.extractTimeComponent(result.start.clone(), match);
    if (!result.start) {
      match.index += match[0].length;
      return null;
    }
    const remainingText = context.text.substring(match.index + match[0].length);
    const secondMatch = SECOND_REG_PATTERN2.exec(remainingText);
    if (secondMatch) {
      result.end = _FRSpecificTimeExpressionParser.extractTimeComponent(result.start.clone(), secondMatch);
      if (result.end) {
        result.text += secondMatch[0];
      }
    }
    return result;
  }
  static extractTimeComponent(extractingComponents, match) {
    let hour = 0;
    let minute = 0;
    let meridiem = null;
    hour = parseInt(match[HOUR_GROUP3]);
    if (match[MINUTE_GROUP3] != null) {
      minute = parseInt(match[MINUTE_GROUP3]);
    }
    if (minute >= 60 || hour > 24) {
      return null;
    }
    if (hour >= 12) {
      meridiem = Meridiem.PM;
    }
    if (match[AM_PM_HOUR_GROUP3] != null) {
      if (hour > 12)
        return null;
      const ampm = match[AM_PM_HOUR_GROUP3][0].toLowerCase();
      if (ampm == "a") {
        meridiem = Meridiem.AM;
        if (hour == 12) {
          hour = 0;
        }
      }
      if (ampm == "p") {
        meridiem = Meridiem.PM;
        if (hour != 12) {
          hour += 12;
        }
      }
    }
    extractingComponents.assign("hour", hour);
    extractingComponents.assign("minute", minute);
    if (meridiem !== null) {
      extractingComponents.assign("meridiem", meridiem);
    } else {
      if (hour < 12) {
        extractingComponents.imply("meridiem", Meridiem.AM);
      } else {
        extractingComponents.imply("meridiem", Meridiem.PM);
      }
    }
    if (match[SECOND_GROUP3] != null) {
      const second = parseInt(match[SECOND_GROUP3]);
      if (second >= 60)
        return null;
      extractingComponents.assign("second", second);
    }
    return extractingComponents;
  }
};

// node_modules/chrono-node/dist/esm/locales/fr/parsers/FRMonthNameLittleEndianParser.js
var PATTERN20 = new RegExp(`(?:on\\s*?)?(${ORDINAL_NUMBER_PATTERN2})(?:\\s*(?:au|\\-|\\\u2013|jusqu'au?|\\s)\\s*(${ORDINAL_NUMBER_PATTERN2}))?(?:-|/|\\s*(?:de)?\\s*)(${matchAnyPattern(MONTH_DICTIONARY3)})(?:(?:-|/|,?\\s*)(${YEAR_PATTERN4}(?![^\\s]\\d)))?(?=\\W|$)`, "i");
var DATE_GROUP5 = 1;
var DATE_TO_GROUP4 = 2;
var MONTH_NAME_GROUP7 = 3;
var YEAR_GROUP9 = 4;
var FRMonthNameLittleEndianParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN20;
  }
  innerExtract(context, match) {
    const result = context.createParsingResult(match.index, match[0]);
    const month = MONTH_DICTIONARY3[match[MONTH_NAME_GROUP7].toLowerCase()];
    const day = parseOrdinalNumberPattern2(match[DATE_GROUP5]);
    if (day > 31) {
      match.index = match.index + match[DATE_GROUP5].length;
      return null;
    }
    result.start.assign("month", month);
    result.start.assign("day", day);
    if (match[YEAR_GROUP9]) {
      const yearNumber = parseYear3(match[YEAR_GROUP9]);
      result.start.assign("year", yearNumber);
    } else {
      const year3 = findYearClosestToRef(context.refDate, day, month);
      result.start.imply("year", year3);
    }
    if (match[DATE_TO_GROUP4]) {
      const endDate = parseOrdinalNumberPattern2(match[DATE_TO_GROUP4]);
      result.end = result.start.clone();
      result.end.assign("day", endDate);
    }
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/fr/parsers/FRTimeUnitAgoFormatParser.js
var FRTimeUnitAgoFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  constructor() {
    super();
  }
  innerPattern() {
    return new RegExp(`il y a\\s*(${TIME_UNITS_PATTERN3})(?=(?:\\W|$))`, "i");
  }
  innerExtract(context, match) {
    const timeUnits = parseDuration3(match[1]);
    const outputTimeUnits = reverseDuration(timeUnits);
    return ParsingComponents.createRelativeFromReference(context.reference, outputTimeUnits);
  }
};

// node_modules/chrono-node/dist/esm/locales/fr/parsers/FRTimeUnitWithinFormatParser.js
var FRTimeUnitWithinFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return new RegExp(`(?:dans|en|pour|pendant|de)\\s*(${TIME_UNITS_PATTERN3})(?=\\W|$)`, "i");
  }
  innerExtract(context, match) {
    const timeUnits = parseDuration3(match[1]);
    return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
  }
};

// node_modules/chrono-node/dist/esm/locales/fr/parsers/FRTimeUnitRelativeFormatParser.js
var FRTimeUnitAgoFormatParser2 = class extends AbstractParserWithWordBoundaryChecking {
  constructor() {
    super();
  }
  innerPattern() {
    return new RegExp(`(?:les?|la|l'|du|des?)\\s*(${NUMBER_PATTERN3})?(?:\\s*(prochaine?s?|derni[e\xE8]re?s?|pass[\xE9e]e?s?|pr[\xE9e]c[\xE9e]dents?|suivante?s?))?\\s*(${matchAnyPattern(TIME_UNIT_DICTIONARY3)})(?:\\s*(prochaine?s?|derni[e\xE8]re?s?|pass[\xE9e]e?s?|pr[\xE9e]c[\xE9e]dents?|suivante?s?))?(?=\\W|$)`, "i");
  }
  innerExtract(context, match) {
    const num = match[1] ? parseNumberPattern3(match[1]) : 1;
    const unit = TIME_UNIT_DICTIONARY3[match[3].toLowerCase()];
    let timeUnits = {};
    timeUnits[unit] = num;
    let modifier = match[2] || match[4] || "";
    modifier = modifier.toLowerCase();
    if (!modifier) {
      return;
    }
    if (/derni[eè]re?s?/.test(modifier) || /pass[ée]e?s?/.test(modifier) || /pr[ée]c[ée]dents?/.test(modifier)) {
      timeUnits = reverseDuration(timeUnits);
    }
    return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
  }
};

// node_modules/chrono-node/dist/esm/locales/fr/index.js
var casual3 = new Chrono(createCasualConfiguration2());
var strict3 = new Chrono(createConfiguration2(true));
function parse3(text, ref, option) {
  return casual3.parse(text, ref, option);
}
function parseDate3(text, ref, option) {
  return casual3.parseDate(text, ref, option);
}
function createCasualConfiguration2(littleEndian = true) {
  const option = createConfiguration2(false, littleEndian);
  option.parsers.unshift(new FRCasualDateParser());
  option.parsers.unshift(new FRCasualTimeParser());
  option.parsers.unshift(new FRTimeUnitAgoFormatParser2());
  return option;
}
function createConfiguration2(strictMode = true, littleEndian = true) {
  return includeCommonConfiguration({
    parsers: [
      new SlashDateFormatParser(littleEndian),
      new FRMonthNameLittleEndianParser(),
      new FRTimeExpressionParser(),
      new FRSpecificTimeExpressionParser(),
      new FRTimeUnitAgoFormatParser(),
      new FRTimeUnitWithinFormatParser(),
      new FRWeekdayParser()
    ],
    refiners: [new FRMergeDateTimeRefiner(), new FRMergeDateRangeRefiner()]
  }, strictMode);
}

// node_modules/chrono-node/dist/esm/locales/ja/index.js
var ja_exports = {};
__export(ja_exports, {
  Chrono: () => Chrono,
  Meridiem: () => Meridiem,
  ParsingComponents: () => ParsingComponents,
  ParsingResult: () => ParsingResult,
  ReferenceWithTimezone: () => ReferenceWithTimezone,
  Weekday: () => Weekday,
  casual: () => casual4,
  createCasualConfiguration: () => createCasualConfiguration3,
  createConfiguration: () => createConfiguration3,
  parse: () => parse4,
  parseDate: () => parseDate4,
  strict: () => strict4
});

// node_modules/chrono-node/dist/esm/locales/ja/constants.js
var NUMBER = {
  "\u96F6": 0,
  "\u3007": 0,
  "\u4E00": 1,
  "\u4E8C": 2,
  "\u4E09": 3,
  "\u56DB": 4,
  "\u4E94": 5,
  "\u516D": 6,
  "\u4E03": 7,
  "\u516B": 8,
  "\u4E5D": 9,
  "\u5341": 10
};
var WEEKDAY_OFFSET = {
  "\u65E5": 0,
  "\u6708": 1,
  "\u706B": 2,
  "\u6C34": 3,
  "\u6728": 4,
  "\u91D1": 5,
  "\u571F": 6
};
function toHankaku(text) {
  return String(text).replace(/\u2019/g, "'").replace(/\u201D/g, '"').replace(/\u3000/g, " ").replace(/\uFFE5/g, "\xA5").replace(/[\uFF01\uFF03-\uFF06\uFF08\uFF09\uFF0C-\uFF19\uFF1C-\uFF1F\uFF21-\uFF3B\uFF3D\uFF3F\uFF41-\uFF5B\uFF5D\uFF5E]/g, alphaNum);
}
function alphaNum(token) {
  return String.fromCharCode(token.charCodeAt(0) - 65248);
}
function jaStringToNumber(text) {
  let number = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "\u5341") {
      number = number === 0 ? NUMBER[char] : number * NUMBER[char];
    } else {
      number += NUMBER[char];
    }
  }
  return number;
}

// node_modules/chrono-node/dist/esm/locales/ja/parsers/JPStandardParser.js
var PATTERN21 = /(?:(?:([同今本])|((昭和|平成|令和)?([0-9０-９]{1,4}|元)))年\s*)?([0-9０-９]{1,2})月\s*([0-9０-９]{1,2})日/i;
var SPECIAL_YEAR_GROUP = 1;
var TYPICAL_YEAR_GROUP = 2;
var ERA_GROUP = 3;
var YEAR_NUMBER_GROUP3 = 4;
var MONTH_GROUP2 = 5;
var DAY_GROUP = 6;
var JPStandardParser = class {
  pattern() {
    return PATTERN21;
  }
  extract(context, match) {
    const month = parseInt(toHankaku(match[MONTH_GROUP2]));
    const day = parseInt(toHankaku(match[DAY_GROUP]));
    const components = context.createParsingComponents({
      day,
      month
    });
    if (match[SPECIAL_YEAR_GROUP] && match[SPECIAL_YEAR_GROUP].match("\u540C|\u4ECA|\u672C")) {
      components.assign("year", context.reference.getDateWithAdjustedTimezone().getFullYear());
    }
    if (match[TYPICAL_YEAR_GROUP]) {
      const yearNumText = match[YEAR_NUMBER_GROUP3];
      let year3 = yearNumText == "\u5143" ? 1 : parseInt(toHankaku(yearNumText));
      if (match[ERA_GROUP] == "\u4EE4\u548C") {
        year3 += 2018;
      } else if (match[ERA_GROUP] == "\u5E73\u6210") {
        year3 += 1988;
      } else if (match[ERA_GROUP] == "\u662D\u548C") {
        year3 += 1925;
      }
      components.assign("year", year3);
    } else {
      const year3 = findYearClosestToRef(context.refDate, day, month);
      components.imply("year", year3);
    }
    return components;
  }
};

// node_modules/chrono-node/dist/esm/locales/ja/refiners/JPMergeDateRangeRefiner.js
var JPMergeDateRangeRefiner = class extends AbstractMergeDateRangeRefiner {
  patternBetween() {
    return /^\s*(から|－|ー|-|～|~)\s*$/i;
  }
};

// node_modules/chrono-node/dist/esm/locales/ja/parsers/JPCasualDateParser.js
var PATTERN22 = /今日|きょう|本日|ほんじつ|昨日|きのう|明日|あした|今夜|こんや|今夕|こんゆう|今晩|こんばん|今朝|けさ/i;
function normalizeTextToKanji(text) {
  switch (text) {
    case "\u304D\u3087\u3046":
      return "\u4ECA\u65E5";
    case "\u307B\u3093\u3058\u3064":
      return "\u672C\u65E5";
    case "\u304D\u306E\u3046":
      return "\u6628\u65E5";
    case "\u3042\u3057\u305F":
      return "\u660E\u65E5";
    case "\u3053\u3093\u3084":
      return "\u4ECA\u591C";
    case "\u3053\u3093\u3086\u3046":
      return "\u4ECA\u5915";
    case "\u3053\u3093\u3070\u3093":
      return "\u4ECA\u6669";
    case "\u3051\u3055":
      return "\u4ECA\u671D";
    default:
      return text;
  }
}
var JPCasualDateParser = class {
  pattern() {
    return PATTERN22;
  }
  extract(context, match) {
    const text = normalizeTextToKanji(match[0]);
    const components = context.createParsingComponents();
    switch (text) {
      case "\u6628\u65E5":
        return yesterday(context.reference);
      case "\u660E\u65E5":
        return tomorrow(context.reference);
      case "\u672C\u65E5":
      case "\u4ECA\u65E5":
        return today(context.reference);
    }
    if (text == "\u4ECA\u591C" || text == "\u4ECA\u5915" || text == "\u4ECA\u6669") {
      components.imply("hour", 22);
      components.assign("meridiem", Meridiem.PM);
    } else if (text.match("\u4ECA\u671D")) {
      components.imply("hour", 6);
      components.assign("meridiem", Meridiem.AM);
    }
    const date = context.refDate;
    components.assign("day", date.getDate());
    components.assign("month", date.getMonth() + 1);
    components.assign("year", date.getFullYear());
    return components;
  }
};

// node_modules/chrono-node/dist/esm/locales/ja/parsers/JPWeekdayParser.js
var PATTERN23 = new RegExp("((?<prefix>\u524D\u306E|\u6B21\u306E|\u4ECA\u9031))?(?<weekday>" + Object.keys(WEEKDAY_OFFSET).join("|") + ")(?:\u66DC\u65E5|\u66DC)", "i");
var JPWeekdayParser = class {
  pattern() {
    return PATTERN23;
  }
  extract(context, match) {
    const dayOfWeek = match.groups.weekday;
    const offset = WEEKDAY_OFFSET[dayOfWeek];
    if (offset === void 0)
      return null;
    const prefix = match.groups.prefix || "";
    let modifier = null;
    if (prefix.match(/前の/)) {
      modifier = "last";
    } else if (prefix.match(/次の/)) {
      modifier = "next";
    } else if (prefix.match(/今週/)) {
      modifier = "this";
    }
    return createParsingComponentsAtWeekday(context.reference, offset, modifier);
  }
};

// node_modules/chrono-node/dist/esm/locales/ja/parsers/JPSlashDateFormatParser.js
var PATTERN24 = new RegExp("([0-9\uFF10-\uFF19]{4}[\\/|\\\uFF0F])?([0-1\uFF10-\uFF11]{0,1}[0-9\uFF10-\uFF19]{1})(?:[\\/|\\\uFF0F]([0-3\uFF10-\uFF13]{0,1}[0-9\uFF10-\uFF19]{1}))", "i");
var YEAR_GROUP10 = 1;
var MONTH_GROUP3 = 2;
var DAY_GROUP2 = 3;
var JPSlashDateFormatParser = class {
  pattern() {
    return PATTERN24;
  }
  extract(context, match) {
    const result = context.createParsingComponents();
    const month = parseInt(toHankaku(match[MONTH_GROUP3]));
    const day = parseInt(toHankaku(match[DAY_GROUP2]));
    if (month < 1 || month > 12) {
      return null;
    }
    if (day < 1 || day > 31) {
      return null;
    }
    result.assign("day", day);
    result.assign("month", month);
    if (match[YEAR_GROUP10]) {
      const rawYearNumber = parseInt(toHankaku(match[YEAR_GROUP10]));
      const year3 = findMostLikelyADYear(rawYearNumber);
      result.assign("year", year3);
    } else {
      const year3 = findYearClosestToRef(context.reference.instant, day, month);
      result.imply("year", year3);
    }
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/ja/parsers/JPTimeExpressionParser.js
var FIRST_REG_PATTERN3 = new RegExp("(?:(\u5348\u524D|\u5348\u5F8C|A.M.|P.M.|AM|PM))?(?:[\\s,\uFF0C\u3001]*)(?:([0-9\uFF10-\uFF19]+|[" + Object.keys(NUMBER).join("") + "]+)(?:\\s*)(?:\u6642(?!\u9593)|:|\uFF1A)(?:\\s*)([0-9\uFF10-\uFF19]+|\u534A|[" + Object.keys(NUMBER).join("") + "]+)?(?:\\s*)(?:\u5206|:|\uFF1A)?(?:\\s*)([0-9\uFF10-\uFF19]+|[" + Object.keys(NUMBER).join("") + "]+)?(?:\\s*)(?:\u79D2)?)(?:\\s*(A.M.|P.M.|AM?|PM?))?", "i");
var SECOND_REG_PATTERN3 = new RegExp("(?:^\\s*(?:\u304B\u3089|\\-|\\\u2013|\\\uFF0D|\\~|\\\u301C)\\s*)(?:(\u5348\u524D|\u5348\u5F8C|A.M.|P.M.|AM|PM))?(?:[\\s,\uFF0C\u3001]*)(?:([0-9\uFF10-\uFF19]+|[" + Object.keys(NUMBER).join("") + "]+)(?:\\s*)(?:\u6642|:|\uFF1A)(?:\\s*)([0-9\uFF10-\uFF19]+|\u534A|[" + Object.keys(NUMBER).join("") + "]+)?(?:\\s*)(?:\u5206|:|\uFF1A)?(?:\\s*)([0-9\uFF10-\uFF19]+|[" + Object.keys(NUMBER).join("") + "]+)?(?:\\s*)(?:\u79D2)?)(?:\\s*(A.M.|P.M.|AM?|PM?))?", "i");
var AM_PM_HOUR_GROUP_1 = 1;
var HOUR_GROUP4 = 2;
var MINUTE_GROUP4 = 3;
var SECOND_GROUP4 = 4;
var AM_PM_HOUR_GROUP_2 = 5;
var JPTimeExpressionParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return FIRST_REG_PATTERN3;
  }
  innerExtract(context, match) {
    if (match.index > 0 && context.text[match.index - 1].match(/\w/)) {
      return null;
    }
    const result = context.createParsingResult(match.index, match[0]);
    result.start = createTimeComponents(context, match[HOUR_GROUP4], match[MINUTE_GROUP4], match[SECOND_GROUP4], match[AM_PM_HOUR_GROUP_1] ?? match[AM_PM_HOUR_GROUP_2]);
    if (!result.start) {
      match.index += match[0].length;
      return null;
    }
    match = SECOND_REG_PATTERN3.exec(context.text.substring(result.index + result.text.length));
    if (!match) {
      return result;
    }
    result.text = result.text + match[0];
    result.end = createTimeComponents(context, match[HOUR_GROUP4], match[MINUTE_GROUP4], match[SECOND_GROUP4], match[AM_PM_HOUR_GROUP_1] ?? match[AM_PM_HOUR_GROUP_2]);
    if (!result.end) {
      return null;
    }
    if (!result.end.isCertain("meridiem") && result.start.isCertain("meridiem")) {
      result.end.imply("meridiem", result.start.get("meridiem"));
      if (result.start.get("meridiem") === Meridiem.PM) {
        if (result.start.get("hour") - 12 > result.end.get("hour")) {
          result.end.imply("meridiem", Meridiem.AM);
        } else if (result.end.get("hour") < 12) {
          result.end.assign("hour", result.end.get("hour") + 12);
        }
      }
    }
    if (result.end.date().getTime() < result.start.date().getTime()) {
      result.end.imply("day", result.end.get("day") + 1);
    }
    return result;
  }
};
function createTimeComponents(context, matchHour, matchMinute, matchSecond, matchAmPm) {
  let hour = 0;
  let meridiem = -1;
  let targetComponents = context.createParsingComponents();
  hour = parseInt(toHankaku(matchHour));
  if (isNaN(hour)) {
    hour = jaStringToNumber(matchHour);
  }
  if (hour > 24) {
    return null;
  }
  if (matchMinute) {
    let minute;
    if (matchMinute === "\u534A") {
      minute = 30;
    } else {
      minute = parseInt(toHankaku(matchMinute));
      if (isNaN(minute)) {
        minute = jaStringToNumber(matchMinute);
      }
    }
    if (minute >= 60)
      return null;
    targetComponents.assign("minute", minute);
  }
  if (matchSecond) {
    let second = parseInt(toHankaku(matchSecond));
    if (isNaN(second)) {
      second = jaStringToNumber(matchSecond);
    }
    if (second >= 60)
      return null;
    targetComponents.assign("second", second);
  }
  if (matchAmPm) {
    if (hour > 12) {
      return null;
    }
    const AMPMString = matchAmPm;
    if (AMPMString === "\u5348\u524D" || AMPMString[0].toLowerCase() === "a") {
      meridiem = Meridiem.AM;
      if (hour === 12)
        hour = 0;
    } else if (AMPMString === "\u5348\u5F8C" || AMPMString[0].toLowerCase() === "p") {
      meridiem = Meridiem.PM;
      if (hour != 12)
        hour += 12;
    }
  }
  targetComponents.assign("hour", hour);
  if (meridiem >= 0) {
    targetComponents.assign("meridiem", meridiem);
  } else {
    if (hour < 12) {
      targetComponents.imply("meridiem", Meridiem.AM);
    } else {
      targetComponents.imply("meridiem", Meridiem.PM);
    }
  }
  return targetComponents;
}

// node_modules/chrono-node/dist/esm/locales/ja/refiners/JPMergeDateTimeRefiner.js
var JPMergeDateTimeRefiner = class extends AbstractMergeDateTimeRefiner {
  patternBetween() {
    return /^\s*(の)?\s*$/i;
  }
};

// node_modules/chrono-node/dist/esm/locales/ja/refiners/JPMergeWeekdayComponentRefiner.js
var JPMergeWeekdayComponentRefiner = class extends MergingRefiner {
  mergeResults(textBetween, currentResult, nextResult) {
    const newResult = currentResult.clone();
    newResult.text = currentResult.text + textBetween + nextResult.text;
    newResult.start.assign("weekday", nextResult.start.get("weekday"));
    if (newResult.end) {
      newResult.end.assign("weekday", nextResult.start.get("weekday"));
    }
    return newResult;
  }
  shouldMergeResults(textBetween, currentResult, nextResult) {
    const normalDateThenWeekday = currentResult.start.isCertain("day") && nextResult.start.isOnlyWeekdayComponent() && !nextResult.start.isCertain("hour");
    return normalDateThenWeekday && textBetween.match(/^[,、の]?\s*$/) !== null;
  }
};

// node_modules/chrono-node/dist/esm/locales/ja/parsers/JPWeekdayWithParenthesesParser.js
var PATTERN25 = new RegExp("(?:\\(|\\\uFF08)(?<weekday>" + Object.keys(WEEKDAY_OFFSET).join("|") + ")(?:\\)|\\\uFF09)", "i");
var JPWeekdayWithParenthesesParser = class {
  pattern() {
    return PATTERN25;
  }
  extract(context, match) {
    const dayOfWeek = match.groups.weekday;
    const offset = WEEKDAY_OFFSET[dayOfWeek];
    if (offset === void 0)
      return null;
    return createParsingComponentsAtWeekday(context.reference, offset);
  }
};

// node_modules/chrono-node/dist/esm/locales/ja/index.js
var casual4 = new Chrono(createCasualConfiguration3());
var strict4 = new Chrono(createConfiguration3(true));
function parse4(text, ref, option) {
  return casual4.parse(text, ref, option);
}
function parseDate4(text, ref, option) {
  return casual4.parseDate(text, ref, option);
}
function createCasualConfiguration3() {
  const option = createConfiguration3(false);
  option.parsers.unshift(new JPCasualDateParser());
  return option;
}
function createConfiguration3(strictMode = true) {
  const configuration3 = includeCommonConfiguration({
    parsers: [
      new JPStandardParser(),
      new JPWeekdayParser(),
      new JPWeekdayWithParenthesesParser(),
      new JPSlashDateFormatParser(),
      new JPTimeExpressionParser()
    ],
    refiners: [
      new JPMergeWeekdayComponentRefiner(),
      new JPMergeDateTimeRefiner(),
      new JPMergeDateRangeRefiner()
    ]
  }, strictMode);
  configuration3.refiners = configuration3.refiners.filter((refiner) => !(refiner instanceof MergeWeekdayComponentRefiner));
  return configuration3;
}

// node_modules/chrono-node/dist/esm/locales/pt/index.js
var pt_exports = {};
__export(pt_exports, {
  Chrono: () => Chrono,
  Meridiem: () => Meridiem,
  ParsingComponents: () => ParsingComponents,
  ParsingResult: () => ParsingResult,
  ReferenceWithTimezone: () => ReferenceWithTimezone,
  Weekday: () => Weekday,
  casual: () => casual5,
  createCasualConfiguration: () => createCasualConfiguration4,
  createConfiguration: () => createConfiguration4,
  parse: () => parse5,
  parseDate: () => parseDate5,
  strict: () => strict5
});

// node_modules/chrono-node/dist/esm/locales/pt/constants.js
var WEEKDAY_DICTIONARY4 = {
  "domingo": 0,
  "dom": 0,
  "segunda": 1,
  "segunda-feira": 1,
  "seg": 1,
  "ter\xE7a": 2,
  "ter\xE7a-feira": 2,
  "ter": 2,
  "quarta": 3,
  "quarta-feira": 3,
  "qua": 3,
  "quinta": 4,
  "quinta-feira": 4,
  "qui": 4,
  "sexta": 5,
  "sexta-feira": 5,
  "sex": 5,
  "s\xE1bado": 6,
  "sabado": 6,
  "sab": 6
};
var MONTH_DICTIONARY4 = {
  "janeiro": 1,
  "jan": 1,
  "jan.": 1,
  "fevereiro": 2,
  "fev": 2,
  "fev.": 2,
  "mar\xE7o": 3,
  "mar": 3,
  "mar.": 3,
  "abril": 4,
  "abr": 4,
  "abr.": 4,
  "maio": 5,
  "mai": 5,
  "mai.": 5,
  "junho": 6,
  "jun": 6,
  "jun.": 6,
  "julho": 7,
  "jul": 7,
  "jul.": 7,
  "agosto": 8,
  "ago": 8,
  "ago.": 8,
  "setembro": 9,
  "set": 9,
  "set.": 9,
  "outubro": 10,
  "out": 10,
  "out.": 10,
  "novembro": 11,
  "nov": 11,
  "nov.": 11,
  "dezembro": 12,
  "dez": 12,
  "dez.": 12
};
var YEAR_PATTERN5 = "[0-9]{1,4}(?![^\\s]\\d)(?:\\s*[a|d]\\.?\\s*c\\.?|\\s*a\\.?\\s*d\\.?)?";
function parseYear4(match) {
  if (match.match(/^[0-9]{1,4}$/)) {
    let yearNumber = parseInt(match);
    if (yearNumber < 100) {
      if (yearNumber > 50) {
        yearNumber = yearNumber + 1900;
      } else {
        yearNumber = yearNumber + 2e3;
      }
    }
    return yearNumber;
  }
  if (match.match(/a\.?\s*c\.?/i)) {
    match = match.replace(/a\.?\s*c\.?/i, "");
    return -parseInt(match);
  }
  return parseInt(match);
}

// node_modules/chrono-node/dist/esm/locales/pt/parsers/PTWeekdayParser.js
var PATTERN26 = new RegExp(`(?:(?:\\,|\\(|\\\uFF08)\\s*)?(?:(este|esta|passado|pr[o\xF3]ximo)\\s*)?(${matchAnyPattern(WEEKDAY_DICTIONARY4)})(?:\\s*(?:\\,|\\)|\\\uFF09))?(?:\\s*(este|esta|passado|pr[\xF3o]ximo)\\s*semana)?(?=\\W|\\d|$)`, "i");
var PREFIX_GROUP4 = 1;
var WEEKDAY_GROUP4 = 2;
var POSTFIX_GROUP3 = 3;
var PTWeekdayParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN26;
  }
  innerExtract(context, match) {
    const dayOfWeek = match[WEEKDAY_GROUP4].toLowerCase();
    const weekday = WEEKDAY_DICTIONARY4[dayOfWeek];
    if (weekday === void 0) {
      return null;
    }
    const prefix = match[PREFIX_GROUP4];
    const postfix = match[POSTFIX_GROUP3];
    let norm = prefix || postfix || "";
    norm = norm.toLowerCase();
    let modifier = null;
    if (norm == "passado") {
      modifier = "this";
    } else if (norm == "pr\xF3ximo" || norm == "proximo") {
      modifier = "next";
    } else if (norm == "este") {
      modifier = "this";
    }
    return createParsingComponentsAtWeekday(context.reference, weekday, modifier);
  }
};

// node_modules/chrono-node/dist/esm/locales/pt/parsers/PTTimeExpressionParser.js
var PTTimeExpressionParser = class extends AbstractTimeExpressionParser {
  primaryPrefix() {
    return "(?:(?:ao?|\xE0s?|das|da|de|do)\\s*)?";
  }
  followingPhase() {
    return "\\s*(?:\\-|\\\u2013|\\~|\\\u301C|a(?:o)?|\\?)\\s*";
  }
};

// node_modules/chrono-node/dist/esm/locales/pt/refiners/PTMergeDateTimeRefiner.js
var PTMergeDateTimeRefiner = class extends AbstractMergeDateTimeRefiner {
  patternBetween() {
    return new RegExp("^\\s*(?:,|\xE0)?\\s*$");
  }
};

// node_modules/chrono-node/dist/esm/locales/pt/refiners/PTMergeDateRangeRefiner.js
var PTMergeDateRangeRefiner = class extends AbstractMergeDateRangeRefiner {
  patternBetween() {
    return /^\s*(?:-)\s*$/i;
  }
};

// node_modules/chrono-node/dist/esm/locales/pt/parsers/PTMonthNameLittleEndianParser.js
var PATTERN27 = new RegExp(`([0-9]{1,2})(?:\xBA|\xAA|\xB0)?(?:\\s*(?:desde|de|\\-|\\\u2013|ao?|\\s)\\s*([0-9]{1,2})(?:\xBA|\xAA|\xB0)?)?\\s*(?:de)?\\s*(?:-|/|\\s*(?:de|,)?\\s*)(${matchAnyPattern(MONTH_DICTIONARY4)})(?:\\s*(?:de|,)?\\s*(${YEAR_PATTERN5}))?(?=\\W|$)`, "i");
var DATE_GROUP6 = 1;
var DATE_TO_GROUP5 = 2;
var MONTH_NAME_GROUP8 = 3;
var YEAR_GROUP11 = 4;
var PTMonthNameLittleEndianParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN27;
  }
  innerExtract(context, match) {
    const result = context.createParsingResult(match.index, match[0]);
    const month = MONTH_DICTIONARY4[match[MONTH_NAME_GROUP8].toLowerCase()];
    const day = parseInt(match[DATE_GROUP6]);
    if (day > 31) {
      match.index = match.index + match[DATE_GROUP6].length;
      return null;
    }
    result.start.assign("month", month);
    result.start.assign("day", day);
    if (match[YEAR_GROUP11]) {
      const yearNumber = parseYear4(match[YEAR_GROUP11]);
      result.start.assign("year", yearNumber);
    } else {
      const year3 = findYearClosestToRef(context.refDate, day, month);
      result.start.imply("year", year3);
    }
    if (match[DATE_TO_GROUP5]) {
      const endDate = parseInt(match[DATE_TO_GROUP5]);
      result.end = result.start.clone();
      result.end.assign("day", endDate);
    }
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/pt/parsers/PTCasualDateParser.js
var PTCasualDateParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern(context) {
    return /(agora|hoje|amanha|amanhã|ontem)(?=\W|$)/i;
  }
  innerExtract(context, match) {
    const lowerText = match[0].toLowerCase();
    const component = context.createParsingComponents();
    switch (lowerText) {
      case "agora":
        return now(context.reference);
      case "hoje":
        return today(context.reference);
      case "amanha":
      case "amanh\xE3":
        return tomorrow(context.reference);
      case "ontem":
        return yesterday(context.reference);
    }
    return component;
  }
};

// node_modules/chrono-node/dist/esm/locales/pt/parsers/PTCasualTimeParser.js
var PTCasualTimeParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return /(?:esta\s*)?(manha|manhã|tarde|meia-noite|meio-dia|noite)(?=\W|$)/i;
  }
  innerExtract(context, match) {
    const targetDate = context.refDate;
    const component = context.createParsingComponents();
    switch (match[1].toLowerCase()) {
      case "tarde":
        component.imply("meridiem", Meridiem.PM);
        component.imply("hour", 15);
        component.addTag("casualReference/afternoon");
        break;
      case "noite":
        component.imply("meridiem", Meridiem.PM);
        component.imply("hour", 22);
        component.addTag("casualReference/evening");
        break;
      case "manha":
      case "manh\xE3":
        component.imply("meridiem", Meridiem.AM);
        component.imply("hour", 6);
        component.addTag("casualReference/morning");
        break;
      case "meia-noite":
        const nextDay = new Date(targetDate.getTime());
        nextDay.setDate(nextDay.getDate() + 1);
        assignSimilarDate(component, nextDay);
        implySimilarTime(component, nextDay);
        component.imply("hour", 0);
        component.imply("minute", 0);
        component.imply("second", 0);
        component.addTag("casualReference/midnight");
        break;
      case "meio-dia":
        component.imply("meridiem", Meridiem.AM);
        component.imply("hour", 12);
        component.addTag("casualReference/noon");
        break;
    }
    return component;
  }
};

// node_modules/chrono-node/dist/esm/locales/pt/index.js
var casual5 = new Chrono(createCasualConfiguration4());
var strict5 = new Chrono(createConfiguration4(true));
function parse5(text, ref, option) {
  return casual5.parse(text, ref, option);
}
function parseDate5(text, ref, option) {
  return casual5.parseDate(text, ref, option);
}
function createCasualConfiguration4(littleEndian = true) {
  const option = createConfiguration4(false, littleEndian);
  option.parsers.push(new PTCasualDateParser());
  option.parsers.push(new PTCasualTimeParser());
  return option;
}
function createConfiguration4(strictMode = true, littleEndian = true) {
  return includeCommonConfiguration({
    parsers: [
      new SlashDateFormatParser(littleEndian),
      new PTWeekdayParser(),
      new PTTimeExpressionParser(),
      new PTMonthNameLittleEndianParser()
    ],
    refiners: [new PTMergeDateTimeRefiner(), new PTMergeDateRangeRefiner()]
  }, strictMode);
}

// node_modules/chrono-node/dist/esm/locales/nl/index.js
var nl_exports = {};
__export(nl_exports, {
  Chrono: () => Chrono,
  Meridiem: () => Meridiem,
  ParsingComponents: () => ParsingComponents,
  ParsingResult: () => ParsingResult,
  ReferenceWithTimezone: () => ReferenceWithTimezone,
  Weekday: () => Weekday,
  casual: () => casual6,
  createCasualConfiguration: () => createCasualConfiguration5,
  createConfiguration: () => createConfiguration5,
  parse: () => parse6,
  parseDate: () => parseDate6,
  strict: () => strict6
});

// node_modules/chrono-node/dist/esm/locales/nl/refiners/NLMergeDateRangeRefiner.js
var NLMergeDateRangeRefiner = class extends AbstractMergeDateRangeRefiner {
  patternBetween() {
    return /^\s*(tot|-)\s*$/i;
  }
};

// node_modules/chrono-node/dist/esm/locales/nl/refiners/NLMergeDateTimeRefiner.js
var NLMergeDateTimeRefiner = class extends AbstractMergeDateTimeRefiner {
  patternBetween() {
    return new RegExp("^\\s*(om|na|voor|in de|,|-)?\\s*$");
  }
};

// node_modules/chrono-node/dist/esm/locales/nl/parsers/NLCasualDateParser.js
var NLCasualDateParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern(context) {
    return /(nu|vandaag|morgen|morgend|gisteren)(?=\W|$)/i;
  }
  innerExtract(context, match) {
    const lowerText = match[0].toLowerCase();
    const component = context.createParsingComponents();
    switch (lowerText) {
      case "nu":
        return now(context.reference);
      case "vandaag":
        return today(context.reference);
      case "morgen":
      case "morgend":
        return tomorrow(context.reference);
      case "gisteren":
        return yesterday(context.reference);
    }
    return component;
  }
};

// node_modules/chrono-node/dist/esm/locales/nl/parsers/NLCasualTimeParser.js
var DAY_GROUP3 = 1;
var MOMENT_GROUP = 2;
var NLCasualTimeParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return /(deze)?\s*(namiddag|avond|middernacht|ochtend|middag|'s middags|'s avonds|'s ochtends)(?=\W|$)/i;
  }
  innerExtract(context, match) {
    const targetDate = context.refDate;
    const component = context.createParsingComponents();
    if (match[DAY_GROUP3] === "deze") {
      component.assign("day", context.refDate.getDate());
      component.assign("month", context.refDate.getMonth() + 1);
      component.assign("year", context.refDate.getFullYear());
    }
    switch (match[MOMENT_GROUP].toLowerCase()) {
      case "namiddag":
      case "'s namiddags":
        component.imply("meridiem", Meridiem.PM);
        component.imply("hour", 15);
        component.addTag("casualReference/afternoon");
        break;
      case "avond":
      case "'s avonds'":
        component.imply("meridiem", Meridiem.PM);
        component.imply("hour", 20);
        component.addTag("casualReference/evening");
        break;
      case "middernacht":
        const nextDay = new Date(targetDate.getTime());
        nextDay.setDate(nextDay.getDate() + 1);
        assignSimilarDate(component, nextDay);
        implySimilarTime(component, nextDay);
        component.imply("hour", 0);
        component.imply("minute", 0);
        component.imply("second", 0);
        component.addTag("casualReference/midnight");
        break;
      case "ochtend":
      case "'s ochtends":
        component.imply("meridiem", Meridiem.AM);
        component.imply("hour", 6);
        component.addTag("casualReference/morning");
        break;
      case "middag":
      case "'s middags":
        component.imply("meridiem", Meridiem.AM);
        component.imply("hour", 12);
        component.addTag("casualReference/noon");
        break;
    }
    return component;
  }
};

// node_modules/chrono-node/dist/esm/locales/nl/constants.js
var WEEKDAY_DICTIONARY5 = {
  zondag: 0,
  zon: 0,
  "zon.": 0,
  zo: 0,
  "zo.": 0,
  maandag: 1,
  ma: 1,
  "ma.": 1,
  dinsdag: 2,
  din: 2,
  "din.": 2,
  di: 2,
  "di.": 2,
  woensdag: 3,
  woe: 3,
  "woe.": 3,
  wo: 3,
  "wo.": 3,
  donderdag: 4,
  dond: 4,
  "dond.": 4,
  do: 4,
  "do.": 4,
  vrijdag: 5,
  vrij: 5,
  "vrij.": 5,
  vr: 5,
  "vr.": 5,
  zaterdag: 6,
  zat: 6,
  "zat.": 6,
  "za": 6,
  "za.": 6
};
var MONTH_DICTIONARY5 = {
  januari: 1,
  jan: 1,
  "jan.": 1,
  februari: 2,
  feb: 2,
  "feb.": 2,
  maart: 3,
  mar: 3,
  "mar.": 3,
  mrt: 3,
  "mrt.": 3,
  april: 4,
  apr: 4,
  "apr.": 4,
  mei: 5,
  juni: 6,
  jun: 6,
  "jun.": 6,
  juli: 7,
  jul: 7,
  "jul.": 7,
  augustus: 8,
  aug: 8,
  "aug.": 8,
  september: 9,
  sep: 9,
  "sep.": 9,
  sept: 9,
  "sept.": 9,
  oktober: 10,
  okt: 10,
  "okt.": 10,
  november: 11,
  nov: 11,
  "nov.": 11,
  december: 12,
  dec: 12,
  "dec.": 12
};
var INTEGER_WORD_DICTIONARY4 = {
  een: 1,
  twee: 2,
  drie: 3,
  vier: 4,
  vijf: 5,
  zes: 6,
  zeven: 7,
  acht: 8,
  negen: 9,
  tien: 10,
  elf: 11,
  twaalf: 12
};
var ORDINAL_WORD_DICTIONARY2 = {
  eerste: 1,
  tweede: 2,
  derde: 3,
  vierde: 4,
  vijfde: 5,
  zesde: 6,
  zevende: 7,
  achtste: 8,
  negende: 9,
  tiende: 10,
  elfde: 11,
  twaalfde: 12,
  dertiende: 13,
  veertiende: 14,
  vijftiende: 15,
  zestiende: 16,
  zeventiende: 17,
  achttiende: 18,
  negentiende: 19,
  twintigste: 20,
  "eenentwintigste": 21,
  "twee\xEBntwintigste": 22,
  "drieentwintigste": 23,
  "vierentwintigste": 24,
  "vijfentwintigste": 25,
  "zesentwintigste": 26,
  "zevenentwintigste": 27,
  "achtentwintig": 28,
  "negenentwintig": 29,
  "dertigste": 30,
  "eenendertigste": 31
};
var TIME_UNIT_DICTIONARY4 = {
  sec: "second",
  second: "second",
  seconden: "second",
  min: "minute",
  mins: "minute",
  minute: "minute",
  minuut: "minute",
  minuten: "minute",
  minuutje: "minute",
  h: "hour",
  hr: "hour",
  hrs: "hour",
  uur: "hour",
  u: "hour",
  uren: "hour",
  dag: "day",
  dagen: "day",
  week: "week",
  weken: "week",
  maand: "month",
  maanden: "month",
  jaar: "year",
  jr: "year",
  jaren: "year"
};
var NUMBER_PATTERN4 = `(?:${matchAnyPattern(INTEGER_WORD_DICTIONARY4)}|[0-9]+|[0-9]+[\\.,][0-9]+|halve?|half|paar)`;
function parseNumberPattern4(match) {
  const num = match.toLowerCase();
  if (INTEGER_WORD_DICTIONARY4[num] !== void 0) {
    return INTEGER_WORD_DICTIONARY4[num];
  } else if (num === "paar") {
    return 2;
  } else if (num === "half" || num.match(/halve?/)) {
    return 0.5;
  }
  return parseFloat(num.replace(",", "."));
}
var ORDINAL_NUMBER_PATTERN3 = `(?:${matchAnyPattern(ORDINAL_WORD_DICTIONARY2)}|[0-9]{1,2}(?:ste|de)?)`;
function parseOrdinalNumberPattern3(match) {
  let num = match.toLowerCase();
  if (ORDINAL_WORD_DICTIONARY2[num] !== void 0) {
    return ORDINAL_WORD_DICTIONARY2[num];
  }
  num = num.replace(/(?:ste|de)$/i, "");
  return parseInt(num);
}
var YEAR_PATTERN6 = `(?:[1-9][0-9]{0,3}\\s*(?:voor Christus|na Christus)|[1-2][0-9]{3}|[5-9][0-9])`;
function parseYear5(match) {
  if (/voor Christus/i.test(match)) {
    match = match.replace(/voor Christus/i, "");
    return -parseInt(match);
  }
  if (/na Christus/i.test(match)) {
    match = match.replace(/na Christus/i, "");
    return parseInt(match);
  }
  const rawYearNumber = parseInt(match);
  return findMostLikelyADYear(rawYearNumber);
}
var SINGLE_TIME_UNIT_PATTERN4 = `(${NUMBER_PATTERN4})\\s{0,5}(${matchAnyPattern(TIME_UNIT_DICTIONARY4)})\\s{0,5}`;
var SINGLE_TIME_UNIT_REGEX4 = new RegExp(SINGLE_TIME_UNIT_PATTERN4, "i");
var TIME_UNITS_PATTERN4 = repeatedTimeunitPattern(`(?:(?:binnen|in)\\s*)?`, SINGLE_TIME_UNIT_PATTERN4);
function parseDuration4(timeunitText) {
  const fragments = {};
  let remainingText = timeunitText;
  let match = SINGLE_TIME_UNIT_REGEX4.exec(remainingText);
  while (match) {
    collectDateTimeFragment4(fragments, match);
    remainingText = remainingText.substring(match[0].length);
    match = SINGLE_TIME_UNIT_REGEX4.exec(remainingText);
  }
  return fragments;
}
function collectDateTimeFragment4(fragments, match) {
  const num = parseNumberPattern4(match[1]);
  const unit = TIME_UNIT_DICTIONARY4[match[2].toLowerCase()];
  fragments[unit] = num;
}

// node_modules/chrono-node/dist/esm/locales/nl/parsers/NLTimeUnitWithinFormatParser.js
var NLTimeUnitWithinFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return new RegExp(`(?:binnen|in|binnen de|voor)\\s*(` + TIME_UNITS_PATTERN4 + `)(?=\\W|$)`, "i");
  }
  innerExtract(context, match) {
    const timeUnits = parseDuration4(match[1]);
    return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
  }
};

// node_modules/chrono-node/dist/esm/locales/nl/parsers/NLWeekdayParser.js
var PATTERN28 = new RegExp(`(?:(?:\\,|\\(|\\\uFF08)\\s*)?(?:op\\s*?)?(?:(deze|vorige|volgende)\\s*(?:week\\s*)?)?(${matchAnyPattern(WEEKDAY_DICTIONARY5)})(?=\\W|$)`, "i");
var PREFIX_GROUP5 = 1;
var WEEKDAY_GROUP5 = 2;
var POSTFIX_GROUP4 = 3;
var NLWeekdayParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN28;
  }
  innerExtract(context, match) {
    const dayOfWeek = match[WEEKDAY_GROUP5].toLowerCase();
    const weekday = WEEKDAY_DICTIONARY5[dayOfWeek];
    const prefix = match[PREFIX_GROUP5];
    const postfix = match[POSTFIX_GROUP4];
    let modifierWord = prefix || postfix;
    modifierWord = modifierWord || "";
    modifierWord = modifierWord.toLowerCase();
    let modifier = null;
    if (modifierWord == "vorige") {
      modifier = "last";
    } else if (modifierWord == "volgende") {
      modifier = "next";
    } else if (modifierWord == "deze") {
      modifier = "this";
    }
    return createParsingComponentsAtWeekday(context.reference, weekday, modifier);
  }
};

// node_modules/chrono-node/dist/esm/locales/nl/parsers/NLMonthNameMiddleEndianParser.js
var PATTERN29 = new RegExp(`(?:on\\s*?)?(${ORDINAL_NUMBER_PATTERN3})(?:\\s*(?:tot|\\-|\\\u2013|until|through|till|\\s)\\s*(${ORDINAL_NUMBER_PATTERN3}))?(?:-|/|\\s*(?:of)?\\s*)(` + matchAnyPattern(MONTH_DICTIONARY5) + `)(?:(?:-|/|,?\\s*)(${YEAR_PATTERN6}(?![^\\s]\\d)))?(?=\\W|$)`, "i");
var MONTH_NAME_GROUP9 = 3;
var DATE_GROUP7 = 1;
var DATE_TO_GROUP6 = 2;
var YEAR_GROUP12 = 4;
var NLMonthNameMiddleEndianParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN29;
  }
  innerExtract(context, match) {
    const month = MONTH_DICTIONARY5[match[MONTH_NAME_GROUP9].toLowerCase()];
    const day = parseOrdinalNumberPattern3(match[DATE_GROUP7]);
    if (day > 31) {
      match.index = match.index + match[DATE_GROUP7].length;
      return null;
    }
    const components = context.createParsingComponents({
      day,
      month
    });
    if (match[YEAR_GROUP12]) {
      const year3 = parseYear5(match[YEAR_GROUP12]);
      components.assign("year", year3);
    } else {
      const year3 = findYearClosestToRef(context.refDate, day, month);
      components.imply("year", year3);
    }
    if (!match[DATE_TO_GROUP6]) {
      return components;
    }
    const endDate = parseOrdinalNumberPattern3(match[DATE_TO_GROUP6]);
    const result = context.createParsingResult(match.index, match[0]);
    result.start = components;
    result.end = components.clone();
    result.end.assign("day", endDate);
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/nl/parsers/NLMonthNameParser.js
var PATTERN30 = new RegExp(`(${matchAnyPattern(MONTH_DICTIONARY5)})\\s*(?:[,-]?\\s*(${YEAR_PATTERN6})?)?(?=[^\\s\\w]|\\s+[^0-9]|\\s+$|$)`, "i");
var MONTH_NAME_GROUP10 = 1;
var YEAR_GROUP13 = 2;
var NLMonthNameParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN30;
  }
  innerExtract(context, match) {
    const components = context.createParsingComponents();
    components.imply("day", 1);
    const monthName = match[MONTH_NAME_GROUP10];
    const month = MONTH_DICTIONARY5[monthName.toLowerCase()];
    components.assign("month", month);
    if (match[YEAR_GROUP13]) {
      const year3 = parseYear5(match[YEAR_GROUP13]);
      components.assign("year", year3);
    } else {
      const year3 = findYearClosestToRef(context.refDate, 1, month);
      components.imply("year", year3);
    }
    return components;
  }
};

// node_modules/chrono-node/dist/esm/locales/nl/parsers/NLSlashMonthFormatParser.js
var PATTERN31 = new RegExp("([0-9]|0[1-9]|1[012])/([0-9]{4})", "i");
var MONTH_GROUP4 = 1;
var YEAR_GROUP14 = 2;
var NLSlashMonthFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN31;
  }
  innerExtract(context, match) {
    const year3 = parseInt(match[YEAR_GROUP14]);
    const month = parseInt(match[MONTH_GROUP4]);
    return context.createParsingComponents().imply("day", 1).assign("month", month).assign("year", year3);
  }
};

// node_modules/chrono-node/dist/esm/locales/nl/parsers/NLTimeExpressionParser.js
var NLTimeExpressionParser = class extends AbstractTimeExpressionParser {
  primaryPrefix() {
    return "(?:(?:om)\\s*)?";
  }
  followingPhase() {
    return "\\s*(?:\\-|\\\u2013|\\~|\\\u301C|om|\\?)\\s*";
  }
  primarySuffix() {
    return "(?:\\s*(?:uur))?(?!/)(?=\\W|$)";
  }
  extractPrimaryTimeComponents(context, match) {
    if (match[0].match(/^\s*\d{4}\s*$/)) {
      return null;
    }
    return super.extractPrimaryTimeComponents(context, match);
  }
};

// node_modules/chrono-node/dist/esm/locales/nl/parsers/NLCasualYearMonthDayParser.js
var PATTERN32 = new RegExp(`([0-9]{4})[\\.\\/\\s](?:(${matchAnyPattern(MONTH_DICTIONARY5)})|([0-9]{1,2}))[\\.\\/\\s]([0-9]{1,2})(?=\\W|$)`, "i");
var YEAR_NUMBER_GROUP4 = 1;
var MONTH_NAME_GROUP11 = 2;
var MONTH_NUMBER_GROUP3 = 3;
var DATE_NUMBER_GROUP3 = 4;
var NLCasualYearMonthDayParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN32;
  }
  innerExtract(context, match) {
    const month = match[MONTH_NUMBER_GROUP3] ? parseInt(match[MONTH_NUMBER_GROUP3]) : MONTH_DICTIONARY5[match[MONTH_NAME_GROUP11].toLowerCase()];
    if (month < 1 || month > 12) {
      return null;
    }
    const year3 = parseInt(match[YEAR_NUMBER_GROUP4]);
    const day = parseInt(match[DATE_NUMBER_GROUP3]);
    return {
      day,
      month,
      year: year3
    };
  }
};

// node_modules/chrono-node/dist/esm/locales/nl/parsers/NLCasualDateTimeParser.js
var DATE_GROUP8 = 1;
var TIME_OF_DAY_GROUP = 2;
var NLCasualDateTimeParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern(context) {
    return /(gisteren|morgen|van)(ochtend|middag|namiddag|avond|nacht)(?=\W|$)/i;
  }
  innerExtract(context, match) {
    const dateText = match[DATE_GROUP8].toLowerCase();
    const timeText = match[TIME_OF_DAY_GROUP].toLowerCase();
    const component = context.createParsingComponents();
    const targetDate = context.refDate;
    switch (dateText) {
      case "gisteren":
        const previousDay = new Date(targetDate.getTime());
        previousDay.setDate(previousDay.getDate() - 1);
        assignSimilarDate(component, previousDay);
        break;
      case "van":
        assignSimilarDate(component, targetDate);
        break;
      case "morgen":
        const nextDay = new Date(targetDate.getTime());
        nextDay.setDate(nextDay.getDate() + 1);
        assignSimilarDate(component, nextDay);
        implySimilarTime(component, nextDay);
        break;
    }
    switch (timeText) {
      case "ochtend":
        component.imply("meridiem", Meridiem.AM);
        component.imply("hour", 6);
        break;
      case "middag":
        component.imply("meridiem", Meridiem.AM);
        component.imply("hour", 12);
        break;
      case "namiddag":
        component.imply("meridiem", Meridiem.PM);
        component.imply("hour", 15);
        break;
      case "avond":
        component.imply("meridiem", Meridiem.PM);
        component.imply("hour", 20);
        break;
    }
    return component;
  }
};

// node_modules/chrono-node/dist/esm/locales/nl/parsers/NLTimeUnitCasualRelativeFormatParser.js
var PATTERN33 = new RegExp(`(dit|deze|vorig|afgelopen|(?:aan)?komend|over|\\+|-)e?\\s*(${TIME_UNITS_PATTERN4})(?=\\W|$)`, "i");
var PREFIX_WORD_GROUP = 1;
var TIME_UNIT_WORD_GROUP = 2;
var NLTimeUnitCasualRelativeFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN33;
  }
  innerExtract(context, match) {
    const prefix = match[PREFIX_WORD_GROUP].toLowerCase();
    let timeUnits = parseDuration4(match[TIME_UNIT_WORD_GROUP]);
    switch (prefix) {
      case "vorig":
      case "afgelopen":
      case "-":
        timeUnits = reverseDuration(timeUnits);
        break;
    }
    return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
  }
};

// node_modules/chrono-node/dist/esm/locales/nl/parsers/NLRelativeDateFormatParser.js
var PATTERN34 = new RegExp(`(dit|deze|(?:aan)?komend|volgend|afgelopen|vorig)e?\\s*(${matchAnyPattern(TIME_UNIT_DICTIONARY4)})(?=\\s*)(?=\\W|$)`, "i");
var MODIFIER_WORD_GROUP2 = 1;
var RELATIVE_WORD_GROUP2 = 2;
var NLRelativeDateFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN34;
  }
  innerExtract(context, match) {
    const modifier = match[MODIFIER_WORD_GROUP2].toLowerCase();
    const unitWord = match[RELATIVE_WORD_GROUP2].toLowerCase();
    const timeunit = TIME_UNIT_DICTIONARY4[unitWord];
    if (modifier == "volgend" || modifier == "komend" || modifier == "aankomend") {
      const timeUnits = {};
      timeUnits[timeunit] = 1;
      return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
    }
    if (modifier == "afgelopen" || modifier == "vorig") {
      const timeUnits = {};
      timeUnits[timeunit] = -1;
      return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
    }
    const components = context.createParsingComponents();
    let date = new Date(context.reference.instant.getTime());
    if (unitWord.match(/week/i)) {
      date.setDate(date.getDate() - date.getDay());
      components.imply("day", date.getDate());
      components.imply("month", date.getMonth() + 1);
      components.imply("year", date.getFullYear());
    } else if (unitWord.match(/maand/i)) {
      date.setDate(1);
      components.imply("day", date.getDate());
      components.assign("year", date.getFullYear());
      components.assign("month", date.getMonth() + 1);
    } else if (unitWord.match(/jaar/i)) {
      date.setDate(1);
      date.setMonth(0);
      components.imply("day", date.getDate());
      components.imply("month", date.getMonth() + 1);
      components.assign("year", date.getFullYear());
    }
    return components;
  }
};

// node_modules/chrono-node/dist/esm/locales/nl/parsers/NLTimeUnitAgoFormatParser.js
var PATTERN35 = new RegExp("(" + TIME_UNITS_PATTERN4 + ")(?:geleden|voor|eerder)(?=(?:\\W|$))", "i");
var STRICT_PATTERN3 = new RegExp("(" + TIME_UNITS_PATTERN4 + ")geleden(?=(?:\\W|$))", "i");
var NLTimeUnitAgoFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  strictMode;
  constructor(strictMode) {
    super();
    this.strictMode = strictMode;
  }
  innerPattern() {
    return this.strictMode ? STRICT_PATTERN3 : PATTERN35;
  }
  innerExtract(context, match) {
    const timeUnits = parseDuration4(match[1]);
    const outputTimeUnits = reverseDuration(timeUnits);
    return ParsingComponents.createRelativeFromReference(context.reference, outputTimeUnits);
  }
};

// node_modules/chrono-node/dist/esm/locales/nl/parsers/NLTimeUnitLaterFormatParser.js
var PATTERN36 = new RegExp("(" + TIME_UNITS_PATTERN4 + ")(later|na|vanaf nu|voortaan|vooruit|uit)(?=(?:\\W|$))", "i");
var STRICT_PATTERN4 = new RegExp("(" + TIME_UNITS_PATTERN4 + ")(later|vanaf nu)(?=(?:\\W|$))", "i");
var GROUP_NUM_TIMEUNITS2 = 1;
var NLTimeUnitLaterFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  strictMode;
  constructor(strictMode) {
    super();
    this.strictMode = strictMode;
  }
  innerPattern() {
    return this.strictMode ? STRICT_PATTERN4 : PATTERN36;
  }
  innerExtract(context, match) {
    const fragments = parseDuration4(match[GROUP_NUM_TIMEUNITS2]);
    return ParsingComponents.createRelativeFromReference(context.reference, fragments);
  }
};

// node_modules/chrono-node/dist/esm/locales/nl/index.js
var casual6 = new Chrono(createCasualConfiguration5());
var strict6 = new Chrono(createConfiguration5(true));
function parse6(text, ref, option) {
  return casual6.parse(text, ref, option);
}
function parseDate6(text, ref, option) {
  return casual6.parseDate(text, ref, option);
}
function createCasualConfiguration5(littleEndian = true) {
  const option = createConfiguration5(false, littleEndian);
  option.parsers.unshift(new NLCasualDateParser());
  option.parsers.unshift(new NLCasualTimeParser());
  option.parsers.unshift(new NLCasualDateTimeParser());
  option.parsers.unshift(new NLMonthNameParser());
  option.parsers.unshift(new NLRelativeDateFormatParser());
  option.parsers.unshift(new NLTimeUnitCasualRelativeFormatParser());
  return option;
}
function createConfiguration5(strictMode = true, littleEndian = true) {
  return includeCommonConfiguration({
    parsers: [
      new SlashDateFormatParser(littleEndian),
      new NLTimeUnitWithinFormatParser(),
      new NLMonthNameMiddleEndianParser(),
      new NLMonthNameParser(),
      new NLWeekdayParser(),
      new NLCasualYearMonthDayParser(),
      new NLSlashMonthFormatParser(),
      new NLTimeExpressionParser(strictMode),
      new NLTimeUnitAgoFormatParser(strictMode),
      new NLTimeUnitLaterFormatParser(strictMode)
    ],
    refiners: [new NLMergeDateTimeRefiner(), new NLMergeDateRangeRefiner()]
  }, strictMode);
}

// node_modules/chrono-node/dist/esm/locales/zh/index.js
var zh_exports = {};
__export(zh_exports, {
  Chrono: () => Chrono,
  Meridiem: () => Meridiem,
  ParsingComponents: () => ParsingComponents,
  ParsingResult: () => ParsingResult,
  ReferenceWithTimezone: () => ReferenceWithTimezone,
  Weekday: () => Weekday,
  casual: () => casual9,
  createCasualConfiguration: () => createCasualConfiguration8,
  createConfiguration: () => createConfiguration8,
  hans: () => hans_exports,
  hant: () => hant_exports,
  parse: () => parse9,
  parseDate: () => parseDate9,
  strict: () => strict9
});

// node_modules/chrono-node/dist/esm/locales/zh/hans/constants.js
var NUMBER2 = {
  "\u96F6": 0,
  "\u3007": 0,
  "\u4E00": 1,
  "\u4E8C": 2,
  "\u4E24": 2,
  "\u4E09": 3,
  "\u56DB": 4,
  "\u4E94": 5,
  "\u516D": 6,
  "\u4E03": 7,
  "\u516B": 8,
  "\u4E5D": 9,
  "\u5341": 10
};
var WEEKDAY_OFFSET2 = {
  "\u5929": 0,
  "\u65E5": 0,
  "\u4E00": 1,
  "\u4E8C": 2,
  "\u4E09": 3,
  "\u56DB": 4,
  "\u4E94": 5,
  "\u516D": 6
};
function zhStringToNumber(text) {
  let number = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "\u5341") {
      number = number === 0 ? NUMBER2[char] : number * NUMBER2[char];
    } else {
      number += NUMBER2[char];
    }
  }
  return number;
}
function zhStringToYear(text) {
  let string = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    string = string + NUMBER2[char];
  }
  return parseInt(string);
}

// node_modules/chrono-node/dist/esm/locales/zh/hans/parsers/ZHHansDateParser.js
var YEAR_GROUP15 = 1;
var MONTH_GROUP5 = 2;
var DAY_GROUP4 = 3;
var ZHHansDateParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return new RegExp("(\\d{2,4}|[" + Object.keys(NUMBER2).join("") + "]{4}|[" + Object.keys(NUMBER2).join("") + "]{2})?(?:\\s*)(?:\u5E74)?(?:[\\s|,|\uFF0C]*)(\\d{1,2}|[" + Object.keys(NUMBER2).join("") + "]{1,3})(?:\\s*)(?:\u6708)(?:\\s*)(\\d{1,2}|[" + Object.keys(NUMBER2).join("") + "]{1,3})?(?:\\s*)(?:\u65E5|\u53F7)?");
  }
  innerExtract(context, match) {
    const result = context.createParsingResult(match.index, match[0]);
    let month = parseInt(match[MONTH_GROUP5]);
    if (isNaN(month))
      month = zhStringToNumber(match[MONTH_GROUP5]);
    result.start.assign("month", month);
    if (match[DAY_GROUP4]) {
      let day = parseInt(match[DAY_GROUP4]);
      if (isNaN(day))
        day = zhStringToNumber(match[DAY_GROUP4]);
      result.start.assign("day", day);
    } else {
      result.start.imply("day", context.refDate.getDate());
    }
    if (match[YEAR_GROUP15]) {
      let year3 = parseInt(match[YEAR_GROUP15]);
      if (isNaN(year3))
        year3 = zhStringToYear(match[YEAR_GROUP15]);
      result.start.assign("year", year3);
    } else {
      result.start.imply("year", context.refDate.getFullYear());
    }
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/zh/hans/parsers/ZHHansDeadlineFormatParser.js
var PATTERN37 = new RegExp("(\\d+|[" + Object.keys(NUMBER2).join("") + "]+|\u534A|\u51E0)(?:\\s*)(?:\u4E2A)?(\u79D2(?:\u949F)?|\u5206\u949F|\u5C0F\u65F6|\u949F|\u65E5|\u5929|\u661F\u671F|\u793C\u62DC|\u6708|\u5E74)(?:(?:\u4E4B|\u8FC7)?\u540E|(?:\u4E4B)?\u5185)", "i");
var NUMBER_GROUP = 1;
var UNIT_GROUP = 2;
var ZHHansDeadlineFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN37;
  }
  innerExtract(context, match) {
    const result = context.createParsingResult(match.index, match[0]);
    let number = parseInt(match[NUMBER_GROUP]);
    if (isNaN(number)) {
      number = zhStringToNumber(match[NUMBER_GROUP]);
    }
    if (isNaN(number)) {
      const string = match[NUMBER_GROUP];
      if (string === "\u51E0") {
        number = 3;
      } else if (string === "\u534A") {
        number = 0.5;
      } else {
        return null;
      }
    }
    const duration = {};
    const unit = match[UNIT_GROUP];
    const unitAbbr = unit[0];
    if (unitAbbr.match(/[日天星礼月年]/)) {
      if (unitAbbr == "\u65E5" || unitAbbr == "\u5929") {
        duration.day = number;
      } else if (unitAbbr == "\u661F" || unitAbbr == "\u793C") {
        duration.week = number;
      } else if (unitAbbr == "\u6708") {
        duration.month = number;
      } else if (unitAbbr == "\u5E74") {
        duration.year = number;
      }
      const date2 = addDuration(context.refDate, duration);
      result.start.assign("year", date2.getFullYear());
      result.start.assign("month", date2.getMonth() + 1);
      result.start.assign("day", date2.getDate());
      return result;
    }
    if (unitAbbr == "\u79D2") {
      duration.second = number;
    } else if (unitAbbr == "\u5206") {
      duration.minute = number;
    } else if (unitAbbr == "\u5C0F" || unitAbbr == "\u949F") {
      duration.hour = number;
    }
    const date = addDuration(context.refDate, duration);
    result.start.imply("year", date.getFullYear());
    result.start.imply("month", date.getMonth() + 1);
    result.start.imply("day", date.getDate());
    result.start.assign("hour", date.getHours());
    result.start.assign("minute", date.getMinutes());
    result.start.assign("second", date.getSeconds());
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/zh/hans/parsers/ZHHansRelationWeekdayParser.js
var PATTERN38 = new RegExp("(?<prefix>\u4E0A|\u4E0B|\u8FD9)(?:\u4E2A)?(?:\u661F\u671F|\u793C\u62DC|\u5468)(?<weekday>" + Object.keys(WEEKDAY_OFFSET2).join("|") + ")");
var ZHHansRelationWeekdayParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN38;
  }
  innerExtract(context, match) {
    const result = context.createParsingResult(match.index, match[0]);
    const dayOfWeek = match.groups.weekday;
    const offset = WEEKDAY_OFFSET2[dayOfWeek];
    if (offset === void 0)
      return null;
    let modifier = null;
    const prefix = match.groups.prefix;
    if (prefix == "\u4E0A") {
      modifier = "last";
    } else if (prefix == "\u4E0B") {
      modifier = "next";
    } else if (prefix == "\u8FD9") {
      modifier = "this";
    }
    const date = new Date(context.refDate.getTime());
    let startMomentFixed = false;
    const refOffset = date.getDay();
    if (modifier == "last" || modifier == "past") {
      date.setDate(date.getDate() + (offset - 7 - refOffset));
      startMomentFixed = true;
    } else if (modifier == "next") {
      date.setDate(date.getDate() + (offset + 7 - refOffset));
      startMomentFixed = true;
    } else if (modifier == "this") {
      date.setDate(date.getDate() + (offset - refOffset));
    } else {
      let diff = offset - refOffset;
      if (Math.abs(diff - 7) < Math.abs(diff)) {
        diff -= 7;
      }
      if (Math.abs(diff + 7) < Math.abs(diff)) {
        diff += 7;
      }
      date.setDate(date.getDate() + diff);
    }
    result.start.assign("weekday", offset);
    if (startMomentFixed) {
      result.start.assign("day", date.getDate());
      result.start.assign("month", date.getMonth() + 1);
      result.start.assign("year", date.getFullYear());
    } else {
      result.start.imply("day", date.getDate());
      result.start.imply("month", date.getMonth() + 1);
      result.start.imply("year", date.getFullYear());
    }
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/zh/hans/parsers/ZHHansTimeExpressionParser.js
var FIRST_REG_PATTERN4 = new RegExp("(?:\u4ECE|\u81EA)?(?:(\u4ECA|\u660E|\u524D|\u5927\u524D|\u540E|\u5927\u540E|\u6628)(\u65E9|\u671D|\u665A)|(\u4E0A(?:\u5348)|\u65E9(?:\u4E0A)|\u4E0B(?:\u5348)|\u665A(?:\u4E0A)|\u591C(?:\u665A)?|\u4E2D(?:\u5348)|\u51CC(?:\u6668))|(\u4ECA|\u660E|\u524D|\u5927\u524D|\u540E|\u5927\u540E|\u6628)(?:\u65E5|\u5929)(?:[\\s,\uFF0C]*)(?:(\u4E0A(?:\u5348)|\u65E9(?:\u4E0A)|\u4E0B(?:\u5348)|\u665A(?:\u4E0A)|\u591C(?:\u665A)?|\u4E2D(?:\u5348)|\u51CC(?:\u6668)))?)?(?:[\\s,\uFF0C]*)(?:(\\d+|[" + Object.keys(NUMBER2).join("") + "]+)(?:\\s*)(?:\u70B9|\u65F6|:|\uFF1A)(?:\\s*)(\\d+|\u534A|\u6B63|\u6574|[" + Object.keys(NUMBER2).join("") + "]+)?(?:\\s*)(?:\u5206|:|\uFF1A)?(?:\\s*)(\\d+|[" + Object.keys(NUMBER2).join("") + "]+)?(?:\\s*)(?:\u79D2)?)(?:\\s*(A.M.|P.M.|AM?|PM?))?", "i");
var SECOND_REG_PATTERN4 = new RegExp("(?:^\\s*(?:\u5230|\u81F3|\\-|\\\u2013|\\~|\\\u301C)\\s*)(?:(\u4ECA|\u660E|\u524D|\u5927\u524D|\u540E|\u5927\u540E|\u6628)(\u65E9|\u671D|\u665A)|(\u4E0A(?:\u5348)|\u65E9(?:\u4E0A)|\u4E0B(?:\u5348)|\u665A(?:\u4E0A)|\u591C(?:\u665A)?|\u4E2D(?:\u5348)|\u51CC(?:\u6668))|(\u4ECA|\u660E|\u524D|\u5927\u524D|\u540E|\u5927\u540E|\u6628)(?:\u65E5|\u5929)(?:[\\s,\uFF0C]*)(?:(\u4E0A(?:\u5348)|\u65E9(?:\u4E0A)|\u4E0B(?:\u5348)|\u665A(?:\u4E0A)|\u591C(?:\u665A)?|\u4E2D(?:\u5348)|\u51CC(?:\u6668)))?)?(?:[\\s,\uFF0C]*)(?:(\\d+|[" + Object.keys(NUMBER2).join("") + "]+)(?:\\s*)(?:\u70B9|\u65F6|:|\uFF1A)(?:\\s*)(\\d+|\u534A|\u6B63|\u6574|[" + Object.keys(NUMBER2).join("") + "]+)?(?:\\s*)(?:\u5206|:|\uFF1A)?(?:\\s*)(\\d+|[" + Object.keys(NUMBER2).join("") + "]+)?(?:\\s*)(?:\u79D2)?)(?:\\s*(A.M.|P.M.|AM?|PM?))?", "i");
var DAY_GROUP_1 = 1;
var ZH_AM_PM_HOUR_GROUP_1 = 2;
var ZH_AM_PM_HOUR_GROUP_2 = 3;
var DAY_GROUP_3 = 4;
var ZH_AM_PM_HOUR_GROUP_3 = 5;
var HOUR_GROUP5 = 6;
var MINUTE_GROUP5 = 7;
var SECOND_GROUP5 = 8;
var AM_PM_HOUR_GROUP4 = 9;
var ZHHansTimeExpressionParser = class extends AbstractParserWithWordBoundaryChecking {
  patternLeftBoundary() {
    return "()";
  }
  innerPattern() {
    return FIRST_REG_PATTERN4;
  }
  innerExtract(context, match) {
    if (match.index > 0 && context.text[match.index - 1].match(/\w/)) {
      return null;
    }
    const result = context.createParsingResult(match.index, match[0]);
    const startMoment = new Date(context.reference.instant.getTime());
    if (match[DAY_GROUP_1]) {
      const day1 = match[DAY_GROUP_1];
      if (day1 == "\u660E") {
        if (context.reference.instant.getHours() > 1) {
          startMoment.setDate(startMoment.getDate() + 1);
        }
      } else if (day1 == "\u6628") {
        startMoment.setDate(startMoment.getDate() - 1);
      } else if (day1 == "\u524D") {
        startMoment.setDate(startMoment.getDate() - 2);
      } else if (day1 == "\u5927\u524D") {
        startMoment.setDate(startMoment.getDate() - 3);
      } else if (day1 == "\u540E") {
        startMoment.setDate(startMoment.getDate() + 2);
      } else if (day1 == "\u5927\u540E") {
        startMoment.setDate(startMoment.getDate() + 3);
      }
      result.start.assign("day", startMoment.getDate());
      result.start.assign("month", startMoment.getMonth() + 1);
      result.start.assign("year", startMoment.getFullYear());
    } else if (match[DAY_GROUP_3]) {
      const day3 = match[DAY_GROUP_3];
      if (day3 == "\u660E") {
        startMoment.setDate(startMoment.getDate() + 1);
      } else if (day3 == "\u6628") {
        startMoment.setDate(startMoment.getDate() - 1);
      } else if (day3 == "\u524D") {
        startMoment.setDate(startMoment.getDate() - 2);
      } else if (day3 == "\u5927\u524D") {
        startMoment.setDate(startMoment.getDate() - 3);
      } else if (day3 == "\u540E") {
        startMoment.setDate(startMoment.getDate() + 2);
      } else if (day3 == "\u5927\u540E") {
        startMoment.setDate(startMoment.getDate() + 3);
      }
      result.start.assign("day", startMoment.getDate());
      result.start.assign("month", startMoment.getMonth() + 1);
      result.start.assign("year", startMoment.getFullYear());
    } else {
      result.start.imply("day", startMoment.getDate());
      result.start.imply("month", startMoment.getMonth() + 1);
      result.start.imply("year", startMoment.getFullYear());
    }
    let hour = 0;
    let minute = 0;
    let meridiem = -1;
    if (match[SECOND_GROUP5]) {
      let second = parseInt(match[SECOND_GROUP5]);
      if (isNaN(second)) {
        second = zhStringToNumber(match[SECOND_GROUP5]);
      }
      if (second >= 60)
        return null;
      result.start.assign("second", second);
    }
    hour = parseInt(match[HOUR_GROUP5]);
    if (isNaN(hour)) {
      hour = zhStringToNumber(match[HOUR_GROUP5]);
    }
    if (match[MINUTE_GROUP5]) {
      if (match[MINUTE_GROUP5] == "\u534A") {
        minute = 30;
      } else if (match[MINUTE_GROUP5] == "\u6B63" || match[MINUTE_GROUP5] == "\u6574") {
        minute = 0;
      } else {
        minute = parseInt(match[MINUTE_GROUP5]);
        if (isNaN(minute)) {
          minute = zhStringToNumber(match[MINUTE_GROUP5]);
        }
      }
    } else if (hour > 100) {
      minute = hour % 100;
      hour = Math.floor(hour / 100);
    }
    if (minute >= 60) {
      return null;
    }
    if (hour > 24) {
      return null;
    }
    if (hour >= 12) {
      meridiem = 1;
    }
    if (match[AM_PM_HOUR_GROUP4]) {
      if (hour > 12)
        return null;
      const ampm = match[AM_PM_HOUR_GROUP4][0].toLowerCase();
      if (ampm == "a") {
        meridiem = 0;
        if (hour == 12)
          hour = 0;
      }
      if (ampm == "p") {
        meridiem = 1;
        if (hour != 12)
          hour += 12;
      }
    } else if (match[ZH_AM_PM_HOUR_GROUP_1]) {
      const zhAMPMString1 = match[ZH_AM_PM_HOUR_GROUP_1];
      const zhAMPM1 = zhAMPMString1[0];
      if (zhAMPM1 == "\u65E9") {
        meridiem = 0;
        if (hour == 12)
          hour = 0;
      } else if (zhAMPM1 == "\u665A") {
        meridiem = 1;
        if (hour != 12)
          hour += 12;
      }
    } else if (match[ZH_AM_PM_HOUR_GROUP_2]) {
      const zhAMPMString2 = match[ZH_AM_PM_HOUR_GROUP_2];
      const zhAMPM2 = zhAMPMString2[0];
      if (zhAMPM2 == "\u4E0A" || zhAMPM2 == "\u65E9" || zhAMPM2 == "\u51CC") {
        meridiem = 0;
        if (hour == 12)
          hour = 0;
      } else if (zhAMPM2 == "\u4E0B" || zhAMPM2 == "\u665A") {
        meridiem = 1;
        if (hour != 12)
          hour += 12;
      }
    } else if (match[ZH_AM_PM_HOUR_GROUP_3]) {
      const zhAMPMString3 = match[ZH_AM_PM_HOUR_GROUP_3];
      const zhAMPM3 = zhAMPMString3[0];
      if (zhAMPM3 == "\u4E0A" || zhAMPM3 == "\u65E9" || zhAMPM3 == "\u51CC") {
        meridiem = 0;
        if (hour == 12)
          hour = 0;
      } else if (zhAMPM3 == "\u4E0B" || zhAMPM3 == "\u665A") {
        meridiem = 1;
        if (hour != 12)
          hour += 12;
      }
    }
    result.start.assign("hour", hour);
    result.start.assign("minute", minute);
    if (meridiem >= 0) {
      result.start.assign("meridiem", meridiem);
    } else {
      if (hour < 12) {
        result.start.imply("meridiem", 0);
      } else {
        result.start.imply("meridiem", 1);
      }
    }
    const secondMatch = SECOND_REG_PATTERN4.exec(context.text.substring(result.index + result.text.length));
    if (!secondMatch) {
      if (result.text.match(/^\d+$/)) {
        return null;
      }
      return result;
    }
    let endMoment = new Date(startMoment.getTime());
    if (secondMatch[DAY_GROUP_1] || secondMatch[DAY_GROUP_3]) {
      endMoment = new Date(context.reference.instant.getTime());
    }
    result.end = context.createParsingComponents();
    if (secondMatch[DAY_GROUP_1]) {
      const day1 = secondMatch[DAY_GROUP_1];
      if (day1 == "\u660E") {
        if (context.reference.instant.getHours() > 1) {
          endMoment.setDate(endMoment.getDate() + 1);
        }
      } else if (day1 == "\u6628") {
        endMoment.setDate(endMoment.getDate() - 1);
      } else if (day1 == "\u524D") {
        endMoment.setDate(endMoment.getDate() - 2);
      } else if (day1 == "\u5927\u524D") {
        endMoment.setDate(endMoment.getDate() - 3);
      } else if (day1 == "\u540E") {
        endMoment.setDate(endMoment.getDate() + 2);
      } else if (day1 == "\u5927\u540E") {
        endMoment.setDate(endMoment.getDate() + 3);
      }
      result.end.assign("day", endMoment.getDate());
      result.end.assign("month", endMoment.getMonth() + 1);
      result.end.assign("year", endMoment.getFullYear());
    } else if (secondMatch[DAY_GROUP_3]) {
      const day3 = secondMatch[DAY_GROUP_3];
      if (day3 == "\u660E") {
        endMoment.setDate(endMoment.getDate() + 1);
      } else if (day3 == "\u6628") {
        endMoment.setDate(endMoment.getDate() - 1);
      } else if (day3 == "\u524D") {
        endMoment.setDate(endMoment.getDate() - 2);
      } else if (day3 == "\u5927\u524D") {
        endMoment.setDate(endMoment.getDate() - 3);
      } else if (day3 == "\u540E") {
        endMoment.setDate(endMoment.getDate() + 2);
      } else if (day3 == "\u5927\u540E") {
        endMoment.setDate(endMoment.getDate() + 3);
      }
      result.end.assign("day", endMoment.getDate());
      result.end.assign("month", endMoment.getMonth() + 1);
      result.end.assign("year", endMoment.getFullYear());
    } else {
      result.end.imply("day", endMoment.getDate());
      result.end.imply("month", endMoment.getMonth() + 1);
      result.end.imply("year", endMoment.getFullYear());
    }
    hour = 0;
    minute = 0;
    meridiem = -1;
    if (secondMatch[SECOND_GROUP5]) {
      let second = parseInt(secondMatch[SECOND_GROUP5]);
      if (isNaN(second)) {
        second = zhStringToNumber(secondMatch[SECOND_GROUP5]);
      }
      if (second >= 60)
        return null;
      result.end.assign("second", second);
    }
    hour = parseInt(secondMatch[HOUR_GROUP5]);
    if (isNaN(hour)) {
      hour = zhStringToNumber(secondMatch[HOUR_GROUP5]);
    }
    if (secondMatch[MINUTE_GROUP5]) {
      if (secondMatch[MINUTE_GROUP5] == "\u534A") {
        minute = 30;
      } else if (secondMatch[MINUTE_GROUP5] == "\u6B63" || secondMatch[MINUTE_GROUP5] == "\u6574") {
        minute = 0;
      } else {
        minute = parseInt(secondMatch[MINUTE_GROUP5]);
        if (isNaN(minute)) {
          minute = zhStringToNumber(secondMatch[MINUTE_GROUP5]);
        }
      }
    } else if (hour > 100) {
      minute = hour % 100;
      hour = Math.floor(hour / 100);
    }
    if (minute >= 60) {
      return null;
    }
    if (hour > 24) {
      return null;
    }
    if (hour >= 12) {
      meridiem = 1;
    }
    if (secondMatch[AM_PM_HOUR_GROUP4]) {
      if (hour > 12)
        return null;
      const ampm = secondMatch[AM_PM_HOUR_GROUP4][0].toLowerCase();
      if (ampm == "a") {
        meridiem = 0;
        if (hour == 12)
          hour = 0;
      }
      if (ampm == "p") {
        meridiem = 1;
        if (hour != 12)
          hour += 12;
      }
      if (!result.start.isCertain("meridiem")) {
        if (meridiem == 0) {
          result.start.imply("meridiem", 0);
          if (result.start.get("hour") == 12) {
            result.start.assign("hour", 0);
          }
        } else {
          result.start.imply("meridiem", 1);
          if (result.start.get("hour") != 12) {
            result.start.assign("hour", result.start.get("hour") + 12);
          }
        }
      }
    } else if (secondMatch[ZH_AM_PM_HOUR_GROUP_1]) {
      const zhAMPMString1 = secondMatch[ZH_AM_PM_HOUR_GROUP_1];
      const zhAMPM1 = zhAMPMString1[0];
      if (zhAMPM1 == "\u65E9") {
        meridiem = 0;
        if (hour == 12)
          hour = 0;
      } else if (zhAMPM1 == "\u665A") {
        meridiem = 1;
        if (hour != 12)
          hour += 12;
      }
    } else if (secondMatch[ZH_AM_PM_HOUR_GROUP_2]) {
      const zhAMPMString2 = secondMatch[ZH_AM_PM_HOUR_GROUP_2];
      const zhAMPM2 = zhAMPMString2[0];
      if (zhAMPM2 == "\u4E0A" || zhAMPM2 == "\u65E9" || zhAMPM2 == "\u51CC") {
        meridiem = 0;
        if (hour == 12)
          hour = 0;
      } else if (zhAMPM2 == "\u4E0B" || zhAMPM2 == "\u665A") {
        meridiem = 1;
        if (hour != 12)
          hour += 12;
      }
    } else if (secondMatch[ZH_AM_PM_HOUR_GROUP_3]) {
      const zhAMPMString3 = secondMatch[ZH_AM_PM_HOUR_GROUP_3];
      const zhAMPM3 = zhAMPMString3[0];
      if (zhAMPM3 == "\u4E0A" || zhAMPM3 == "\u65E9" || zhAMPM3 == "\u51CC") {
        meridiem = 0;
        if (hour == 12)
          hour = 0;
      } else if (zhAMPM3 == "\u4E0B" || zhAMPM3 == "\u665A") {
        meridiem = 1;
        if (hour != 12)
          hour += 12;
      }
    }
    result.text = result.text + secondMatch[0];
    result.end.assign("hour", hour);
    result.end.assign("minute", minute);
    if (meridiem >= 0) {
      result.end.assign("meridiem", meridiem);
    } else {
      const startAtPM = result.start.isCertain("meridiem") && result.start.get("meridiem") == 1;
      if (startAtPM && result.start.get("hour") > hour) {
        result.end.imply("meridiem", 0);
      } else if (hour > 12) {
        result.end.imply("meridiem", 1);
      }
    }
    if (result.end.date().getTime() < result.start.date().getTime()) {
      result.end.imply("day", result.end.get("day") + 1);
    }
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/zh/hans/parsers/ZHHansWeekdayParser.js
var PATTERN39 = new RegExp("(?:\u661F\u671F|\u793C\u62DC|\u5468)(?<weekday>" + Object.keys(WEEKDAY_OFFSET2).join("|") + ")");
var ZHHansWeekdayParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN39;
  }
  innerExtract(context, match) {
    const result = context.createParsingResult(match.index, match[0]);
    const dayOfWeek = match.groups.weekday;
    const offset = WEEKDAY_OFFSET2[dayOfWeek];
    if (offset === void 0)
      return null;
    const date = new Date(context.refDate.getTime());
    const startMomentFixed = false;
    const refOffset = date.getDay();
    let diff = offset - refOffset;
    if (Math.abs(diff - 7) < Math.abs(diff)) {
      diff -= 7;
    }
    if (Math.abs(diff + 7) < Math.abs(diff)) {
      diff += 7;
    }
    date.setDate(date.getDate() + diff);
    result.start.assign("weekday", offset);
    if (startMomentFixed) {
      result.start.assign("day", date.getDate());
      result.start.assign("month", date.getMonth() + 1);
      result.start.assign("year", date.getFullYear());
    } else {
      result.start.imply("day", date.getDate());
      result.start.imply("month", date.getMonth() + 1);
      result.start.imply("year", date.getFullYear());
    }
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/zh/hant/parsers/ZHHantCasualDateParser.js
var NOW_GROUP = 1;
var DAY_GROUP_12 = 2;
var TIME_GROUP_1 = 3;
var TIME_GROUP_2 = 4;
var DAY_GROUP_32 = 5;
var TIME_GROUP_3 = 6;
var ZHHantCasualDateParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern(context) {
    return new RegExp("(\u800C\u5BB6|\u7ACB(?:\u523B|\u5373)|\u5373\u523B)|(\u4ECA|\u660E|\u524D|\u5927\u524D|\u5F8C|\u5927\u5F8C|\u807D|\u6628|\u5C0B|\u7434)(\u65E9|\u671D|\u665A)|(\u4E0A(?:\u5348|\u665D)|\u671D(?:\u65E9)|\u65E9(?:\u4E0A)|\u4E0B(?:\u5348|\u665D)|\u664F(?:\u665D)|\u665A(?:\u4E0A)|\u591C(?:\u665A)?|\u4E2D(?:\u5348)|\u51CC(?:\u6668))|(\u4ECA|\u660E|\u524D|\u5927\u524D|\u5F8C|\u5927\u5F8C|\u807D|\u6628|\u5C0B|\u7434)(?:\u65E5|\u5929)(?:[\\s|,|\uFF0C]*)(?:(\u4E0A(?:\u5348|\u665D)|\u671D(?:\u65E9)|\u65E9(?:\u4E0A)|\u4E0B(?:\u5348|\u665D)|\u664F(?:\u665D)|\u665A(?:\u4E0A)|\u591C(?:\u665A)?|\u4E2D(?:\u5348)|\u51CC(?:\u6668)))?", "i");
  }
  innerExtract(context, match) {
    const index = match.index;
    const result = context.createParsingResult(index, match[0]);
    const refDate = context.refDate;
    let date = new Date(refDate.getTime());
    if (match[NOW_GROUP]) {
      result.start.imply("hour", refDate.getHours());
      result.start.imply("minute", refDate.getMinutes());
      result.start.imply("second", refDate.getSeconds());
      result.start.imply("millisecond", refDate.getMilliseconds());
    } else if (match[DAY_GROUP_12]) {
      const day1 = match[DAY_GROUP_12];
      const time1 = match[TIME_GROUP_1];
      if (day1 == "\u660E" || day1 == "\u807D") {
        if (refDate.getHours() > 1) {
          date.setDate(date.getDate() + 1);
        }
      } else if (day1 == "\u6628" || day1 == "\u5C0B" || day1 == "\u7434") {
        date.setDate(date.getDate() - 1);
      } else if (day1 == "\u524D") {
        date.setDate(date.getDate() - 2);
      } else if (day1 == "\u5927\u524D") {
        date.setDate(date.getDate() - 3);
      } else if (day1 == "\u5F8C") {
        date.setDate(date.getDate() + 2);
      } else if (day1 == "\u5927\u5F8C") {
        date.setDate(date.getDate() + 3);
      }
      if (time1 == "\u65E9" || time1 == "\u671D") {
        result.start.imply("hour", 6);
      } else if (time1 == "\u665A") {
        result.start.imply("hour", 22);
        result.start.imply("meridiem", 1);
      }
    } else if (match[TIME_GROUP_2]) {
      const timeString2 = match[TIME_GROUP_2];
      const time2 = timeString2[0];
      if (time2 == "\u65E9" || time2 == "\u671D" || time2 == "\u4E0A") {
        result.start.imply("hour", 6);
      } else if (time2 == "\u4E0B" || time2 == "\u664F") {
        result.start.imply("hour", 15);
        result.start.imply("meridiem", 1);
      } else if (time2 == "\u4E2D") {
        result.start.imply("hour", 12);
        result.start.imply("meridiem", 1);
      } else if (time2 == "\u591C" || time2 == "\u665A") {
        result.start.imply("hour", 22);
        result.start.imply("meridiem", 1);
      } else if (time2 == "\u51CC") {
        result.start.imply("hour", 0);
      }
    } else if (match[DAY_GROUP_32]) {
      const day3 = match[DAY_GROUP_32];
      if (day3 == "\u660E" || day3 == "\u807D") {
        if (refDate.getHours() > 1) {
          date.setDate(date.getDate() + 1);
        }
      } else if (day3 == "\u6628" || day3 == "\u5C0B" || day3 == "\u7434") {
        date.setDate(date.getDate() - 1);
      } else if (day3 == "\u524D") {
        date.setDate(date.getDate() - 2);
      } else if (day3 == "\u5927\u524D") {
        date.setDate(date.getDate() - 3);
      } else if (day3 == "\u5F8C") {
        date.setDate(date.getDate() + 2);
      } else if (day3 == "\u5927\u5F8C") {
        date.setDate(date.getDate() + 3);
      }
      const timeString3 = match[TIME_GROUP_3];
      if (timeString3) {
        const time3 = timeString3[0];
        if (time3 == "\u65E9" || time3 == "\u671D" || time3 == "\u4E0A") {
          result.start.imply("hour", 6);
        } else if (time3 == "\u4E0B" || time3 == "\u664F") {
          result.start.imply("hour", 15);
          result.start.imply("meridiem", 1);
        } else if (time3 == "\u4E2D") {
          result.start.imply("hour", 12);
          result.start.imply("meridiem", 1);
        } else if (time3 == "\u591C" || time3 == "\u665A") {
          result.start.imply("hour", 22);
          result.start.imply("meridiem", 1);
        } else if (time3 == "\u51CC") {
          result.start.imply("hour", 0);
        }
      }
    }
    result.start.assign("day", date.getDate());
    result.start.assign("month", date.getMonth() + 1);
    result.start.assign("year", date.getFullYear());
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/zh/hant/constants.js
var NUMBER3 = {
  "\u96F6": 0,
  "\u4E00": 1,
  "\u4E8C": 2,
  "\u5169": 2,
  "\u4E09": 3,
  "\u56DB": 4,
  "\u4E94": 5,
  "\u516D": 6,
  "\u4E03": 7,
  "\u516B": 8,
  "\u4E5D": 9,
  "\u5341": 10,
  "\u5EFF": 20,
  "\u5345": 30
};
var WEEKDAY_OFFSET3 = {
  "\u5929": 0,
  "\u65E5": 0,
  "\u4E00": 1,
  "\u4E8C": 2,
  "\u4E09": 3,
  "\u56DB": 4,
  "\u4E94": 5,
  "\u516D": 6
};
function zhStringToNumber2(text) {
  let number = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "\u5341") {
      number = number === 0 ? NUMBER3[char] : number * NUMBER3[char];
    } else {
      number += NUMBER3[char];
    }
  }
  return number;
}
function zhStringToYear2(text) {
  let string = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    string = string + NUMBER3[char];
  }
  return parseInt(string);
}

// node_modules/chrono-node/dist/esm/locales/zh/hant/parsers/ZHHantDateParser.js
var YEAR_GROUP16 = 1;
var MONTH_GROUP6 = 2;
var DAY_GROUP5 = 3;
var ZHHantDateParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return new RegExp("(\\d{2,4}|[" + Object.keys(NUMBER3).join("") + "]{4}|[" + Object.keys(NUMBER3).join("") + "]{2})?(?:\\s*)(?:\u5E74)?(?:[\\s|,|\uFF0C]*)(\\d{1,2}|[" + Object.keys(NUMBER3).join("") + "]{1,2})(?:\\s*)(?:\u6708)(?:\\s*)(\\d{1,2}|[" + Object.keys(NUMBER3).join("") + "]{1,2})?(?:\\s*)(?:\u65E5|\u865F)?");
  }
  innerExtract(context, match) {
    const result = context.createParsingResult(match.index, match[0]);
    let month = parseInt(match[MONTH_GROUP6]);
    if (isNaN(month))
      month = zhStringToNumber2(match[MONTH_GROUP6]);
    result.start.assign("month", month);
    if (match[DAY_GROUP5]) {
      let day = parseInt(match[DAY_GROUP5]);
      if (isNaN(day))
        day = zhStringToNumber2(match[DAY_GROUP5]);
      result.start.assign("day", day);
    } else {
      result.start.imply("day", context.refDate.getDate());
    }
    if (match[YEAR_GROUP16]) {
      let year3 = parseInt(match[YEAR_GROUP16]);
      if (isNaN(year3))
        year3 = zhStringToYear2(match[YEAR_GROUP16]);
      result.start.assign("year", year3);
    } else {
      result.start.imply("year", context.refDate.getFullYear());
    }
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/zh/hant/parsers/ZHHantDeadlineFormatParser.js
var PATTERN40 = new RegExp("(\\d+|[" + Object.keys(NUMBER3).join("") + "]+|\u534A|\u5E7E)(?:\\s*)(?:\u500B)?(\u79D2(?:\u9418)?|\u5206\u9418|\u5C0F\u6642|\u9418|\u65E5|\u5929|\u661F\u671F|\u79AE\u62DC|\u6708|\u5E74)(?:(?:\u4E4B|\u904E)?\u5F8C|(?:\u4E4B)?\u5167)", "i");
var NUMBER_GROUP2 = 1;
var UNIT_GROUP2 = 2;
var ZHHantDeadlineFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN40;
  }
  innerExtract(context, match) {
    const result = context.createParsingResult(match.index, match[0]);
    let number = parseInt(match[NUMBER_GROUP2]);
    if (isNaN(number)) {
      number = zhStringToNumber2(match[NUMBER_GROUP2]);
    }
    if (isNaN(number)) {
      const string = match[NUMBER_GROUP2];
      if (string === "\u5E7E") {
        number = 3;
      } else if (string === "\u534A") {
        number = 0.5;
      } else {
        return null;
      }
    }
    const duration = {};
    const unit = match[UNIT_GROUP2];
    const unitAbbr = unit[0];
    if (unitAbbr.match(/[日天星禮月年]/)) {
      if (unitAbbr == "\u65E5" || unitAbbr == "\u5929") {
        duration.day = number;
      } else if (unitAbbr == "\u661F" || unitAbbr == "\u79AE") {
        duration.week = number;
      } else if (unitAbbr == "\u6708") {
        duration.month = number;
      } else if (unitAbbr == "\u5E74") {
        duration.year = number;
      }
      const date2 = addDuration(context.refDate, duration);
      result.start.assign("year", date2.getFullYear());
      result.start.assign("month", date2.getMonth() + 1);
      result.start.assign("day", date2.getDate());
      return result;
    }
    if (unitAbbr == "\u79D2") {
      duration.second = number;
    } else if (unitAbbr == "\u5206") {
      duration.minute = number;
    } else if (unitAbbr == "\u5C0F" || unitAbbr == "\u9418") {
      duration.hour = number;
    }
    const date = addDuration(context.refDate, duration);
    result.start.imply("year", date.getFullYear());
    result.start.imply("month", date.getMonth() + 1);
    result.start.imply("day", date.getDate());
    result.start.assign("hour", date.getHours());
    result.start.assign("minute", date.getMinutes());
    result.start.assign("second", date.getSeconds());
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/zh/hant/parsers/ZHHantRelationWeekdayParser.js
var PATTERN41 = new RegExp("(?<prefix>\u4E0A|\u4ECA|\u4E0B|\u9019|\u5462)(?:\u500B)?(?:\u661F\u671F|\u79AE\u62DC|\u9031)(?<weekday>" + Object.keys(WEEKDAY_OFFSET3).join("|") + ")");
var ZHHantRelationWeekdayParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN41;
  }
  innerExtract(context, match) {
    const result = context.createParsingResult(match.index, match[0]);
    const dayOfWeek = match.groups.weekday;
    const offset = WEEKDAY_OFFSET3[dayOfWeek];
    if (offset === void 0)
      return null;
    let modifier = null;
    const prefix = match.groups.prefix;
    if (prefix == "\u4E0A") {
      modifier = "last";
    } else if (prefix == "\u4E0B") {
      modifier = "next";
    } else if (prefix == "\u4ECA" || prefix == "\u9019" || prefix == "\u5462") {
      modifier = "this";
    }
    const date = new Date(context.refDate.getTime());
    let startMomentFixed = false;
    const refOffset = date.getDay();
    if (modifier == "last" || modifier == "past") {
      date.setDate(date.getDate() + (offset - 7 - refOffset));
      startMomentFixed = true;
    } else if (modifier == "next") {
      date.setDate(date.getDate() + (offset + 7 - refOffset));
      startMomentFixed = true;
    } else if (modifier == "this") {
      date.setDate(date.getDate() + (offset - refOffset));
    } else {
      let diff = offset - refOffset;
      if (Math.abs(diff - 7) < Math.abs(diff)) {
        diff -= 7;
      }
      if (Math.abs(diff + 7) < Math.abs(diff)) {
        diff += 7;
      }
      date.setDate(date.getDate() + diff);
    }
    result.start.assign("weekday", offset);
    if (startMomentFixed) {
      result.start.assign("day", date.getDate());
      result.start.assign("month", date.getMonth() + 1);
      result.start.assign("year", date.getFullYear());
    } else {
      result.start.imply("day", date.getDate());
      result.start.imply("month", date.getMonth() + 1);
      result.start.imply("year", date.getFullYear());
    }
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/zh/hant/parsers/ZHHantTimeExpressionParser.js
var FIRST_REG_PATTERN5 = new RegExp("(?:\u7531|\u5F9E|\u81EA)?(?:(\u4ECA|\u660E|\u524D|\u5927\u524D|\u5F8C|\u5927\u5F8C|\u807D|\u6628|\u5C0B|\u7434)(\u65E9|\u671D|\u665A)|(\u4E0A(?:\u5348|\u665D)|\u671D(?:\u65E9)|\u65E9(?:\u4E0A)|\u4E0B(?:\u5348|\u665D)|\u664F(?:\u665D)|\u665A(?:\u4E0A)|\u591C(?:\u665A)?|\u4E2D(?:\u5348)|\u51CC(?:\u6668))|(\u4ECA|\u660E|\u524D|\u5927\u524D|\u5F8C|\u5927\u5F8C|\u807D|\u6628|\u5C0B|\u7434)(?:\u65E5|\u5929)(?:[\\s,\uFF0C]*)(?:(\u4E0A(?:\u5348|\u665D)|\u671D(?:\u65E9)|\u65E9(?:\u4E0A)|\u4E0B(?:\u5348|\u665D)|\u664F(?:\u665D)|\u665A(?:\u4E0A)|\u591C(?:\u665A)?|\u4E2D(?:\u5348)|\u51CC(?:\u6668)))?)?(?:[\\s,\uFF0C]*)(?:(\\d+|[" + Object.keys(NUMBER3).join("") + "]+)(?:\\s*)(?:\u9EDE|\u6642|:|\uFF1A)(?:\\s*)(\\d+|\u534A|\u6B63|\u6574|[" + Object.keys(NUMBER3).join("") + "]+)?(?:\\s*)(?:\u5206|:|\uFF1A)?(?:\\s*)(\\d+|[" + Object.keys(NUMBER3).join("") + "]+)?(?:\\s*)(?:\u79D2)?)(?:\\s*(A.M.|P.M.|AM?|PM?))?", "i");
var SECOND_REG_PATTERN5 = new RegExp("(?:^\\s*(?:\u5230|\u81F3|\\-|\\\u2013|\\~|\\\u301C)\\s*)(?:(\u4ECA|\u660E|\u524D|\u5927\u524D|\u5F8C|\u5927\u5F8C|\u807D|\u6628|\u5C0B|\u7434)(\u65E9|\u671D|\u665A)|(\u4E0A(?:\u5348|\u665D)|\u671D(?:\u65E9)|\u65E9(?:\u4E0A)|\u4E0B(?:\u5348|\u665D)|\u664F(?:\u665D)|\u665A(?:\u4E0A)|\u591C(?:\u665A)?|\u4E2D(?:\u5348)|\u51CC(?:\u6668))|(\u4ECA|\u660E|\u524D|\u5927\u524D|\u5F8C|\u5927\u5F8C|\u807D|\u6628|\u5C0B|\u7434)(?:\u65E5|\u5929)(?:[\\s,\uFF0C]*)(?:(\u4E0A(?:\u5348|\u665D)|\u671D(?:\u65E9)|\u65E9(?:\u4E0A)|\u4E0B(?:\u5348|\u665D)|\u664F(?:\u665D)|\u665A(?:\u4E0A)|\u591C(?:\u665A)?|\u4E2D(?:\u5348)|\u51CC(?:\u6668)))?)?(?:[\\s,\uFF0C]*)(?:(\\d+|[" + Object.keys(NUMBER3).join("") + "]+)(?:\\s*)(?:\u9EDE|\u6642|:|\uFF1A)(?:\\s*)(\\d+|\u534A|\u6B63|\u6574|[" + Object.keys(NUMBER3).join("") + "]+)?(?:\\s*)(?:\u5206|:|\uFF1A)?(?:\\s*)(\\d+|[" + Object.keys(NUMBER3).join("") + "]+)?(?:\\s*)(?:\u79D2)?)(?:\\s*(A.M.|P.M.|AM?|PM?))?", "i");
var DAY_GROUP_13 = 1;
var ZH_AM_PM_HOUR_GROUP_12 = 2;
var ZH_AM_PM_HOUR_GROUP_22 = 3;
var DAY_GROUP_33 = 4;
var ZH_AM_PM_HOUR_GROUP_32 = 5;
var HOUR_GROUP6 = 6;
var MINUTE_GROUP6 = 7;
var SECOND_GROUP6 = 8;
var AM_PM_HOUR_GROUP5 = 9;
var ZHHantTimeExpressionParser = class extends AbstractParserWithWordBoundaryChecking {
  patternLeftBoundary() {
    return "()";
  }
  innerPattern() {
    return FIRST_REG_PATTERN5;
  }
  innerExtract(context, match) {
    if (match.index > 0 && context.text[match.index - 1].match(/\w/)) {
      return null;
    }
    const result = context.createParsingResult(match.index, match[0]);
    const startMoment = new Date(context.reference.instant.getTime());
    if (match[DAY_GROUP_13]) {
      const day1 = match[DAY_GROUP_13];
      if (day1 == "\u660E" || day1 == "\u807D") {
        if (context.refDate.getHours() > 1) {
          startMoment.setDate(startMoment.getDate() + 1);
        }
      } else if (day1 == "\u6628" || day1 == "\u5C0B" || day1 == "\u7434") {
        startMoment.setDate(startMoment.getDate() - 1);
      } else if (day1 == "\u524D") {
        startMoment.setDate(startMoment.getDate() - 2);
      } else if (day1 == "\u5927\u524D") {
        startMoment.setDate(startMoment.getDate() - 3);
      } else if (day1 == "\u5F8C") {
        startMoment.setDate(startMoment.getDate() + 2);
      } else if (day1 == "\u5927\u5F8C") {
        startMoment.setDate(startMoment.getDate() + 3);
      }
      result.start.assign("day", startMoment.getDate());
      result.start.assign("month", startMoment.getMonth() + 1);
      result.start.assign("year", startMoment.getFullYear());
    } else if (match[DAY_GROUP_33]) {
      const day3 = match[DAY_GROUP_33];
      if (day3 == "\u660E" || day3 == "\u807D") {
        startMoment.setDate(startMoment.getDate() + 1);
      } else if (day3 == "\u6628" || day3 == "\u5C0B" || day3 == "\u7434") {
        startMoment.setDate(startMoment.getDate() - 1);
      } else if (day3 == "\u524D") {
        startMoment.setDate(startMoment.getDate() - 2);
      } else if (day3 == "\u5927\u524D") {
        startMoment.setDate(startMoment.getDate() - 3);
      } else if (day3 == "\u5F8C") {
        startMoment.setDate(startMoment.getDate() + 2);
      } else if (day3 == "\u5927\u5F8C") {
        startMoment.setDate(startMoment.getDate() + 3);
      }
      result.start.assign("day", startMoment.getDate());
      result.start.assign("month", startMoment.getMonth() + 1);
      result.start.assign("year", startMoment.getFullYear());
    } else {
      result.start.imply("day", startMoment.getDate());
      result.start.imply("month", startMoment.getMonth() + 1);
      result.start.imply("year", startMoment.getFullYear());
    }
    let hour = 0;
    let minute = 0;
    let meridiem = -1;
    if (match[SECOND_GROUP6]) {
      var second = parseInt(match[SECOND_GROUP6]);
      if (isNaN(second)) {
        second = zhStringToNumber2(match[SECOND_GROUP6]);
      }
      if (second >= 60)
        return null;
      result.start.assign("second", second);
    }
    hour = parseInt(match[HOUR_GROUP6]);
    if (isNaN(hour)) {
      hour = zhStringToNumber2(match[HOUR_GROUP6]);
    }
    if (match[MINUTE_GROUP6]) {
      if (match[MINUTE_GROUP6] == "\u534A") {
        minute = 30;
      } else if (match[MINUTE_GROUP6] == "\u6B63" || match[MINUTE_GROUP6] == "\u6574") {
        minute = 0;
      } else {
        minute = parseInt(match[MINUTE_GROUP6]);
        if (isNaN(minute)) {
          minute = zhStringToNumber2(match[MINUTE_GROUP6]);
        }
      }
    } else if (hour > 100) {
      minute = hour % 100;
      hour = Math.floor(hour / 100);
    }
    if (minute >= 60) {
      return null;
    }
    if (hour > 24) {
      return null;
    }
    if (hour >= 12) {
      meridiem = 1;
    }
    if (match[AM_PM_HOUR_GROUP5]) {
      if (hour > 12)
        return null;
      var ampm = match[AM_PM_HOUR_GROUP5][0].toLowerCase();
      if (ampm == "a") {
        meridiem = 0;
        if (hour == 12)
          hour = 0;
      }
      if (ampm == "p") {
        meridiem = 1;
        if (hour != 12)
          hour += 12;
      }
    } else if (match[ZH_AM_PM_HOUR_GROUP_12]) {
      var zhAMPMString1 = match[ZH_AM_PM_HOUR_GROUP_12];
      var zhAMPM1 = zhAMPMString1[0];
      if (zhAMPM1 == "\u671D" || zhAMPM1 == "\u65E9") {
        meridiem = 0;
        if (hour == 12)
          hour = 0;
      } else if (zhAMPM1 == "\u665A") {
        meridiem = 1;
        if (hour != 12)
          hour += 12;
      }
    } else if (match[ZH_AM_PM_HOUR_GROUP_22]) {
      var zhAMPMString2 = match[ZH_AM_PM_HOUR_GROUP_22];
      var zhAMPM2 = zhAMPMString2[0];
      if (zhAMPM2 == "\u4E0A" || zhAMPM2 == "\u671D" || zhAMPM2 == "\u65E9" || zhAMPM2 == "\u51CC") {
        meridiem = 0;
        if (hour == 12)
          hour = 0;
      } else if (zhAMPM2 == "\u4E0B" || zhAMPM2 == "\u664F" || zhAMPM2 == "\u665A") {
        meridiem = 1;
        if (hour != 12)
          hour += 12;
      }
    } else if (match[ZH_AM_PM_HOUR_GROUP_32]) {
      var zhAMPMString3 = match[ZH_AM_PM_HOUR_GROUP_32];
      var zhAMPM3 = zhAMPMString3[0];
      if (zhAMPM3 == "\u4E0A" || zhAMPM3 == "\u671D" || zhAMPM3 == "\u65E9" || zhAMPM3 == "\u51CC") {
        meridiem = 0;
        if (hour == 12)
          hour = 0;
      } else if (zhAMPM3 == "\u4E0B" || zhAMPM3 == "\u664F" || zhAMPM3 == "\u665A") {
        meridiem = 1;
        if (hour != 12)
          hour += 12;
      }
    }
    result.start.assign("hour", hour);
    result.start.assign("minute", minute);
    if (meridiem >= 0) {
      result.start.assign("meridiem", meridiem);
    } else {
      if (hour < 12) {
        result.start.imply("meridiem", 0);
      } else {
        result.start.imply("meridiem", 1);
      }
    }
    const secondMatch = SECOND_REG_PATTERN5.exec(context.text.substring(result.index + result.text.length));
    if (!secondMatch) {
      if (result.text.match(/^\d+$/)) {
        return null;
      }
      return result;
    }
    let endMoment = new Date(startMoment.getTime());
    if (secondMatch[DAY_GROUP_13] || secondMatch[DAY_GROUP_33]) {
      endMoment = new Date(context.reference.instant.getTime());
    }
    result.end = context.createParsingComponents();
    if (secondMatch[DAY_GROUP_13]) {
      const day1 = secondMatch[DAY_GROUP_13];
      if (day1 == "\u660E" || day1 == "\u807D") {
        if (context.refDate.getHours() > 1) {
          endMoment.setDate(endMoment.getDate() + 1);
        }
      } else if (day1 == "\u6628" || day1 == "\u5C0B" || day1 == "\u7434") {
        endMoment.setDate(endMoment.getDate() - 1);
      } else if (day1 == "\u524D") {
        endMoment.setDate(endMoment.getDate() - 2);
      } else if (day1 == "\u5927\u524D") {
        endMoment.setDate(endMoment.getDate() - 3);
      } else if (day1 == "\u5F8C") {
        endMoment.setDate(endMoment.getDate() + 2);
      } else if (day1 == "\u5927\u5F8C") {
        endMoment.setDate(endMoment.getDate() + 3);
      }
      result.end.assign("day", endMoment.getDate());
      result.end.assign("month", endMoment.getMonth() + 1);
      result.end.assign("year", endMoment.getFullYear());
    } else if (secondMatch[DAY_GROUP_33]) {
      const day3 = secondMatch[DAY_GROUP_33];
      if (day3 == "\u660E" || day3 == "\u807D") {
        endMoment.setDate(endMoment.getDate() + 1);
      } else if (day3 == "\u6628" || day3 == "\u5C0B" || day3 == "\u7434") {
        endMoment.setDate(endMoment.getDate() - 1);
      } else if (day3 == "\u524D") {
        endMoment.setDate(endMoment.getDate() - 2);
      } else if (day3 == "\u5927\u524D") {
        endMoment.setDate(endMoment.getDate() - 3);
      } else if (day3 == "\u5F8C") {
        endMoment.setDate(endMoment.getDate() + 2);
      } else if (day3 == "\u5927\u5F8C") {
        endMoment.setDate(endMoment.getDate() + 3);
      }
      result.end.assign("day", endMoment.getDate());
      result.end.assign("month", endMoment.getMonth() + 1);
      result.end.assign("year", endMoment.getFullYear());
    } else {
      result.end.imply("day", endMoment.getDate());
      result.end.imply("month", endMoment.getMonth() + 1);
      result.end.imply("year", endMoment.getFullYear());
    }
    hour = 0;
    minute = 0;
    meridiem = -1;
    if (secondMatch[SECOND_GROUP6]) {
      let second2 = parseInt(secondMatch[SECOND_GROUP6]);
      if (isNaN(second2)) {
        second2 = zhStringToNumber2(secondMatch[SECOND_GROUP6]);
      }
      if (second2 >= 60)
        return null;
      result.end.assign("second", second2);
    }
    hour = parseInt(secondMatch[HOUR_GROUP6]);
    if (isNaN(hour)) {
      hour = zhStringToNumber2(secondMatch[HOUR_GROUP6]);
    }
    if (secondMatch[MINUTE_GROUP6]) {
      if (secondMatch[MINUTE_GROUP6] == "\u534A") {
        minute = 30;
      } else if (secondMatch[MINUTE_GROUP6] == "\u6B63" || secondMatch[MINUTE_GROUP6] == "\u6574") {
        minute = 0;
      } else {
        minute = parseInt(secondMatch[MINUTE_GROUP6]);
        if (isNaN(minute)) {
          minute = zhStringToNumber2(secondMatch[MINUTE_GROUP6]);
        }
      }
    } else if (hour > 100) {
      minute = hour % 100;
      hour = Math.floor(hour / 100);
    }
    if (minute >= 60) {
      return null;
    }
    if (hour > 24) {
      return null;
    }
    if (hour >= 12) {
      meridiem = 1;
    }
    if (secondMatch[AM_PM_HOUR_GROUP5]) {
      if (hour > 12)
        return null;
      var ampm = secondMatch[AM_PM_HOUR_GROUP5][0].toLowerCase();
      if (ampm == "a") {
        meridiem = 0;
        if (hour == 12)
          hour = 0;
      }
      if (ampm == "p") {
        meridiem = 1;
        if (hour != 12)
          hour += 12;
      }
      if (!result.start.isCertain("meridiem")) {
        if (meridiem == 0) {
          result.start.imply("meridiem", 0);
          if (result.start.get("hour") == 12) {
            result.start.assign("hour", 0);
          }
        } else {
          result.start.imply("meridiem", 1);
          if (result.start.get("hour") != 12) {
            result.start.assign("hour", result.start.get("hour") + 12);
          }
        }
      }
    } else if (secondMatch[ZH_AM_PM_HOUR_GROUP_12]) {
      const zhAMPMString12 = secondMatch[ZH_AM_PM_HOUR_GROUP_12];
      var zhAMPM1 = zhAMPMString12[0];
      if (zhAMPM1 == "\u671D" || zhAMPM1 == "\u65E9") {
        meridiem = 0;
        if (hour == 12)
          hour = 0;
      } else if (zhAMPM1 == "\u665A") {
        meridiem = 1;
        if (hour != 12)
          hour += 12;
      }
    } else if (secondMatch[ZH_AM_PM_HOUR_GROUP_22]) {
      const zhAMPMString22 = secondMatch[ZH_AM_PM_HOUR_GROUP_22];
      var zhAMPM2 = zhAMPMString22[0];
      if (zhAMPM2 == "\u4E0A" || zhAMPM2 == "\u671D" || zhAMPM2 == "\u65E9" || zhAMPM2 == "\u51CC") {
        meridiem = 0;
        if (hour == 12)
          hour = 0;
      } else if (zhAMPM2 == "\u4E0B" || zhAMPM2 == "\u664F" || zhAMPM2 == "\u665A") {
        meridiem = 1;
        if (hour != 12)
          hour += 12;
      }
    } else if (secondMatch[ZH_AM_PM_HOUR_GROUP_32]) {
      const zhAMPMString32 = secondMatch[ZH_AM_PM_HOUR_GROUP_32];
      var zhAMPM3 = zhAMPMString32[0];
      if (zhAMPM3 == "\u4E0A" || zhAMPM3 == "\u671D" || zhAMPM3 == "\u65E9" || zhAMPM3 == "\u51CC") {
        meridiem = 0;
        if (hour == 12)
          hour = 0;
      } else if (zhAMPM3 == "\u4E0B" || zhAMPM3 == "\u664F" || zhAMPM3 == "\u665A") {
        meridiem = 1;
        if (hour != 12)
          hour += 12;
      }
    }
    result.text = result.text + secondMatch[0];
    result.end.assign("hour", hour);
    result.end.assign("minute", minute);
    if (meridiem >= 0) {
      result.end.assign("meridiem", meridiem);
    } else {
      const startAtPM = result.start.isCertain("meridiem") && result.start.get("meridiem") == 1;
      if (startAtPM && result.start.get("hour") > hour) {
        result.end.imply("meridiem", 0);
      } else if (hour > 12) {
        result.end.imply("meridiem", 1);
      }
    }
    if (result.end.date().getTime() < result.start.date().getTime()) {
      result.end.imply("day", result.end.get("day") + 1);
    }
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/zh/hant/parsers/ZHHantWeekdayParser.js
var PATTERN42 = new RegExp("(?:\u661F\u671F|\u79AE\u62DC|\u9031)(?<weekday>" + Object.keys(WEEKDAY_OFFSET3).join("|") + ")");
var ZHHantWeekdayParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN42;
  }
  innerExtract(context, match) {
    const result = context.createParsingResult(match.index, match[0]);
    const dayOfWeek = match.groups.weekday;
    const offset = WEEKDAY_OFFSET3[dayOfWeek];
    if (offset === void 0)
      return null;
    const date = new Date(context.refDate.getTime());
    const startMomentFixed = false;
    const refOffset = date.getDay();
    let diff = offset - refOffset;
    if (Math.abs(diff - 7) < Math.abs(diff)) {
      diff -= 7;
    }
    if (Math.abs(diff + 7) < Math.abs(diff)) {
      diff += 7;
    }
    date.setDate(date.getDate() + diff);
    result.start.assign("weekday", offset);
    if (startMomentFixed) {
      result.start.assign("day", date.getDate());
      result.start.assign("month", date.getMonth() + 1);
      result.start.assign("year", date.getFullYear());
    } else {
      result.start.imply("day", date.getDate());
      result.start.imply("month", date.getMonth() + 1);
      result.start.imply("year", date.getFullYear());
    }
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/zh/hant/refiners/ZHHantMergeDateRangeRefiner.js
var ZHHantMergeDateRangeRefiner = class extends AbstractMergeDateRangeRefiner {
  patternBetween() {
    return /^\s*(至|到|\-|\~|～|－|ー)\s*$/i;
  }
};

// node_modules/chrono-node/dist/esm/locales/zh/hant/refiners/ZHHantMergeDateTimeRefiner.js
var ZHHantMergeDateTimeRefiner = class extends AbstractMergeDateTimeRefiner {
  patternBetween() {
    return /^\s*$/i;
  }
};

// node_modules/chrono-node/dist/esm/locales/zh/hant/index.js
var hant_exports = {};
__export(hant_exports, {
  Chrono: () => Chrono,
  Meridiem: () => Meridiem,
  ParsingComponents: () => ParsingComponents,
  ParsingResult: () => ParsingResult,
  ReferenceWithTimezone: () => ReferenceWithTimezone,
  Weekday: () => Weekday,
  casual: () => casual7,
  createCasualConfiguration: () => createCasualConfiguration6,
  createConfiguration: () => createConfiguration6,
  hant: () => hant,
  parse: () => parse7,
  parseDate: () => parseDate7,
  strict: () => strict7
});

// node_modules/chrono-node/dist/esm/locales/zh/hant/parsers/ZHHantAgoFormatParser.js
var PATTERN43 = new RegExp("(\\d+|[" + Object.keys(NUMBER3).join("") + "]+|\u534A|\u5E7E)(?:\\s*)(?:\u500B)?(\u79D2(?:\u9418)?|\u5206\u9418|\u5C0F\u6642|\u9418|\u65E5|\u5929|\u661F\u671F|\u79AE\u62DC|\u6708|\u5E74)(?:\u4E4B)?\u524D", "i");
var NUMBER_GROUP3 = 1;
var UNIT_GROUP3 = 2;
var ZHHantAgoFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN43;
  }
  innerExtract(context, match) {
    const result = context.createParsingResult(match.index, match[0]);
    let number = parseInt(match[NUMBER_GROUP3]);
    if (isNaN(number)) {
      number = zhStringToNumber2(match[NUMBER_GROUP3]);
    }
    if (isNaN(number)) {
      const string = match[NUMBER_GROUP3];
      if (string === "\u5E7E") {
        number = 3;
      } else if (string === "\u534A") {
        number = 0.5;
      } else {
        return null;
      }
    }
    let duration = {};
    const unit = match[UNIT_GROUP3];
    const unitAbbr = unit[0];
    if (unitAbbr.match(/[日天星禮月年]/)) {
      if (unitAbbr == "\u65E5" || unitAbbr == "\u5929") {
        duration.day = number;
      } else if (unitAbbr == "\u661F" || unitAbbr == "\u79AE") {
        duration.week = number;
      } else if (unitAbbr == "\u6708") {
        duration.month = number;
      } else if (unitAbbr == "\u5E74") {
        duration.year = number;
      }
      duration = reverseDuration(duration);
      const date2 = addDuration(context.refDate, duration);
      result.start.assign("year", date2.getFullYear());
      result.start.assign("month", date2.getMonth() + 1);
      result.start.assign("day", date2.getDate());
      return result;
    }
    if (unitAbbr == "\u79D2") {
      duration.second = number;
    } else if (unitAbbr == "\u5206") {
      duration.minute = number;
    } else if (unitAbbr == "\u5C0F" || unitAbbr == "\u9418") {
      duration.hour = number;
    }
    duration = reverseDuration(duration);
    const date = addDuration(context.refDate, duration);
    result.start.imply("year", date.getFullYear());
    result.start.imply("month", date.getMonth() + 1);
    result.start.imply("day", date.getDate());
    result.start.assign("hour", date.getHours());
    result.start.assign("minute", date.getMinutes());
    result.start.assign("second", date.getSeconds());
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/zh/hant/index.js
var hant = new Chrono(createCasualConfiguration6());
var casual7 = new Chrono(createCasualConfiguration6());
var strict7 = new Chrono(createConfiguration6());
function parse7(text, ref, option) {
  return casual7.parse(text, ref, option);
}
function parseDate7(text, ref, option) {
  return casual7.parseDate(text, ref, option);
}
function createCasualConfiguration6() {
  const option = createConfiguration6();
  option.parsers.unshift(new ZHHantCasualDateParser());
  return option;
}
function createConfiguration6() {
  const configuration3 = includeCommonConfiguration({
    parsers: [
      new ZHHantDateParser(),
      new ZHHantRelationWeekdayParser(),
      new ZHHantWeekdayParser(),
      new ZHHantTimeExpressionParser(),
      new ZHHantDeadlineFormatParser(),
      new ZHHantAgoFormatParser()
    ],
    refiners: [new ZHHantMergeDateRangeRefiner(), new ZHHantMergeDateTimeRefiner()]
  });
  configuration3.refiners = configuration3.refiners.filter((refiner) => !(refiner instanceof ExtractTimezoneOffsetRefiner));
  return configuration3;
}

// node_modules/chrono-node/dist/esm/locales/zh/hans/index.js
var hans_exports = {};
__export(hans_exports, {
  Chrono: () => Chrono,
  Meridiem: () => Meridiem,
  ParsingComponents: () => ParsingComponents,
  ParsingResult: () => ParsingResult,
  ReferenceWithTimezone: () => ReferenceWithTimezone,
  Weekday: () => Weekday,
  casual: () => casual8,
  createCasualConfiguration: () => createCasualConfiguration7,
  createConfiguration: () => createConfiguration7,
  hans: () => hans,
  parse: () => parse8,
  parseDate: () => parseDate8,
  strict: () => strict8
});

// node_modules/chrono-node/dist/esm/locales/zh/hans/parsers/ZHHansCasualDateParser.js
var NOW_GROUP2 = 1;
var DAY_GROUP_14 = 2;
var TIME_GROUP_12 = 3;
var TIME_GROUP_22 = 4;
var DAY_GROUP_34 = 5;
var TIME_GROUP_32 = 6;
var ZHHansCasualDateParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern(context) {
    return new RegExp("(\u73B0\u5728|\u7ACB(?:\u523B|\u5373)|\u5373\u523B)|(\u4ECA|\u660E|\u524D|\u5927\u524D|\u540E|\u5927\u540E|\u6628)(\u65E9|\u665A)|(\u4E0A(?:\u5348)|\u65E9(?:\u4E0A)|\u4E0B(?:\u5348)|\u665A(?:\u4E0A)|\u591C(?:\u665A)?|\u4E2D(?:\u5348)|\u51CC(?:\u6668))|(\u4ECA|\u660E|\u524D|\u5927\u524D|\u540E|\u5927\u540E|\u6628)(?:\u65E5|\u5929)(?:[\\s|,|\uFF0C]*)(?:(\u4E0A(?:\u5348)|\u65E9(?:\u4E0A)|\u4E0B(?:\u5348)|\u665A(?:\u4E0A)|\u591C(?:\u665A)?|\u4E2D(?:\u5348)|\u51CC(?:\u6668)))?", "i");
  }
  innerExtract(context, match) {
    const index = match.index;
    const result = context.createParsingResult(index, match[0]);
    const refDate = context.refDate;
    let date = new Date(refDate.getTime());
    if (match[NOW_GROUP2]) {
      result.start.imply("hour", refDate.getHours());
      result.start.imply("minute", refDate.getMinutes());
      result.start.imply("second", refDate.getSeconds());
      result.start.imply("millisecond", refDate.getMilliseconds());
    } else if (match[DAY_GROUP_14]) {
      const day1 = match[DAY_GROUP_14];
      const time1 = match[TIME_GROUP_12];
      if (day1 == "\u660E") {
        if (refDate.getHours() > 1) {
          date.setDate(date.getDate() + 1);
        }
      } else if (day1 == "\u6628") {
        date.setDate(date.getDate() - 1);
      } else if (day1 == "\u524D") {
        date.setDate(date.getDate() - 2);
      } else if (day1 == "\u5927\u524D") {
        date.setDate(date.getDate() - 3);
      } else if (day1 == "\u540E") {
        date.setDate(date.getDate() + 2);
      } else if (day1 == "\u5927\u540E") {
        date.setDate(date.getDate() + 3);
      }
      if (time1 == "\u65E9") {
        result.start.imply("hour", 6);
      } else if (time1 == "\u665A") {
        result.start.imply("hour", 22);
        result.start.imply("meridiem", 1);
      }
    } else if (match[TIME_GROUP_22]) {
      const timeString2 = match[TIME_GROUP_22];
      const time2 = timeString2[0];
      if (time2 == "\u65E9" || time2 == "\u4E0A") {
        result.start.imply("hour", 6);
      } else if (time2 == "\u4E0B") {
        result.start.imply("hour", 15);
        result.start.imply("meridiem", 1);
      } else if (time2 == "\u4E2D") {
        result.start.imply("hour", 12);
        result.start.imply("meridiem", 1);
      } else if (time2 == "\u591C" || time2 == "\u665A") {
        result.start.imply("hour", 22);
        result.start.imply("meridiem", 1);
      } else if (time2 == "\u51CC") {
        result.start.imply("hour", 0);
      }
    } else if (match[DAY_GROUP_34]) {
      const day3 = match[DAY_GROUP_34];
      if (day3 == "\u660E") {
        if (refDate.getHours() > 1) {
          date.setDate(date.getDate() + 1);
        }
      } else if (day3 == "\u6628") {
        date.setDate(date.getDate() - 1);
      } else if (day3 == "\u524D") {
        date.setDate(date.getDate() - 2);
      } else if (day3 == "\u5927\u524D") {
        date.setDate(date.getDate() - 3);
      } else if (day3 == "\u540E") {
        date.setDate(date.getDate() + 2);
      } else if (day3 == "\u5927\u540E") {
        date.setDate(date.getDate() + 3);
      }
      const timeString3 = match[TIME_GROUP_32];
      if (timeString3) {
        const time3 = timeString3[0];
        if (time3 == "\u65E9" || time3 == "\u4E0A") {
          result.start.imply("hour", 6);
        } else if (time3 == "\u4E0B") {
          result.start.imply("hour", 15);
          result.start.imply("meridiem", 1);
        } else if (time3 == "\u4E2D") {
          result.start.imply("hour", 12);
          result.start.imply("meridiem", 1);
        } else if (time3 == "\u591C" || time3 == "\u665A") {
          result.start.imply("hour", 22);
          result.start.imply("meridiem", 1);
        } else if (time3 == "\u51CC") {
          result.start.imply("hour", 0);
        }
      }
    }
    result.start.assign("day", date.getDate());
    result.start.assign("month", date.getMonth() + 1);
    result.start.assign("year", date.getFullYear());
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/zh/hans/parsers/ZHHansAgoFormatParser.js
var PATTERN44 = new RegExp("(\\d+|[" + Object.keys(NUMBER2).join("") + "]+|\u534A|\u51E0)(?:\\s*)(?:\u4E2A)?(\u79D2(?:\u949F)?|\u5206\u949F|\u5C0F\u65F6|\u949F|\u65E5|\u5929|\u661F\u671F|\u793C\u62DC|\u6708|\u5E74)(?:\u4E4B)?\u524D", "i");
var NUMBER_GROUP4 = 1;
var UNIT_GROUP4 = 2;
var ZHHansAgoFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN44;
  }
  innerExtract(context, match) {
    const result = context.createParsingResult(match.index, match[0]);
    let number = parseInt(match[NUMBER_GROUP4]);
    if (isNaN(number)) {
      number = zhStringToNumber(match[NUMBER_GROUP4]);
    }
    if (isNaN(number)) {
      const string = match[NUMBER_GROUP4];
      if (string === "\u51E0") {
        number = 3;
      } else if (string === "\u534A") {
        number = 0.5;
      } else {
        return null;
      }
    }
    let duration = {};
    const unit = match[UNIT_GROUP4];
    const unitAbbr = unit[0];
    if (unitAbbr.match(/[日天星礼月年]/)) {
      if (unitAbbr == "\u65E5" || unitAbbr == "\u5929") {
        duration.day = number;
      } else if (unitAbbr == "\u661F" || unitAbbr == "\u793C") {
        duration.week = number;
      } else if (unitAbbr == "\u6708") {
        duration.month = number;
      } else if (unitAbbr == "\u5E74") {
        duration.year = number;
      }
      duration = reverseDuration(duration);
      const date2 = addDuration(context.refDate, duration);
      result.start.assign("year", date2.getFullYear());
      result.start.assign("month", date2.getMonth() + 1);
      result.start.assign("day", date2.getDate());
      return result;
    }
    if (unitAbbr == "\u79D2") {
      duration.second = number;
    } else if (unitAbbr == "\u5206") {
      duration.minute = number;
    } else if (unitAbbr == "\u5C0F" || unitAbbr == "\u949F") {
      duration.hour = number;
    }
    duration = reverseDuration(duration);
    const date = addDuration(context.refDate, duration);
    result.start.imply("year", date.getFullYear());
    result.start.imply("month", date.getMonth() + 1);
    result.start.imply("day", date.getDate());
    result.start.assign("hour", date.getHours());
    result.start.assign("minute", date.getMinutes());
    result.start.assign("second", date.getSeconds());
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/zh/hans/refiners/ZHHansMergeDateRangeRefiner.js
var ZHHansMergeDateRangeRefiner = class extends AbstractMergeDateRangeRefiner {
  patternBetween() {
    return /^\s*(至|到|-|~|～|－|ー)\s*$/i;
  }
};

// node_modules/chrono-node/dist/esm/locales/zh/hans/refiners/ZHHansMergeDateTimeRefiner.js
var ZHHansMergeDateTimeRefiner = class extends AbstractMergeDateTimeRefiner {
  patternBetween() {
    return /^\s*$/i;
  }
};

// node_modules/chrono-node/dist/esm/locales/zh/hans/index.js
var hans = new Chrono(createCasualConfiguration7());
var casual8 = new Chrono(createCasualConfiguration7());
var strict8 = new Chrono(createConfiguration7());
function parse8(text, ref, option) {
  return casual8.parse(text, ref, option);
}
function parseDate8(text, ref, option) {
  return casual8.parseDate(text, ref, option);
}
function createCasualConfiguration7() {
  const option = createConfiguration7();
  option.parsers.unshift(new ZHHansCasualDateParser());
  return option;
}
function createConfiguration7() {
  const configuration3 = includeCommonConfiguration({
    parsers: [
      new ZHHansDateParser(),
      new ZHHansRelationWeekdayParser(),
      new ZHHansWeekdayParser(),
      new ZHHansTimeExpressionParser(),
      new ZHHansDeadlineFormatParser(),
      new ZHHansAgoFormatParser()
    ],
    refiners: [new ZHHansMergeDateRangeRefiner(), new ZHHansMergeDateTimeRefiner()]
  });
  configuration3.refiners = configuration3.refiners.filter((refiner) => !(refiner instanceof ExtractTimezoneOffsetRefiner));
  return configuration3;
}

// node_modules/chrono-node/dist/esm/locales/zh/index.js
var casual9 = new Chrono(createCasualConfiguration8());
var strict9 = new Chrono(createConfiguration8());
function parse9(text, ref, option) {
  return casual9.parse(text, ref, option);
}
function parseDate9(text, ref, option) {
  return casual9.parseDate(text, ref, option);
}
function createCasualConfiguration8() {
  const option = createConfiguration8();
  option.parsers.unshift(new ZHHantCasualDateParser());
  return option;
}
function createConfiguration8() {
  const configuration3 = includeCommonConfiguration({
    parsers: [
      new ZHHantDateParser(),
      new ZHHansDateParser(),
      new ZHHantRelationWeekdayParser(),
      new ZHHansRelationWeekdayParser(),
      new ZHHantWeekdayParser(),
      new ZHHansWeekdayParser(),
      new ZHHantTimeExpressionParser(),
      new ZHHansTimeExpressionParser(),
      new ZHHantDeadlineFormatParser(),
      new ZHHansDeadlineFormatParser()
    ],
    refiners: [new ZHHantMergeDateRangeRefiner(), new ZHHantMergeDateTimeRefiner()]
  });
  configuration3.refiners = configuration3.refiners.filter((refiner) => !(refiner instanceof ExtractTimezoneOffsetRefiner));
  return configuration3;
}

// node_modules/chrono-node/dist/esm/locales/ru/index.js
var ru_exports = {};
__export(ru_exports, {
  Chrono: () => Chrono,
  Meridiem: () => Meridiem,
  ParsingComponents: () => ParsingComponents,
  ParsingResult: () => ParsingResult,
  ReferenceWithTimezone: () => ReferenceWithTimezone,
  Weekday: () => Weekday,
  casual: () => casual10,
  createCasualConfiguration: () => createCasualConfiguration9,
  createConfiguration: () => createConfiguration9,
  parse: () => parse10,
  parseDate: () => parseDate10,
  strict: () => strict10
});

// node_modules/chrono-node/dist/esm/locales/ru/constants.js
var REGEX_PARTS = {
  leftBoundary: "([^\\p{L}\\p{N}_]|^)",
  rightBoundary: "(?=[^\\p{L}\\p{N}_]|$)",
  flags: "iu"
};
var WEEKDAY_DICTIONARY6 = {
  \u0432\u043E\u0441\u043A\u0440\u0435\u0441\u0435\u043D\u044C\u0435: 0,
  \u0432\u043E\u0441\u043A\u0440\u0435\u0441\u0435\u043D\u044C\u044F: 0,
  \u0432\u0441\u043A: 0,
  "\u0432\u0441\u043A.": 0,
  \u043F\u043E\u043D\u0435\u0434\u0435\u043B\u044C\u043D\u0438\u043A: 1,
  \u043F\u043E\u043D\u0435\u0434\u0435\u043B\u044C\u043D\u0438\u043A\u0430: 1,
  \u043F\u043D: 1,
  "\u043F\u043D.": 1,
  \u0432\u0442\u043E\u0440\u043D\u0438\u043A: 2,
  \u0432\u0442\u043E\u0440\u043D\u0438\u043A\u0430: 2,
  \u0432\u0442: 2,
  "\u0432\u0442.": 2,
  \u0441\u0440\u0435\u0434\u0430: 3,
  \u0441\u0440\u0435\u0434\u044B: 3,
  \u0441\u0440\u0435\u0434\u0443: 3,
  \u0441\u0440: 3,
  "\u0441\u0440.": 3,
  \u0447\u0435\u0442\u0432\u0435\u0440\u0433: 4,
  \u0447\u0435\u0442\u0432\u0435\u0440\u0433\u0430: 4,
  \u0447\u0442: 4,
  "\u0447\u0442.": 4,
  \u043F\u044F\u0442\u043D\u0438\u0446\u0430: 5,
  \u043F\u044F\u0442\u043D\u0438\u0446\u0443: 5,
  \u043F\u044F\u0442\u043D\u0438\u0446\u044B: 5,
  \u043F\u0442: 5,
  "\u043F\u0442.": 5,
  \u0441\u0443\u0431\u0431\u043E\u0442\u0430: 6,
  \u0441\u0443\u0431\u0431\u043E\u0442\u0443: 6,
  \u0441\u0443\u0431\u0431\u043E\u0442\u044B: 6,
  \u0441\u0431: 6,
  "\u0441\u0431.": 6
};
var FULL_MONTH_NAME_DICTIONARY2 = {
  \u044F\u043D\u0432\u0430\u0440\u044C: 1,
  \u044F\u043D\u0432\u0430\u0440\u044F: 1,
  \u044F\u043D\u0432\u0430\u0440\u0435: 1,
  \u0444\u0435\u0432\u0440\u0430\u043B\u044C: 2,
  \u0444\u0435\u0432\u0440\u0430\u043B\u044F: 2,
  \u0444\u0435\u0432\u0440\u0430\u043B\u0435: 2,
  \u043C\u0430\u0440\u0442: 3,
  \u043C\u0430\u0440\u0442\u0430: 3,
  \u043C\u0430\u0440\u0442\u0435: 3,
  \u0430\u043F\u0440\u0435\u043B\u044C: 4,
  \u0430\u043F\u0440\u0435\u043B\u044F: 4,
  \u0430\u043F\u0440\u0435\u043B\u0435: 4,
  \u043C\u0430\u0439: 5,
  \u043C\u0430\u044F: 5,
  \u043C\u0430\u0435: 5,
  \u0438\u044E\u043D\u044C: 6,
  \u0438\u044E\u043D\u044F: 6,
  \u0438\u044E\u043D\u0435: 6,
  \u0438\u044E\u043B\u044C: 7,
  \u0438\u044E\u043B\u044F: 7,
  \u0438\u044E\u043B\u0435: 7,
  \u0430\u0432\u0433\u0443\u0441\u0442: 8,
  \u0430\u0432\u0433\u0443\u0441\u0442\u0430: 8,
  \u0430\u0432\u0433\u0443\u0441\u0442\u0435: 8,
  \u0441\u0435\u043D\u0442\u044F\u0431\u0440\u044C: 9,
  \u0441\u0435\u043D\u0442\u044F\u0431\u0440\u044F: 9,
  \u0441\u0435\u043D\u0442\u044F\u0431\u0440\u0435: 9,
  \u043E\u043A\u0442\u044F\u0431\u0440\u044C: 10,
  \u043E\u043A\u0442\u044F\u0431\u0440\u044F: 10,
  \u043E\u043A\u0442\u044F\u0431\u0440\u0435: 10,
  \u043D\u043E\u044F\u0431\u0440\u044C: 11,
  \u043D\u043E\u044F\u0431\u0440\u044F: 11,
  \u043D\u043E\u044F\u0431\u0440\u0435: 11,
  \u0434\u0435\u043A\u0430\u0431\u0440\u044C: 12,
  \u0434\u0435\u043A\u0430\u0431\u0440\u044F: 12,
  \u0434\u0435\u043A\u0430\u0431\u0440\u0435: 12
};
var MONTH_DICTIONARY6 = {
  ...FULL_MONTH_NAME_DICTIONARY2,
  \u044F\u043D\u0432: 1,
  "\u044F\u043D\u0432.": 1,
  \u0444\u0435\u0432: 2,
  "\u0444\u0435\u0432.": 2,
  \u043C\u0430\u0440: 3,
  "\u043C\u0430\u0440.": 3,
  \u0430\u043F\u0440: 4,
  "\u0430\u043F\u0440.": 4,
  \u0430\u0432\u0433: 8,
  "\u0430\u0432\u0433.": 8,
  \u0441\u0435\u043D: 9,
  "\u0441\u0435\u043D.": 9,
  \u043E\u043A\u0442: 10,
  "\u043E\u043A\u0442.": 10,
  \u043D\u043E\u044F: 11,
  "\u043D\u043E\u044F.": 11,
  \u0434\u0435\u043A: 12,
  "\u0434\u0435\u043A.": 12
};
var INTEGER_WORD_DICTIONARY5 = {
  \u043E\u0434\u0438\u043D: 1,
  \u043E\u0434\u043D\u0430: 1,
  \u043E\u0434\u043D\u043E\u0439: 1,
  \u043E\u0434\u043D\u0443: 1,
  \u0434\u0432\u0435: 2,
  \u0434\u0432\u0430: 2,
  \u0434\u0432\u0443\u0445: 2,
  \u0442\u0440\u0438: 3,
  \u0442\u0440\u0435\u0445: 3,
  \u0442\u0440\u0451\u0445: 3,
  \u0447\u0435\u0442\u044B\u0440\u0435: 4,
  \u0447\u0435\u0442\u044B\u0440\u0435\u0445: 4,
  \u0447\u0435\u0442\u044B\u0440\u0451\u0445: 4,
  \u043F\u044F\u0442\u044C: 5,
  \u043F\u044F\u0442\u0438: 5,
  \u0448\u0435\u0441\u0442\u044C: 6,
  \u0448\u0435\u0441\u0442\u0438: 6,
  \u0441\u0435\u043C\u044C: 7,
  \u0441\u0435\u043C\u0438: 7,
  \u0432\u043E\u0441\u0435\u043C\u044C: 8,
  \u0432\u043E\u0441\u044C\u043C\u0438: 8,
  \u0434\u0435\u0432\u044F\u0442\u044C: 9,
  \u0434\u0435\u0432\u044F\u0442\u0438: 9,
  \u0434\u0435\u0441\u044F\u0442\u044C: 10,
  \u0434\u0435\u0441\u044F\u0442\u0438: 10,
  \u043E\u0434\u0438\u043D\u043D\u0430\u0434\u0446\u0430\u0442\u044C: 11,
  \u043E\u0434\u0438\u043D\u043D\u0430\u0434\u0446\u0430\u0442\u0438: 11,
  \u0434\u0432\u0435\u043D\u0430\u0434\u0446\u0430\u0442\u044C: 12,
  \u0434\u0432\u0435\u043D\u0430\u0434\u0446\u0430\u0442\u0438: 12
};
var ORDINAL_WORD_DICTIONARY3 = {
  \u043F\u0435\u0440\u0432\u043E\u0435: 1,
  \u043F\u0435\u0440\u0432\u043E\u0433\u043E: 1,
  \u0432\u0442\u043E\u0440\u043E\u0435: 2,
  \u0432\u0442\u043E\u0440\u043E\u0433\u043E: 2,
  \u0442\u0440\u0435\u0442\u044C\u0435: 3,
  \u0442\u0440\u0435\u0442\u044C\u0435\u0433\u043E: 3,
  \u0447\u0435\u0442\u0432\u0435\u0440\u0442\u043E\u0435: 4,
  \u0447\u0435\u0442\u0432\u0435\u0440\u0442\u043E\u0433\u043E: 4,
  \u043F\u044F\u0442\u043E\u0435: 5,
  \u043F\u044F\u0442\u043E\u0433\u043E: 5,
  \u0448\u0435\u0441\u0442\u043E\u0435: 6,
  \u0448\u0435\u0441\u0442\u043E\u0433\u043E: 6,
  \u0441\u0435\u0434\u044C\u043C\u043E\u0435: 7,
  \u0441\u0435\u0434\u044C\u043C\u043E\u0433\u043E: 7,
  \u0432\u043E\u0441\u044C\u043C\u043E\u0435: 8,
  \u0432\u043E\u0441\u044C\u043C\u043E\u0433\u043E: 8,
  \u0434\u0435\u0432\u044F\u0442\u043E\u0435: 9,
  \u0434\u0435\u0432\u044F\u0442\u043E\u0433\u043E: 9,
  \u0434\u0435\u0441\u044F\u0442\u043E\u0435: 10,
  \u0434\u0435\u0441\u044F\u0442\u043E\u0433\u043E: 10,
  \u043E\u0434\u0438\u043D\u043D\u0430\u0434\u0446\u0430\u0442\u043E\u0435: 11,
  \u043E\u0434\u0438\u043D\u043D\u0430\u0434\u0446\u0430\u0442\u043E\u0433\u043E: 11,
  \u0434\u0432\u0435\u043D\u0430\u0434\u0446\u0430\u0442\u043E\u0435: 12,
  \u0434\u0432\u0435\u043D\u0430\u0434\u0446\u0430\u0442\u043E\u0433\u043E: 12,
  \u0442\u0440\u0438\u043D\u0430\u0434\u0446\u0430\u0442\u043E\u0435: 13,
  \u0442\u0440\u0438\u043D\u0430\u0434\u0446\u0430\u0442\u043E\u0433\u043E: 13,
  \u0447\u0435\u0442\u044B\u0440\u043D\u0430\u0434\u0446\u0430\u0442\u043E\u0435: 14,
  \u0447\u0435\u0442\u044B\u0440\u043D\u0430\u0434\u0446\u0430\u0442\u043E\u0433\u043E: 14,
  \u043F\u044F\u0442\u043D\u0430\u0434\u0446\u0430\u0442\u043E\u0435: 15,
  \u043F\u044F\u0442\u043D\u0430\u0434\u0446\u0430\u0442\u043E\u0433\u043E: 15,
  \u0448\u0435\u0441\u0442\u043D\u0430\u0434\u0446\u0430\u0442\u043E\u0435: 16,
  \u0448\u0435\u0441\u0442\u043D\u0430\u0434\u0446\u0430\u0442\u043E\u0433\u043E: 16,
  \u0441\u0435\u043C\u043D\u0430\u0434\u0446\u0430\u0442\u043E\u0435: 17,
  \u0441\u0435\u043C\u043D\u0430\u0434\u0446\u0430\u0442\u043E\u0433\u043E: 17,
  \u0432\u043E\u0441\u0435\u043C\u043D\u0430\u0434\u0446\u0430\u0442\u043E\u0435: 18,
  \u0432\u043E\u0441\u0435\u043C\u043D\u0430\u0434\u0446\u0430\u0442\u043E\u0433\u043E: 18,
  \u0434\u0435\u0432\u044F\u0442\u043D\u0430\u0434\u0446\u0430\u0442\u043E\u0435: 19,
  \u0434\u0435\u0432\u044F\u0442\u043D\u0430\u0434\u0446\u0430\u0442\u043E\u0433\u043E: 19,
  \u0434\u0432\u0430\u0434\u0446\u0430\u0442\u043E\u0435: 20,
  \u0434\u0432\u0430\u0434\u0446\u0430\u0442\u043E\u0433\u043E: 20,
  "\u0434\u0432\u0430\u0434\u0446\u0430\u0442\u044C \u043F\u0435\u0440\u0432\u043E\u0435": 21,
  "\u0434\u0432\u0430\u0434\u0446\u0430\u0442\u044C \u043F\u0435\u0440\u0432\u043E\u0433\u043E": 21,
  "\u0434\u0432\u0430\u0434\u0446\u0430\u0442\u044C \u0432\u0442\u043E\u0440\u043E\u0435": 22,
  "\u0434\u0432\u0430\u0434\u0446\u0430\u0442\u044C \u0432\u0442\u043E\u0440\u043E\u0433\u043E": 22,
  "\u0434\u0432\u0430\u0434\u0446\u0430\u0442\u044C \u0442\u0440\u0435\u0442\u044C\u0435": 23,
  "\u0434\u0432\u0430\u0434\u0446\u0430\u0442\u044C \u0442\u0440\u0435\u0442\u044C\u0435\u0433\u043E": 23,
  "\u0434\u0432\u0430\u0434\u0446\u0430\u0442\u044C \u0447\u0435\u0442\u0432\u0435\u0440\u0442\u043E\u0435": 24,
  "\u0434\u0432\u0430\u0434\u0446\u0430\u0442\u044C \u0447\u0435\u0442\u0432\u0435\u0440\u0442\u043E\u0433\u043E": 24,
  "\u0434\u0432\u0430\u0434\u0446\u0430\u0442\u044C \u043F\u044F\u0442\u043E\u0435": 25,
  "\u0434\u0432\u0430\u0434\u0446\u0430\u0442\u044C \u043F\u044F\u0442\u043E\u0433\u043E": 25,
  "\u0434\u0432\u0430\u0434\u0446\u0430\u0442\u044C \u0448\u0435\u0441\u0442\u043E\u0435": 26,
  "\u0434\u0432\u0430\u0434\u0446\u0430\u0442\u044C \u0448\u0435\u0441\u0442\u043E\u0433\u043E": 26,
  "\u0434\u0432\u0430\u0434\u0446\u0430\u0442\u044C \u0441\u0435\u0434\u044C\u043C\u043E\u0435": 27,
  "\u0434\u0432\u0430\u0434\u0446\u0430\u0442\u044C \u0441\u0435\u0434\u044C\u043C\u043E\u0433\u043E": 27,
  "\u0434\u0432\u0430\u0434\u0446\u0430\u0442\u044C \u0432\u043E\u0441\u044C\u043C\u043E\u0435": 28,
  "\u0434\u0432\u0430\u0434\u0446\u0430\u0442\u044C \u0432\u043E\u0441\u044C\u043C\u043E\u0433\u043E": 28,
  "\u0434\u0432\u0430\u0434\u0446\u0430\u0442\u044C \u0434\u0435\u0432\u044F\u0442\u043E\u0435": 29,
  "\u0434\u0432\u0430\u0434\u0446\u0430\u0442\u044C \u0434\u0435\u0432\u044F\u0442\u043E\u0433\u043E": 29,
  "\u0442\u0440\u0438\u0434\u0446\u0430\u0442\u043E\u0435": 30,
  "\u0442\u0440\u0438\u0434\u0446\u0430\u0442\u043E\u0433\u043E": 30,
  "\u0442\u0440\u0438\u0434\u0446\u0430\u0442\u044C \u043F\u0435\u0440\u0432\u043E\u0435": 31,
  "\u0442\u0440\u0438\u0434\u0446\u0430\u0442\u044C \u043F\u0435\u0440\u0432\u043E\u0433\u043E": 31
};
var TIME_UNIT_DICTIONARY5 = {
  \u0441\u0435\u043A: "second",
  \u0441\u0435\u043A\u0443\u043D\u0434\u0430: "second",
  \u0441\u0435\u043A\u0443\u043D\u0434: "second",
  \u0441\u0435\u043A\u0443\u043D\u0434\u044B: "second",
  \u0441\u0435\u043A\u0443\u043D\u0434\u0443: "second",
  \u0441\u0435\u043A\u0443\u043D\u0434\u043E\u0447\u043A\u0430: "second",
  \u0441\u0435\u043A\u0443\u043D\u0434\u043E\u0447\u043A\u0438: "second",
  \u0441\u0435\u043A\u0443\u043D\u0434\u043E\u0447\u0435\u043A: "second",
  \u0441\u0435\u043A\u0443\u043D\u0434\u043E\u0447\u043A\u0443: "second",
  \u043C\u0438\u043D: "minute",
  \u043C\u0438\u043D\u0443\u0442\u0430: "minute",
  \u043C\u0438\u043D\u0443\u0442: "minute",
  \u043C\u0438\u043D\u0443\u0442\u044B: "minute",
  \u043C\u0438\u043D\u0443\u0442\u0443: "minute",
  \u043C\u0438\u043D\u0443\u0442\u043E\u043A: "minute",
  \u043C\u0438\u043D\u0443\u0442\u043A\u0438: "minute",
  \u043C\u0438\u043D\u0443\u0442\u043A\u0443: "minute",
  \u043C\u0438\u043D\u0443\u0442\u043E\u0447\u0435\u043A: "minute",
  \u043C\u0438\u043D\u0443\u0442\u043E\u0447\u043A\u0438: "minute",
  \u043C\u0438\u043D\u0443\u0442\u043E\u0447\u043A\u0443: "minute",
  \u0447\u0430\u0441: "hour",
  \u0447\u0430\u0441\u043E\u0432: "hour",
  \u0447\u0430\u0441\u0430: "hour",
  \u0447\u0430\u0441\u0443: "hour",
  \u0447\u0430\u0441\u0438\u043A\u043E\u0432: "hour",
  \u0447\u0430\u0441\u0438\u043A\u0430: "hour",
  \u0447\u0430\u0441\u0438\u043A\u0435: "hour",
  \u0447\u0430\u0441\u0438\u043A: "hour",
  \u0434\u0435\u043D\u044C: "day",
  \u0434\u043D\u044F: "day",
  \u0434\u043D\u0435\u0439: "day",
  \u0441\u0443\u0442\u043E\u043A: "day",
  \u0441\u0443\u0442\u043A\u0438: "day",
  \u043D\u0435\u0434\u0435\u043B\u044F: "week",
  \u043D\u0435\u0434\u0435\u043B\u0435: "week",
  \u043D\u0435\u0434\u0435\u043B\u0438: "week",
  \u043D\u0435\u0434\u0435\u043B\u044E: "week",
  \u043D\u0435\u0434\u0435\u043B\u044C: "week",
  \u043D\u0435\u0434\u0435\u043B\u044C\u043A\u0435: "week",
  \u043D\u0435\u0434\u0435\u043B\u044C\u043A\u0438: "week",
  \u043D\u0435\u0434\u0435\u043B\u0435\u043A: "week",
  \u043C\u0435\u0441\u044F\u0446: "month",
  \u043C\u0435\u0441\u044F\u0446\u0435: "month",
  \u043C\u0435\u0441\u044F\u0446\u0435\u0432: "month",
  \u043C\u0435\u0441\u044F\u0446\u0430: "month",
  \u043A\u0432\u0430\u0440\u0442\u0430\u043B: "quarter",
  \u043A\u0432\u0430\u0440\u0442\u0430\u043B\u0435: "quarter",
  \u043A\u0432\u0430\u0440\u0442\u0430\u043B\u043E\u0432: "quarter",
  \u0433\u043E\u0434: "year",
  \u0433\u043E\u0434\u0430: "year",
  \u0433\u043E\u0434\u0443: "year",
  \u0433\u043E\u0434\u043E\u0432: "year",
  \u043B\u0435\u0442: "year",
  \u0433\u043E\u0434\u0438\u043A: "year",
  \u0433\u043E\u0434\u0438\u043A\u0430: "year",
  \u0433\u043E\u0434\u0438\u043A\u043E\u0432: "year"
};
var NUMBER_PATTERN5 = `(?:${matchAnyPattern(INTEGER_WORD_DICTIONARY5)}|[0-9]+|[0-9]+\\.[0-9]+|\u043F\u043E\u043B|\u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E|\u043F\u0430\u0440(?:\u044B|\u0443)|\\s{0,3})`;
function parseNumberPattern5(match) {
  const num = match.toLowerCase();
  if (INTEGER_WORD_DICTIONARY5[num] !== void 0) {
    return INTEGER_WORD_DICTIONARY5[num];
  }
  if (num.match(/несколько/)) {
    return 3;
  } else if (num.match(/пол/)) {
    return 0.5;
  } else if (num.match(/пар/)) {
    return 2;
  } else if (num === "") {
    return 1;
  }
  return parseFloat(num);
}
var ORDINAL_NUMBER_PATTERN4 = `(?:${matchAnyPattern(ORDINAL_WORD_DICTIONARY3)}|[0-9]{1,2}(?:\u0433\u043E|\u043E\u0433\u043E|\u0435|\u043E\u0435)?)`;
function parseOrdinalNumberPattern4(match) {
  const num = match.toLowerCase();
  if (ORDINAL_WORD_DICTIONARY3[num] !== void 0) {
    return ORDINAL_WORD_DICTIONARY3[num];
  }
  return parseInt(num);
}
var year = "(?:\\s+(?:\u0433\u043E\u0434\u0443|\u0433\u043E\u0434\u0430|\u0433\u043E\u0434|\u0433|\u0433.))?";
var YEAR_PATTERN7 = `(?:[1-9][0-9]{0,3}${year}\\s*(?:\u043D.\u044D.|\u0434\u043E \u043D.\u044D.|\u043D. \u044D.|\u0434\u043E \u043D. \u044D.)|[1-2][0-9]{3}${year}|[5-9][0-9]${year})`;
function parseYear6(match) {
  if (/(год|года|г|г.)/i.test(match)) {
    match = match.replace(/(год|года|г|г.)/i, "");
  }
  if (/(до н.э.|до н. э.)/i.test(match)) {
    match = match.replace(/(до н.э.|до н. э.)/i, "");
    return -parseInt(match);
  }
  if (/(н. э.|н.э.)/i.test(match)) {
    match = match.replace(/(н. э.|н.э.)/i, "");
    return parseInt(match);
  }
  const rawYearNumber = parseInt(match);
  return findMostLikelyADYear(rawYearNumber);
}
var SINGLE_TIME_UNIT_PATTERN5 = `(${NUMBER_PATTERN5})\\s{0,3}(${matchAnyPattern(TIME_UNIT_DICTIONARY5)})`;
var SINGLE_TIME_UNIT_REGEX5 = new RegExp(SINGLE_TIME_UNIT_PATTERN5, "i");
var TIME_UNITS_PATTERN5 = repeatedTimeunitPattern(`(?:(?:\u043E\u043A\u043E\u043B\u043E|\u043F\u0440\u0438\u043C\u0435\u0440\u043D\u043E)\\s{0,3})?`, SINGLE_TIME_UNIT_PATTERN5);
function parseDuration5(timeunitText) {
  const fragments = {};
  let remainingText = timeunitText;
  let match = SINGLE_TIME_UNIT_REGEX5.exec(remainingText);
  while (match) {
    collectDateTimeFragment5(fragments, match);
    remainingText = remainingText.substring(match[0].length).trim();
    match = SINGLE_TIME_UNIT_REGEX5.exec(remainingText);
  }
  return fragments;
}
function collectDateTimeFragment5(fragments, match) {
  const num = parseNumberPattern5(match[1]);
  const unit = TIME_UNIT_DICTIONARY5[match[2].toLowerCase()];
  fragments[unit] = num;
}

// node_modules/chrono-node/dist/esm/locales/ru/parsers/RUTimeUnitWithinFormatParser.js
var PATTERN45 = `(?:(?:\u043E\u043A\u043E\u043B\u043E|\u043F\u0440\u0438\u043C\u0435\u0440\u043D\u043E)\\s*(?:~\\s*)?)?(${TIME_UNITS_PATTERN5})${REGEX_PARTS.rightBoundary}`;
var RUTimeUnitWithinFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  patternLeftBoundary() {
    return REGEX_PARTS.leftBoundary;
  }
  innerPattern(context) {
    return context.option.forwardDate ? new RegExp(PATTERN45, REGEX_PARTS.flags) : new RegExp(`(?:\u0432 \u0442\u0435\u0447\u0435\u043D\u0438\u0435|\u0432 \u0442\u0435\u0447\u0435\u043D\u0438\u0438)\\s*${PATTERN45}`, REGEX_PARTS.flags);
  }
  innerExtract(context, match) {
    const timeUnits = parseDuration5(match[1]);
    return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
  }
};

// node_modules/chrono-node/dist/esm/locales/ru/parsers/AbstractParserWithWordBoundaryChecking.js
var AbstractParserWithLeftBoundaryChecking = class extends AbstractParserWithWordBoundaryChecking {
  patternLeftBoundary() {
    return REGEX_PARTS.leftBoundary;
  }
  innerPattern(context) {
    return new RegExp(this.innerPatternString(context), REGEX_PARTS.flags);
  }
  innerPatternHasChange(context, currentInnerPattern) {
    return false;
  }
};
var AbstractParserWithLeftRightBoundaryChecking = class extends AbstractParserWithLeftBoundaryChecking {
  innerPattern(context) {
    return new RegExp(`${this.innerPatternString(context)}${REGEX_PARTS.rightBoundary}`, REGEX_PARTS.flags);
  }
};

// node_modules/chrono-node/dist/esm/locales/ru/parsers/RUMonthNameLittleEndianParser.js
var DATE_GROUP9 = 1;
var DATE_TO_GROUP7 = 2;
var MONTH_NAME_GROUP12 = 3;
var YEAR_GROUP17 = 4;
var RUMonthNameLittleEndianParser = class extends AbstractParserWithLeftRightBoundaryChecking {
  innerPatternString(context) {
    return `(?:\u0441)?\\s*(${ORDINAL_NUMBER_PATTERN4})(?:\\s{0,3}(?:\u043F\u043E|-|\u2013|\u0434\u043E)?\\s{0,3}(${ORDINAL_NUMBER_PATTERN4}))?(?:-|\\/|\\s{0,3}(?:of)?\\s{0,3})(${matchAnyPattern(MONTH_DICTIONARY6)})(?:(?:-|\\/|,?\\s{0,3})(${YEAR_PATTERN7}(?![^\\s]\\d)))?`;
  }
  innerExtract(context, match) {
    const result = context.createParsingResult(match.index, match[0]);
    const month = MONTH_DICTIONARY6[match[MONTH_NAME_GROUP12].toLowerCase()];
    const day = parseOrdinalNumberPattern4(match[DATE_GROUP9]);
    if (day > 31) {
      match.index = match.index + match[DATE_GROUP9].length;
      return null;
    }
    result.start.assign("month", month);
    result.start.assign("day", day);
    if (match[YEAR_GROUP17]) {
      const yearNumber = parseYear6(match[YEAR_GROUP17]);
      result.start.assign("year", yearNumber);
    } else {
      const year3 = findYearClosestToRef(context.refDate, day, month);
      result.start.imply("year", year3);
    }
    if (match[DATE_TO_GROUP7]) {
      const endDate = parseOrdinalNumberPattern4(match[DATE_TO_GROUP7]);
      result.end = result.start.clone();
      result.end.assign("day", endDate);
    }
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/ru/parsers/RUMonthNameParser.js
var MONTH_NAME_GROUP13 = 2;
var YEAR_GROUP18 = 3;
var RUMonthNameParser = class extends AbstractParserWithLeftBoundaryChecking {
  innerPatternString(context) {
    return `((?:\u0432)\\s*)?(${matchAnyPattern(MONTH_DICTIONARY6)})\\s*(?:[,-]?\\s*(${YEAR_PATTERN7})?)?(?=[^\\s\\w]|\\s+[^0-9]|\\s+$|$)`;
  }
  innerExtract(context, match) {
    const monthName = match[MONTH_NAME_GROUP13].toLowerCase();
    if (match[0].length <= 3 && !FULL_MONTH_NAME_DICTIONARY2[monthName]) {
      return null;
    }
    const result = context.createParsingResult(match.index, match.index + match[0].length);
    result.start.imply("day", 1);
    const month = MONTH_DICTIONARY6[monthName];
    result.start.assign("month", month);
    if (match[YEAR_GROUP18]) {
      const year3 = parseYear6(match[YEAR_GROUP18]);
      result.start.assign("year", year3);
    } else {
      const year3 = findYearClosestToRef(context.refDate, 1, month);
      result.start.imply("year", year3);
    }
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/ru/parsers/RUTimeExpressionParser.js
var RUTimeExpressionParser = class extends AbstractTimeExpressionParser {
  constructor(strictMode) {
    super(strictMode);
  }
  patternFlags() {
    return REGEX_PARTS.flags;
  }
  primaryPatternLeftBoundary() {
    return `(^|\\s|T|(?:[^\\p{L}\\p{N}_]))`;
  }
  followingPhase() {
    return `\\s*(?:\\-|\\\u2013|\\~|\\\u301C|\u0434\u043E|\u0438|\u043F\u043E|\\?)\\s*`;
  }
  primaryPrefix() {
    return `(?:(?:\u0432|\u0441)\\s*)??`;
  }
  primarySuffix() {
    return `(?:\\s*(?:\u0443\u0442\u0440\u0430|\u0432\u0435\u0447\u0435\u0440\u0430|\u043F\u043E\u0441\u043B\u0435 \u043F\u043E\u043B\u0443\u0434\u043D\u044F))?(?!\\/)${REGEX_PARTS.rightBoundary}`;
  }
  extractPrimaryTimeComponents(context, match) {
    const components = super.extractPrimaryTimeComponents(context, match);
    if (components) {
      if (match[0].endsWith("\u0432\u0435\u0447\u0435\u0440\u0430")) {
        const hour = components.get("hour");
        if (hour >= 6 && hour < 12) {
          components.assign("hour", components.get("hour") + 12);
          components.assign("meridiem", Meridiem.PM);
        } else if (hour < 6) {
          components.assign("meridiem", Meridiem.AM);
        }
      }
      if (match[0].endsWith("\u043F\u043E\u0441\u043B\u0435 \u043F\u043E\u043B\u0443\u0434\u043D\u044F")) {
        components.assign("meridiem", Meridiem.PM);
        const hour = components.get("hour");
        if (hour >= 0 && hour <= 6) {
          components.assign("hour", components.get("hour") + 12);
        }
      }
      if (match[0].endsWith("\u0443\u0442\u0440\u0430")) {
        components.assign("meridiem", Meridiem.AM);
        const hour = components.get("hour");
        if (hour < 12) {
          components.assign("hour", components.get("hour"));
        }
      }
    }
    return components;
  }
};

// node_modules/chrono-node/dist/esm/locales/ru/parsers/RUTimeUnitAgoFormatParser.js
var RUTimeUnitAgoFormatParser = class extends AbstractParserWithLeftBoundaryChecking {
  innerPatternString(context) {
    return `(${TIME_UNITS_PATTERN5})\\s{0,5}\u043D\u0430\u0437\u0430\u0434(?=(?:\\W|$))`;
  }
  innerExtract(context, match) {
    const timeUnits = parseDuration5(match[1]);
    const outputTimeUnits = reverseDuration(timeUnits);
    return ParsingComponents.createRelativeFromReference(context.reference, outputTimeUnits);
  }
};

// node_modules/chrono-node/dist/esm/locales/ru/refiners/RUMergeDateRangeRefiner.js
var RUMergeDateRangeRefiner = class extends AbstractMergeDateRangeRefiner {
  patternBetween() {
    return /^\s*(и до|и по|до|по|-)\s*$/i;
  }
};

// node_modules/chrono-node/dist/esm/locales/ru/refiners/RUMergeDateTimeRefiner.js
var RUMergeDateTimeRefiner = class extends AbstractMergeDateTimeRefiner {
  patternBetween() {
    return new RegExp(`^\\s*(T|\u0432|,|-)?\\s*$`);
  }
};

// node_modules/chrono-node/dist/esm/locales/ru/parsers/RUCasualDateParser.js
var RUCasualDateParser = class extends AbstractParserWithLeftRightBoundaryChecking {
  innerPatternString(context) {
    return `(?:\u0441|\u0441\u043E)?\\s*(\u0441\u0435\u0433\u043E\u0434\u043D\u044F|\u0432\u0447\u0435\u0440\u0430|\u0437\u0430\u0432\u0442\u0440\u0430|\u043F\u043E\u0441\u043B\u0435\u0437\u0430\u0432\u0442\u0440\u0430|\u043F\u043E\u0441\u043B\u0435\u043F\u043E\u0441\u043B\u0435\u0437\u0430\u0432\u0442\u0440\u0430|\u043F\u043E\u0437\u0430\u043F\u043E\u0437\u0430\u0432\u0447\u0435\u0440\u0430|\u043F\u043E\u0437\u0430\u0432\u0447\u0435\u0440\u0430)`;
  }
  innerExtract(context, match) {
    const lowerText = match[1].toLowerCase();
    const component = context.createParsingComponents();
    switch (lowerText) {
      case "\u0441\u0435\u0433\u043E\u0434\u043D\u044F":
        return today(context.reference);
      case "\u0432\u0447\u0435\u0440\u0430":
        return yesterday(context.reference);
      case "\u0437\u0430\u0432\u0442\u0440\u0430":
        return tomorrow(context.reference);
      case "\u043F\u043E\u0441\u043B\u0435\u0437\u0430\u0432\u0442\u0440\u0430":
        return theDayAfter(context.reference, 2);
      case "\u043F\u043E\u0441\u043B\u0435\u043F\u043E\u0441\u043B\u0435\u0437\u0430\u0432\u0442\u0440\u0430":
        return theDayAfter(context.reference, 3);
      case "\u043F\u043E\u0437\u0430\u0432\u0447\u0435\u0440\u0430":
        return theDayBefore(context.reference, 2);
      case "\u043F\u043E\u0437\u0430\u043F\u043E\u0437\u0430\u0432\u0447\u0435\u0440\u0430":
        return theDayBefore(context.reference, 3);
    }
    return component;
  }
};

// node_modules/chrono-node/dist/esm/locales/ru/parsers/RUCasualTimeParser.js
var RUCasualTimeParser = class extends AbstractParserWithLeftRightBoundaryChecking {
  innerPatternString(context) {
    return `(\u0441\u0435\u0439\u0447\u0430\u0441|\u043F\u0440\u043E\u0448\u043B\u044B\u043C\\s*\u0432\u0435\u0447\u0435\u0440\u043E\u043C|\u043F\u0440\u043E\u0448\u043B\u043E\u0439\\s*\u043D\u043E\u0447\u044C\u044E|\u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0439\\s*\u043D\u043E\u0447\u044C\u044E|\u0441\u0435\u0433\u043E\u0434\u043D\u044F\\s*\u043D\u043E\u0447\u044C\u044E|\u044D\u0442\u043E\u0439\\s*\u043D\u043E\u0447\u044C\u044E|\u043D\u043E\u0447\u044C\u044E|\u044D\u0442\u0438\u043C \u0443\u0442\u0440\u043E\u043C|\u0443\u0442\u0440\u043E\u043C|\u0443\u0442\u0440\u0430|\u0432\\s*\u043F\u043E\u043B\u0434\u0435\u043D\u044C|\u0432\u0435\u0447\u0435\u0440\u043E\u043C|\u0432\u0435\u0447\u0435\u0440\u0430|\u0432\\s*\u043F\u043E\u043B\u043D\u043E\u0447\u044C)`;
  }
  innerExtract(context, match) {
    let targetDate = context.refDate;
    const lowerText = match[0].toLowerCase();
    const component = context.createParsingComponents();
    if (lowerText === "\u0441\u0435\u0439\u0447\u0430\u0441") {
      return now(context.reference);
    }
    if (lowerText === "\u0432\u0435\u0447\u0435\u0440\u043E\u043C" || lowerText === "\u0432\u0435\u0447\u0435\u0440\u0430") {
      return evening(context.reference);
    }
    if (lowerText.endsWith("\u0443\u0442\u0440\u043E\u043C") || lowerText.endsWith("\u0443\u0442\u0440\u0430")) {
      return morning(context.reference);
    }
    if (lowerText.match(/в\s*полдень/)) {
      return noon(context.reference);
    }
    if (lowerText.match(/прошлой\s*ночью/)) {
      return lastNight(context.reference);
    }
    if (lowerText.match(/прошлым\s*вечером/)) {
      return yesterdayEvening(context.reference);
    }
    if (lowerText.match(/следующей\s*ночью/)) {
      const daysToAdd = targetDate.getHours() < 22 ? 1 : 2;
      const nextDay = new Date(targetDate.getTime());
      nextDay.setDate(nextDay.getDate() + daysToAdd);
      assignSimilarDate(component, nextDay);
      component.imply("hour", 0);
    }
    if (lowerText.match(/в\s*полночь/) || lowerText.endsWith("\u043D\u043E\u0447\u044C\u044E")) {
      return midnight(context.reference);
    }
    return component;
  }
};

// node_modules/chrono-node/dist/esm/locales/ru/parsers/RUWeekdayParser.js
var PREFIX_GROUP6 = 1;
var WEEKDAY_GROUP6 = 2;
var POSTFIX_GROUP5 = 3;
var RUWeekdayParser = class extends AbstractParserWithLeftRightBoundaryChecking {
  innerPatternString(context) {
    return `(?:(?:,|\\(|\uFF08)\\s*)?(?:\u0432\\s*?)?(?:(\u044D\u0442\u0443|\u044D\u0442\u043E\u0442|\u043F\u0440\u043E\u0448\u043B\u044B\u0439|\u043F\u0440\u043E\u0448\u043B\u0443\u044E|\u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439|\u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0443\u044E|\u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0433\u043E)\\s*)?(${matchAnyPattern(WEEKDAY_DICTIONARY6)})(?:\\s*(?:,|\\)|\uFF09))?(?:\\s*\u043D\u0430\\s*(\u044D\u0442\u043E\u0439|\u043F\u0440\u043E\u0448\u043B\u043E\u0439|\u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0439)\\s*\u043D\u0435\u0434\u0435\u043B\u0435)?`;
  }
  innerExtract(context, match) {
    const dayOfWeek = match[WEEKDAY_GROUP6].toLowerCase();
    const weekday = WEEKDAY_DICTIONARY6[dayOfWeek];
    const prefix = match[PREFIX_GROUP6];
    const postfix = match[POSTFIX_GROUP5];
    let modifierWord = prefix || postfix;
    modifierWord = modifierWord || "";
    modifierWord = modifierWord.toLowerCase();
    let modifier = null;
    if (modifierWord == "\u043F\u0440\u043E\u0448\u043B\u044B\u0439" || modifierWord == "\u043F\u0440\u043E\u0448\u043B\u0443\u044E" || modifierWord == "\u043F\u0440\u043E\u0448\u043B\u043E\u0439") {
      modifier = "last";
    } else if (modifierWord == "\u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439" || modifierWord == "\u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0443\u044E" || modifierWord == "\u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0439" || modifierWord == "\u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0433\u043E") {
      modifier = "next";
    } else if (modifierWord == "\u044D\u0442\u043E\u0442" || modifierWord == "\u044D\u0442\u0443" || modifierWord == "\u044D\u0442\u043E\u0439") {
      modifier = "this";
    }
    return createParsingComponentsAtWeekday(context.reference, weekday, modifier);
  }
};

// node_modules/chrono-node/dist/esm/locales/ru/parsers/RURelativeDateFormatParser.js
var MODIFIER_WORD_GROUP3 = 1;
var RELATIVE_WORD_GROUP3 = 2;
var RURelativeDateFormatParser = class extends AbstractParserWithLeftRightBoundaryChecking {
  innerPatternString(context) {
    return `(\u0432 \u043F\u0440\u043E\u0448\u043B\u043E\u043C|\u043D\u0430 \u043F\u0440\u043E\u0448\u043B\u043E\u0439|\u043D\u0430 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0439|\u0432 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u043C|\u043D\u0430 \u044D\u0442\u043E\u0439|\u0432 \u044D\u0442\u043E\u043C)\\s*(${matchAnyPattern(TIME_UNIT_DICTIONARY5)})`;
  }
  innerExtract(context, match) {
    const modifier = match[MODIFIER_WORD_GROUP3].toLowerCase();
    const unitWord = match[RELATIVE_WORD_GROUP3].toLowerCase();
    const timeunit = TIME_UNIT_DICTIONARY5[unitWord];
    if (modifier == "\u043D\u0430 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0439" || modifier == "\u0432 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u043C") {
      const timeUnits = {};
      timeUnits[timeunit] = 1;
      return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
    }
    if (modifier == "\u0432 \u043F\u0440\u043E\u0448\u043B\u043E\u043C" || modifier == "\u043D\u0430 \u043F\u0440\u043E\u0448\u043B\u043E\u0439") {
      const timeUnits = {};
      timeUnits[timeunit] = -1;
      return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
    }
    const components = context.createParsingComponents();
    let date = new Date(context.reference.instant.getTime());
    if (timeunit.match(/week/i)) {
      date.setDate(date.getDate() - date.getDay());
      components.imply("day", date.getDate());
      components.imply("month", date.getMonth() + 1);
      components.imply("year", date.getFullYear());
    } else if (timeunit.match(/month/i)) {
      date.setDate(1);
      components.imply("day", date.getDate());
      components.assign("year", date.getFullYear());
      components.assign("month", date.getMonth() + 1);
    } else if (timeunit.match(/year/i)) {
      date.setDate(1);
      date.setMonth(0);
      components.imply("day", date.getDate());
      components.imply("month", date.getMonth() + 1);
      components.assign("year", date.getFullYear());
    }
    return components;
  }
};

// node_modules/chrono-node/dist/esm/locales/ru/parsers/RUTimeUnitCasualRelativeFormatParser.js
var RUTimeUnitCasualRelativeFormatParser = class extends AbstractParserWithLeftRightBoundaryChecking {
  innerPatternString(context) {
    return `(\u044D\u0442\u0438|\u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0435|\u043F\u0440\u043E\u0448\u043B\u044B\u0435|\u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0435|\u043F\u043E\u0441\u043B\u0435|\u0441\u043F\u0443\u0441\u0442\u044F|\u0447\u0435\u0440\u0435\u0437|\\+|-)\\s*(${TIME_UNITS_PATTERN5})`;
  }
  innerExtract(context, match) {
    const prefix = match[1].toLowerCase();
    let timeUnits = parseDuration5(match[2]);
    switch (prefix) {
      case "\u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0435":
      case "\u043F\u0440\u043E\u0448\u043B\u044B\u0435":
      case "-":
        timeUnits = reverseDuration(timeUnits);
        break;
    }
    return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
  }
};

// node_modules/chrono-node/dist/esm/locales/ru/index.js
var casual10 = new Chrono(createCasualConfiguration9());
var strict10 = new Chrono(createConfiguration9(true));
function parse10(text, ref, option) {
  return casual10.parse(text, ref, option);
}
function parseDate10(text, ref, option) {
  return casual10.parseDate(text, ref, option);
}
function createCasualConfiguration9() {
  const option = createConfiguration9(false);
  option.parsers.unshift(new RUCasualDateParser());
  option.parsers.unshift(new RUCasualTimeParser());
  option.parsers.unshift(new RUMonthNameParser());
  option.parsers.unshift(new RURelativeDateFormatParser());
  option.parsers.unshift(new RUTimeUnitCasualRelativeFormatParser());
  return option;
}
function createConfiguration9(strictMode = true) {
  return includeCommonConfiguration({
    parsers: [
      new SlashDateFormatParser(true),
      new RUTimeUnitWithinFormatParser(),
      new RUMonthNameLittleEndianParser(),
      new RUWeekdayParser(),
      new RUTimeExpressionParser(strictMode),
      new RUTimeUnitAgoFormatParser()
    ],
    refiners: [new RUMergeDateTimeRefiner(), new RUMergeDateRangeRefiner()]
  }, strictMode);
}

// node_modules/chrono-node/dist/esm/locales/es/index.js
var es_exports = {};
__export(es_exports, {
  Chrono: () => Chrono,
  Meridiem: () => Meridiem,
  ParsingComponents: () => ParsingComponents,
  ParsingResult: () => ParsingResult,
  ReferenceWithTimezone: () => ReferenceWithTimezone,
  Weekday: () => Weekday,
  casual: () => casual11,
  createCasualConfiguration: () => createCasualConfiguration10,
  createConfiguration: () => createConfiguration10,
  parse: () => parse11,
  parseDate: () => parseDate11,
  strict: () => strict11
});

// node_modules/chrono-node/dist/esm/locales/es/constants.js
var WEEKDAY_DICTIONARY7 = {
  "domingo": 0,
  "dom": 0,
  "lunes": 1,
  "lun": 1,
  "martes": 2,
  "mar": 2,
  "mi\xE9rcoles": 3,
  "miercoles": 3,
  "mi\xE9": 3,
  "mie": 3,
  "jueves": 4,
  "jue": 4,
  "viernes": 5,
  "vie": 5,
  "s\xE1bado": 6,
  "sabado": 6,
  "s\xE1b": 6,
  "sab": 6
};
var MONTH_DICTIONARY7 = {
  "enero": 1,
  "ene": 1,
  "ene.": 1,
  "febrero": 2,
  "feb": 2,
  "feb.": 2,
  "marzo": 3,
  "mar": 3,
  "mar.": 3,
  "abril": 4,
  "abr": 4,
  "abr.": 4,
  "mayo": 5,
  "may": 5,
  "may.": 5,
  "junio": 6,
  "jun": 6,
  "jun.": 6,
  "julio": 7,
  "jul": 7,
  "jul.": 7,
  "agosto": 8,
  "ago": 8,
  "ago.": 8,
  "septiembre": 9,
  "setiembre": 9,
  "sep": 9,
  "sep.": 9,
  "octubre": 10,
  "oct": 10,
  "oct.": 10,
  "noviembre": 11,
  "nov": 11,
  "nov.": 11,
  "diciembre": 12,
  "dic": 12,
  "dic.": 12
};
var INTEGER_WORD_DICTIONARY6 = {
  "uno": 1,
  "dos": 2,
  "tres": 3,
  "cuatro": 4,
  "cinco": 5,
  "seis": 6,
  "siete": 7,
  "ocho": 8,
  "nueve": 9,
  "diez": 10,
  "once": 11,
  "doce": 12,
  "trece": 13
};
var TIME_UNIT_DICTIONARY6 = {
  "sec": "second",
  "segundo": "second",
  "segundos": "second",
  "min": "minute",
  "mins": "minute",
  "minuto": "minute",
  "minutos": "minute",
  "h": "hour",
  "hr": "hour",
  "hrs": "hour",
  "hora": "hour",
  "horas": "hour",
  "d\xEDa": "day",
  "d\xEDas": "day",
  "semana": "week",
  "semanas": "week",
  "mes": "month",
  "meses": "month",
  "cuarto": "quarter",
  "cuartos": "quarter",
  "a\xF1o": "year",
  "a\xF1os": "year"
};
var NUMBER_PATTERN6 = `(?:${matchAnyPattern(INTEGER_WORD_DICTIONARY6)}|[0-9]+|[0-9]+\\.[0-9]+|un?|uno?|una?|algunos?|unos?|demi-?)`;
function parseNumberPattern6(match) {
  const num = match.toLowerCase();
  if (INTEGER_WORD_DICTIONARY6[num] !== void 0) {
    return INTEGER_WORD_DICTIONARY6[num];
  } else if (num === "un" || num === "una" || num === "uno") {
    return 1;
  } else if (num.match(/algunos?/)) {
    return 3;
  } else if (num.match(/unos?/)) {
    return 3;
  } else if (num.match(/media?/)) {
    return 0.5;
  }
  return parseFloat(num);
}
var YEAR_PATTERN8 = "[0-9]{1,4}(?![^\\s]\\d)(?:\\s*[a|d]\\.?\\s*c\\.?|\\s*a\\.?\\s*d\\.?)?";
function parseYear7(match) {
  if (match.match(/^[0-9]{1,4}$/)) {
    let yearNumber = parseInt(match);
    if (yearNumber < 100) {
      if (yearNumber > 50) {
        yearNumber = yearNumber + 1900;
      } else {
        yearNumber = yearNumber + 2e3;
      }
    }
    return yearNumber;
  }
  if (match.match(/a\.?\s*c\.?/i)) {
    match = match.replace(/a\.?\s*c\.?/i, "");
    return -parseInt(match);
  }
  return parseInt(match);
}
var SINGLE_TIME_UNIT_PATTERN6 = `(${NUMBER_PATTERN6})\\s{0,5}(${matchAnyPattern(TIME_UNIT_DICTIONARY6)})\\s{0,5}`;
var SINGLE_TIME_UNIT_REGEX6 = new RegExp(SINGLE_TIME_UNIT_PATTERN6, "i");
var TIME_UNITS_PATTERN6 = repeatedTimeunitPattern("", SINGLE_TIME_UNIT_PATTERN6);
function parseDuration6(timeunitText) {
  const fragments = {};
  let remainingText = timeunitText;
  let match = SINGLE_TIME_UNIT_REGEX6.exec(remainingText);
  while (match) {
    collectDateTimeFragment6(fragments, match);
    remainingText = remainingText.substring(match[0].length);
    match = SINGLE_TIME_UNIT_REGEX6.exec(remainingText);
  }
  return fragments;
}
function collectDateTimeFragment6(fragments, match) {
  const num = parseNumberPattern6(match[1]);
  const unit = TIME_UNIT_DICTIONARY6[match[2].toLowerCase()];
  fragments[unit] = num;
}

// node_modules/chrono-node/dist/esm/locales/es/parsers/ESWeekdayParser.js
var PATTERN46 = new RegExp(`(?:(?:\\,|\\(|\\\uFF08)\\s*)?(?:(este|esta|pasado|pr[o\xF3]ximo)\\s*)?(${matchAnyPattern(WEEKDAY_DICTIONARY7)})(?:\\s*(?:\\,|\\)|\\\uFF09))?(?:\\s*(este|esta|pasado|pr[\xF3o]ximo)\\s*semana)?(?=\\W|\\d|$)`, "i");
var PREFIX_GROUP7 = 1;
var WEEKDAY_GROUP7 = 2;
var POSTFIX_GROUP6 = 3;
var ESWeekdayParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN46;
  }
  innerExtract(context, match) {
    const dayOfWeek = match[WEEKDAY_GROUP7].toLowerCase();
    const weekday = WEEKDAY_DICTIONARY7[dayOfWeek];
    if (weekday === void 0) {
      return null;
    }
    const prefix = match[PREFIX_GROUP7];
    const postfix = match[POSTFIX_GROUP6];
    let norm = prefix || postfix || "";
    norm = norm.toLowerCase();
    let modifier = null;
    if (norm == "pasado") {
      modifier = "this";
    } else if (norm == "pr\xF3ximo" || norm == "proximo") {
      modifier = "next";
    } else if (norm == "este") {
      modifier = "this";
    }
    return createParsingComponentsAtWeekday(context.reference, weekday, modifier);
  }
};

// node_modules/chrono-node/dist/esm/locales/es/parsers/ESTimeExpressionParser.js
var ESTimeExpressionParser = class extends AbstractTimeExpressionParser {
  primaryPrefix() {
    return "(?:(?:aslas|deslas|las?|al?|de|del)\\s*)?";
  }
  followingPhase() {
    return "\\s*(?:\\-|\\\u2013|\\~|\\\u301C|a(?:l)?|\\?)\\s*";
  }
};

// node_modules/chrono-node/dist/esm/locales/es/refiners/ESMergeDateTimeRefiner.js
var ESMergeDateTimeRefiner = class extends AbstractMergeDateTimeRefiner {
  patternBetween() {
    return new RegExp("^\\s*(?:,|de|aslas|a)?\\s*$");
  }
};

// node_modules/chrono-node/dist/esm/locales/es/refiners/ESMergeDateRangeRefiner.js
var ESMergeDateRangeRefiner = class extends AbstractMergeDateRangeRefiner {
  patternBetween() {
    return /^\s*(?:-)\s*$/i;
  }
};

// node_modules/chrono-node/dist/esm/locales/es/parsers/ESMonthNameLittleEndianParser.js
var PATTERN47 = new RegExp(`([0-9]{1,2})(?:\xBA|\xAA|\xB0)?(?:\\s*(?:desde|de|\\-|\\\u2013|ao?|\\s)\\s*([0-9]{1,2})(?:\xBA|\xAA|\xB0)?)?\\s*(?:de)?\\s*(?:-|/|\\s*(?:de|,)?\\s*)(${matchAnyPattern(MONTH_DICTIONARY7)})(?:\\s*(?:de|,)?\\s*(${YEAR_PATTERN8}))?(?=\\W|$)`, "i");
var DATE_GROUP10 = 1;
var DATE_TO_GROUP8 = 2;
var MONTH_NAME_GROUP14 = 3;
var YEAR_GROUP19 = 4;
var ESMonthNameLittleEndianParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN47;
  }
  innerExtract(context, match) {
    const result = context.createParsingResult(match.index, match[0]);
    const month = MONTH_DICTIONARY7[match[MONTH_NAME_GROUP14].toLowerCase()];
    const day = parseInt(match[DATE_GROUP10]);
    if (day > 31) {
      match.index = match.index + match[DATE_GROUP10].length;
      return null;
    }
    result.start.assign("month", month);
    result.start.assign("day", day);
    if (match[YEAR_GROUP19]) {
      const yearNumber = parseYear7(match[YEAR_GROUP19]);
      result.start.assign("year", yearNumber);
    } else {
      const year3 = findYearClosestToRef(context.refDate, day, month);
      result.start.imply("year", year3);
    }
    if (match[DATE_TO_GROUP8]) {
      const endDate = parseInt(match[DATE_TO_GROUP8]);
      result.end = result.start.clone();
      result.end.assign("day", endDate);
    }
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/es/parsers/ESCasualDateParser.js
var ESCasualDateParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern(context) {
    return /(ahora|hoy|mañana|ayer)(?=\W|$)/i;
  }
  innerExtract(context, match) {
    const lowerText = match[0].toLowerCase();
    const component = context.createParsingComponents();
    switch (lowerText) {
      case "ahora":
        return now(context.reference);
      case "hoy":
        return today(context.reference);
      case "ma\xF1ana":
        return tomorrow(context.reference);
      case "ayer":
        return yesterday(context.reference);
    }
    return component;
  }
};

// node_modules/chrono-node/dist/esm/locales/es/parsers/ESCasualTimeParser.js
var ESCasualTimeParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return /(?:esta\s*)?(mañana|tarde|medianoche|mediodia|mediodía|noche)(?=\W|$)/i;
  }
  innerExtract(context, match) {
    const targetDate = context.refDate;
    const component = context.createParsingComponents();
    switch (match[1].toLowerCase()) {
      case "tarde":
        component.imply("meridiem", Meridiem.PM);
        component.imply("hour", 15);
        component.addTag("casualReference/afternoon");
        break;
      case "noche":
        component.imply("meridiem", Meridiem.PM);
        component.imply("hour", 22);
        component.addTag("casualReference/evening");
        break;
      case "ma\xF1ana":
        component.imply("meridiem", Meridiem.AM);
        component.imply("hour", 6);
        component.addTag("casualReference/morning");
        break;
      case "medianoche":
        const nextDay = new Date(targetDate.getTime());
        nextDay.setDate(nextDay.getDate() + 1);
        assignSimilarDate(component, nextDay);
        implySimilarTime(component, nextDay);
        component.imply("hour", 0);
        component.imply("minute", 0);
        component.imply("second", 0);
        component.addTag("casualReference/midnight");
        break;
      case "mediodia":
      case "mediod\xEDa":
        component.imply("meridiem", Meridiem.AM);
        component.imply("hour", 12);
        component.addTag("casualReference/noon");
        break;
    }
    return component;
  }
};

// node_modules/chrono-node/dist/esm/locales/es/parsers/ESTimeUnitWithinFormatParser.js
var ESTimeUnitWithinFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return new RegExp(`(?:en|por|durante|de|dentro de)\\s*(${TIME_UNITS_PATTERN6})(?=\\W|$)`, "i");
  }
  innerExtract(context, match) {
    const timeUnits = parseDuration6(match[1]);
    return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
  }
};

// node_modules/chrono-node/dist/esm/locales/es/index.js
var casual11 = new Chrono(createCasualConfiguration10());
var strict11 = new Chrono(createConfiguration10(true));
function parse11(text, ref, option) {
  return casual11.parse(text, ref, option);
}
function parseDate11(text, ref, option) {
  return casual11.parseDate(text, ref, option);
}
function createCasualConfiguration10(littleEndian = true) {
  const option = createConfiguration10(false, littleEndian);
  option.parsers.push(new ESCasualDateParser());
  option.parsers.push(new ESCasualTimeParser());
  return option;
}
function createConfiguration10(strictMode = true, littleEndian = true) {
  return includeCommonConfiguration({
    parsers: [
      new SlashDateFormatParser(littleEndian),
      new ESWeekdayParser(),
      new ESTimeExpressionParser(),
      new ESMonthNameLittleEndianParser(),
      new ESTimeUnitWithinFormatParser()
    ],
    refiners: [new ESMergeDateTimeRefiner(), new ESMergeDateRangeRefiner()]
  }, strictMode);
}

// node_modules/chrono-node/dist/esm/locales/uk/index.js
var uk_exports = {};
__export(uk_exports, {
  Chrono: () => Chrono,
  Meridiem: () => Meridiem,
  ParsingComponents: () => ParsingComponents,
  ParsingResult: () => ParsingResult,
  ReferenceWithTimezone: () => ReferenceWithTimezone,
  Weekday: () => Weekday,
  casual: () => casual12,
  createCasualConfiguration: () => createCasualConfiguration11,
  createConfiguration: () => createConfiguration11,
  parse: () => parse12,
  parseDate: () => parseDate12,
  strict: () => strict12
});

// node_modules/chrono-node/dist/esm/locales/uk/constants.js
var REGEX_PARTS2 = {
  leftBoundary: "([^\\p{L}\\p{N}_]|^)",
  rightBoundary: "(?=[^\\p{L}\\p{N}_]|$)",
  flags: "iu"
};
var WEEKDAY_DICTIONARY8 = {
  "\u043D\u0435\u0434\u0456\u043B\u044F": 0,
  "\u043D\u0435\u0434\u0456\u043B\u0456": 0,
  "\u043D\u0435\u0434\u0456\u043B\u044E": 0,
  "\u043D\u0434": 0,
  "\u043D\u0434.": 0,
  "\u043F\u043E\u043D\u0435\u0434\u0456\u043B\u043E\u043A": 1,
  "\u043F\u043E\u043D\u0435\u0434\u0456\u043B\u043A\u0430": 1,
  "\u043F\u043D": 1,
  "\u043F\u043D.": 1,
  "\u0432\u0456\u0432\u0442\u043E\u0440\u043E\u043A": 2,
  "\u0432\u0456\u0432\u0442\u043E\u0440\u043A\u0430": 2,
  "\u0432\u0442": 2,
  "\u0432\u0442.": 2,
  "\u0441\u0435\u0440\u0435\u0434\u0430": 3,
  "\u0441\u0435\u0440\u0435\u0434\u0438": 3,
  "\u0441\u0435\u0440\u0435\u0434\u0443": 3,
  "\u0441\u0440": 3,
  "\u0441\u0440.": 3,
  "\u0447\u0435\u0442\u0432\u0435\u0440": 4,
  "\u0447\u0435\u0442\u0432\u0435\u0440\u0433\u0430": 4,
  "\u0447\u0435\u0442\u0432\u0435\u0440\u0433\u0443": 4,
  "\u0447\u0442": 4,
  "\u0447\u0442.": 4,
  "\u043F'\u044F\u0442\u043D\u0438\u0446\u044F": 5,
  "\u043F'\u044F\u0442\u043D\u0438\u0446\u0456": 5,
  "\u043F'\u044F\u0442\u043D\u0438\u0446\u044E": 5,
  "\u043F\u0442": 5,
  "\u043F\u0442.": 5,
  "\u0441\u0443\u0431\u043E\u0442\u0430": 6,
  "\u0441\u0443\u0431\u043E\u0442\u0438": 6,
  "\u0441\u0443\u0431\u043E\u0442\u0443": 6,
  "\u0441\u0431": 6,
  "\u0441\u0431.": 6
};
var FULL_MONTH_NAME_DICTIONARY3 = {
  "\u0441\u0456\u0447\u0435\u043D\u044C": 1,
  "\u0441\u0456\u0447\u043D\u044F": 1,
  "\u0441\u0456\u0447\u043D\u0456": 1,
  "\u043B\u044E\u0442\u0438\u0439": 2,
  "\u043B\u044E\u0442\u043E\u0433\u043E": 2,
  "\u043B\u044E\u0442\u043E\u043C\u0443": 2,
  "\u0431\u0435\u0440\u0435\u0437\u0435\u043D\u044C": 3,
  "\u0431\u0435\u0440\u0435\u0437\u043D\u044F": 3,
  "\u0431\u0435\u0440\u0435\u0437\u043D\u0456": 3,
  "\u043A\u0432\u0456\u0442\u0435\u043D\u044C": 4,
  "\u043A\u0432\u0456\u0442\u043D\u044F": 4,
  "\u043A\u0432\u0456\u0442\u043D\u0456": 4,
  "\u0442\u0440\u0430\u0432\u0435\u043D\u044C": 5,
  "\u0442\u0440\u0430\u0432\u043D\u044F": 5,
  "\u0442\u0440\u0430\u0432\u043D\u0456": 5,
  "\u0447\u0435\u0440\u0432\u0435\u043D\u044C": 6,
  "\u0447\u0435\u0440\u0432\u043D\u044F": 6,
  "\u0447\u0435\u0440\u0432\u043D\u0456": 6,
  "\u043B\u0438\u043F\u0435\u043D\u044C": 7,
  "\u043B\u0438\u043F\u043D\u044F": 7,
  "\u043B\u0438\u043F\u043D\u0456": 7,
  "\u0441\u0435\u0440\u043F\u0435\u043D\u044C": 8,
  "\u0441\u0435\u0440\u043F\u043D\u044F": 8,
  "\u0441\u0435\u0440\u043F\u043D\u0456": 8,
  "\u0432\u0435\u0440\u0435\u0441\u0435\u043D\u044C": 9,
  "\u0432\u0435\u0440\u0435\u0441\u043D\u044F": 9,
  "\u0432\u0435\u0440\u0435\u0441\u043D\u0456": 9,
  "\u0436\u043E\u0432\u0442\u0435\u043D\u044C": 10,
  "\u0436\u043E\u0432\u0442\u043D\u044F": 10,
  "\u0436\u043E\u0432\u0442\u043D\u0456": 10,
  "\u043B\u0438\u0441\u0442\u043E\u043F\u0430\u0434": 11,
  "\u043B\u0438\u0441\u0442\u043E\u043F\u0430\u0434\u0430": 11,
  "\u043B\u0438\u0441\u0442\u043E\u043F\u0430\u0434\u0443": 11,
  "\u0433\u0440\u0443\u0434\u0435\u043D\u044C": 12,
  "\u0433\u0440\u0443\u0434\u043D\u044F": 12,
  "\u0433\u0440\u0443\u0434\u043D\u0456": 12
};
var MONTH_DICTIONARY8 = {
  ...FULL_MONTH_NAME_DICTIONARY3,
  "\u0441\u0456\u0447": 1,
  "\u0441\u0456\u0447.": 1,
  "\u043B\u044E\u0442": 2,
  "\u043B\u044E\u0442.": 2,
  "\u0431\u0435\u0440": 3,
  "\u0431\u0435\u0440.": 3,
  "\u043A\u0432\u0456\u0442": 4,
  "\u043A\u0432\u0456\u0442.": 4,
  "\u0442\u0440\u0430\u0432": 5,
  "\u0442\u0440\u0430\u0432.": 5,
  "\u0447\u0435\u0440\u0432": 6,
  "\u0447\u0435\u0440\u0432.": 6,
  "\u043B\u0438\u043F": 7,
  "\u043B\u0438\u043F.": 7,
  "\u0441\u0435\u0440\u043F": 8,
  "\u0441\u0435\u0440\u043F.": 8,
  "\u0441\u0435\u0440": 8,
  "c\u0435\u0440.": 8,
  "\u0432\u0435\u0440": 9,
  "\u0432\u0435\u0440.": 9,
  "\u0432\u0435\u0440\u0435\u0441": 9,
  "\u0432\u0435\u0440\u0435\u0441.": 9,
  "\u0436\u043E\u0432\u0442": 10,
  "\u0436\u043E\u0432\u0442.": 10,
  "\u043B\u0438\u0441\u0442\u043E\u043F": 11,
  "\u043B\u0438\u0441\u0442\u043E\u043F.": 11,
  "\u0433\u0440\u0443\u0434": 12,
  "\u0433\u0440\u0443\u0434.": 12
};
var INTEGER_WORD_DICTIONARY7 = {
  "\u043E\u0434\u0438\u043D": 1,
  "\u043E\u0434\u043D\u0430": 1,
  "\u043E\u0434\u043D\u043E\u0457": 1,
  "\u043E\u0434\u043D\u0443": 1,
  "\u0434\u0432\u0456": 2,
  "\u0434\u0432\u0430": 2,
  "\u0434\u0432\u043E\u0445": 2,
  "\u0442\u0440\u0438": 3,
  "\u0442\u0440\u044C\u043E\u0445": 3,
  "\u0447\u043E\u0442\u0438\u0440\u0438": 4,
  "\u0447\u043E\u0442\u0438\u0440\u044C\u043E\u0445": 4,
  "\u043F'\u044F\u0442\u044C": 5,
  "\u043F'\u044F\u0442\u0438": 5,
  "\u0448\u0456\u0441\u0442\u044C": 6,
  "\u0448\u0435\u0441\u0442\u0438": 6,
  "\u0441\u0456\u043C": 7,
  "\u0441\u0435\u043C\u0438": 7,
  "\u0432\u0456\u0441\u0456\u043C": 8,
  "\u0432\u043E\u0441\u044C\u043C\u0438": 8,
  "\u0434\u0435\u0432'\u044F\u0442\u044C": 9,
  "\u0434\u0435\u0432'\u044F\u0442\u0438": 9,
  "\u0434\u0435\u0441\u044F\u0442\u044C": 10,
  "\u0434\u0435\u0441\u044F\u0442\u0438": 10,
  "\u043E\u0434\u0438\u043D\u0430\u0434\u0446\u044F\u0442\u044C": 11,
  "\u043E\u0434\u0438\u043D\u0430\u0434\u0446\u044F\u0442\u0438": 11,
  "\u0434\u0432\u0430\u043D\u0430\u0434\u0446\u044F\u0442\u044C": 12,
  "\u0434\u0432\u0430\u043D\u0430\u0434\u0446\u044F\u0442\u0438": 12
};
var ORDINAL_WORD_DICTIONARY4 = {
  "\u043F\u0435\u0440\u0448\u0435": 1,
  "\u043F\u0435\u0440\u0448\u043E\u0433\u043E": 1,
  "\u0434\u0440\u0443\u0433\u0435": 2,
  "\u0434\u0440\u0443\u0433\u043E\u0433\u043E": 2,
  "\u0442\u0440\u0435\u0442\u0454": 3,
  "\u0442\u0440\u0435\u0442\u044C\u043E\u0433\u043E": 3,
  "\u0447\u0435\u0442\u0432\u0435\u0440\u0442\u0435": 4,
  "\u0447\u0435\u0442\u0432\u0435\u0440\u0442\u043E\u0433\u043E": 4,
  "\u043F'\u044F\u0442\u0435": 5,
  "\u043F'\u044F\u0442\u043E\u0433\u043E": 5,
  "\u0448\u043E\u0441\u0442\u0435": 6,
  "\u0448\u043E\u0441\u0442\u043E\u0433\u043E": 6,
  "\u0441\u044C\u043E\u043C\u0435": 7,
  "\u0441\u044C\u043E\u043C\u043E\u0433\u043E": 7,
  "\u0432\u043E\u0441\u044C\u043C\u0435": 8,
  "\u0432\u043E\u0441\u044C\u043C\u043E\u0433\u043E": 8,
  "\u0434\u0435\u0432'\u044F\u0442\u0435": 9,
  "\u0434\u0435\u0432'\u044F\u0442\u043E\u0433\u043E": 9,
  "\u0434\u0435\u0441\u044F\u0442\u0435": 10,
  "\u0434\u0435\u0441\u044F\u0442\u043E\u0433\u043E": 10,
  "\u043E\u0434\u0438\u043D\u0430\u0434\u0446\u044F\u0442\u0435": 11,
  "\u043E\u0434\u0438\u043D\u0430\u0434\u0446\u044F\u0442\u043E\u0433\u043E": 11,
  "\u0434\u0432\u0430\u043D\u0430\u0434\u0446\u044F\u0442\u0435": 12,
  "\u0434\u0432\u0430\u043D\u0430\u0434\u0446\u044F\u0442\u043E\u0433\u043E": 12,
  "\u0442\u0440\u0438\u043D\u0430\u0434\u0446\u044F\u0442\u0435": 13,
  "\u0442\u0440\u0438\u043D\u0430\u0434\u0446\u044F\u0442\u043E\u0433\u043E": 13,
  "\u0447\u043E\u0442\u0438\u0440\u043D\u0430\u0434\u0446\u044F\u0442\u0435": 14,
  "\u0447\u043E\u0442\u0438\u043D\u0440\u043D\u0430\u0434\u0446\u044F\u0442\u043E\u0433\u043E": 14,
  "\u043F'\u044F\u0442\u043D\u0430\u0434\u0446\u044F\u0442\u0435": 15,
  "\u043F'\u044F\u0442\u043D\u0430\u0434\u0446\u044F\u0442\u043E\u0433\u043E": 15,
  "\u0448\u0456\u0441\u0442\u043D\u0430\u0434\u0446\u044F\u0442\u0435": 16,
  "\u0448\u0456\u0441\u0442\u043D\u0430\u0434\u0446\u044F\u0442\u043E\u0433\u043E": 16,
  "\u0441\u0456\u043C\u043D\u0430\u0434\u0446\u044F\u0442\u0435": 17,
  "\u0441\u0456\u043C\u043D\u0430\u0434\u0446\u044F\u0442\u043E\u0433\u043E": 17,
  "\u0432\u0456\u0441\u0456\u043C\u043D\u0430\u0434\u0446\u044F\u0442\u0435": 18,
  "\u0432\u0456\u0441\u0456\u043C\u043D\u0430\u0434\u0446\u044F\u0442\u043E\u0433\u043E": 18,
  "\u0434\u0435\u0432'\u044F\u0442\u043D\u0430\u0434\u0446\u044F\u0442\u0435": 19,
  "\u0434\u0435\u0432'\u044F\u0442\u043D\u0430\u0434\u0446\u044F\u0442\u043E\u0433\u043E": 19,
  "\u0434\u0432\u0430\u0434\u0446\u044F\u0442\u0435": 20,
  "\u0434\u0432\u0430\u0434\u0446\u044F\u0442\u043E\u0433\u043E": 20,
  "\u0434\u0432\u0430\u0434\u0446\u044F\u0442\u044C \u043F\u0435\u0440\u0448\u0435": 21,
  "\u0434\u0432\u0430\u0434\u0446\u044F\u0442\u044C \u043F\u0435\u0440\u0448\u043E\u0433\u043E": 21,
  "\u0434\u0432\u0430\u0434\u0446\u044F\u0442\u044C \u0434\u0440\u0443\u0433\u0435": 22,
  "\u0434\u0432\u0430\u0434\u0446\u044F\u0442\u044C \u0434\u0440\u0443\u0433\u043E\u0433\u043E": 22,
  "\u0434\u0432\u0430\u0434\u0446\u044F\u0442\u044C \u0442\u0440\u0435\u0442\u0454": 23,
  "\u0434\u0432\u0430\u0434\u0446\u044F\u0442\u044C \u0442\u0440\u0435\u0442\u044C\u043E\u0433\u043E": 23,
  "\u0434\u0432\u0430\u0434\u0446\u044F\u0442\u044C \u0447\u0435\u0442\u0432\u0435\u0440\u0442\u0435": 24,
  "\u0434\u0432\u0430\u0434\u0446\u044F\u0442\u044C \u0447\u0435\u0442\u0432\u0435\u0440\u0442\u043E\u0433\u043E": 24,
  "\u0434\u0432\u0430\u0434\u0446\u044F\u0442\u044C \u043F'\u044F\u0442\u0435": 25,
  "\u0434\u0432\u0430\u0434\u0446\u044F\u0442\u044C \u043F'\u044F\u0442\u043E\u0433\u043E": 25,
  "\u0434\u0432\u0430\u0434\u0446\u044F\u0442\u044C \u0448\u043E\u0441\u0442\u0435": 26,
  "\u0434\u0432\u0430\u0434\u0446\u044F\u0442\u044C \u0448\u043E\u0441\u0442\u043E\u0433\u043E": 26,
  "\u0434\u0432\u0430\u0434\u0446\u044F\u0442\u044C \u0441\u044C\u043E\u043C\u0435": 27,
  "\u0434\u0432\u0430\u0434\u0446\u044F\u0442\u044C \u0441\u044C\u043E\u043C\u043E\u0433\u043E": 27,
  "\u0434\u0432\u0430\u0434\u0446\u044F\u0442\u044C \u0432\u043E\u0441\u044C\u043C\u0435": 28,
  "\u0434\u0432\u0430\u0434\u0446\u044F\u0442\u044C \u0432\u043E\u0441\u044C\u043C\u043E\u0433\u043E": 28,
  "\u0434\u0432\u0430\u0434\u0446\u044F\u0442\u044C \u0434\u0435\u0432'\u044F\u0442\u0435": 29,
  "\u0434\u0432\u0430\u0434\u0446\u044F\u0442\u044C \u0434\u0435\u0432'\u044F\u0442\u043E\u0433\u043E": 29,
  "\u0442\u0440\u0438\u0434\u0446\u044F\u0442\u0435": 30,
  "\u0442\u0440\u0438\u0434\u0446\u044F\u0442\u043E\u0433\u043E": 30,
  "\u0442\u0440\u0438\u0434\u0446\u044F\u0442\u044C \u043F\u0435\u0440\u0448\u0435": 31,
  "\u0442\u0440\u0438\u0434\u0446\u044F\u0442\u044C \u043F\u0435\u0440\u0448\u043E\u0433\u043E": 31
};
var TIME_UNIT_DICTIONARY7 = {
  \u0441\u0435\u043A: "second",
  \u0441\u0435\u043A\u0443\u043D\u0434\u0430: "second",
  \u0441\u0435\u043A\u0443\u043D\u0434: "second",
  \u0441\u0435\u043A\u0443\u043D\u0434\u0438: "second",
  \u0441\u0435\u043A\u0443\u043D\u0434\u0443: "second",
  \u0441\u0435\u043A\u0443\u043D\u0434\u043E\u0447\u043E\u043A: "second",
  \u0441\u0435\u043A\u0443\u043D\u0434\u043E\u0447\u043A\u0438: "second",
  \u0441\u0435\u043A\u0443\u043D\u0434\u043E\u0447\u043A\u0443: "second",
  \u0445\u0432: "minute",
  \u0445\u0432\u0438\u043B\u0438\u043D\u0430: "minute",
  \u0445\u0432\u0438\u043B\u0438\u043D: "minute",
  \u0445\u0432\u0438\u043B\u0438\u043D\u0438: "minute",
  \u0445\u0432\u0438\u043B\u0438\u043D\u0443: "minute",
  \u0445\u0432\u0438\u043B\u0438\u043D\u043E\u043A: "minute",
  \u0445\u0432\u0438\u043B\u0438\u043D\u043A\u0438: "minute",
  \u0445\u0432\u0438\u043B\u0438\u043D\u043A\u0443: "minute",
  \u0445\u0432\u0438\u043B\u0438\u043D\u043E\u0447\u043E\u043A: "minute",
  \u0445\u0432\u0438\u043B\u0438\u043D\u043E\u0447\u043A\u0438: "minute",
  \u0445\u0432\u0438\u043B\u0438\u043D\u043E\u0447\u043A\u0443: "minute",
  \u0433\u043E\u0434: "hour",
  \u0433\u043E\u0434\u0438\u043D\u0430: "hour",
  \u0433\u043E\u0434\u0438\u043D: "hour",
  \u0433\u043E\u0434\u0438\u043D\u0438: "hour",
  \u0433\u043E\u0434\u0438\u043D\u0443: "hour",
  \u0433\u043E\u0434\u0438\u043D\u043A\u0430: "hour",
  \u0433\u043E\u0434\u0438\u043D\u043E\u043A: "hour",
  \u0433\u043E\u0434\u0438\u043D\u043A\u0438: "hour",
  \u0433\u043E\u0434\u0438\u043D\u043A\u0443: "hour",
  \u0434\u0435\u043D\u044C: "day",
  \u0434\u043D\u044F: "day",
  \u0434\u043D\u0456\u0432: "day",
  \u0434\u043D\u0456: "day",
  \u0434\u043E\u0431\u0430: "day",
  \u0434\u043E\u0431\u0443: "day",
  \u0442\u0438\u0436\u0434\u0435\u043D\u044C: "week",
  \u0442\u0438\u0436\u043D\u044E: "week",
  \u0442\u0438\u0436\u043D\u044F: "week",
  \u0442\u0438\u0436\u043D\u0456: "week",
  \u0442\u0438\u0436\u043D\u0456\u0432: "week",
  \u043C\u0456\u0441\u044F\u0446\u044C: "month",
  \u043C\u0456\u0441\u044F\u0446\u0456\u0432: "month",
  \u043C\u0456\u0441\u044F\u0446\u0456: "month",
  \u043C\u0456\u0441\u044F\u0446\u044F: "month",
  \u043A\u0432\u0430\u0440\u0442\u0430\u043B: "quarter",
  \u043A\u0432\u0430\u0440\u0442\u0430\u043B\u0443: "quarter",
  \u043A\u0432\u0430\u0440\u0442\u0430\u043B\u0430: "quarter",
  \u043A\u0432\u0430\u0440\u0442\u0430\u043B\u0456\u0432: "quarter",
  \u043A\u0432\u0430\u0440\u0442\u0430\u043B\u0456: "quarter",
  \u0440\u0456\u043A: "year",
  \u0440\u043E\u043A\u0443: "year",
  \u0440\u043E\u0446\u0456: "year",
  \u0440\u043E\u043A\u0456\u0432: "year",
  \u0440\u043E\u043A\u0438: "year"
};
var NUMBER_PATTERN7 = `(?:${matchAnyPattern(INTEGER_WORD_DICTIONARY7)}|[0-9]+|[0-9]+\\.[0-9]+|\u043F\u0456\u0432|\u0434\u0435\u043A\u0456\u043B\u044C\u043A\u0430|\u043F\u0430\u0440(?:\u0443)|\\s{0,3})`;
function parseNumberPattern7(match) {
  const num = match.toLowerCase();
  if (INTEGER_WORD_DICTIONARY7[num] !== void 0) {
    return INTEGER_WORD_DICTIONARY7[num];
  }
  if (num.match(/декілька/)) {
    return 2;
  } else if (num.match(/пів/)) {
    return 0.5;
  } else if (num.match(/пар/)) {
    return 2;
  } else if (num === "") {
    return 1;
  }
  return parseFloat(num);
}
var ORDINAL_NUMBER_PATTERN5 = `(?:${matchAnyPattern(ORDINAL_WORD_DICTIONARY4)}|[0-9]{1,2}(?:\u0433\u043E|\u043E\u0433\u043E|\u0435)?)`;
function parseOrdinalNumberPattern5(match) {
  const num = match.toLowerCase();
  if (ORDINAL_WORD_DICTIONARY4[num] !== void 0) {
    return ORDINAL_WORD_DICTIONARY4[num];
  }
  return parseInt(num);
}
var year2 = "(?:\\s+(?:\u0440\u043E\u043A\u0443|\u0440\u0456\u043A|\u0440|\u0440.))?";
var YEAR_PATTERN9 = `(?:[1-9][0-9]{0,3}${year2}\\s*(?:\u043D.\u0435.|\u0434\u043E \u043D.\u0435.|\u043D. \u0435.|\u0434\u043E \u043D. \u0435.)|[1-2][0-9]{3}${year2}|[5-9][0-9]${year2})`;
function parseYearPattern(match) {
  if (/(рік|року|р|р.)/i.test(match)) {
    match = match.replace(/(рік|року|р|р.)/i, "");
  }
  if (/(до н.е.|до н. е.)/i.test(match)) {
    match = match.replace(/(до н.е.|до н. е.)/i, "");
    return -parseInt(match);
  }
  if (/(н. е.|н.е.)/i.test(match)) {
    match = match.replace(/(н. е.|н.е.)/i, "");
    return parseInt(match);
  }
  const rawYearNumber = parseInt(match);
  return findMostLikelyADYear(rawYearNumber);
}
var SINGLE_TIME_UNIT_PATTERN7 = `(${NUMBER_PATTERN7})\\s{0,3}(${matchAnyPattern(TIME_UNIT_DICTIONARY7)})`;
var SINGLE_TIME_UNIT_REGEX7 = new RegExp(SINGLE_TIME_UNIT_PATTERN7, "i");
var TIME_UNITS_PATTERN7 = repeatedTimeunitPattern(`(?:(?:\u0431\u043B\u0438\u0437\u044C\u043A\u043E|\u043F\u0440\u0438\u0431\u043B\u0438\u0437\u043D\u043E)\\s{0,3})?`, SINGLE_TIME_UNIT_PATTERN7);
function parseDuration7(timeunitText) {
  const fragments = {};
  let remainingText = timeunitText;
  let match = SINGLE_TIME_UNIT_REGEX7.exec(remainingText);
  while (match) {
    collectDateTimeFragment7(fragments, match);
    remainingText = remainingText.substring(match[0].length).trim();
    match = SINGLE_TIME_UNIT_REGEX7.exec(remainingText);
  }
  return fragments;
}
function collectDateTimeFragment7(fragments, match) {
  const num = parseNumberPattern7(match[1]);
  const unit = TIME_UNIT_DICTIONARY7[match[2].toLowerCase()];
  fragments[unit] = num;
}

// node_modules/chrono-node/dist/esm/locales/uk/parsers/UKTimeUnitWithinFormatParser.js
var PATTERN48 = `(?:(?:\u043F\u0440\u0438\u0431\u043B\u0438\u0437\u043D\u043E|\u043E\u0440\u0456\u0454\u043D\u0442\u043E\u0432\u043D\u043E)\\s*(?:~\\s*)?)?(${TIME_UNITS_PATTERN7})${REGEX_PARTS2.rightBoundary}`;
var UKTimeUnitWithinFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  patternLeftBoundary() {
    return REGEX_PARTS2.leftBoundary;
  }
  innerPattern(context) {
    return context.option.forwardDate ? new RegExp(PATTERN48, REGEX_PARTS2.flags) : new RegExp(`(?:\u043F\u0440\u043E\u0442\u044F\u0433\u043E\u043C|\u043D\u0430 \u043F\u0440\u043E\u0442\u044F\u0437\u0456|\u043F\u0440\u043E\u0442\u044F\u0433\u043E\u043C|\u0443\u043F\u0440\u043E\u0434\u043E\u0432\u0436|\u0432\u043F\u0440\u043E\u0434\u043E\u0432\u0436)\\s*${PATTERN48}`, REGEX_PARTS2.flags);
  }
  innerExtract(context, match) {
    const timeUnits = parseDuration7(match[1]);
    return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
  }
};

// node_modules/chrono-node/dist/esm/locales/uk/parsers/AbstractParserWithWordBoundaryChecking.js
var AbstractParserWithLeftBoundaryChecking2 = class extends AbstractParserWithWordBoundaryChecking {
  patternLeftBoundary() {
    return REGEX_PARTS2.leftBoundary;
  }
  innerPattern(context) {
    return new RegExp(this.innerPatternString(context), REGEX_PARTS2.flags);
  }
  innerPatternHasChange(context, currentInnerPattern) {
    return false;
  }
};
var AbstractParserWithLeftRightBoundaryChecking2 = class extends AbstractParserWithLeftBoundaryChecking2 {
  innerPattern(context) {
    return new RegExp(`${this.innerPatternString(context)}${REGEX_PARTS2.rightBoundary}`, REGEX_PARTS2.flags);
  }
};

// node_modules/chrono-node/dist/esm/locales/uk/parsers/UKMonthNameLittleEndianParser.js
var DATE_GROUP11 = 1;
var DATE_TO_GROUP9 = 2;
var MONTH_NAME_GROUP15 = 3;
var YEAR_GROUP20 = 4;
var UKMonthNameLittleEndianParser = class extends AbstractParserWithLeftRightBoundaryChecking2 {
  innerPatternString(context) {
    return `(?:\u0437|\u0456\u0437)?\\s*(${ORDINAL_NUMBER_PATTERN5})(?:\\s{0,3}(?:\u043F\u043E|-|\u2013|\u0434\u043E)?\\s{0,3}(${ORDINAL_NUMBER_PATTERN5}))?(?:-|\\/|\\s{0,3}(?:of)?\\s{0,3})(${matchAnyPattern(MONTH_DICTIONARY8)})(?:(?:-|\\/|,?\\s{0,3})(${YEAR_PATTERN9}(?![^\\s]\\d)))?`;
  }
  innerExtract(context, match) {
    const result = context.createParsingResult(match.index, match[0]);
    const month = MONTH_DICTIONARY8[match[MONTH_NAME_GROUP15].toLowerCase()];
    const day = parseOrdinalNumberPattern5(match[DATE_GROUP11]);
    if (day > 31) {
      match.index = match.index + match[DATE_GROUP11].length;
      return null;
    }
    result.start.assign("month", month);
    result.start.assign("day", day);
    if (match[YEAR_GROUP20]) {
      const yearNumber = parseYearPattern(match[YEAR_GROUP20]);
      result.start.assign("year", yearNumber);
    } else {
      const year3 = findYearClosestToRef(context.reference.instant, day, month);
      result.start.imply("year", year3);
    }
    if (match[DATE_TO_GROUP9]) {
      const endDate = parseOrdinalNumberPattern5(match[DATE_TO_GROUP9]);
      result.end = result.start.clone();
      result.end.assign("day", endDate);
    }
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/uk/parsers/UKMonthNameParser.js
var MONTH_NAME_GROUP16 = 2;
var YEAR_GROUP21 = 3;
var UkMonthNameParser = class extends AbstractParserWithLeftBoundaryChecking2 {
  innerPatternString(context) {
    return `((?:\u0432|\u0443)\\s*)?(${matchAnyPattern(MONTH_DICTIONARY8)})\\s*(?:[,-]?\\s*(${YEAR_PATTERN9})?)?(?=[^\\s\\w]|\\s+[^0-9]|\\s+$|$)`;
  }
  innerExtract(context, match) {
    const monthName = match[MONTH_NAME_GROUP16].toLowerCase();
    if (match[0].length <= 3 && !FULL_MONTH_NAME_DICTIONARY3[monthName]) {
      return null;
    }
    const result = context.createParsingResult(match.index, match.index + match[0].length);
    result.start.imply("day", 1);
    const month = MONTH_DICTIONARY8[monthName];
    result.start.assign("month", month);
    if (match[YEAR_GROUP21]) {
      const year3 = parseYearPattern(match[YEAR_GROUP21]);
      result.start.assign("year", year3);
    } else {
      const year3 = findYearClosestToRef(context.reference.instant, 1, month);
      result.start.imply("year", year3);
    }
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/uk/parsers/UKTimeExpressionParser.js
var UKTimeExpressionParser = class extends AbstractTimeExpressionParser {
  constructor(strictMode) {
    super(strictMode);
  }
  patternFlags() {
    return REGEX_PARTS2.flags;
  }
  primaryPatternLeftBoundary() {
    return `(^|\\s|T|(?:[^\\p{L}\\p{N}_]))`;
  }
  followingPhase() {
    return `\\s*(?:\\-|\\\u2013|\\~|\\\u301C|\u0434\u043E|\u0456|\u043F\u043E|\\?)\\s*`;
  }
  primaryPrefix() {
    return `(?:(?:\u0432|\u0443|\u043E|\u043E\u0431|\u0437|\u0456\u0437|\u0432\u0456\u0434)\\s*)??`;
  }
  primarySuffix() {
    return `(?:\\s*(?:\u0440\u0430\u043D\u043A\u0443|\u0432\u0435\u0447\u043E\u0440\u0430|\u043F\u043E \u043E\u0431\u0456\u0434\u0456|\u043F\u0456\u0441\u043B\u044F \u043E\u0431\u0456\u0434\u0443))?(?!\\/)${REGEX_PARTS2.rightBoundary}`;
  }
  extractPrimaryTimeComponents(context, match) {
    const components = super.extractPrimaryTimeComponents(context, match);
    if (components) {
      if (match[0].endsWith("\u0432\u0435\u0447\u043E\u0440\u0430")) {
        const hour = components.get("hour");
        if (hour >= 6 && hour < 12) {
          components.assign("hour", components.get("hour") + 12);
          components.assign("meridiem", Meridiem.PM);
        } else if (hour < 6) {
          components.assign("meridiem", Meridiem.AM);
        }
      }
      if (match[0].endsWith("\u043F\u043E \u043E\u0431\u0456\u0434\u0456") || match[0].endsWith("\u043F\u0456\u0441\u043B\u044F \u043E\u0431\u0456\u0434\u0443")) {
        components.assign("meridiem", Meridiem.PM);
        const hour = components.get("hour");
        if (hour >= 0 && hour <= 6) {
          components.assign("hour", components.get("hour") + 12);
        }
      }
      if (match[0].endsWith("\u0440\u0430\u043D\u043A\u0443")) {
        components.assign("meridiem", Meridiem.AM);
        const hour = components.get("hour");
        if (hour < 12) {
          components.assign("hour", components.get("hour"));
        }
      }
    }
    return components;
  }
};

// node_modules/chrono-node/dist/esm/locales/uk/parsers/UKTimeUnitAgoFormatParser.js
var UKTimeUnitAgoFormatParser = class extends AbstractParserWithLeftBoundaryChecking2 {
  innerPatternString(context) {
    return `(${TIME_UNITS_PATTERN7})\\s{0,5}\u0442\u043E\u043C\u0443(?=(?:\\W|$))`;
  }
  innerExtract(context, match) {
    const timeUnits = parseDuration7(match[1]);
    const outputTimeUnits = reverseDuration(timeUnits);
    return ParsingComponents.createRelativeFromReference(context.reference, outputTimeUnits);
  }
};

// node_modules/chrono-node/dist/esm/locales/uk/refiners/UKMergeDateRangeRefiner.js
var UKMergeDateRangeRefiner = class extends AbstractMergeDateRangeRefiner {
  patternBetween() {
    return /^\s*(і до|і по|до|по|-)\s*$/i;
  }
};

// node_modules/chrono-node/dist/esm/locales/uk/refiners/UKMergeDateTimeRefiner.js
var UKMergeDateTimeRefiner = class extends AbstractMergeDateTimeRefiner {
  patternBetween() {
    return new RegExp(`^\\s*(T|\u0432|\u0443|\u043E|,|-)?\\s*$`);
  }
};

// node_modules/chrono-node/dist/esm/locales/uk/parsers/UKCasualDateParser.js
var UKCasualDateParser = class extends AbstractParserWithLeftRightBoundaryChecking2 {
  innerPatternString(context) {
    return `(?:\u0437|\u0456\u0437|\u0432\u0456\u0434)?\\s*(\u0441\u044C\u043E\u0433\u043E\u0434\u043D\u0456|\u0432\u0447\u043E\u0440\u0430|\u0437\u0430\u0432\u0442\u0440\u0430|\u043F\u0456\u0441\u043B\u044F\u0437\u0430\u0432\u0442\u0440\u0430|\u043F\u0456\u0441\u043B\u044F\u043F\u0456\u0441\u043B\u044F\u0437\u0430\u0432\u0442\u0440\u0430|\u043F\u043E\u0437\u0430\u043F\u043E\u0437\u0430\u0432\u0447\u043E\u0440\u0430|\u043F\u043E\u0437\u0430\u0432\u0447\u043E\u0440\u0430)`;
  }
  innerExtract(context, match) {
    const lowerText = match[1].toLowerCase();
    const component = context.createParsingComponents();
    switch (lowerText) {
      case "\u0441\u044C\u043E\u0433\u043E\u0434\u043D\u0456":
        return today(context.reference);
      case "\u0432\u0447\u043E\u0440\u0430":
        return yesterday(context.reference);
      case "\u0437\u0430\u0432\u0442\u0440\u0430":
        return tomorrow(context.reference);
      case "\u043F\u0456\u0441\u043B\u044F\u0437\u0430\u0432\u0442\u0440\u0430":
        return theDayAfter(context.reference, 2);
      case "\u043F\u0456\u0441\u043B\u044F\u043F\u0456\u0441\u043B\u044F\u0437\u0430\u0432\u0442\u0440\u0430":
        return theDayAfter(context.reference, 3);
      case "\u043F\u043E\u0437\u0430\u0432\u0447\u043E\u0440\u0430":
        return theDayBefore(context.reference, 2);
      case "\u043F\u043E\u0437\u0430\u043F\u043E\u0437\u0430\u0432\u0447\u043E\u0440\u0430":
        return theDayBefore(context.reference, 3);
    }
    return component;
  }
};

// node_modules/chrono-node/dist/esm/locales/uk/parsers/UKCasualTimeParser.js
var UKCasualTimeParser = class extends AbstractParserWithLeftRightBoundaryChecking2 {
  innerPatternString(context) {
    return `(\u0437\u0430\u0440\u0430\u0437|\u043C\u0438\u043D\u0443\u043B\u043E\u0433\u043E\\s*\u0432\u0435\u0447\u043E\u0440\u0430|\u043C\u0438\u043D\u0443\u043B\u043E\u0457\\s*\u043D\u043E\u0447\u0456|\u043D\u0430\u0441\u0442\u0443\u043F\u043D\u043E\u0457\\s*\u043D\u043E\u0447\u0456|\u0441\u044C\u043E\u0433\u043E\u0434\u043D\u0456\\s*\u0432\u043D\u043E\u0447\u0456|\u0446\u0456\u0454\u0457\\s*\u043D\u043E\u0447\u0456|\u0446\u044C\u043E\u0433\u043E \u0440\u0430\u043D\u043A\u0443|\u0432\u0440\u0430\u043D\u0446\u0456|\u0440\u0430\u043D\u043A\u0443|\u0437\u0440\u0430\u043D\u043A\u0443|\u043E\u043F\u0456\u0432\u0434\u043D\u0456|\u0432\u0432\u0435\u0447\u0435\u0440\u0456|\u0432\u0435\u0447\u043E\u0440\u0430|\u043E\u043F\u0456\u0432\u043D\u043E\u0447\u0456|\u0432\u043D\u043E\u0447\u0456)`;
  }
  innerExtract(context, match) {
    let targetDate = context.refDate;
    const lowerText = match[0].toLowerCase();
    const component = context.createParsingComponents();
    if (lowerText === "\u0437\u0430\u0440\u0430\u0437") {
      return now(context.reference);
    }
    if (lowerText === "\u0432\u0432\u0435\u0447\u0435\u0440\u0456" || lowerText === "\u0432\u0435\u0447\u043E\u0440\u0430") {
      return evening(context.reference);
    }
    if (lowerText.endsWith("\u0432\u0440\u0430\u043D\u0446\u0456") || lowerText.endsWith("\u0440\u0430\u043D\u043A\u0443") || lowerText.endsWith("\u0437\u0440\u0430\u043D\u043A\u0443")) {
      return morning(context.reference);
    }
    if (lowerText.endsWith("\u043E\u043F\u0456\u0432\u0434\u043D\u0456")) {
      return noon(context.reference);
    }
    if (lowerText.match(/минулої\s*ночі/)) {
      return lastNight(context.reference);
    }
    if (lowerText.match(/минулого\s*вечора/)) {
      return yesterdayEvening(context.reference);
    }
    if (lowerText.match(/наступної\s*ночі/)) {
      const daysToAdd = targetDate.getHours() < 22 ? 1 : 2;
      const nextDay = new Date(targetDate.getTime());
      nextDay.setDate(nextDay.getDate() + daysToAdd);
      assignSimilarDate(component, nextDay);
      component.imply("hour", 1);
    }
    if (lowerText.match(/цієї\s*ночі/)) {
      return midnight(context.reference);
    }
    if (lowerText.endsWith("\u043E\u043F\u0456\u0432\u043D\u043E\u0447\u0456") || lowerText.endsWith("\u0432\u043D\u043E\u0447\u0456")) {
      return midnight(context.reference);
    }
    return component;
  }
};

// node_modules/chrono-node/dist/esm/locales/uk/parsers/UKWeekdayParser.js
var PREFIX_GROUP8 = 1;
var WEEKDAY_GROUP8 = 2;
var POSTFIX_GROUP7 = 3;
var UKWeekdayParser = class extends AbstractParserWithLeftRightBoundaryChecking2 {
  innerPatternString(context) {
    return `(?:(?:,|\\(|\uFF08)\\s*)?(?:\u0432\\s*?)?(?:\u0443\\s*?)?(?:(\u0446\u0435\u0439|\u043C\u0438\u043D\u0443\u043B\u043E\u0433\u043E|\u043C\u0438\u043D\u0443\u043B\u0438\u0439|\u043F\u043E\u043F\u0435\u0440\u0435\u0434\u043D\u0456\u0439|\u043F\u043E\u043F\u0435\u0440\u0435\u0434\u043D\u044C\u043E\u0433\u043E|\u043D\u0430\u0441\u0442\u0443\u043F\u043D\u043E\u0433\u043E|\u043D\u0430\u0441\u0442\u0443\u043F\u043D\u0438\u0439|\u043D\u0430\u0441\u0442\u0443\u043F\u043D\u043E\u043C\u0443)\\s*)?(${matchAnyPattern(WEEKDAY_DICTIONARY8)})(?:\\s*(?:,|\\)|\uFF09))?(?:\\s*(\u043D\u0430|\u0443|\u0432)\\s*(\u0446\u044C\u043E\u043C\u0443|\u043C\u0438\u043D\u0443\u043B\u043E\u043C\u0443|\u043D\u0430\u0441\u0442\u0443\u043F\u043D\u043E\u043C\u0443)\\s*\u0442\u0438\u0436\u043D\u0456)?`;
  }
  innerExtract(context, match) {
    const dayOfWeek = match[WEEKDAY_GROUP8].toLocaleLowerCase();
    const weekday = WEEKDAY_DICTIONARY8[dayOfWeek];
    const prefix = match[PREFIX_GROUP8];
    const postfix = match[POSTFIX_GROUP7];
    let modifierWord = prefix || postfix;
    modifierWord = modifierWord || "";
    modifierWord = modifierWord.toLocaleLowerCase();
    let modifier = null;
    if (modifierWord == "\u043C\u0438\u043D\u0443\u043B\u043E\u0433\u043E" || modifierWord == "\u043C\u0438\u043D\u0443\u043B\u0438\u0439" || modifierWord == "\u043F\u043E\u043F\u0435\u0440\u0435\u0434\u043D\u0456\u0439" || modifierWord == "\u043F\u043E\u043F\u0435\u0440\u0435\u0434\u043D\u044C\u043E\u0433\u043E") {
      modifier = "last";
    } else if (modifierWord == "\u043D\u0430\u0441\u0442\u0443\u043F\u043D\u043E\u0433\u043E" || modifierWord == "\u043D\u0430\u0441\u0442\u0443\u043F\u043D\u0438\u0439") {
      modifier = "next";
    } else if (modifierWord == "\u0446\u0435\u0439" || modifierWord == "\u0446\u044C\u043E\u0433\u043E" || modifierWord == "\u0446\u044C\u043E\u043C\u0443") {
      modifier = "this";
    }
    return createParsingComponentsAtWeekday(context.reference, weekday, modifier);
  }
};

// node_modules/chrono-node/dist/esm/locales/uk/parsers/UKRelativeDateFormatParser.js
var MODIFIER_WORD_GROUP4 = 1;
var RELATIVE_WORD_GROUP4 = 2;
var UKRelativeDateFormatParser = class extends AbstractParserWithLeftRightBoundaryChecking2 {
  innerPatternString(context) {
    return `(\u0432 \u043C\u0438\u043D\u0443\u043B\u043E\u043C\u0443|\u0443 \u043C\u0438\u043D\u0443\u043B\u043E\u043C\u0443|\u043D\u0430 \u043C\u0438\u043D\u0443\u043B\u043E\u043C\u0443|\u043C\u0438\u043D\u0443\u043B\u043E\u0433\u043E|\u043D\u0430 \u043D\u0430\u0441\u0442\u0443\u043F\u043D\u043E\u043C\u0443|\u0432 \u043D\u0430\u0441\u0442\u0443\u043F\u043D\u043E\u043C\u0443|\u0443 \u043D\u0430\u0441\u0442\u0443\u043F\u043D\u043E\u043C\u0443|\u043D\u0430\u0441\u0442\u0443\u043F\u043D\u043E\u0433\u043E|\u043D\u0430 \u0446\u044C\u043E\u043C\u0443|\u0432 \u0446\u044C\u043E\u043C\u0443|\u0443 \u0446\u044C\u043E\u043C\u0443|\u0446\u044C\u043E\u0433\u043E)\\s*(${matchAnyPattern(TIME_UNIT_DICTIONARY7)})(?=\\s*)`;
  }
  innerExtract(context, match) {
    const modifier = match[MODIFIER_WORD_GROUP4].toLowerCase();
    const unitWord = match[RELATIVE_WORD_GROUP4].toLowerCase();
    const timeunit = TIME_UNIT_DICTIONARY7[unitWord];
    if (modifier == "\u043D\u0430 \u043D\u0430\u0441\u0442\u0443\u043F\u043D\u043E\u043C\u0443" || modifier == "\u0432 \u043D\u0430\u0441\u0442\u0443\u043F\u043D\u043E\u043C\u0443" || modifier == "\u0443 \u043D\u0430\u0441\u0442\u0443\u043F\u043D\u043E\u043C\u0443" || modifier == "\u043D\u0430\u0441\u0442\u0443\u043F\u043D\u043E\u0433\u043E") {
      const timeUnits = {};
      timeUnits[timeunit] = 1;
      return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
    }
    if (modifier == "\u043D\u0430 \u043C\u0438\u043D\u0443\u043B\u043E\u043C\u0443" || modifier == "\u0432 \u043C\u0438\u043D\u0443\u043B\u043E\u043C\u0443" || modifier == "\u0443 \u043C\u0438\u043D\u0443\u043B\u043E\u043C\u0443" || modifier == "\u043C\u0438\u043D\u0443\u043B\u043E\u0433\u043E") {
      const timeUnits = {};
      timeUnits[timeunit] = -1;
      return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
    }
    const components = context.createParsingComponents();
    let date = new Date(context.reference.instant.getTime());
    if (timeunit.match(/week/i)) {
      date.setDate(date.getDate() - date.getDay());
      components.imply("day", date.getDate());
      components.imply("month", date.getMonth() + 1);
      components.imply("year", date.getFullYear());
    } else if (timeunit.match(/month/i)) {
      date.setDate(1);
      components.imply("day", date.getDate());
      components.assign("year", date.getFullYear());
      components.assign("month", date.getMonth() + 1);
    } else if (timeunit.match(/year/i)) {
      date.setDate(1);
      date.setMonth(0);
      components.imply("day", date.getDate());
      components.imply("month", date.getMonth() + 1);
      components.assign("year", date.getFullYear());
    }
    return components;
  }
};

// node_modules/chrono-node/dist/esm/locales/uk/parsers/UKTimeUnitCasualRelativeFormatParser.js
var UKTimeUnitCasualRelativeFormatParser = class extends AbstractParserWithLeftRightBoundaryChecking2 {
  innerPatternString(context) {
    return `(\u0446\u0456|\u043E\u0441\u0442\u0430\u043D\u043D\u0456|\u043C\u0438\u043D\u0443\u043B\u0456|\u043C\u0430\u0439\u0431\u0443\u0442\u043D\u0456|\u043D\u0430\u0441\u0442\u0443\u043F\u043D\u0456|\u043F\u0456\u0441\u043B\u044F|\u0447\u0435\u0440\u0435\u0437|\\+|-)\\s*(${TIME_UNITS_PATTERN7})`;
  }
  innerExtract(context, match) {
    const prefix = match[1].toLowerCase();
    let timeUnits = parseDuration7(match[3]);
    switch (prefix) {
      case "\u043E\u0441\u0442\u0430\u043D\u043D\u0456":
      case "\u043C\u0438\u043D\u0443\u043B\u0456":
      case "-":
        timeUnits = reverseDuration(timeUnits);
        break;
    }
    return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
  }
};

// node_modules/chrono-node/dist/esm/locales/uk/index.js
var casual12 = new Chrono(createCasualConfiguration11());
var strict12 = new Chrono(createConfiguration11(true));
function createCasualConfiguration11() {
  const option = createConfiguration11(false);
  option.parsers.unshift(new UKCasualDateParser());
  option.parsers.unshift(new UKCasualTimeParser());
  option.parsers.unshift(new UkMonthNameParser());
  option.parsers.unshift(new UKRelativeDateFormatParser());
  option.parsers.unshift(new UKTimeUnitCasualRelativeFormatParser());
  return option;
}
function createConfiguration11(strictMode) {
  return includeCommonConfiguration({
    parsers: [
      new ISOFormatParser(),
      new SlashDateFormatParser(true),
      new UKTimeUnitWithinFormatParser(),
      new UKMonthNameLittleEndianParser(),
      new UKWeekdayParser(),
      new UKTimeExpressionParser(strictMode),
      new UKTimeUnitAgoFormatParser()
    ],
    refiners: [new UKMergeDateTimeRefiner(), new UKMergeDateRangeRefiner()]
  }, strictMode);
}
function parse12(text, ref, option) {
  return casual12.parse(text, ref, option);
}
function parseDate12(text, ref, option) {
  return casual12.parseDate(text, ref, option);
}

// node_modules/chrono-node/dist/esm/locales/it/index.js
var it_exports = {};
__export(it_exports, {
  Chrono: () => Chrono,
  Meridiem: () => Meridiem,
  ParsingComponents: () => ParsingComponents,
  ParsingResult: () => ParsingResult,
  ReferenceWithTimezone: () => ReferenceWithTimezone,
  Weekday: () => Weekday,
  casual: () => casual13,
  configuration: () => configuration2,
  parse: () => parse13,
  parseDate: () => parseDate13,
  strict: () => strict13
});

// node_modules/chrono-node/dist/esm/locales/it/constants.js
var WEEKDAY_DICTIONARY9 = {
  domenica: 0,
  dom: 0,
  "dom.": 0,
  luned\u00EC: 1,
  lunedi: 1,
  lun: 1,
  "lun.": 1,
  marted\u00EC: 2,
  martedi: 2,
  mar: 2,
  "mar.": 2,
  mercoled\u00EC: 3,
  mercoledi: 3,
  mer: 3,
  "mer.": 3,
  gioved\u00EC: 4,
  giovedi: 4,
  gio: 4,
  "gio.": 4,
  venerd\u00EC: 5,
  venerdi: 5,
  ven: 5,
  "ven.": 5,
  sabato: 6,
  sab: 6,
  "sab.": 6
};
var FULL_MONTH_NAME_DICTIONARY4 = {
  gennaio: 1,
  febbraio: 2,
  marzo: 3,
  aprile: 4,
  maggio: 5,
  giugno: 6,
  luglio: 7,
  agosto: 8,
  settembre: 9,
  ottobre: 10,
  novembre: 11,
  dicembre: 12
};
var MONTH_DICTIONARY9 = {
  ...FULL_MONTH_NAME_DICTIONARY4,
  gen: 1,
  "gen.": 1,
  feb: 2,
  "feb.": 2,
  mar: 3,
  "mar.": 3,
  apr: 4,
  "apr.": 4,
  mag: 5,
  "mag.": 5,
  giu: 6,
  "giu.": 6,
  lug: 7,
  "lug.": 7,
  ago: 8,
  "ago.": 8,
  set: 9,
  "set.": 9,
  sett: 9,
  "sett.": 9,
  ott: 10,
  "ott.": 10,
  nov: 11,
  "nov.": 11,
  dic: 12,
  "dic.": 12
};
var INTEGER_WORD_DICTIONARY8 = {
  uno: 1,
  una: 1,
  un: 1,
  due: 2,
  tre: 3,
  quattro: 4,
  cinque: 5,
  sei: 6,
  sette: 7,
  otto: 8,
  nove: 9,
  dieci: 10,
  undici: 11,
  dodici: 12
};
var ORDINAL_WORD_DICTIONARY5 = {
  primo: 1,
  prima: 1,
  "1\xB0": 1,
  "1\xAA": 1,
  secondo: 2,
  seconda: 2,
  "2\xB0": 2,
  "2\xAA": 2,
  terzo: 3,
  terza: 3,
  "3\xB0": 3,
  "3\xAA": 3,
  quarto: 4,
  quarta: 4,
  "4\xB0": 4,
  "4\xAA": 4,
  quinto: 5,
  quinta: 5,
  "5\xB0": 5,
  "5\xAA": 5,
  sesto: 6,
  sesta: 6,
  "6\xB0": 6,
  "6\xAA": 6,
  settimo: 7,
  settima: 7,
  "7\xB0": 7,
  "7\xAA": 7,
  ottavo: 8,
  ottava: 8,
  "8\xB0": 8,
  "8\xAA": 8,
  nono: 9,
  nona: 9,
  "9\xB0": 9,
  "9\xAA": 9,
  decimo: 10,
  decima: 10,
  "10\xB0": 10,
  "10\xAA": 10,
  undicesimo: 11,
  undicesima: 11,
  "11\xB0": 11,
  "11\xAA": 11,
  dodicesimo: 12,
  dodicesima: 12,
  "12\xB0": 12,
  "12\xAA": 12,
  tredicesimo: 13,
  tredicesima: 13,
  "13\xB0": 13,
  "13\xAA": 13,
  quattordicesimo: 14,
  quattordicesima: 14,
  "14\xB0": 14,
  "14\xAA": 14,
  quindicesimo: 15,
  quindicesima: 15,
  "15\xB0": 15,
  "15\xAA": 15,
  sedicesimo: 16,
  sedicesima: 16,
  "16\xB0": 16,
  "16\xAA": 16,
  diciassettesimo: 17,
  diciassettesima: 17,
  "17\xB0": 17,
  "17\xAA": 17,
  diciottesimo: 18,
  diciottesima: 18,
  "18\xB0": 18,
  "18\xAA": 18,
  diciannovesimo: 19,
  diciannovesima: 19,
  "19\xB0": 19,
  "19\xAA": 19,
  ventesimo: 20,
  ventesima: 20,
  "20\xB0": 20,
  "20\xAA": 20,
  ventunesimo: 21,
  ventunesima: 21,
  "21\xB0": 21,
  "21\xAA": 21,
  ventiduesimo: 22,
  ventiduesima: 22,
  "22\xB0": 22,
  "22\xAA": 22,
  ventitreesimo: 23,
  ventitreesima: 23,
  "23\xB0": 23,
  "23\xAA": 23,
  ventiquattresimo: 24,
  ventiquattresima: 24,
  "24\xB0": 24,
  "24\xAA": 24,
  venticinquesimo: 25,
  venticinquesima: 25,
  "25\xB0": 25,
  "25\xAA": 25,
  ventiseiesimo: 26,
  ventiseiesima: 26,
  "26\xB0": 26,
  "26\xAA": 26,
  ventisettesimo: 27,
  ventisettesima: 27,
  "27\xB0": 27,
  "27\xAA": 27,
  ventottesimo: 28,
  ventottesima: 28,
  "28\xB0": 28,
  "28\xAA": 28,
  ventinovesimo: 29,
  ventinovesima: 29,
  "29\xB0": 29,
  "29\xAA": 29,
  trentesimo: 30,
  trentesima: 30,
  "30\xB0": 30,
  "30\xAA": 30,
  trentunesimo: 31,
  trentunesima: 31,
  "31\xB0": 31,
  "31\xAA": 31
};
var TIME_UNIT_DICTIONARY_NO_ABBR2 = {
  secondo: "second",
  secondi: "second",
  minuto: "minute",
  minuti: "minute",
  ora: "hour",
  ore: "hour",
  giorno: "day",
  giorni: "day",
  settimana: "week",
  settimane: "week",
  mese: "month",
  mesi: "month",
  trimestre: "quarter",
  trimestri: "quarter",
  anno: "year",
  anni: "year"
};
var TIME_UNIT_DICTIONARY8 = {
  s: "second",
  sec: "second",
  secondo: "second",
  secondi: "second",
  m: "minute",
  min: "minute",
  minuto: "minute",
  minuti: "minute",
  h: "hour",
  ora: "hour",
  ore: "hour",
  g: "day",
  gg: "day",
  giorno: "day",
  giorni: "day",
  sett: "week",
  settimana: "week",
  settimane: "week",
  mese: "month",
  mesi: "month",
  trim: "quarter",
  trimestre: "quarter",
  trimestri: "quarter",
  anno: "year",
  anni: "year",
  ...TIME_UNIT_DICTIONARY_NO_ABBR2
};
var NUMBER_PATTERN8 = `(?:${matchAnyPattern(INTEGER_WORD_DICTIONARY8)}|[0-9]+|[0-9]+\\.[0-9]+|mezz[oa]?(?:\\s{0,2})?|un(?:'|\\s{0,2})?|qualche|alcuni|paio\\s{0,2}(?:di)?)`;
function parseNumberPattern8(match) {
  const num = match.toLowerCase();
  if (INTEGER_WORD_DICTIONARY8[num] !== void 0) {
    return INTEGER_WORD_DICTIONARY8[num];
  } else if (num === "un" || num === "un'" || num === "una" || num === "uno") {
    return 1;
  } else if (num.match(/qualche/)) {
    return 3;
  } else if (num.match(/mezz/)) {
    return 0.5;
  } else if (num.match(/paio/)) {
    return 2;
  } else if (num.match(/alcuni/)) {
    return 7;
  }
  return parseFloat(num);
}
var ORDINAL_NUMBER_PATTERN6 = `(?:${matchAnyPattern(ORDINAL_WORD_DICTIONARY5)}|[0-9]{1,2}(?:\xB0|\xAA|\xBA)?)`;
function parseOrdinalNumberPattern6(match) {
  let num = match.toLowerCase();
  if (ORDINAL_WORD_DICTIONARY5[num] !== void 0) {
    return ORDINAL_WORD_DICTIONARY5[num];
  }
  num = num.replace(/(?:°|ª|º)$/i, "");
  return parseInt(num);
}
var YEAR_PATTERN10 = `(?:[1-9][0-9]{0,3}\\s{0,2}(?:BE|AD|BC|BCE|CE)|[1-2][0-9]{3}|[5-9][0-9]|2[0-5])`;
function parseYear8(match) {
  if (/BE/i.test(match)) {
    match = match.replace(/BE/i, "");
    return parseInt(match) - 543;
  }
  if (/BCE?/i.test(match)) {
    match = match.replace(/BCE?/i, "");
    return -parseInt(match);
  }
  if (/(AD|CE)/i.test(match)) {
    match = match.replace(/(AD|CE)/i, "");
    return parseInt(match);
  }
  const rawYearNumber = parseInt(match);
  return findMostLikelyADYear(rawYearNumber);
}
var SINGLE_TIME_UNIT_PATTERN8 = `(${NUMBER_PATTERN8})\\s{0,3}(${matchAnyPattern(TIME_UNIT_DICTIONARY8)})`;
var SINGLE_TIME_UNIT_REGEX8 = new RegExp(SINGLE_TIME_UNIT_PATTERN8, "i");
var SINGLE_TIME_UNIT_NO_ABBR_PATTERN2 = `(${NUMBER_PATTERN8})\\s{0,3}(${matchAnyPattern(TIME_UNIT_DICTIONARY_NO_ABBR2)})`;
var TIME_UNIT_CONNECTOR_PATTERN2 = `\\s{0,5},?(?:\\s*e)?\\s{0,5}`;
var TIME_UNITS_PATTERN8 = repeatedTimeunitPattern(`(?:(?:circa|approssimativamente)\\s{0,3})?`, SINGLE_TIME_UNIT_PATTERN8, TIME_UNIT_CONNECTOR_PATTERN2);
var TIME_UNITS_NO_ABBR_PATTERN2 = repeatedTimeunitPattern(`(?:(?:circa|approssimativamente)\\s{0,3})?`, SINGLE_TIME_UNIT_NO_ABBR_PATTERN2, TIME_UNIT_CONNECTOR_PATTERN2);
function parseDuration8(timeunitText) {
  const fragments = {};
  let remainingText = timeunitText;
  let match = SINGLE_TIME_UNIT_REGEX8.exec(remainingText);
  while (match) {
    collectDateTimeFragment8(fragments, match);
    remainingText = remainingText.substring(match[0].length).trim();
    match = SINGLE_TIME_UNIT_REGEX8.exec(remainingText);
  }
  if (Object.keys(fragments).length == 0) {
    return null;
  }
  return fragments;
}
function collectDateTimeFragment8(fragments, match) {
  if (match[0].match(/^[a-zA-Z]+$/)) {
    return;
  }
  const num = parseNumberPattern8(match[1]);
  const unit = TIME_UNIT_DICTIONARY8[match[2].toLowerCase()];
  fragments[unit] = num;
}

// node_modules/chrono-node/dist/esm/locales/it/parsers/ITTimeUnitWithinFormatParser.js
var PATTERN_WITH_OPTIONAL_PREFIX2 = new RegExp(`(?:(?:entro|tra|fra|in|per)\\s*)?(?:(?:circa|approssimativamente)\\s*(?:~\\s*)?)?(${TIME_UNITS_PATTERN8})(?=\\W|$)`, "i");
var PATTERN_WITH_PREFIX2 = new RegExp(`(?:entro|tra|fra|in|per)\\s*(?:(?:circa|approssimativamente)\\s*(?:~\\s*)?)?(${TIME_UNITS_PATTERN8})(?=\\W|$)`, "i");
var PATTERN_WITH_PREFIX_STRICT2 = new RegExp(`(?:entro|tra|fra|in|per)\\s*(?:(?:circa|approssimativamente)\\s*(?:~\\s*)?)?(${TIME_UNITS_NO_ABBR_PATTERN2})(?=\\W|$)`, "i");
var ITTimeUnitWithinFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  strictMode;
  constructor(strictMode) {
    super();
    this.strictMode = strictMode;
  }
  innerPattern(context) {
    if (this.strictMode) {
      return PATTERN_WITH_PREFIX_STRICT2;
    }
    return context.option.forwardDate ? PATTERN_WITH_OPTIONAL_PREFIX2 : PATTERN_WITH_PREFIX2;
  }
  innerExtract(context, match) {
    if (match[0].match(/^per\s*(il|la|l')\s*\w+/)) {
      return null;
    }
    const timeUnits = parseDuration8(match[1]);
    if (!timeUnits) {
      return null;
    }
    return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
  }
};

// node_modules/chrono-node/dist/esm/locales/it/parsers/ITMonthNameLittleEndianParser.js
var PATTERN49 = new RegExp(`(?:il\\s{0,3})?(${ORDINAL_NUMBER_PATTERN6})(?:\\s{0,3}(?:al|\\-|\\\u2013|fino\\s*al?)?\\s{0,3}(${ORDINAL_NUMBER_PATTERN6}))?(?:-|/|\\s{0,3}(?:di)?\\s{0,3})(${matchAnyPattern(MONTH_DICTIONARY9)})(?:(?:-|/|,?\\s{0,3})(${YEAR_PATTERN10}(?!\\w)))?(?=\\W|$)`, "i");
var DATE_GROUP12 = 1;
var DATE_TO_GROUP10 = 2;
var MONTH_NAME_GROUP17 = 3;
var YEAR_GROUP22 = 4;
var ITMonthNameLittleEndianParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN49;
  }
  innerExtract(context, match) {
    const result = context.createParsingResult(match.index, match[0]);
    const month = MONTH_DICTIONARY9[match[MONTH_NAME_GROUP17].toLowerCase()];
    const day = parseOrdinalNumberPattern6(match[DATE_GROUP12]);
    if (day > 31) {
      match.index = match.index + match[DATE_GROUP12].length;
      return null;
    }
    result.start.assign("month", month);
    result.start.assign("day", day);
    if (match[YEAR_GROUP22]) {
      const yearNumber = parseYear8(match[YEAR_GROUP22]);
      result.start.assign("year", yearNumber);
    } else {
      const year3 = findYearClosestToRef(context.refDate, day, month);
      result.start.imply("year", year3);
    }
    if (match[DATE_TO_GROUP10]) {
      const endDate = parseOrdinalNumberPattern6(match[DATE_TO_GROUP10]);
      result.end = result.start.clone();
      result.end.assign("day", endDate);
    }
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/it/parsers/ITMonthNameMiddleEndianParser.js
var PATTERN50 = new RegExp(`(${matchAnyPattern(MONTH_DICTIONARY9)})(?:-|/|\\s*,?\\s*)(${ORDINAL_NUMBER_PATTERN6})(?!\\s*(?:am|pm))\\s*(?:(?:al|\\-)\\s*(${ORDINAL_NUMBER_PATTERN6})\\s*)?(?:(?:-|/|\\s*,\\s*|\\s+)(${YEAR_PATTERN10}))?(?=\\W|$)(?!\\:\\d)`, "i");
var MONTH_NAME_GROUP18 = 1;
var DATE_GROUP13 = 2;
var DATE_TO_GROUP11 = 3;
var YEAR_GROUP23 = 4;
var ITMonthNameMiddleEndianParser = class extends AbstractParserWithWordBoundaryChecking {
  shouldSkipYearLikeDate;
  constructor(shouldSkipYearLikeDate) {
    super();
    this.shouldSkipYearLikeDate = shouldSkipYearLikeDate;
  }
  innerPattern() {
    return PATTERN50;
  }
  innerExtract(context, match) {
    const month = MONTH_DICTIONARY9[match[MONTH_NAME_GROUP18].toLowerCase()];
    const day = parseOrdinalNumberPattern6(match[DATE_GROUP13]);
    if (day > 31) {
      return null;
    }
    if (this.shouldSkipYearLikeDate) {
      if (!match[DATE_TO_GROUP11] && !match[YEAR_GROUP23] && match[DATE_GROUP13].match(/^2[0-5]$/)) {
        return null;
      }
    }
    const components = context.createParsingComponents({
      day,
      month
    }).addTag("parser/ITMonthNameMiddleEndianParser");
    if (match[YEAR_GROUP23]) {
      const year3 = parseYear8(match[YEAR_GROUP23]);
      components.assign("year", year3);
    } else {
      const year3 = findYearClosestToRef(context.refDate, day, month);
      components.imply("year", year3);
    }
    if (!match[DATE_TO_GROUP11]) {
      return components;
    }
    const endDate = parseOrdinalNumberPattern6(match[DATE_TO_GROUP11]);
    const result = context.createParsingResult(match.index, match[0]);
    result.start = components;
    result.end = components.clone();
    result.end.assign("day", endDate);
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/it/parsers/ITMonthNameParser.js
var PATTERN51 = new RegExp(`((?:a|in|di|del)\\s*)?(${matchAnyPattern(MONTH_DICTIONARY9)})\\s*(?:(?:,|-|del)?\\s*(${YEAR_PATTERN10})?)?(?=[^\\s\\w]|\\s+[^0-9]|\\s+$|$)`, "i");
var PREFIX_GROUP9 = 1;
var MONTH_NAME_GROUP19 = 2;
var YEAR_GROUP24 = 3;
var ITMonthNameParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN51;
  }
  innerExtract(context, match) {
    const monthName = match[MONTH_NAME_GROUP19].toLowerCase();
    if (match[0].length <= 3 && !FULL_MONTH_NAME_DICTIONARY4[monthName]) {
      return null;
    }
    const result = context.createParsingResult(match.index + (match[PREFIX_GROUP9] || "").length, match.index + match[0].length);
    result.start.imply("day", 1);
    result.start.addTag("parser/ITMonthNameParser");
    const month = MONTH_DICTIONARY9[monthName];
    result.start.assign("month", month);
    if (match[YEAR_GROUP24]) {
      const year3 = parseYear8(match[YEAR_GROUP24]);
      result.start.assign("year", year3);
    } else {
      const year3 = findYearClosestToRef(context.refDate, 1, month);
      result.start.imply("year", year3);
    }
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/it/parsers/ITYearMonthDayParser.js
var PATTERN52 = new RegExp(`([0-9]{4})[-\\.\\/\\s](?:(${matchAnyPattern(MONTH_DICTIONARY9)})|([0-9]{1,2}))[-\\.\\/\\s]([0-9]{1,2})(?=\\W|$)`, "i");
var YEAR_NUMBER_GROUP5 = 1;
var MONTH_NAME_GROUP20 = 2;
var MONTH_NUMBER_GROUP4 = 3;
var DATE_NUMBER_GROUP4 = 4;
var ITYearMonthDayParser = class extends AbstractParserWithWordBoundaryChecking {
  strictMonthDateOrder;
  constructor(strictMonthDateOrder) {
    super();
    this.strictMonthDateOrder = strictMonthDateOrder;
  }
  innerPattern() {
    return PATTERN52;
  }
  innerExtract(context, match) {
    const year3 = parseInt(match[YEAR_NUMBER_GROUP5]);
    let day = parseInt(match[DATE_NUMBER_GROUP4]);
    let month = match[MONTH_NUMBER_GROUP4] ? parseInt(match[MONTH_NUMBER_GROUP4]) : MONTH_DICTIONARY9[match[MONTH_NAME_GROUP20].toLowerCase()];
    if (month < 1 || month > 12) {
      if (this.strictMonthDateOrder) {
        return null;
      }
      if (day >= 1 && day <= 12) {
        [month, day] = [day, month];
      }
    }
    if (day < 1 || day > 31) {
      return null;
    }
    return {
      day,
      month,
      year: year3
    };
  }
};

// node_modules/chrono-node/dist/esm/locales/it/parsers/ITSlashMonthFormatParser.js
var PATTERN53 = new RegExp("([0-9]|0[1-9]|1[012])/([0-9]{4})", "i");
var MONTH_GROUP7 = 1;
var YEAR_GROUP25 = 2;
var ITSlashMonthFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN53;
  }
  innerExtract(context, match) {
    const year3 = parseInt(match[YEAR_GROUP25]);
    const month = parseInt(match[MONTH_GROUP7]);
    return context.createParsingComponents().imply("day", 1).assign("month", month).assign("year", year3);
  }
};

// node_modules/chrono-node/dist/esm/locales/it/parsers/ITTimeExpressionParser.js
var ITTimeExpressionParser = class extends AbstractTimeExpressionParser {
  constructor(strictMode) {
    super(strictMode);
  }
  followingPhase() {
    return "\\s*(?:\\-|\\\u2013|\\~|\\\u301C|a|fino\\s*a|alle?|\\?)\\s*";
  }
  primaryPrefix() {
    return "(?:(?:alle?|dalle?)\\s*)??";
  }
  primarySuffix() {
    return "(?:\\s*(?:di\\s*(?:sera|notte|mattina|pomeriggio)))?(?!/)(?=\\W|$)";
  }
  extractPrimaryTimeComponents(context, match) {
    const components = super.extractPrimaryTimeComponents(context, match);
    if (!components) {
      return components;
    }
    if (match[0].match(/di\s*(?:sera|notte)/i)) {
      const hour = components.get("hour");
      if (hour >= 6 && hour < 12) {
        components.assign("hour", components.get("hour") + 12);
        components.assign("meridiem", Meridiem.PM);
      } else if (hour < 6) {
        components.assign("meridiem", Meridiem.AM);
      }
    }
    if (match[0].match(/di\s*pomeriggio/i)) {
      components.assign("meridiem", Meridiem.PM);
      const hour = components.get("hour");
      if (hour >= 0 && hour <= 6) {
        components.assign("hour", components.get("hour") + 12);
      }
    }
    if (match[0].match(/di\s*mattina/i)) {
      components.assign("meridiem", Meridiem.AM);
      const hour = components.get("hour");
      if (hour < 12) {
        components.assign("hour", components.get("hour"));
      }
    }
    return components.addTag("parser/ITTimeExpressionParser");
  }
  extractFollowingTimeComponents(context, match, result) {
    const followingComponents = super.extractFollowingTimeComponents(context, match, result);
    if (followingComponents) {
      followingComponents.addTag("parser/ITTimeExpressionParser");
    }
    return followingComponents;
  }
};

// node_modules/chrono-node/dist/esm/locales/it/parsers/ITTimeUnitAgoFormatParser.js
var PATTERN54 = new RegExp(`(${TIME_UNITS_PATTERN8})\\s{0,5}(?:fa|prima)(?=\\W|$)`, "i");
var STRICT_PATTERN5 = new RegExp(`(${TIME_UNITS_NO_ABBR_PATTERN2})\\s{0,5}(?:fa|prima)(?=\\W|$)`, "i");
var ITTimeUnitAgoFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  strictMode;
  constructor(strictMode) {
    super();
    this.strictMode = strictMode;
  }
  innerPattern() {
    return this.strictMode ? STRICT_PATTERN5 : PATTERN54;
  }
  innerExtract(context, match) {
    const duration = parseDuration8(match[1]);
    if (!duration) {
      return null;
    }
    return ParsingComponents.createRelativeFromReference(context.reference, reverseDuration(duration));
  }
};

// node_modules/chrono-node/dist/esm/locales/it/parsers/ITTimeUnitLaterFormatParser.js
var PATTERN55 = new RegExp(`(${TIME_UNITS_PATTERN8})\\s{0,5}(?:dopo|pi\xF9\\s*tardi|da\\s*adesso|da\\s*ora)(?=(?:\\W|$))`, "i");
var STRICT_PATTERN6 = new RegExp(`(${TIME_UNITS_NO_ABBR_PATTERN2})\\s{0,5}(dopo|pi\xF9\\s*tardi|da\\s*adesso|da\\s*ora)(?=\\W|$)`, "i");
var GROUP_NUM_TIMEUNITS3 = 1;
var ITTimeUnitLaterFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  strictMode;
  constructor(strictMode) {
    super();
    this.strictMode = strictMode;
  }
  innerPattern() {
    return this.strictMode ? STRICT_PATTERN6 : PATTERN55;
  }
  innerExtract(context, match) {
    const timeUnits = parseDuration8(match[GROUP_NUM_TIMEUNITS3]);
    if (!timeUnits) {
      return null;
    }
    return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
  }
};

// node_modules/chrono-node/dist/esm/locales/it/refiners/ITMergeDateRangeRefiner.js
var ITMergeDateRangeRefiner = class extends AbstractMergeDateRangeRefiner {
  patternBetween() {
    return /^\s*(a|al|-|–|fino\s*a|fino\s*al)\s*$/i;
  }
};

// node_modules/chrono-node/dist/esm/locales/it/refiners/ITMergeDateTimeRefiner.js
var ITMergeDateTimeRefiner = class extends AbstractMergeDateTimeRefiner {
  patternBetween() {
    return new RegExp("^\\s*(T|alle?|dopo\\s*le|prima\\s*delle?|,|-|\\.|\u2219|:)?\\s*$");
  }
};

// node_modules/chrono-node/dist/esm/locales/it/parsers/ITCasualDateParser.js
var PATTERN56 = /(adesso|ora|oggi|stasera|stanotte|domani|dopodomani|ieri|ieri\s*sera|ieri\s*notte)(?=\W|$)/i;
var ITCasualDateParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern(context) {
    return PATTERN56;
  }
  innerExtract(context, match) {
    let targetDate = context.refDate;
    const lowerText = match[0].toLowerCase();
    let component = context.createParsingComponents();
    switch (lowerText) {
      case "adesso":
      case "ora":
        component = now(context.reference);
        break;
      case "oggi":
        component = today(context.reference);
        break;
      case "ieri":
        component = yesterday(context.reference);
        break;
      case "domani":
        component = tomorrow(context.reference);
        break;
      case "stasera":
      case "stanotte":
        component = tonight(context.reference);
        break;
      case "dopodomani":
        component = theDayAfter(context.reference, 2);
        break;
      default:
        if (lowerText.match(/ieri\s*sera/) || lowerText.match(/ieri\s*notte/)) {
          if (targetDate.getHours() > 6) {
            const previousDay = new Date(targetDate.getTime());
            previousDay.setDate(previousDay.getDate() - 1);
            targetDate = previousDay;
          }
          assignSimilarDate(component, targetDate);
          component.imply("hour", 0);
        }
        break;
    }
    component.addTag("parser/ITCasualDateParser");
    return component;
  }
};

// node_modules/chrono-node/dist/esm/locales/it/parsers/ITCasualTimeParser.js
var PATTERN57 = /(stamattina|stasera|stanotte|stamani)|(questa\s*)?(mattina|pomeriggio|sera|notte|mezzanotte|mezzogiorno)(?=\W|$)/i;
var ITCasualTimeParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN57;
  }
  innerExtract(context, match) {
    let component = null;
    if (match[1]) {
      switch (match[1].toLowerCase()) {
        case "stamattina":
        case "stamani":
          component = morning(context.reference);
          break;
        case "stasera":
        case "stanotte":
          component = evening(context.reference);
          break;
      }
    } else if (match[3]) {
      switch (match[3].toLowerCase()) {
        case "pomeriggio":
          component = afternoon(context.reference);
          break;
        case "sera":
        case "notte":
          component = evening(context.reference);
          break;
        case "mezzanotte":
          component = midnight(context.reference);
          break;
        case "mattina":
          component = morning(context.reference);
          break;
        case "mezzogiorno":
          component = noon(context.reference);
          break;
      }
    }
    if (component) {
      component.addTag("parser/ITCasualTimeParser");
    }
    return component;
  }
};

// node_modules/chrono-node/dist/esm/locales/it/parsers/ITWeekdayParser.js
var PATTERN58 = new RegExp(`(?:(?:\\,|\\(|\\\uFF08)\\s*)?(?:(questo|questa|quest'|scorso|scorsa|prossimo|prossima)\\s*)?(${matchAnyPattern(WEEKDAY_DICTIONARY9)}|weekend|fine\\s*settimana)(?:\\s*(?:\\,|\\)|\\\uFF09))?(?:\\s*(scorso|scorsa|prossimo|prossima)(?:\\s*settimana)?)?(?=\\W|$)`, "i");
var PREFIX_GROUP10 = 1;
var WEEKDAY_GROUP9 = 2;
var POSTFIX_GROUP8 = 3;
var ITWeekdayParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN58;
  }
  innerExtract(context, match) {
    const prefix = match[PREFIX_GROUP10];
    const postfix = match[POSTFIX_GROUP8];
    let modifierWord = prefix || postfix;
    modifierWord = modifierWord || "";
    modifierWord = modifierWord.toLowerCase();
    let modifier = null;
    if (modifierWord == "scorso" || modifierWord == "scorsa") {
      modifier = "last";
    } else if (modifierWord == "prossimo" || modifierWord == "prossima") {
      modifier = "next";
    } else if (modifierWord == "questo" || modifierWord == "questa" || modifierWord == "quest'") {
      modifier = "this";
    }
    const weekday_word = match[WEEKDAY_GROUP9].toLowerCase();
    let weekday;
    if (WEEKDAY_DICTIONARY9[weekday_word] !== void 0) {
      weekday = WEEKDAY_DICTIONARY9[weekday_word];
    } else if (weekday_word == "weekend" || weekday_word.match(/fine\s*settimana/)) {
      weekday = modifier == "last" ? Weekday.SUNDAY : Weekday.SATURDAY;
    } else {
      return null;
    }
    return createParsingComponentsAtWeekday(context.reference, weekday, modifier);
  }
};

// node_modules/chrono-node/dist/esm/locales/it/parsers/ITRelativeDateFormatParser.js
var PATTERN59 = new RegExp(`(?:(?:il\\s*|la\\s*|l'\\s*)?(questo|questa|quest'|scorso|scorsa|prossimo|prossima|dopo\\s*questo|dopo\\s*questa)\\s*(${matchAnyPattern(TIME_UNIT_DICTIONARY8)})|(?:il\\s*|la\\s*|l'\\s*)(${matchAnyPattern(TIME_UNIT_DICTIONARY8)})\\s*(scorso|scorsa|prossimo|prossima))(?=\\W|$)`, "i");
var MODIFIER_WORD_GROUP_1 = 1;
var RELATIVE_WORD_GROUP_1 = 2;
var RELATIVE_WORD_GROUP_2 = 3;
var MODIFIER_WORD_GROUP_2 = 4;
var ITRelativeDateFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN59;
  }
  innerExtract(context, match) {
    let modifier;
    let unitWord;
    if (match[MODIFIER_WORD_GROUP_1]) {
      modifier = match[MODIFIER_WORD_GROUP_1].toLowerCase();
      unitWord = match[RELATIVE_WORD_GROUP_1].toLowerCase();
    } else {
      modifier = match[MODIFIER_WORD_GROUP_2].toLowerCase();
      unitWord = match[RELATIVE_WORD_GROUP_2].toLowerCase();
    }
    const timeunit = TIME_UNIT_DICTIONARY8[unitWord];
    if (modifier == "prossimo" || modifier == "prossima" || modifier.startsWith("dopo")) {
      const timeUnits = {};
      timeUnits[timeunit] = 1;
      return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
    }
    if (modifier == "scorso" || modifier == "scorsa") {
      const timeUnits = {};
      timeUnits[timeunit] = -1;
      return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
    }
    const components = context.createParsingComponents();
    let date = new Date(context.reference.instant.getTime());
    if (unitWord.match(/settimana/i)) {
      date.setDate(date.getDate() - date.getDay());
      components.imply("day", date.getDate());
      components.imply("month", date.getMonth() + 1);
      components.imply("year", date.getFullYear());
    } else if (unitWord.match(/mese/i)) {
      date.setDate(1);
      components.imply("day", date.getDate());
      components.assign("year", date.getFullYear());
      components.assign("month", date.getMonth() + 1);
    } else if (unitWord.match(/anno/i)) {
      date.setDate(1);
      date.setMonth(0);
      components.imply("day", date.getDate());
      components.imply("month", date.getMonth() + 1);
      components.assign("year", date.getFullYear());
    }
    return components;
  }
};

// node_modules/chrono-node/dist/esm/locales/it/parsers/ITTimeUnitCasualRelativeFormatParser.js
var PATTERN60 = new RegExp(`(?:il\\s*|la\\s*|l'\\s*)?(questo|questa|quest'|scorso|scorsa|prossimo|prossima|dopo|\\+|-)\\s*(${TIME_UNITS_PATTERN8})(?=\\W|$)`, "i");
var PATTERN_NO_ABBR2 = new RegExp(`(?:il\\s*|la\\s*|l'\\s*)?(questo|questa|quest'|scorso|scorsa|prossimo|prossima|dopo|\\+|-)\\s*(${TIME_UNITS_NO_ABBR_PATTERN2})(?=\\W|$)`, "i");
var ITTimeUnitCasualRelativeFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  allowAbbreviations;
  constructor(allowAbbreviations = true) {
    super();
    this.allowAbbreviations = allowAbbreviations;
  }
  innerPattern() {
    return this.allowAbbreviations ? PATTERN60 : PATTERN_NO_ABBR2;
  }
  innerExtract(context, match) {
    const prefix = match[1].toLowerCase();
    let duration = parseDuration8(match[2]);
    if (!duration) {
      return null;
    }
    switch (prefix) {
      case "scorso":
      case "scorsa":
      case "-":
        duration = reverseDuration(duration);
        break;
    }
    return ParsingComponents.createRelativeFromReference(context.reference, duration);
  }
};

// node_modules/chrono-node/dist/esm/locales/it/refiners/ITMergeRelativeAfterDateRefiner.js
function IsPositiveFollowingReference2(result) {
  return result.text.match(/^[+-]/i) != null;
}
function IsNegativeFollowingReference2(result) {
  return result.text.match(/^-/i) != null;
}
var ITMergeRelativeAfterDateRefiner = class extends MergingRefiner {
  shouldMergeResults(textBetween, currentResult, nextResult) {
    if (!textBetween.match(/^\s*$/i)) {
      return false;
    }
    return IsPositiveFollowingReference2(nextResult) || IsNegativeFollowingReference2(nextResult);
  }
  mergeResults(textBetween, currentResult, nextResult, context) {
    let timeUnits = parseDuration8(nextResult.text);
    if (IsNegativeFollowingReference2(nextResult)) {
      timeUnits = reverseDuration(timeUnits);
    }
    const components = ParsingComponents.createRelativeFromReference(ReferenceWithTimezone.fromDate(currentResult.start.date()), timeUnits);
    return new ParsingResult(currentResult.reference, currentResult.index, `${currentResult.text}${textBetween}${nextResult.text}`, components);
  }
};

// node_modules/chrono-node/dist/esm/locales/it/refiners/ITMergeRelativeFollowByDateRefiner.js
function hasImpliedEarlierReferenceDate2(result) {
  return result.text.match(/\s+(prima|da)$/i) != null;
}
function hasImpliedLaterReferenceDate2(result) {
  return result.text.match(/\s+(dopo|dal?)$/i) != null;
}
var ITMergeRelativeFollowByDateRefiner = class extends MergingRefiner {
  patternBetween() {
    return /^\s*$/i;
  }
  shouldMergeResults(textBetween, currentResult, nextResult) {
    if (!textBetween.match(this.patternBetween())) {
      return false;
    }
    if (!hasImpliedEarlierReferenceDate2(currentResult) && !hasImpliedLaterReferenceDate2(currentResult)) {
      return false;
    }
    return !!nextResult.start.get("day") && !!nextResult.start.get("month") && !!nextResult.start.get("year");
  }
  mergeResults(textBetween, currentResult, nextResult) {
    let duration = parseDuration8(currentResult.text);
    if (hasImpliedEarlierReferenceDate2(currentResult)) {
      duration = reverseDuration(duration);
    }
    const components = ParsingComponents.createRelativeFromReference(ReferenceWithTimezone.fromDate(nextResult.start.date()), duration);
    return new ParsingResult(nextResult.reference, currentResult.index, `${currentResult.text}${textBetween}${nextResult.text}`, components);
  }
};

// node_modules/chrono-node/dist/esm/locales/it/refiners/ITExtractYearSuffixRefiner.js
var YEAR_SUFFIX_PATTERN2 = new RegExp(`^\\s*(${YEAR_PATTERN10})`, "i");
var YEAR_GROUP26 = 1;
var ITExtractYearSuffixRefiner = class {
  refine(context, results) {
    results.forEach(function(result) {
      if (!result.start.isDateWithUnknownYear()) {
        return;
      }
      const suffix = context.text.substring(result.index + result.text.length);
      const match = YEAR_SUFFIX_PATTERN2.exec(suffix);
      if (!match) {
        return;
      }
      if (match[0].trim().length <= 3) {
        return;
      }
      context.debug(() => {
        console.log(`Extracting year: '${match[0]}' into : ${result}`);
      });
      const year3 = parseYear8(match[YEAR_GROUP26]);
      if (result.end != null) {
        result.end.assign("year", year3);
      }
      result.start.assign("year", year3);
      result.text += match[0];
    });
    return results;
  }
};

// node_modules/chrono-node/dist/esm/locales/it/refiners/ITUnlikelyFormatFilter.js
var ITUnlikelyFormatFilter = class extends Filter {
  constructor() {
    super();
  }
  isValid(context, result) {
    const text = result.text.trim();
    if (text === context.text.trim()) {
      return true;
    }
    if (text.toLowerCase().endsWith("il secondo") || text.toLowerCase() === "secondo") {
      const textAfter = context.text.substring(result.index + result.text.length).trim();
      if (textAfter.length > 0) {
        context.debug(() => {
          console.log(`Removing unlikely result: ${result}`);
        });
      }
      return false;
    }
    return true;
  }
};

// node_modules/chrono-node/dist/esm/locales/it/configuration.js
var ITDefaultConfiguration = class {
  createCasualConfiguration() {
    const option = this.createConfiguration(false);
    option.parsers.push(new ITCasualDateParser());
    option.parsers.push(new ITCasualTimeParser());
    option.parsers.push(new ITMonthNameParser());
    option.parsers.push(new ITRelativeDateFormatParser());
    option.parsers.push(new ITTimeUnitCasualRelativeFormatParser());
    option.refiners.push(new ITUnlikelyFormatFilter());
    return option;
  }
  createConfiguration(strictMode = true) {
    const options = includeCommonConfiguration({
      parsers: [
        new SlashDateFormatParser(true),
        new ITTimeUnitWithinFormatParser(strictMode),
        new ITMonthNameLittleEndianParser(),
        new ITMonthNameMiddleEndianParser(true),
        new ITWeekdayParser(),
        new ITSlashMonthFormatParser(),
        new ITTimeExpressionParser(strictMode),
        new ITTimeUnitAgoFormatParser(strictMode),
        new ITTimeUnitLaterFormatParser(strictMode)
      ],
      refiners: [new ITMergeDateTimeRefiner()]
    }, strictMode);
    options.parsers.unshift(new ITYearMonthDayParser(strictMode));
    options.refiners.unshift(new ITMergeRelativeFollowByDateRefiner());
    options.refiners.unshift(new ITMergeRelativeAfterDateRefiner());
    options.refiners.unshift(new OverlapRemovalRefiner());
    options.refiners.push(new ITMergeDateTimeRefiner());
    options.refiners.push(new ITExtractYearSuffixRefiner());
    options.refiners.push(new ITMergeDateRangeRefiner());
    return options;
  }
};

// node_modules/chrono-node/dist/esm/locales/it/index.js
var configuration2 = new ITDefaultConfiguration();
var casual13 = new Chrono(configuration2.createCasualConfiguration());
var strict13 = new Chrono(configuration2.createConfiguration(true));
function parse13(text, ref, option) {
  return casual13.parse(text, ref, option);
}
function parseDate13(text, ref, option) {
  return casual13.parseDate(text, ref, option);
}

// node_modules/chrono-node/dist/esm/locales/sv/index.js
var sv_exports = {};
__export(sv_exports, {
  Chrono: () => Chrono,
  Meridiem: () => Meridiem,
  ParsingComponents: () => ParsingComponents,
  ParsingResult: () => ParsingResult,
  ReferenceWithTimezone: () => ReferenceWithTimezone,
  Weekday: () => Weekday,
  casual: () => casual14,
  createCasualConfiguration: () => createCasualConfiguration12,
  createConfiguration: () => createConfiguration12,
  parse: () => parse14,
  parseDate: () => parseDate14,
  strict: () => strict14
});

// node_modules/chrono-node/dist/esm/locales/sv/constants.js
var WEEKDAY_DICTIONARY10 = {
  "s\xF6ndag": 0,
  "s\xF6n": 0,
  "so": 0,
  "m\xE5ndag": 1,
  "m\xE5n": 1,
  "m\xE5": 1,
  "tisdag": 2,
  "tis": 2,
  "ti": 2,
  "onsdag": 3,
  "ons": 3,
  "on": 3,
  "torsdag": 4,
  "tors": 4,
  "to": 4,
  "fredag": 5,
  "fre": 5,
  "fr": 5,
  "l\xF6rdag": 6,
  "l\xF6r": 6,
  "l\xF6": 6
};
var MONTH_DICTIONARY10 = {
  "januari": 1,
  "jan": 1,
  "jan.": 1,
  "februari": 2,
  "feb": 2,
  "feb.": 2,
  "mars": 3,
  "mar": 3,
  "mar.": 3,
  "april": 4,
  "apr": 4,
  "apr.": 4,
  "maj": 5,
  "juni": 6,
  "jun": 6,
  "jun.": 6,
  "juli": 7,
  "jul": 7,
  "jul.": 7,
  "augusti": 8,
  "aug": 8,
  "aug.": 8,
  "september": 9,
  "sep": 9,
  "sep.": 9,
  "sept": 9,
  "oktober": 10,
  "okt": 10,
  "okt.": 10,
  "november": 11,
  "nov": 11,
  "nov.": 11,
  "december": 12,
  "dec": 12,
  "dec.": 12
};
var ORDINAL_NUMBER_DICTIONARY = {
  "f\xF6rsta": 1,
  "andra": 2,
  "tredje": 3,
  "fj\xE4rde": 4,
  "femte": 5,
  "sj\xE4tte": 6,
  "sjunde": 7,
  "\xE5ttonde": 8,
  "nionde": 9,
  "tionde": 10,
  "elfte": 11,
  "tolfte": 12,
  "trettonde": 13,
  "fjortonde": 14,
  "femtonde": 15,
  "sextonde": 16,
  "sjuttonde": 17,
  "artonde": 18,
  "nittonde": 19,
  "tjugonde": 20,
  "tjugof\xF6rsta": 21,
  "tjugoandra": 22,
  "tjugotredje": 23,
  "tjugofj\xE4rde": 24,
  "tjugofemte": 25,
  "tjugosj\xE4tte": 26,
  "tjugosjunde": 27,
  "tjugo\xE5ttonde": 28,
  "tjugonionde": 29,
  "trettionde": 30,
  "trettiof\xF6rsta": 31
};
var INTEGER_WORD_DICTIONARY9 = {
  "en": 1,
  "ett": 1,
  "tv\xE5": 2,
  "tre": 3,
  "fyra": 4,
  "fem": 5,
  "sex": 6,
  "sju": 7,
  "\xE5tta": 8,
  "nio": 9,
  "tio": 10,
  "elva": 11,
  "tolv": 12,
  "tretton": 13,
  "fjorton": 14,
  "femton": 15,
  "sexton": 16,
  "sjutton": 17,
  "arton": 18,
  "nitton": 19,
  "tjugo": 20,
  "tretti\u043E": 30,
  "fyrtio": 40,
  "femtio": 50,
  "sextio": 60,
  "sjuttio": 70,
  "\xE5ttio": 80,
  "nittio": 90,
  "hundra": 100,
  "tusen": 1e3
};
var TIME_UNIT_DICTIONARY9 = {
  "sek": "second",
  "sekund": "second",
  "sekunder": "second",
  "min": "minute",
  "minut": "minute",
  "minuter": "minute",
  "tim": "hour",
  "timme": "hour",
  "timmar": "hour",
  "dag": "day",
  "dagar": "day",
  "vecka": "week",
  "veckor": "week",
  "m\xE5n": "month",
  "m\xE5nad": "month",
  "m\xE5nader": "month",
  "\xE5r": "year",
  "kvart\u0430l": "quarter",
  "kvartal": "quarter"
};
var TIME_UNIT_NO_ABBR_DICTIONARY = {
  "sekund": "second",
  "sekunder": "second",
  "minut": "minute",
  "minuter": "minute",
  "timme": "hour",
  "timmar": "hour",
  "dag": "day",
  "dagar": "day",
  "vecka": "week",
  "veckor": "week",
  "m\xE5nad": "month",
  "m\xE5nader": "month",
  "\xE5r": "year",
  "kvartal": "quarter"
};
function parseDuration9(timeunitText) {
  const fragments = {};
  let remainingText = timeunitText;
  let match = SINGLE_TIME_UNIT_REGEX9.exec(remainingText);
  while (match) {
    collectDateTimeFragment9(fragments, match);
    remainingText = remainingText.substring(match[0].length);
    match = SINGLE_TIME_UNIT_REGEX9.exec(remainingText);
  }
  return fragments;
}
function collectDateTimeFragment9(fragments, match) {
  const num = parseNumberPattern9(match[1]);
  const unit = TIME_UNIT_DICTIONARY9[match[2].toLowerCase()];
  fragments[unit] = num;
}
var NUMBER_PATTERN9 = `(?:${matchAnyPattern(INTEGER_WORD_DICTIONARY9)}|\\d+)`;
var ORDINAL_NUMBER_PATTERN7 = `(?:${matchAnyPattern(ORDINAL_NUMBER_DICTIONARY)}|\\d{1,2}(?:e|:e))`;
var TIME_UNIT_PATTERN = `(?:${matchAnyPattern(TIME_UNIT_DICTIONARY9)})`;
var SINGLE_TIME_UNIT_PATTERN9 = `(${NUMBER_PATTERN9})\\s{0,5}(${matchAnyPattern(TIME_UNIT_DICTIONARY9)})\\s{0,5}`;
var SINGLE_TIME_UNIT_REGEX9 = new RegExp(SINGLE_TIME_UNIT_PATTERN9, "i");
var SINGLE_TIME_UNIT_NO_ABBR_PATTERN3 = `(${NUMBER_PATTERN9})\\s{0,5}(${matchAnyPattern(TIME_UNIT_NO_ABBR_DICTIONARY)})\\s{0,5}`;
var TIME_UNITS_PATTERN9 = repeatedTimeunitPattern("", SINGLE_TIME_UNIT_PATTERN9);
var TIME_UNITS_NO_ABBR_PATTERN3 = repeatedTimeunitPattern("", SINGLE_TIME_UNIT_NO_ABBR_PATTERN3);
function parseNumberPattern9(match) {
  const num = match.toLowerCase();
  if (INTEGER_WORD_DICTIONARY9[num] !== void 0) {
    return INTEGER_WORD_DICTIONARY9[num];
  }
  return parseInt(num);
}
function parseYear9(match) {
  if (/\d+/.test(match)) {
    let yearNumber = parseInt(match);
    if (yearNumber < 100) {
      yearNumber = findMostLikelyADYear(yearNumber);
    }
    return yearNumber;
  }
  const num = match.toLowerCase();
  if (INTEGER_WORD_DICTIONARY9[num] !== void 0) {
    return INTEGER_WORD_DICTIONARY9[num];
  }
  return parseInt(match);
}

// node_modules/chrono-node/dist/esm/locales/sv/parsers/SVWeekdayParser.js
var PATTERN61 = new RegExp(`(?:(?:\\,|\\(|\\\uFF08)\\s*)?(?:p\xE5\\s*?)?(?:(f\xF6rra|senaste|n\xE4sta|kommande)\\s*)?(${matchAnyPattern(WEEKDAY_DICTIONARY10)})(?:\\s*(?:\\,|\\)|\\\uFF09))?(?:\\s*(f\xF6rra|senaste|n\xE4sta|kommande)\\s*vecka)?(?=\\W|$)`, "i");
var PREFIX_GROUP11 = 1;
var SUFFIX_GROUP2 = 3;
var WEEKDAY_GROUP10 = 2;
var SVWeekdayParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN61;
  }
  innerExtract(context, match) {
    const dayOfWeek = match[WEEKDAY_GROUP10].toLowerCase();
    const offset = WEEKDAY_DICTIONARY10[dayOfWeek];
    const prefix = match[PREFIX_GROUP11];
    const postfix = match[SUFFIX_GROUP2];
    let modifierWord = prefix || postfix;
    modifierWord = modifierWord || "";
    modifierWord = modifierWord.toLowerCase();
    let modifier = null;
    if (modifierWord.match(/förra|senaste/)) {
      modifier = "last";
    } else if (modifierWord.match(/nästa|kommande/)) {
      modifier = "next";
    }
    return createParsingComponentsAtWeekday(context.reference, offset, modifier);
  }
};

// node_modules/chrono-node/dist/esm/locales/sv/parsers/SVMonthNameLittleEndianParser.js
var PATTERN62 = new RegExp(`(?:den\\s*?)?([0-9]{1,2})(?:\\s*(?:till|\\-|\\\u2013|\\s)\\s*([0-9]{1,2}))?\\s*(${matchAnyPattern(MONTH_DICTIONARY10)})(?:(?:-|/|,?\\s*)([0-9]{4}(?![^\\s]\\d)))?(?=\\W|$)`, "i");
var DATE_GROUP14 = 1;
var DATE_TO_GROUP12 = 2;
var MONTH_NAME_GROUP21 = 3;
var YEAR_GROUP27 = 4;
var SVMonthNameLittleEndianParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN62;
  }
  innerExtract(context, match) {
    const result = context.createParsingResult(match.index, match[0]);
    const month = MONTH_DICTIONARY10[match[MONTH_NAME_GROUP21].toLowerCase()];
    const day = parseInt(match[DATE_GROUP14]);
    if (day > 31) {
      match.index = match.index + match[DATE_GROUP14].length;
      return null;
    }
    result.start.assign("month", month);
    result.start.assign("day", day);
    if (match[YEAR_GROUP27]) {
      const yearNumber = parseYear9(match[YEAR_GROUP27]);
      result.start.assign("year", yearNumber);
    } else {
      const year3 = findYearClosestToRef(context.refDate, day, month);
      result.start.imply("year", year3);
    }
    if (match[DATE_TO_GROUP12]) {
      const endDate = parseInt(match[DATE_TO_GROUP12]);
      result.end = result.start.clone();
      result.end.assign("day", endDate);
    }
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/sv/parsers/SVTimeUnitCasualRelativeFormatParser.js
var PATTERN63 = new RegExp(`(denna|den h\xE4r|f\xF6rra|passerade|n\xE4sta|kommande|efter|\\+|-)\\s*(${TIME_UNITS_PATTERN9})(?=\\W|$)`, "i");
var PATTERN_NO_ABBR3 = new RegExp(`(denna|den h\xE4r|f\xF6rra|passerade|n\xE4sta|kommande|efter|\\+|-)\\s*(${TIME_UNITS_NO_ABBR_PATTERN3})(?=\\W|$)`, "i");
var SVTimeUnitCasualRelativeFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  allowAbbreviations;
  constructor(allowAbbreviations = true) {
    super();
    this.allowAbbreviations = allowAbbreviations;
  }
  innerPattern() {
    return this.allowAbbreviations ? PATTERN63 : PATTERN_NO_ABBR3;
  }
  innerExtract(context, match) {
    const prefix = match[1].toLowerCase();
    let duration = parseDuration9(match[2]);
    if (!duration) {
      return null;
    }
    switch (prefix) {
      case "f\xF6rra":
      case "passerade":
      case "-":
        duration = reverseDuration(duration);
        break;
    }
    return ParsingComponents.createRelativeFromReference(context.reference, duration);
  }
};

// node_modules/chrono-node/dist/esm/locales/sv/parsers/SVCasualDateParser.js
var PATTERN64 = new RegExp(`(nu|idag|imorgon|\xF6vermorgon|ig\xE5r|f\xF6rrg\xE5r|i\\s*f\xF6rrg\xE5r)(?:\\s*(?:p\xE5\\s*)?(morgonen?|f\xF6rmiddagen?|middagen?|eftermiddagen?|kv\xE4llen?|natten?|midnatt))?(?=\\W|$)`, "i");
var DATE_GROUP15 = 1;
var TIME_GROUP2 = 2;
var SVCasualDateParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern(context) {
    return PATTERN64;
  }
  innerExtract(context, match) {
    const targetDate = context.refDate;
    const dateKeyword = (match[DATE_GROUP15] || "").toLowerCase();
    const timeKeyword = (match[TIME_GROUP2] || "").toLowerCase();
    let component = context.createParsingComponents();
    switch (dateKeyword) {
      case "nu":
        component = now(context.reference);
        break;
      case "idag":
        component = today(context.reference);
        break;
      case "imorgon":
      case "imorn":
        const nextDay = new Date(targetDate.getTime());
        nextDay.setDate(nextDay.getDate() + 1);
        assignSimilarDate(component, nextDay);
        implySimilarTime(component, nextDay);
        break;
      case "ig\xE5r":
        const previousDay = new Date(targetDate.getTime());
        previousDay.setDate(previousDay.getDate() - 1);
        assignSimilarDate(component, previousDay);
        implySimilarTime(component, previousDay);
        break;
      case "f\xF6rrg\xE5r":
      case "i f\xF6rrg\xE5r":
        const twoDaysAgo = new Date(targetDate.getTime());
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        assignSimilarDate(component, twoDaysAgo);
        implySimilarTime(component, twoDaysAgo);
        break;
    }
    switch (timeKeyword) {
      case "morgon":
      case "morgonen":
        component.imply("hour", 6);
        component.imply("minute", 0);
        component.imply("second", 0);
        component.imply("millisecond", 0);
        break;
      case "f\xF6rmiddag":
      case "f\xF6rmiddagen":
        component.imply("hour", 9);
        component.imply("minute", 0);
        component.imply("second", 0);
        component.imply("millisecond", 0);
        break;
      case "middag":
      case "middagen":
        component.imply("hour", 12);
        component.imply("minute", 0);
        component.imply("second", 0);
        component.imply("millisecond", 0);
        break;
      case "eftermiddag":
      case "eftermiddagen":
        component.imply("hour", 15);
        component.imply("minute", 0);
        component.imply("second", 0);
        component.imply("millisecond", 0);
        break;
      case "kv\xE4ll":
      case "kv\xE4llen":
        component.imply("hour", 20);
        component.imply("minute", 0);
        component.imply("second", 0);
        component.imply("millisecond", 0);
        break;
      case "natt":
      case "natten":
      case "midnatt":
        if (timeKeyword === "midnatt") {
          component.imply("hour", 0);
        } else {
          component.imply("hour", 2);
        }
        component.imply("minute", 0);
        component.imply("second", 0);
        component.imply("millisecond", 0);
        break;
    }
    return component;
  }
};

// node_modules/chrono-node/dist/esm/locales/sv/index.js
var casual14 = new Chrono(createCasualConfiguration12());
var strict14 = new Chrono(createConfiguration12(true));
function parse14(text, ref, option) {
  return casual14.parse(text, ref, option);
}
function parseDate14(text, ref, option) {
  return casual14.parseDate(text, ref, option);
}
function createCasualConfiguration12(littleEndian = true) {
  const option = createConfiguration12(false, littleEndian);
  option.parsers.unshift(new SVCasualDateParser());
  return option;
}
function createConfiguration12(strictMode = true, littleEndian = true) {
  return includeCommonConfiguration({
    parsers: [
      new ISOFormatParser(),
      new SlashDateFormatParser(littleEndian),
      new SVMonthNameLittleEndianParser(),
      new SVWeekdayParser(),
      new SVTimeUnitCasualRelativeFormatParser()
    ],
    refiners: []
  }, strictMode);
}

// node_modules/chrono-node/dist/esm/locales/fi/index.js
var fi_exports = {};
__export(fi_exports, {
  Chrono: () => Chrono,
  Meridiem: () => Meridiem,
  ParsingComponents: () => ParsingComponents,
  ParsingResult: () => ParsingResult,
  ReferenceWithTimezone: () => ReferenceWithTimezone,
  Weekday: () => Weekday,
  casual: () => casual15,
  createCasualConfiguration: () => createCasualConfiguration13,
  createConfiguration: () => createConfiguration13,
  parse: () => parse15,
  parseDate: () => parseDate15,
  strict: () => strict15
});

// node_modules/chrono-node/dist/esm/locales/fi/parsers/FITimeExpressionParser.js
var FITimeExpressionParser = class extends AbstractTimeExpressionParser {
  primaryPrefix() {
    return "(?:(?:klo|kello)\\s*)?";
  }
  followingPhase() {
    return "\\s*(?:\\-|\\\u2013|\\~|\\\u301C)\\s*";
  }
  extractPrimaryTimeComponents(context, match) {
    if (match[0].match(/^\s*\d{4}\s*$/)) {
      return null;
    }
    return super.extractPrimaryTimeComponents(context, match);
  }
};

// node_modules/chrono-node/dist/esm/locales/fi/constants.js
var WEEKDAY_DICTIONARY11 = {
  "sunnuntai": 0,
  "sunnuntaina": 0,
  "su": 0,
  "maanantai": 1,
  "maanantaina": 1,
  "ma": 1,
  "tiistai": 2,
  "tiistaina": 2,
  "ti": 2,
  "keskiviikko": 3,
  "keskiviikkona": 3,
  "ke": 3,
  "torstai": 4,
  "torstaina": 4,
  "to": 4,
  "perjantai": 5,
  "perjantaina": 5,
  "pe": 5,
  "lauantai": 6,
  "lauantaina": 6,
  "la": 6
};
var MONTH_DICTIONARY11 = {
  "tammikuu": 1,
  "tammikuuta": 1,
  "tammikuun": 1,
  "tammi": 1,
  "helmikuu": 2,
  "helmikuuta": 2,
  "helmikuun": 2,
  "helmi": 2,
  "maaliskuu": 3,
  "maaliskuuta": 3,
  "maaliskuun": 3,
  "maalis": 3,
  "huhtikuu": 4,
  "huhtikuuta": 4,
  "huhtikuun": 4,
  "huhti": 4,
  "toukokuu": 5,
  "toukokuuta": 5,
  "toukokuun": 5,
  "touko": 5,
  "kes\xE4kuu": 6,
  "kes\xE4kuuta": 6,
  "kes\xE4kuun": 6,
  "kes\xE4": 6,
  "hein\xE4kuu": 7,
  "hein\xE4kuuta": 7,
  "hein\xE4kuun": 7,
  "hein\xE4": 7,
  "elokuu": 8,
  "elokuuta": 8,
  "elokuun": 8,
  "elo": 8,
  "syyskuu": 9,
  "syyskuuta": 9,
  "syyskuun": 9,
  "syys": 9,
  "lokakuu": 10,
  "lokakuuta": 10,
  "lokakuun": 10,
  "loka": 10,
  "marraskuu": 11,
  "marraskuuta": 11,
  "marraskuun": 11,
  "marras": 11,
  "joulukuu": 12,
  "joulukuuta": 12,
  "joulukuun": 12,
  "joulu": 12
};
var INTEGER_WORD_DICTIONARY10 = {
  "yksi": 1,
  "yhden": 1,
  "kaksi": 2,
  "kahden": 2,
  "kolme": 3,
  "kolmen": 3,
  "nelj\xE4": 4,
  "nelj\xE4n": 4,
  "viisi": 5,
  "viiden": 5,
  "kuusi": 6,
  "kuuden": 6,
  "seitsem\xE4n": 7,
  "kahdeksan": 8,
  "yhdeks\xE4n": 9,
  "kymmenen": 10
};
var TIME_UNIT_DICTIONARY10 = {
  "s": "second",
  "sek": "second",
  "sekunti": "second",
  "sekuntia": "second",
  "sekunnin": "second",
  "min": "minute",
  "minuutti": "minute",
  "minuuttia": "minute",
  "minuutin": "minute",
  "t": "hour",
  "tunti": "hour",
  "tuntia": "hour",
  "tunnin": "hour",
  "pv": "day",
  "p\xE4iv\xE4": "day",
  "p\xE4iv\xE4\xE4": "day",
  "p\xE4iv\xE4n": "day",
  "vk": "week",
  "viikko": "week",
  "viikkoa": "week",
  "viikon": "week",
  "kk": "month",
  "kuukausi": "month",
  "kuukautta": "month",
  "kuukauden": "month",
  "vuosi": "year",
  "vuotta": "year",
  "vuoden": "year"
};
var TIME_UNIT_NO_ABBR_DICTIONARY2 = {
  "sekunti": "second",
  "sekuntia": "second",
  "sekunnin": "second",
  "minuutti": "minute",
  "minuuttia": "minute",
  "minuutin": "minute",
  "tunti": "hour",
  "tuntia": "hour",
  "tunnin": "hour",
  "p\xE4iv\xE4": "day",
  "p\xE4iv\xE4\xE4": "day",
  "p\xE4iv\xE4n": "day",
  "viikko": "week",
  "viikkoa": "week",
  "viikon": "week",
  "kuukausi": "month",
  "kuukautta": "month",
  "kuukauden": "month",
  "vuosi": "year",
  "vuotta": "year",
  "vuoden": "year"
};
function parseDuration10(timeunitText) {
  const fragments = {};
  let remainingText = timeunitText;
  let match = SINGLE_TIME_UNIT_REGEX10.exec(remainingText);
  while (match) {
    collectDateTimeFragment10(fragments, match);
    remainingText = remainingText.substring(match[0].length);
    match = SINGLE_TIME_UNIT_REGEX10.exec(remainingText);
  }
  return fragments;
}
function collectDateTimeFragment10(fragments, match) {
  const num = parseNumberPattern10(match[1]);
  const unit = TIME_UNIT_DICTIONARY10[match[2].toLowerCase()];
  fragments[unit] = num;
}
var NUMBER_PATTERN10 = `(?:${matchAnyPattern(INTEGER_WORD_DICTIONARY10)}|\\d+)`;
var TIME_UNIT_PATTERN2 = `(?:${matchAnyPattern(TIME_UNIT_DICTIONARY10)})`;
var SINGLE_TIME_UNIT_PATTERN10 = `(${NUMBER_PATTERN10})\\s{0,5}(${matchAnyPattern(TIME_UNIT_DICTIONARY10)})\\s{0,5}`;
var SINGLE_TIME_UNIT_REGEX10 = new RegExp(SINGLE_TIME_UNIT_PATTERN10, "i");
var SINGLE_TIME_UNIT_NO_ABBR_PATTERN4 = `(${NUMBER_PATTERN10})\\s{0,5}(${matchAnyPattern(TIME_UNIT_NO_ABBR_DICTIONARY2)})\\s{0,5}`;
var TIME_UNITS_PATTERN10 = repeatedTimeunitPattern("", SINGLE_TIME_UNIT_PATTERN10);
var TIME_UNITS_NO_ABBR_PATTERN4 = repeatedTimeunitPattern("", SINGLE_TIME_UNIT_NO_ABBR_PATTERN4);
function parseNumberPattern10(match) {
  const num = match.toLowerCase();
  if (INTEGER_WORD_DICTIONARY10[num] !== void 0) {
    return INTEGER_WORD_DICTIONARY10[num];
  }
  return parseInt(num);
}
function parseYear10(match) {
  if (/\d+/.test(match)) {
    let yearNumber = parseInt(match);
    if (yearNumber < 100) {
      yearNumber = findMostLikelyADYear(yearNumber);
    }
    return yearNumber;
  }
  const num = match.toLowerCase();
  if (INTEGER_WORD_DICTIONARY10[num] !== void 0) {
    return INTEGER_WORD_DICTIONARY10[num];
  }
  return parseInt(match);
}

// node_modules/chrono-node/dist/esm/locales/fi/parsers/FIWeekdayParser.js
var PATTERN65 = new RegExp(`(?:(?:\\,|\\(|\\\uFF08)\\s*)?(?:(viime|edellinen|edellisen\xE4|ensi|seuraava|seuraavana|t\xE4m\xE4|t\xE4n\xE4)\\s*)?(${matchAnyPattern(WEEKDAY_DICTIONARY11)})(?:\\s*(?:\\,|\\)|\\\uFF09))?(?:\\s*(viime|ensi|seuraava)\\s*viikolla)?(?=\\W|$)`, "i");
var PREFIX_GROUP12 = 1;
var WEEKDAY_GROUP11 = 2;
var SUFFIX_GROUP3 = 3;
var FIWeekdayParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN65;
  }
  innerExtract(context, match) {
    const dayOfWeek = match[WEEKDAY_GROUP11].toLowerCase();
    const offset = WEEKDAY_DICTIONARY11[dayOfWeek];
    const prefix = match[PREFIX_GROUP12];
    const postfix = match[SUFFIX_GROUP3];
    let modifierWord = prefix || postfix;
    modifierWord = modifierWord || "";
    modifierWord = modifierWord.toLowerCase();
    let modifier = null;
    if (modifierWord.match(/viime|edellinen|edellisenä/)) {
      modifier = "last";
    } else if (modifierWord.match(/ensi|seuraava|seuraavana/)) {
      modifier = "next";
    }
    return createParsingComponentsAtWeekday(context.reference, offset, modifier);
  }
};

// node_modules/chrono-node/dist/esm/locales/fi/parsers/FIMonthNameLittleEndianParser.js
var PATTERN66 = new RegExp(`([0-9]{1,2})\\.?(?:\\s*(?:\\-|\\\u2013|\\s)\\s*([0-9]{1,2})\\.?)?\\s*(${matchAnyPattern(MONTH_DICTIONARY11)})(?:(?:-|/|,?\\s*)([0-9]{4}(?![^\\s]\\d)))?(?=\\W|$)`, "i");
var DATE_GROUP16 = 1;
var DATE_TO_GROUP13 = 2;
var MONTH_NAME_GROUP22 = 3;
var YEAR_GROUP28 = 4;
var FIMonthNameLittleEndianParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN66;
  }
  innerExtract(context, match) {
    const result = context.createParsingResult(match.index, match[0]);
    const month = MONTH_DICTIONARY11[match[MONTH_NAME_GROUP22].toLowerCase()];
    const day = parseInt(match[DATE_GROUP16]);
    if (day > 31) {
      match.index = match.index + match[DATE_GROUP16].length;
      return null;
    }
    result.start.assign("month", month);
    result.start.assign("day", day);
    if (match[YEAR_GROUP28]) {
      const yearNumber = parseYear10(match[YEAR_GROUP28]);
      result.start.assign("year", yearNumber);
    } else {
      const year3 = findYearClosestToRef(context.refDate, day, month);
      result.start.imply("year", year3);
    }
    if (match[DATE_TO_GROUP13]) {
      const endDate = parseInt(match[DATE_TO_GROUP13]);
      result.end = result.start.clone();
      result.end.assign("day", endDate);
    }
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/fi/parsers/FITimeUnitCasualRelativeFormatParser.js
var PATTERN67 = new RegExp(`(seuraava|seuraavat|seuraavien|edellinen|edelliset|edellisten|viimeiset|viimeisten|kuluneet|kuluneiden|\\+|-)\\s*(${TIME_UNITS_PATTERN10})(?=\\W|$)`, "i");
var PATTERN_NO_ABBR4 = new RegExp(`(seuraava|seuraavat|seuraavien|edellinen|edelliset|edellisten|viimeiset|viimeisten|kuluneet|kuluneiden|\\+|-)\\s*(${TIME_UNITS_NO_ABBR_PATTERN4})(?=\\W|$)`, "i");
var FITimeUnitCasualRelativeFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  allowAbbreviations;
  constructor(allowAbbreviations = true) {
    super();
    this.allowAbbreviations = allowAbbreviations;
  }
  innerPattern() {
    return this.allowAbbreviations ? PATTERN67 : PATTERN_NO_ABBR4;
  }
  innerExtract(context, match) {
    const prefix = match[1].toLowerCase();
    let duration = parseDuration10(match[2]);
    if (!duration) {
      return null;
    }
    switch (prefix) {
      case "edellinen":
      case "edelliset":
      case "edellisten":
      case "viimeiset":
      case "viimeisten":
      case "kuluneet":
      case "kuluneiden":
      case "-":
        duration = reverseDuration(duration);
        break;
    }
    return ParsingComponents.createRelativeFromReference(context.reference, duration);
  }
};

// node_modules/chrono-node/dist/esm/locales/fi/parsers/FITimeUnitAgoFormatParser.js
var FITimeUnitAgoFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return new RegExp(`(${TIME_UNITS_PATTERN10})\\s*sitten(?=\\W|$)`, "i");
  }
  innerExtract(context, match) {
    const timeUnits = parseDuration10(match[1]);
    const outputTimeUnits = reverseDuration(timeUnits);
    return ParsingComponents.createRelativeFromReference(context.reference, outputTimeUnits);
  }
};

// node_modules/chrono-node/dist/esm/locales/fi/parsers/FITimeUnitWithinFormatParser.js
var FITimeUnitWithinFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return new RegExp(`(${TIME_UNITS_PATTERN10})\\s*(?:sis\xE4ll\xE4|kuluessa|p\xE4\xE4st\xE4)(?=\\W|$)`, "i");
  }
  innerExtract(context, match) {
    const timeUnits = parseDuration10(match[1]);
    return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
  }
};

// node_modules/chrono-node/dist/esm/locales/fi/parsers/FICasualTimeParser.js
var FICasualTimeParser = class _FICasualTimeParser extends AbstractParserWithWordBoundaryChecking {
  innerPattern(context) {
    return /(tänä\s*)?(aamulla|aamuna|aamupäivällä|päivällä|iltapäivällä|illalla|yöllä|keskiyöllä)(?=\W|$)/i;
  }
  innerExtract(context, match) {
    const targetDate = context.refDate;
    const timeKeywordPattern = match[2].toLowerCase();
    const component = context.createParsingComponents();
    implySimilarTime(component, targetDate);
    return _FICasualTimeParser.extractTimeComponents(component, timeKeywordPattern);
  }
  static extractTimeComponents(component, timeKeywordPattern) {
    switch (timeKeywordPattern) {
      case "aamulla":
      case "aamuna":
        component.imply("hour", 6);
        component.imply("minute", 0);
        component.imply("second", 0);
        component.imply("meridiem", Meridiem.AM);
        component.addTag("casualReference/morning");
        break;
      case "aamup\xE4iv\xE4ll\xE4":
        component.imply("hour", 9);
        component.imply("minute", 0);
        component.imply("second", 0);
        component.imply("meridiem", Meridiem.AM);
        component.addTag("casualReference/morning");
        break;
      case "p\xE4iv\xE4ll\xE4":
        component.imply("hour", 12);
        component.imply("minute", 0);
        component.imply("second", 0);
        component.imply("meridiem", Meridiem.AM);
        component.addTag("casualReference/noon");
        break;
      case "iltap\xE4iv\xE4ll\xE4":
        component.imply("hour", 15);
        component.imply("minute", 0);
        component.imply("second", 0);
        component.imply("meridiem", Meridiem.PM);
        component.addTag("casualReference/afternoon");
        break;
      case "illalla":
        component.imply("hour", 18);
        component.imply("minute", 0);
        component.imply("second", 0);
        component.imply("meridiem", Meridiem.PM);
        component.addTag("casualReference/evening");
        break;
      case "y\xF6ll\xE4":
        component.imply("hour", 22);
        component.imply("minute", 0);
        component.imply("second", 0);
        component.imply("meridiem", Meridiem.PM);
        component.addTag("casualReference/evening");
        break;
      case "keskiy\xF6ll\xE4":
        if (component.get("hour") > 1) {
          component.addDurationAsImplied({ "day": 1 });
        }
        component.imply("hour", 0);
        component.imply("minute", 0);
        component.imply("second", 0);
        component.imply("meridiem", Meridiem.AM);
        component.addTag("casualReference/midnight");
        break;
    }
    return component;
  }
};

// node_modules/chrono-node/dist/esm/locales/fi/parsers/FICasualDateParser.js
var PATTERN68 = new RegExp(`(nyt|t\xE4n\xE4\xE4n|huomenna|ylihuomenna|eilen|toissap\xE4iv\xE4n\xE4|viime\\s*y\xF6n\xE4)(?:\\s*(aamulla|aamuna|aamup\xE4iv\xE4ll\xE4|p\xE4iv\xE4ll\xE4|iltap\xE4iv\xE4ll\xE4|illalla|y\xF6ll\xE4|keskiy\xF6ll\xE4))?(?=\\W|$)`, "i");
var DATE_GROUP17 = 1;
var TIME_GROUP3 = 2;
var FICasualDateParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern(context) {
    return PATTERN68;
  }
  innerExtract(context, match) {
    let targetDate = context.reference.getDateWithAdjustedTimezone();
    const dateKeyword = (match[DATE_GROUP17] || "").toLowerCase();
    const timeKeyword = (match[TIME_GROUP3] || "").toLowerCase();
    let component = context.createParsingComponents();
    switch (dateKeyword) {
      case "nyt":
        component = now(context.reference);
        break;
      case "t\xE4n\xE4\xE4n":
        component = today(context.reference);
        break;
      case "huomenna":
        targetDate = addDuration(targetDate, { day: 1 });
        assignSimilarDate(component, targetDate);
        implySimilarTime(component, targetDate);
        break;
      case "ylihuomenna":
        targetDate = addDuration(targetDate, { day: 2 });
        assignSimilarDate(component, targetDate);
        implySimilarTime(component, targetDate);
        break;
      case "eilen":
        targetDate = addDuration(targetDate, { day: -1 });
        assignSimilarDate(component, targetDate);
        implySimilarTime(component, targetDate);
        break;
      case "toissap\xE4iv\xE4n\xE4":
        targetDate = addDuration(targetDate, { day: -2 });
        assignSimilarDate(component, targetDate);
        implySimilarTime(component, targetDate);
        break;
      default:
        if (dateKeyword.match(/viime\s*yönä/)) {
          if (targetDate.getHours() > 6) {
            targetDate = addDuration(targetDate, { day: -1 });
          }
          assignSimilarDate(component, targetDate);
          component.imply("hour", 0);
        }
        break;
    }
    if (timeKeyword) {
      component = FICasualTimeParser.extractTimeComponents(component, timeKeyword);
    }
    return component;
  }
};

// node_modules/chrono-node/dist/esm/locales/fi/refiners/FIMergeDateRangeRefiner.js
var FIMergeDateRangeRefiner = class extends AbstractMergeDateRangeRefiner {
  patternBetween() {
    return /^\s*(-|–)\s*$/i;
  }
};

// node_modules/chrono-node/dist/esm/locales/fi/refiners/FIMergeDateTimeRefiner.js
var FIMergeDateTimeRefiner = class extends AbstractMergeDateTimeRefiner {
  patternBetween() {
    return new RegExp("^\\s*(T|klo|kello|,|-)?\\s*$");
  }
};

// node_modules/chrono-node/dist/esm/locales/fi/index.js
var casual15 = new Chrono(createCasualConfiguration13());
var strict15 = new Chrono(createConfiguration13(true));
function parse15(text, ref, option) {
  return casual15.parse(text, ref, option);
}
function parseDate15(text, ref, option) {
  return casual15.parseDate(text, ref, option);
}
function createCasualConfiguration13(littleEndian = true) {
  const option = createConfiguration13(false, littleEndian);
  option.parsers.unshift(new FICasualTimeParser());
  option.parsers.unshift(new FICasualDateParser());
  option.parsers.unshift(new FITimeUnitCasualRelativeFormatParser());
  return option;
}
function createConfiguration13(strictMode = true, littleEndian = true) {
  return includeCommonConfiguration({
    parsers: [
      new ISOFormatParser(),
      new SlashDateFormatParser(littleEndian),
      new FITimeExpressionParser(),
      new FIMonthNameLittleEndianParser(),
      new FIWeekdayParser(),
      new FITimeUnitWithinFormatParser(),
      new FITimeUnitAgoFormatParser()
    ],
    refiners: [new FIMergeDateRangeRefiner(), new FIMergeDateTimeRefiner()]
  }, strictMode);
}

// node_modules/chrono-node/dist/esm/locales/vi/index.js
var vi_exports = {};
__export(vi_exports, {
  Chrono: () => Chrono,
  Meridiem: () => Meridiem,
  ParsingComponents: () => ParsingComponents,
  ParsingResult: () => ParsingResult,
  ReferenceWithTimezone: () => ReferenceWithTimezone,
  Weekday: () => Weekday,
  casual: () => casual16,
  createCasualConfiguration: () => createCasualConfiguration14,
  createConfiguration: () => createConfiguration14,
  parse: () => parse16,
  parseDate: () => parseDate16,
  strict: () => strict16
});

// node_modules/chrono-node/dist/esm/locales/vi/constants.js
var WEEKDAY_DICTIONARY12 = {
  "ch\u1EE7 nh\u1EADt": 0,
  "cn": 0,
  "th\u1EE9 hai": 1,
  "t2": 1,
  "th\u1EE9 ba": 2,
  "t3": 2,
  "th\u1EE9 t\u01B0": 3,
  "t4": 3,
  "th\u1EE9 n\u0103m": 4,
  "t5": 4,
  "th\u1EE9 s\xE1u": 5,
  "t6": 5,
  "th\u1EE9 b\u1EA3y": 6,
  "t7": 6
};
var MONTH_DICTIONARY12 = {
  "th\xE1ng 1": 1,
  "th\xE1ng m\u1ED9t": 1,
  "th\xE1ng gi\xEAng": 1,
  "th\xE1ng 2": 2,
  "th\xE1ng hai": 2,
  "th\xE1ng 3": 3,
  "th\xE1ng ba": 3,
  "th\xE1ng 4": 4,
  "th\xE1ng t\u01B0": 4,
  "th\xE1ng 5": 5,
  "th\xE1ng n\u0103m": 5,
  "th\xE1ng 6": 6,
  "th\xE1ng s\xE1u": 6,
  "th\xE1ng 7": 7,
  "th\xE1ng b\u1EA3y": 7,
  "th\xE1ng 8": 8,
  "th\xE1ng t\xE1m": 8,
  "th\xE1ng 9": 9,
  "th\xE1ng ch\xEDn": 9,
  "th\xE1ng 10": 10,
  "th\xE1ng m\u01B0\u1EDDi": 10,
  "th\xE1ng 11": 11,
  "th\xE1ng m\u01B0\u1EDDi m\u1ED9t": 11,
  "th\xE1ng 12": 12,
  "th\xE1ng m\u01B0\u1EDDi hai": 12,
  "th\xE1ng ch\u1EA1p": 12
};
var INTEGER_WORD_DICTIONARY11 = {
  "m\u1ED9t": 1,
  "hai": 2,
  "ba": 3,
  "b\u1ED1n": 4,
  "n\u0103m": 5,
  "s\xE1u": 6,
  "b\u1EA3y": 7,
  "t\xE1m": 8,
  "ch\xEDn": 9,
  "m\u01B0\u1EDDi": 10,
  "m\u01B0\u1EDDi m\u1ED9t": 11,
  "m\u01B0\u1EDDi hai": 12
};
var TIME_UNIT_DICTIONARY11 = {
  "gi\xE2y": "second",
  "ph\xFAt": "minute",
  "gi\u1EDD": "hour",
  "ng\xE0y": "day",
  "tu\u1EA7n": "week",
  "th\xE1ng": "month",
  "n\u0103m": "year"
};
var NUMBER_PATTERN11 = "(?:" + matchAnyPattern(INTEGER_WORD_DICTIONARY11) + "|[0-9]+|[0-9]+\\.[0-9]+)";
function parseNumberPattern11(match) {
  const num = match.toLowerCase();
  if (INTEGER_WORD_DICTIONARY11[num] !== void 0)
    return INTEGER_WORD_DICTIONARY11[num];
  return parseFloat(num);
}
var YEAR_PATTERN11 = "(?:[0-9]{1,4}(?:\\s*TCN)?)";
function parseYear11(match) {
  const upper = match.toUpperCase();
  const num = parseInt(match.replace(/[^0-9]+/g, ""));
  if (/TCN/.test(upper))
    return -num;
  return findMostLikelyADYear(num);
}
var SINGLE_TIME_UNIT_PATTERN11 = "(" + NUMBER_PATTERN11 + ")\\s{0,5}(" + matchAnyPattern(TIME_UNIT_DICTIONARY11) + ")\\s{0,5}";
var SINGLE_TIME_UNIT_REGEX11 = new RegExp(SINGLE_TIME_UNIT_PATTERN11, "i");
var TIME_UNITS_PATTERN11 = repeatedTimeunitPattern("", SINGLE_TIME_UNIT_PATTERN11);
function parseDuration11(timeunitText) {
  const fragments = {};
  let remainingText = timeunitText;
  let match = SINGLE_TIME_UNIT_REGEX11.exec(remainingText);
  while (match) {
    const num = parseNumberPattern11(match[1]);
    const unit = TIME_UNIT_DICTIONARY11[match[2].toLowerCase()];
    fragments[unit] = num;
    remainingText = remainingText.substring(match[0].length);
    match = SINGLE_TIME_UNIT_REGEX11.exec(remainingText);
  }
  return fragments;
}

// node_modules/chrono-node/dist/esm/locales/vi/parsers/VIStandardParser.js
var PATTERN69 = new RegExp("(?:ng\xE0y\\s*)?([0-9]{1,2})\\s*th\xE1ng\\s*([0-9]{1,2})(?:\\s*n\u0103m\\s*(" + YEAR_PATTERN11 + "))?(?=\\W|$)", "i");
var DAY_GROUP6 = 1;
var MONTH_GROUP8 = 2;
var YEAR_GROUP29 = 3;
var VIStandardParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN69;
  }
  innerExtract(context, match) {
    const day = parseInt(match[DAY_GROUP6]);
    const month = parseInt(match[MONTH_GROUP8]);
    if (day > 31 || month > 12)
      return null;
    const result = context.createParsingResult(match.index, match[0]);
    result.start.assign("day", day);
    result.start.assign("month", month);
    if (match[YEAR_GROUP29]) {
      result.start.assign("year", parseYear11(match[YEAR_GROUP29]));
    } else {
      result.start.imply("year", findYearClosestToRef(context.refDate, day, month));
    }
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/vi/parsers/VIMonthYearParser.js
var PATTERN70 = new RegExp("(" + matchAnyPattern(MONTH_DICTIONARY12) + ")(?:\\s*(?:n\u0103m|/)\\s*(" + YEAR_PATTERN11 + "))?(?=\\W|$)", "i");
var MONTH_GROUP9 = 1;
var YEAR_GROUP30 = 2;
var VIMonthYearParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN70;
  }
  innerExtract(context, match) {
    const month = MONTH_DICTIONARY12[match[MONTH_GROUP9].toLowerCase()];
    if (!month)
      return null;
    const result = context.createParsingResult(match.index, match[0]);
    result.start.assign("month", month);
    result.start.imply("day", 1);
    if (match[YEAR_GROUP30]) {
      result.start.assign("year", parseYear11(match[YEAR_GROUP30]));
    } else {
      result.start.imply("year", context.reference.getDateWithAdjustedTimezone().getFullYear());
    }
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/vi/parsers/VIYearParser.js
var PATTERN71 = new RegExp("(?:\\bn\u0103m\\s*(" + YEAR_PATTERN11 + ")|\\b([0-9]{1,4})\\s*(TCN))(?=\\W|$)", "i");
var YEAR_WITH_NAM_GROUP = 1;
var BARE_BC_YEAR_GROUP = 2;
var BARE_BC_SUFFIX_GROUP = 3;
var VIYearParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN71;
  }
  innerExtract(context, match) {
    let yearText;
    if (match[YEAR_WITH_NAM_GROUP]) {
      yearText = match[YEAR_WITH_NAM_GROUP];
    } else {
      yearText = match[BARE_BC_YEAR_GROUP] + " " + match[BARE_BC_SUFFIX_GROUP];
    }
    const result = context.createParsingResult(match.index, match[0]);
    result.start.assign("year", parseYear11(yearText));
    result.start.imply("month", 1);
    result.start.imply("day", 1);
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/vi/parsers/VICasualDateParser.js
var PATTERN72 = /\b(hôm nay|hôm qua|hôm kia|ngày mai|ngày kia|bây giờ|lúc này)(?=\W|$)/i;
var VICasualDateParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN72;
  }
  innerExtract(context, match) {
    switch (match[1].toLowerCase()) {
      case "b\xE2y gi\u1EDD":
      case "l\xFAc n\xE0y":
        return now(context.reference);
      case "h\xF4m nay":
        return today(context.reference);
      case "h\xF4m qua":
        return yesterday(context.reference);
      case "h\xF4m kia":
        return theDayBefore(context.reference, 2);
      case "ng\xE0y mai":
        return tomorrow(context.reference);
      case "ng\xE0y kia":
        return theDayAfter(context.reference, 2);
    }
    return context.createParsingComponents();
  }
};

// node_modules/chrono-node/dist/esm/locales/vi/parsers/VICasualTimeParser.js
var PATTERN73 = /(buổi\s*)?(sáng sớm|sáng|trưa|chiều|tối|đêm|nửa đêm|bình minh)(?=\W|$)/i;
var VICasualTimeParser = class _VICasualTimeParser extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN73;
  }
  innerExtract(context, match) {
    const component = context.createParsingComponents();
    implySimilarTime(component, context.refDate);
    return _VICasualTimeParser.extractTimeComponents(component, match[2].toLowerCase());
  }
  static extractTimeComponents(component, keyword) {
    switch (keyword) {
      case "b\xECnh minh":
      case "s\xE1ng s\u1EDBm":
        component.imply("hour", 6);
        component.imply("minute", 0);
        component.imply("meridiem", Meridiem.AM);
        break;
      case "s\xE1ng":
        component.imply("hour", 9);
        component.imply("minute", 0);
        component.imply("meridiem", Meridiem.AM);
        break;
      case "tr\u01B0a":
        component.imply("hour", 12);
        component.imply("minute", 0);
        component.imply("meridiem", Meridiem.PM);
        break;
      case "chi\u1EC1u":
        component.imply("hour", 15);
        component.imply("minute", 0);
        component.imply("meridiem", Meridiem.PM);
        break;
      case "t\u1ED1i":
        component.imply("hour", 19);
        component.imply("minute", 0);
        component.imply("meridiem", Meridiem.PM);
        break;
      case "\u0111\xEAm":
        component.imply("hour", 22);
        component.imply("minute", 0);
        component.imply("meridiem", Meridiem.PM);
        break;
      case "n\u1EEDa \u0111\xEAm":
        component.imply("hour", 0);
        component.imply("minute", 0);
        component.imply("meridiem", Meridiem.AM);
        break;
    }
    return component;
  }
};

// node_modules/chrono-node/dist/esm/locales/vi/parsers/VIWeekdayParser.js
var PATTERN74 = new RegExp("(" + matchAnyPattern(WEEKDAY_DICTIONARY12) + ")(?:\\s*(n\xE0y|t\u1EDBi|sau(?!\\s*khi)|qua))?(?=\\W|$)", "i");
var WEEKDAY_GROUP12 = 1;
var MODIFIER_GROUP = 2;
var VIWeekdayParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN74;
  }
  innerExtract(context, match) {
    const dowText = match[WEEKDAY_GROUP12].toLowerCase();
    const dow = WEEKDAY_DICTIONARY12[dowText];
    if (dow === void 0)
      return null;
    const modifier = match[MODIFIER_GROUP];
    let modifierType = null;
    if (modifier) {
      const m = modifier.toLowerCase();
      if (m.includes("t\u1EDBi") || m.includes("sau"))
        modifierType = "next";
      else if (m.includes("qua"))
        modifierType = "last";
    }
    return createParsingComponentsAtWeekday(context.reference, dow, modifierType);
  }
};

// node_modules/chrono-node/dist/esm/locales/vi/parsers/VITimeExpressionParser.js
var PATTERN75 = new RegExp("(?:l\xFAc\\s*|v\xE0o\\s*)?([0-9]{1,2})(?:\\s*gi\u1EDD\\s*([0-9]{1,2})?\\s*(?:ph\xFAt\\s*)?(s\xE1ng|tr\u01B0a|chi\u1EC1u|t\u1ED1i|\u0111\xEAm)?|:([0-9]{2}))(?=\\W|$)", "i");
var HOUR_GROUP7 = 1;
var MINUTE_GIO_GROUP = 2;
var MERIDIEM_GROUP = 3;
var MINUTE_COLON_GROUP = 4;
var VITimeExpressionParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN75;
  }
  innerExtract(context, match) {
    const hour = parseInt(match[HOUR_GROUP7]);
    if (hour > 23)
      return null;
    const result = context.createParsingResult(match.index, match[0]);
    result.start.assign("hour", hour);
    const minute = match[MINUTE_COLON_GROUP] ? parseInt(match[MINUTE_COLON_GROUP]) : match[MINUTE_GIO_GROUP] ? parseInt(match[MINUTE_GIO_GROUP]) : 0;
    if (minute >= 60)
      return null;
    result.start.assign("minute", minute);
    const meridiem = match[MERIDIEM_GROUP]?.toLowerCase();
    if (meridiem === "s\xE1ng") {
      result.start.assign("meridiem", Meridiem.AM);
      if (hour === 12)
        result.start.assign("hour", 0);
    } else if (meridiem === "tr\u01B0a") {
      if (hour < 10) {
        result.start.assign("meridiem", Meridiem.PM);
        result.start.assign("hour", hour + 12);
      } else {
        result.start.assign("meridiem", hour >= 12 ? Meridiem.PM : Meridiem.AM);
      }
    } else if (meridiem === "chi\u1EC1u" || meridiem === "t\u1ED1i" || meridiem === "\u0111\xEAm") {
      result.start.assign("meridiem", Meridiem.PM);
      if (hour < 12)
        result.start.assign("hour", hour + 12);
    }
    result.start.imply("second", 0);
    result.start.imply("millisecond", 0);
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/vi/parsers/VITimeUnitAgoFormatParser.js
var PATTERN76 = new RegExp("(" + TIME_UNITS_PATTERN11 + ")\\s{0,5}(?:tr\u01B0\u1EDBc|qua)(?=\\W|$)", "i");
var VITimeUnitAgoFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  strictMode;
  constructor(strictMode = false) {
    super();
    this.strictMode = strictMode;
  }
  innerPattern() {
    return PATTERN76;
  }
  innerExtract(context, match) {
    const duration = parseDuration11(match[1]);
    if (!duration)
      return null;
    return ParsingComponents.createRelativeFromReference(context.reference, reverseDuration(duration));
  }
};

// node_modules/chrono-node/dist/esm/locales/vi/parsers/VITimeUnitLaterFormatParser.js
var PATTERN77 = new RegExp("(" + TIME_UNITS_PATTERN11 + ")\\s{0,5}(?:sau|n\u1EEFa|t\u1EDBi|ti\u1EBFp)(?=\\W|$)", "i");
var VITimeUnitLaterFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  strictMode;
  constructor(strictMode = false) {
    super();
    this.strictMode = strictMode;
  }
  innerPattern() {
    return PATTERN77;
  }
  innerExtract(context, match) {
    const duration = parseDuration11(match[1]);
    if (!duration)
      return null;
    return ParsingComponents.createRelativeFromReference(context.reference, duration);
  }
};

// node_modules/chrono-node/dist/esm/locales/vi/parsers/VITimeUnitWithinFormatParser.js
var PATTERN78 = new RegExp("(?:trong\\s*(?:v\xF2ng\\s*)?)(" + TIME_UNITS_PATTERN11 + ")(?=\\W|$)", "i");
var VITimeUnitWithinFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  strictMode;
  constructor(strictMode = false) {
    super();
    this.strictMode = strictMode;
  }
  innerPattern() {
    return PATTERN78;
  }
  innerExtract(context, match) {
    const timeUnits = parseDuration11(match[1]);
    if (!timeUnits)
      return null;
    return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
  }
};

// node_modules/chrono-node/dist/esm/locales/vi/parsers/VITimeUnitCasualRelativeFormatParser.js
var CASUAL_UNIT_PATTERN = "(?:" + NUMBER_PATTERN11 + "\\s{0,5})?(?:" + matchAnyPattern(TIME_UNIT_DICTIONARY11) + ")";
var PATTERN79 = new RegExp("(n\xE0y|tr\u01B0\u1EDBc|qua|sau|t\u1EDBi|ti\u1EBFp)\\s*(" + CASUAL_UNIT_PATTERN + ")|(" + CASUAL_UNIT_PATTERN + ")\\s*(n\xE0y|tr\u01B0\u1EDBc|qua|sau|t\u1EDBi|ti\u1EBFp)(?=\\W|$)", "i");
var VITimeUnitCasualRelativeFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN79;
  }
  innerExtract(context, match) {
    const modifier = (match[1] || match[4] || "").toLowerCase();
    const unitText = (match[2] || match[3] || "").toLowerCase();
    let duration = parseDuration11(unitText);
    if (Object.keys(duration).length === 0) {
      const unit = TIME_UNIT_DICTIONARY11[unitText];
      if (!unit)
        return null;
      duration = { [unit]: 1 };
    }
    if (modifier === "tr\u01B0\u1EDBc" || modifier === "qua") {
      duration = reverseDuration(duration);
    }
    return ParsingComponents.createRelativeFromReference(context.reference, duration);
  }
};

// node_modules/chrono-node/dist/esm/locales/vi/refiners/VIMergeDateRangeRefiner.js
var VIMergeDateRangeRefiner = class extends AbstractMergeDateRangeRefiner {
  patternBetween() {
    return /^\s*(?:–|-|đến|tới|và)\s*$/;
  }
};

// node_modules/chrono-node/dist/esm/locales/vi/refiners/VIMergeDateTimeRefiner.js
var VIMergeDateTimeRefiner = class extends AbstractMergeDateTimeRefiner {
  patternBetween() {
    return /^\s*(?:lúc|vào|,|T|-)?\s*$/;
  }
};

// node_modules/chrono-node/dist/esm/locales/vi/refiners/VIMergeWeekdayComponentRefiner.js
var VIMergeWeekdayComponentRefiner = class extends MergeWeekdayComponentRefiner {
};

// node_modules/chrono-node/dist/esm/locales/vi/index.js
var casual16 = new Chrono(createCasualConfiguration14());
var strict16 = new Chrono(createConfiguration14(true));
function parse16(text, ref, option) {
  return casual16.parse(text, ref, option);
}
function parseDate16(text, ref, option) {
  return casual16.parseDate(text, ref, option);
}
function createCasualConfiguration14(littleEndian = true) {
  const option = createConfiguration14(false, littleEndian);
  option.parsers.unshift(new VICasualTimeParser());
  option.parsers.unshift(new VICasualDateParser());
  option.parsers.unshift(new VITimeUnitCasualRelativeFormatParser());
  return option;
}
function createConfiguration14(strictMode = true, littleEndian = true) {
  return includeCommonConfiguration({
    parsers: [
      new ISOFormatParser(),
      new SlashDateFormatParser(littleEndian),
      new VIStandardParser(),
      new VIMonthYearParser(),
      new VIYearParser(),
      new VIWeekdayParser(),
      new VITimeExpressionParser(),
      new VITimeUnitAgoFormatParser(strictMode),
      new VITimeUnitLaterFormatParser(strictMode),
      new VITimeUnitWithinFormatParser(strictMode)
    ],
    refiners: [
      new VIMergeWeekdayComponentRefiner(),
      new VIMergeDateRangeRefiner(),
      new VIMergeDateTimeRefiner()
    ]
  }, strictMode);
}

// node_modules/chrono-node/dist/esm/index.js
var strict17 = strict;
var casual17 = casual;
function parse17(text, ref, option) {
  return casual17.parse(text, ref, option);
}
function parseDate17(text, ref, option) {
  return casual17.parseDate(text, ref, option);
}

// src/shims/rrule.ts
import { createRequire } from "module";
var require2 = createRequire(import.meta.url);
var pkg = require2("rrule");
var RRule = pkg.RRule;

// node_modules/tasknotes-nlp-core/dist/NaturalLanguageParserCore.js
var RRule2 = RRule;
var NaturalLanguageParserCore = class {
  constructor(statusConfigs = [], priorityConfigs = [], defaultToScheduled = true, languageCode = "en", nlpTriggers, userFields, options = {}) {
    this.isValidDateString = (dateString) => /^\d{4}-\d{2}-\d{2}$/.test(dateString);
    this.isValidTimeString = (timeString) => /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeString);
    this.escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    this.cleanupWhitespace = (text) => {
      return text.replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "").trim();
    };
    this.defaultToScheduled = defaultToScheduled;
    this.languageConfig = getLanguageConfig(languageCode);
    this.options = options;
    this.statusConfigs = statusConfigs;
    this.priorityConfigs = priorityConfigs;
    const effectiveTriggers = nlpTriggers || DEFAULT_NLP_TRIGGERS;
    this.triggerConfig = new TriggerConfigService(effectiveTriggers, userFields || []);
    this.boundaries = this.createBoundaryConfig();
    this.recurrencePatterns = this.buildRecurrencePatterns();
    this.processingPipeline = this.buildProcessingPipeline();
  }
  /**
   * Creates boundary configuration based on language characteristics.
   * Non-ASCII languages (with accented characters, non-Latin scripts) need flexible boundaries.
   */
  createBoundaryConfig() {
    const isNonAscii = ["ru", "zh", "ja", "uk", "fr"].includes(this.languageConfig.code);
    return {
      boundary: isNonAscii ? "(?:^|\\s)" : "\\b",
      endBoundary: isNonAscii ? "(?=\\s|$)" : "\\b",
      isNonAscii
    };
  }
  /**
   * Get the appropriate chrono parser for the configured language.
   */
  getChronoParser() {
    const locale = this.languageConfig.chronoLocale;
    return esm_exports[locale] || esm_exports;
  }
  /**
   * Build the modular processing pipeline.
   * Each processor is self-contained and operates on the current state.
   */
  buildProcessingPipeline() {
    return [
      {
        name: "extractTags",
        process: (text, result) => this.extractTags(text, result)
      },
      {
        name: "extractContexts",
        process: (text, result) => this.extractContexts(text, result)
      },
      {
        name: "extractProjects",
        process: (text, result) => this.extractProjects(text, result)
      },
      {
        name: "extractPriority",
        process: (text, result) => this.extractPriority(text, result)
      },
      {
        name: "extractStatus",
        process: (text, result) => this.extractStatus(text, result)
      },
      {
        name: "extractRecurrence",
        process: (text, result) => this.extractRecurrence(text, result)
      },
      {
        name: "extractTimeEstimate",
        process: (text, result) => this.extractTimeEstimate(text, result)
      },
      {
        name: "extractUserFields",
        process: (text, result) => this.extractUserFields(text, result)
      },
      {
        name: "parseUnifiedDatesAndTimes",
        process: (text, result) => this.parseUnifiedDatesAndTimes(text, result)
      }
    ];
  }
  /**
   * Parse natural language input into structured task data using a modular pipeline architecture.
   * Each processing stage is self-contained and can be easily reordered, added, or removed.
   */
  parseInput(input) {
    const result = {
      title: "",
      tags: [],
      contexts: [],
      projects: []
    };
    const protectedInput = this.protectNlpLiterals(input);
    const normalizedInput = this.normalizeNumericDateLiterals(protectedInput.text);
    const [workingText, details] = this.extractTitleAndDetails(normalizedInput);
    if (details) {
      result.details = details;
    }
    let remainingText = workingText;
    for (const processor of this.processingPipeline) {
      try {
        remainingText = processor.process(remainingText, result);
      } catch (error) {
        console.debug(`Error in processor ${processor.name}:`, error);
      }
    }
    result.title = remainingText.trim();
    const finalized = this.validateAndCleanupResult(result);
    this.restoreProtectedLiterals(finalized, protectedInput.literals);
    return finalized;
  }
  protectNlpLiterals(input) {
    const quoted = this.protectQuotedLiterals(input);
    return this.protectEscapedLiterals(quoted.text, quoted.literals);
  }
  protectQuotedLiterals(input) {
    const literals = [];
    let text = "";
    let index = 0;
    while (index < input.length) {
      const char = input[index];
      if (!this.isQuoteDelimiter(char) || !this.isEligibleQuoteStart(input, index)) {
        text += char;
        index += 1;
        continue;
      }
      const endIndex = this.findClosingQuote(input, index + 1, char);
      if (endIndex === -1 || !this.isEligibleQuoteEnd(input, endIndex)) {
        text += char;
        index += 1;
        continue;
      }
      const literal = input.slice(index + 1, endIndex);
      if (literal.trim().length === 0) {
        text += char;
        index += 1;
        continue;
      }
      const placeholder = `__TASKNOTES_NLP_LITERAL_${literals.length}__`;
      literals.push(literal);
      text += placeholder;
      index = endIndex + 1;
    }
    return { text, literals };
  }
  protectEscapedLiterals(input, literals) {
    let text = "";
    let index = 0;
    while (index < input.length) {
      if (input[index] !== "\\") {
        text += input[index];
        index += 1;
        continue;
      }
      const literalStart = index + 1;
      if (literalStart >= input.length || !this.shouldProtectEscapedLiteral(input, index, literalStart)) {
        text += input[index];
        index += 1;
        continue;
      }
      let literalEnd = literalStart;
      while (literalEnd < input.length && !/\s/u.test(input[literalEnd])) {
        literalEnd += 1;
      }
      const literal = input.slice(literalStart, literalEnd);
      const placeholder = `__TASKNOTES_NLP_LITERAL_${literals.length}__`;
      literals.push(literal);
      text += placeholder;
      index = literalEnd;
    }
    return { text, literals };
  }
  restoreProtectedLiterals(parsed, literals) {
    if (literals.length === 0)
      return;
    parsed.title = this.restoreProtectedLiteralsInText(parsed.title, literals).replace(/\s+/g, " ").trim();
    if (parsed.details) {
      parsed.details = this.restoreProtectedLiteralsInText(parsed.details, literals);
    }
    if (parsed.userFields) {
      for (const [key, value] of Object.entries(parsed.userFields)) {
        if (typeof value === "string") {
          parsed.userFields[key] = this.restoreProtectedLiteralsInText(value, literals);
        } else {
          parsed.userFields[key] = value.map((item) => this.restoreProtectedLiteralsInText(item, literals));
        }
      }
    }
  }
  restoreProtectedLiteralsInText(text, literals) {
    let restored = text;
    literals.forEach((literal, index) => {
      restored = restored.replace(`__TASKNOTES_NLP_LITERAL_${index}__`, literal);
    });
    return restored;
  }
  isQuoteDelimiter(char) {
    return char === '"' || char === "'" || char === "`";
  }
  isEligibleQuoteStart(input, index) {
    const char = input[index];
    if (char !== "'")
      return true;
    const previous = index > 0 ? input[index - 1] : "";
    return !this.isWordCharacter(previous);
  }
  isEligibleQuoteEnd(input, index) {
    const char = input[index];
    if (char !== "'")
      return true;
    const next = index + 1 < input.length ? input[index + 1] : "";
    return !this.isWordCharacter(next);
  }
  findClosingQuote(input, startIndex, delimiter) {
    for (let index = startIndex; index < input.length; index += 1) {
      if (input[index] !== delimiter)
        continue;
      const previous = index > 0 ? input[index - 1] : "";
      if (previous === "\\")
        continue;
      return index;
    }
    return -1;
  }
  shouldProtectEscapedLiteral(input, escapeIndex, literalStart) {
    if (this.startsWithEscapableTrigger(input, literalStart)) {
      return true;
    }
    const previous = escapeIndex > 0 ? input[escapeIndex - 1] : "";
    if (previous && !/\s/u.test(previous)) {
      return false;
    }
    return /[\p{L}\p{N}]/u.test(input[literalStart]);
  }
  startsWithEscapableTrigger(input, index) {
    return this.getEscapableTriggers().some((trigger) => input.startsWith(trigger, index));
  }
  getEscapableTriggers() {
    const configured = this.triggerConfig.getTriggersOrderedByLength().map((trigger) => trigger.trigger).filter((trigger) => trigger.length > 0);
    return configured.length > 0 ? configured : ["#", "@", "+", "*", "!"];
  }
  normalizeNumericDateLiterals(input) {
    const withYearFirstDates = input.replace(/(^|[^\p{L}\p{N}_])(\d{4})[/.](\d{1,2})[/.](\d{1,2})(?=$|[^\p{L}\p{N}_])/gu, (match, prefix, yearText, monthText, dayText) => {
      const formatted = this.toValidatedISODate(Number(yearText), Number(monthText), Number(dayText));
      return formatted ? `${prefix}${formatted}` : match;
    });
    if (this.getNumericDateOrder() !== "day-first") {
      return withYearFirstDates;
    }
    return withYearFirstDates.replace(/(^|[^\p{L}\p{N}_])(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?=$|[^\p{L}\p{N}_])/gu, (match, prefix, dayText, monthText, yearText) => {
      const formatted = this.toValidatedISODate(Number(yearText), Number(monthText), Number(dayText));
      return formatted ? `${prefix}${formatted}` : match;
    });
  }
  getNumericDateOrder() {
    if (this.options.dateOrder) {
      return this.options.dateOrder;
    }
    const locale = this.options.dateLocale || this.languageConfig.code;
    try {
      const parts = new Intl.DateTimeFormat(locale).formatToParts(new Date(2006, 10, 22));
      const firstDatePart = parts.find((part) => part.type === "day" || part.type === "month" || part.type === "year");
      if (firstDatePart?.type === "day") {
        return "day-first";
      }
    } catch {
    }
    return "month-first";
  }
  toValidatedISODate(year3, month, day) {
    const parsed = new Date(Date.UTC(year3, month - 1, day));
    if (parsed.getUTCFullYear() !== year3 || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
      return null;
    }
    return `${year3}-${this.padDatePart(month)}-${this.padDatePart(day)}`;
  }
  padDatePart(value) {
    return String(value).padStart(2, "0");
  }
  /**
   * Splits the input string into the first line (for parsing) and the rest (for details).
   */
  extractTitleAndDetails(input) {
    const trimmedInput = input.trim();
    const firstLineBreak = trimmedInput.indexOf("\n");
    if (firstLineBreak !== -1) {
      const titleLine = trimmedInput.substring(0, firstLineBreak).trim();
      const details = trimmedInput.substring(firstLineBreak + 1).trim();
      return [titleLine, details];
    }
    return [trimmedInput, void 0];
  }
  /** Extracts tags from the text and adds them to the result object. */
  extractTags(text, result) {
    const trigger = this.triggerConfig.getTagTrigger();
    if (!trigger)
      return text;
    const escapedTrigger = this.escapeRegex(trigger);
    const tagPattern = new RegExp(`${escapedTrigger}[\\p{L}\\p{N}\\p{M}_/-]+`, "gu");
    const tagMatches = text.match(tagPattern);
    if (tagMatches) {
      result.tags.push(...tagMatches.map((tag) => tag.substring(trigger.length)));
      return this.cleanupWhitespace(text.replace(tagPattern, ""));
    }
    return text;
  }
  /** Extracts contexts from the text and adds them to the result object. */
  extractContexts(text, result) {
    const trigger = this.triggerConfig.getContextTrigger();
    if (!trigger)
      return text;
    const escapedTrigger = this.escapeRegex(trigger);
    const contextPattern = new RegExp(`${escapedTrigger}[\\p{L}\\p{N}\\p{M}_/-]+`, "gu");
    const contextMatches = text.match(contextPattern);
    if (contextMatches) {
      result.contexts.push(...contextMatches.map((context) => context.substring(trigger.length)));
      return this.cleanupWhitespace(text.replace(contextPattern, ""));
    }
    return text;
  }
  /** Extracts projects and [[wikilinks]] from the text and adds them to the result object. */
  extractProjects(text, result) {
    const trigger = this.triggerConfig.getProjectTrigger();
    if (!trigger)
      return text;
    let workingText = text;
    const escapedTrigger = this.escapeRegex(trigger);
    const wikilinkPattern = new RegExp(`${escapedTrigger}\\[\\[.*?\\]\\]`, "g");
    const wikilinkProjectMatches = workingText.match(wikilinkPattern);
    if (wikilinkProjectMatches) {
      result.projects.push(...wikilinkProjectMatches.map((project) => {
        let projectName = project.slice(trigger.length);
        return projectName;
      }));
      workingText = this.cleanupWhitespace(workingText.replace(wikilinkPattern, ""));
    }
    const projectPattern = new RegExp(`${escapedTrigger}[\\p{L}\\p{N}\\p{M}_/-]+`, "gu");
    const projectMatches = workingText.match(projectPattern);
    if (projectMatches) {
      result.projects.push(...projectMatches.map((project) => project.substring(trigger.length)));
      workingText = this.cleanupWhitespace(workingText.replace(projectPattern, ""));
    }
    return workingText;
  }
  /**
   * Extracts user-defined field values from the text
   * Supports quoted values for multi-word content: trigger "multi word value"
   */
  extractUserFields(text, result) {
    let workingText = text;
    const userFieldTriggers = this.triggerConfig.getAllEnabledTriggers().filter((t) => this.triggerConfig.isUserField(t.propertyId));
    for (const triggerDef of userFieldTriggers) {
      const userField = this.triggerConfig.getUserField(triggerDef.propertyId);
      if (!userField) {
        continue;
      }
      const escapedTrigger = this.escapeRegex(triggerDef.trigger);
      if (userField.type === "list") {
        const pattern = new RegExp(`${escapedTrigger}(?:"([^"]+)"|([\\p{L}\\p{N}\\p{M}_/-]+))`, "gu");
        const values = [];
        let match;
        while ((match = pattern.exec(workingText)) !== null) {
          const value = match[1] || match[2];
          values.push(value);
        }
        if (values.length > 0) {
          if (!result.userFields)
            result.userFields = {};
          result.userFields[userField.id] = values;
          workingText = this.cleanupWhitespace(workingText.replace(pattern, ""));
        }
      } else if (userField.type === "text" || userField.type === "boolean" || userField.type === "number") {
        const pattern = new RegExp(`${escapedTrigger}(?:"([^"]+)"|([\\p{L}\\p{N}\\p{M}_/-]+))`, "u");
        const match = workingText.match(pattern);
        if (match) {
          const value = match[1] || match[2];
          if (!result.userFields)
            result.userFields = {};
          if (userField.type === "boolean") {
            result.userFields[userField.id] = value.toLowerCase() === "true" ? "true" : "false";
          } else {
            result.userFields[userField.id] = value;
          }
          workingText = this.cleanupWhitespace(workingText.replace(pattern, ""));
        }
      } else if (userField.type === "date") {
        const pattern = new RegExp(`${escapedTrigger}(?:"([^"]+)"|([\\p{L}\\p{N}\\p{M}_/-]+))`, "u");
        const match = workingText.match(pattern);
        if (match) {
          const value = match[1] || match[2];
          if (!result.userFields)
            result.userFields = {};
          result.userFields[userField.id] = value;
          workingText = this.cleanupWhitespace(workingText.replace(pattern, ""));
        }
      }
    }
    return workingText;
  }
  /** Extracts priority using shared phrase matching for custom and fallback priorities. */
  extractPriority(text, result) {
    if (this.priorityConfigs.length > 0) {
      const sortedConfigs = [...this.priorityConfigs].sort((a, b) => b.label.length - a.label.length);
      const priorityTrigger = this.triggerConfig.getTriggerForProperty("priority");
      const trigger = priorityTrigger?.enabled ? priorityTrigger.trigger : "";
      for (const config of sortedConfigs) {
        const candidates = [config.label, config.value];
        for (const candidate of candidates) {
          if (!candidate || candidate.trim() === "")
            continue;
          if (trigger) {
            const triggerPlusCandidate = trigger + candidate;
            const match3 = this.findTextMatch(text, triggerPlusCandidate);
            if (match3) {
              result.priority = config.value;
              return this.cleanupWhitespace(text.replace(match3.fullMatch, ""));
            }
          }
          const match2 = this.findTextMatch(text, candidate);
          if (match2) {
            result.priority = config.value;
            return this.cleanupWhitespace(text.replace(match2.fullMatch, ""));
          }
        }
      }
      return text;
    }
    const langConfig = this.languageConfig.fallbackPriority;
    const match = this.findPhraseValueMatch(text, [
      { value: "urgent", phrases: langConfig.urgent },
      { value: "high", phrases: langConfig.high },
      { value: "normal", phrases: langConfig.normal },
      { value: "low", phrases: langConfig.low }
    ]);
    if (match) {
      result.priority = match.value;
      return this.removePhraseMatch(text, match.match);
    }
    return text;
  }
  /** Extracts status using shared phrase matching for custom and fallback statuses. */
  extractStatus(text, result) {
    if (this.statusConfigs.length > 0) {
      const sortedConfigs = [...this.statusConfigs].sort((a, b) => b.label.length - a.label.length);
      const statusTrigger = this.triggerConfig.getTriggerForProperty("status");
      const trigger = statusTrigger?.enabled ? statusTrigger.trigger : "";
      for (const config of sortedConfigs) {
        const candidates = [config.label, config.value];
        for (const candidate of candidates) {
          if (!candidate || candidate.trim() === "") {
            continue;
          }
          if (trigger) {
            const triggerPlusCandidate = trigger + candidate;
            const match3 = this.findTextMatch(text, triggerPlusCandidate);
            if (match3) {
              result.status = config.value;
              return this.cleanupWhitespace(text.replace(match3.fullMatch, ""));
            }
          }
          const match2 = this.findTextMatch(text, candidate);
          if (match2) {
            result.status = config.value;
            return this.cleanupWhitespace(text.replace(match2.fullMatch, ""));
          }
        }
      }
      return text;
    }
    const langConfig = this.languageConfig.fallbackStatus;
    const match = this.findPhraseValueMatch(text, [
      { value: "open", phrases: langConfig.open },
      { value: "in-progress", phrases: langConfig.inProgress },
      { value: "done", phrases: langConfig.done },
      { value: "cancelled", phrases: langConfig.cancelled },
      { value: "waiting", phrases: langConfig.waiting }
    ]);
    if (match) {
      result.status = match.value;
      return this.removePhraseMatch(text, match.match);
    }
    return text;
  }
  /**
   * Finds a match using case-insensitive string search with boundary checking.
   * Returns the match details or null if no valid match found.
   */
  findTextMatch(text, searchText) {
    const match = this.findPhraseMatch(text, [searchText]);
    if (!match) {
      return null;
    }
    const fullMatchEndIndex = this.includeTrailingPhraseSeparator(text, match.endIndex);
    return {
      fullMatch: text.substring(match.startIndex, fullMatchEndIndex),
      startIndex: match.startIndex
    };
  }
  /**
   * Finds the earliest whole-phrase match, preferring the longest phrase at the same position.
   */
  findPhraseMatch(text, phrases) {
    const searchablePhrases = phrases.filter((phrase) => phrase && phrase.trim() !== "").sort((a, b) => b.length - a.length);
    if (searchablePhrases.length === 0) {
      return null;
    }
    const lowerText = text.toLowerCase();
    let bestMatch = null;
    for (const phrase of searchablePhrases) {
      const lowerPhrase = phrase.toLowerCase();
      let searchIndex = 0;
      while (searchIndex <= lowerText.length) {
        const index = lowerText.indexOf(lowerPhrase, searchIndex);
        if (index === -1) {
          break;
        }
        const endIndex = index + phrase.length;
        if (this.hasPhraseBoundaries(text, index, endIndex)) {
          const candidate = {
            fullMatch: text.substring(index, endIndex),
            phrase,
            startIndex: index,
            endIndex
          };
          if (!bestMatch || candidate.startIndex < bestMatch.startIndex || candidate.startIndex === bestMatch.startIndex && candidate.phrase.length > bestMatch.phrase.length) {
            bestMatch = candidate;
          }
        }
        searchIndex = index + 1;
      }
    }
    return bestMatch;
  }
  findPhraseValueMatch(text, groups) {
    let bestMatch = null;
    for (const group of groups) {
      const match = this.findPhraseMatch(text, group.phrases);
      if (match && (!bestMatch || match.startIndex < bestMatch.match.startIndex || match.startIndex === bestMatch.match.startIndex && match.phrase.length > bestMatch.match.phrase.length)) {
        bestMatch = { value: group.value, match };
      }
    }
    return bestMatch;
  }
  removePhraseMatch(text, match) {
    const endIndex = this.includeTrailingPhraseSeparator(text, match.endIndex);
    return this.cleanupWhitespace(text.substring(0, match.startIndex) + text.substring(endIndex));
  }
  hasPhraseBoundaries(text, startIndex, endIndex) {
    if (["zh", "ja"].includes(this.languageConfig.code)) {
      return true;
    }
    const beforeChar = this.getCodePointBefore(text, startIndex);
    const afterChar = this.getCodePointAt(text, endIndex);
    return !this.isWordCharacter(beforeChar) && !this.isWordCharacter(afterChar);
  }
  getCodePointBefore(text, index) {
    if (index <= 0) {
      return "";
    }
    return Array.from(text.slice(0, index)).pop() || "";
  }
  getCodePointAt(text, index) {
    if (index >= text.length) {
      return "";
    }
    return Array.from(text.slice(index))[0] || "";
  }
  isWordCharacter(char) {
    return char !== "" && /[\p{L}\p{N}\p{M}_]/u.test(char);
  }
  includeTrailingPhraseSeparator(text, endIndex) {
    return /[:,;]/.test(text[endIndex] || "") ? endIndex + 1 : endIndex;
  }
  /**
   * Unified method to parse all dates and times with internationalized context awareness.
   * Combines the functionality of extractExplicitDates and parseDatesAndTimes.
   *
   * Processing order:
   * 1. Look for explicit trigger patterns: "due tomorrow", "scheduled for friday"
   * 2. Parse implicit dates using chrono-node with language-specific parser
   * 3. Determine if date is due/scheduled based on context and defaultToScheduled setting
   *
   * Trigger pattern examples:
   * - English: "due\s+", "scheduled\s+for"
   * - French: "échéance\s+", "programmé\s+pour"
   * - German: "fällig\s+am", "geplant\s+für"
   *
   * @param text Input text to parse
   * @param result ParsedTaskData object to populate with date/time fields
   * @returns Text with date/time patterns removed
   */
  parseUnifiedDatesAndTimes(text, result) {
    let workingText = text;
    try {
      const chronoParser = this.getChronoParser();
      const langTriggers = this.languageConfig.dateTriggers;
      const triggerPatterns = [
        {
          type: "due",
          phrases: langTriggers.due
        },
        {
          type: "scheduled",
          phrases: langTriggers.scheduled
        }
      ];
      let foundExplicitTrigger = false;
      for (const triggerPattern of triggerPatterns) {
        const match = this.findPhraseMatch(workingText, triggerPattern.phrases);
        if (match) {
          const remainingText = workingText.substring(match.endIndex);
          const chronoParsed = this.parseChronoFromPosition(remainingText);
          if (chronoParsed.success) {
            foundExplicitTrigger = true;
            if (triggerPattern.type === "due") {
              result.dueDate = chronoParsed.date;
              if (chronoParsed.time) {
                result.dueTime = chronoParsed.time;
              }
            } else {
              result.scheduledDate = chronoParsed.date;
              if (chronoParsed.time) {
                result.scheduledTime = chronoParsed.time;
              }
            }
            const remainingDateOffset = this.getChronoMatchOffset(remainingText, chronoParsed);
            const dateEnd = chronoParsed.matchedText ? match.endIndex + remainingDateOffset + chronoParsed.matchedText.length : match.endIndex;
            workingText = workingText.substring(0, match.startIndex) + workingText.substring(dateEnd);
            workingText = this.cleanupWhitespace(workingText);
          }
        }
      }
      if (foundExplicitTrigger) {
        return workingText;
      }
      const parsedResults = chronoParser.parse(text, /* @__PURE__ */ new Date(), { forwardDate: true });
      if (parsedResults.length === 0) {
        return text;
      }
      const primaryMatch = parsedResults[0];
      const dateText = primaryMatch.text;
      const startDate = primaryMatch.start.date();
      const endDate = primaryMatch.end?.date();
      let isDue = this.findPhraseMatch(primaryMatch.text, langTriggers.due) !== null;
      let isScheduled = this.findPhraseMatch(primaryMatch.text, langTriggers.scheduled) !== null;
      if (endDate && isValid(endDate) && endDate.getTime() !== startDate.getTime()) {
        result.scheduledDate = format(startDate, "yyyy-MM-dd");
        if (primaryMatch.start.isCertain("hour")) {
          result.scheduledTime = format(startDate, "HH:mm");
        }
        result.dueDate = format(endDate, "yyyy-MM-dd");
        if (primaryMatch.end?.isCertain("hour")) {
          result.dueTime = format(endDate, "HH:mm");
        }
      } else if (isValid(startDate)) {
        const dateString = format(startDate, "yyyy-MM-dd");
        const timeString = primaryMatch.start.isCertain("hour") ? format(startDate, "HH:mm") : void 0;
        if (isDue && !isScheduled) {
          result.dueDate = dateString;
          result.dueTime = timeString;
        } else if (isScheduled && !isDue) {
          result.scheduledDate = dateString;
          result.scheduledTime = timeString;
        } else if (this.defaultToScheduled) {
          result.scheduledDate = dateString;
          result.scheduledTime = timeString;
        } else {
          result.dueDate = dateString;
          result.dueTime = timeString;
        }
      }
      workingText = workingText.replace(dateText, "").trim();
      workingText = this.cleanupWhitespace(workingText);
    } catch (error) {
      console.debug("Error in unified date parsing:", error);
    }
    return workingText;
  }
  /**
   * Use chrono-node to parse date starting from a specific position.
   * Uses language-specific chrono parser and validates that match starts near beginning.
   *
   * Position validation: Match must start within first 3 characters to account for
   * prepositions like "on", "at", "le", "am" in different languages.
   *
   * @param text Text to parse (typically after a trigger word)
   * @returns Parsed date result with success flag, formatted date/time, and matched text
   */
  parseChronoFromPosition(text) {
    try {
      const chronoParser = this.getChronoParser();
      const parsed = chronoParser.parse(text, /* @__PURE__ */ new Date(), { forwardDate: true });
      if (parsed.length > 0) {
        const firstMatch = parsed[0];
        if (firstMatch.index <= 3) {
          const parsedDate = firstMatch.start.date();
          if (isValid(parsedDate)) {
            const result = {
              success: true,
              date: format(parsedDate, "yyyy-MM-dd"),
              matchedText: firstMatch.text,
              startIndex: firstMatch.index
            };
            if (firstMatch.start.isCertain("hour")) {
              result.time = format(parsedDate, "HH:mm");
            }
            return result;
          }
        }
      }
    } catch (error) {
      console.debug("Error parsing date with chrono:", error);
    }
    return { success: false };
  }
  getChronoMatchOffset(text, chronoParsed) {
    const reportedStart = chronoParsed.startIndex ?? 0;
    if (!chronoParsed.matchedText) {
      return reportedStart;
    }
    const actualStart = text.indexOf(chronoParsed.matchedText);
    if (actualStart !== -1) {
      return actualStart;
    }
    return reportedStart;
  }
  /**
   * Builds comprehensive recurrence patterns from language configuration.
   * Patterns are ordered by priority (most specific first) and cached for performance.
   */
  buildRecurrencePatterns() {
    const lang = this.languageConfig.recurrence;
    const patterns = [];
    const { boundary, endBoundary } = this.boundaries;
    const escapeAndJoin = (patterns2) => patterns2.map((p) => this.escapeRegex(p)).join("|");
    patterns.push(...this.buildOrdinalWeekdayPatterns(lang, boundary, endBoundary, escapeAndJoin));
    patterns.push(...this.buildIntervalPatterns(lang, boundary, endBoundary, escapeAndJoin));
    patterns.push(...this.buildEveryOtherPatterns(lang, boundary, endBoundary, escapeAndJoin));
    patterns.push(...this.buildWeekdayPatterns(lang, boundary, endBoundary, escapeAndJoin));
    patterns.push(...this.buildFrequencyPatterns(lang, boundary, endBoundary, escapeAndJoin));
    return patterns;
  }
  /**
   * Builds "every [ordinal] [weekday]" patterns (e.g., "every second monday").
   * These have highest priority as they are most specific.
   */
  buildOrdinalWeekdayPatterns(lang, boundary, endBoundary, escapeAndJoin) {
    const everyKeywords = escapeAndJoin(lang.every);
    const ordinalPatterns = escapeAndJoin([
      ...lang.ordinals.first,
      ...lang.ordinals.second,
      ...lang.ordinals.third,
      ...lang.ordinals.fourth,
      ...lang.ordinals.last
    ]);
    const weekdayPatterns = escapeAndJoin([
      ...lang.weekdays.monday,
      ...lang.weekdays.tuesday,
      ...lang.weekdays.wednesday,
      ...lang.weekdays.thursday,
      ...lang.weekdays.friday,
      ...lang.weekdays.saturday,
      ...lang.weekdays.sunday
    ]);
    return [
      {
        regex: new RegExp(`${boundary}(${everyKeywords})\\s+(${ordinalPatterns})\\s+(${weekdayPatterns})${endBoundary}`, "i"),
        handler: (match) => {
          const ordinalText = match[2].toLowerCase();
          const dayText = match[3].toLowerCase();
          let position = 1;
          if (lang.ordinals.second.some((o) => o.toLowerCase() === ordinalText))
            position = 2;
          else if (lang.ordinals.third.some((o) => o.toLowerCase() === ordinalText))
            position = 3;
          else if (lang.ordinals.fourth.some((o) => o.toLowerCase() === ordinalText))
            position = 4;
          else if (lang.ordinals.last.some((o) => o.toLowerCase() === ordinalText))
            position = -1;
          const rruleDay = this.getWeekdayRRuleCode(dayText, lang);
          return `FREQ=MONTHLY;BYDAY=${rruleDay};BYSETPOS=${position}`;
        }
      }
    ];
  }
  /**
   * Builds "every [N] [period]" patterns (e.g., "every 3 days", "every 2 weeks").
   */
  buildIntervalPatterns(lang, boundary, endBoundary, escapeAndJoin) {
    const everyKeywords = escapeAndJoin(lang.every);
    const periodPatterns = escapeAndJoin([
      ...lang.periods.day,
      ...lang.periods.week,
      ...lang.periods.month,
      ...lang.periods.year
    ]);
    return [
      {
        regex: new RegExp(`${boundary}(${everyKeywords})\\s+(\\d+)\\s+(${periodPatterns})${endBoundary}`, "i"),
        handler: (match) => {
          const interval = parseInt(match[2]);
          const periodText = match[3].toLowerCase();
          const freq = this.getPeriodFrequency(periodText, lang);
          return `FREQ=${freq};INTERVAL=${interval}`;
        }
      }
    ];
  }
  /**
   * Builds "every other [period]" patterns (e.g., "every other week").
   */
  buildEveryOtherPatterns(lang, boundary, endBoundary, escapeAndJoin) {
    const everyKeywords = escapeAndJoin(lang.every);
    const otherKeywords = escapeAndJoin(lang.other);
    const periodPatterns = escapeAndJoin([
      ...lang.periods.day,
      ...lang.periods.week,
      ...lang.periods.month,
      ...lang.periods.year
    ]);
    return [
      {
        regex: new RegExp(`${boundary}(${everyKeywords})\\s+(${otherKeywords})\\s+(${periodPatterns})${endBoundary}`, "i"),
        handler: (match) => {
          const periodText = match[3].toLowerCase();
          const freq = this.getPeriodFrequency(periodText, lang);
          return `FREQ=${freq};INTERVAL=2`;
        }
      }
    ];
  }
  /**
   * Builds weekday patterns ("every [weekday]" and plural weekdays).
   */
  buildWeekdayPatterns(lang, boundary, endBoundary, escapeAndJoin) {
    const everyKeywords = escapeAndJoin(lang.every);
    const weekdayPatterns = escapeAndJoin([
      ...lang.weekdays.monday,
      ...lang.weekdays.tuesday,
      ...lang.weekdays.wednesday,
      ...lang.weekdays.thursday,
      ...lang.weekdays.friday,
      ...lang.weekdays.saturday,
      ...lang.weekdays.sunday
    ]);
    const pluralWeekdayPatterns = escapeAndJoin([
      ...lang.pluralWeekdays.monday,
      ...lang.pluralWeekdays.tuesday,
      ...lang.pluralWeekdays.wednesday,
      ...lang.pluralWeekdays.thursday,
      ...lang.pluralWeekdays.friday,
      ...lang.pluralWeekdays.saturday,
      ...lang.pluralWeekdays.sunday
    ]);
    return [
      // "every [weekday]" patterns
      {
        regex: new RegExp(`${boundary}(${everyKeywords})\\s+(${weekdayPatterns})${endBoundary}`, "i"),
        handler: (match) => {
          const dayText = match[2].toLowerCase();
          const rruleDay = this.getWeekdayRRuleCode(dayText, lang);
          return `FREQ=WEEKLY;BYDAY=${rruleDay}`;
        }
      },
      // Plural weekdays ("mondays", "tuesdays")
      {
        regex: new RegExp(`${boundary}(${pluralWeekdayPatterns})${endBoundary}`, "i"),
        handler: (match) => {
          const dayText = match[1].toLowerCase();
          const rruleDay = this.getPluralWeekdayRRuleCode(dayText, lang);
          return `FREQ=WEEKLY;BYDAY=${rruleDay}`;
        }
      }
    ];
  }
  /**
   * Builds general frequency patterns (daily, weekly, monthly, yearly).
   */
  buildFrequencyPatterns(lang, boundary, endBoundary, escapeAndJoin) {
    return [
      {
        regex: new RegExp(`${boundary}(${escapeAndJoin(lang.frequencies.daily)})${endBoundary}`, "i"),
        handler: () => "FREQ=DAILY"
      },
      {
        regex: new RegExp(`${boundary}(${escapeAndJoin(lang.frequencies.weekly)})${endBoundary}`, "i"),
        handler: () => "FREQ=WEEKLY"
      },
      {
        regex: new RegExp(`${boundary}(${escapeAndJoin(lang.frequencies.monthly)})${endBoundary}`, "i"),
        handler: () => "FREQ=MONTHLY"
      },
      {
        regex: new RegExp(`${boundary}(${escapeAndJoin(lang.frequencies.yearly)})${endBoundary}`, "i"),
        handler: () => "FREQ=YEARLY"
      }
    ];
  }
  /**
   * Helper to determine frequency type from period text.
   */
  getPeriodFrequency(periodText, lang) {
    if (lang.periods.week.some((p) => p.toLowerCase() === periodText))
      return "WEEKLY";
    if (lang.periods.month.some((p) => p.toLowerCase() === periodText))
      return "MONTHLY";
    if (lang.periods.year.some((p) => p.toLowerCase() === periodText))
      return "YEARLY";
    return "DAILY";
  }
  /**
   * Helper to get RRule weekday code from weekday text.
   */
  getWeekdayRRuleCode(dayText, lang) {
    if (lang.weekdays.tuesday.some((d) => d.toLowerCase() === dayText))
      return "TU";
    if (lang.weekdays.wednesday.some((d) => d.toLowerCase() === dayText))
      return "WE";
    if (lang.weekdays.thursday.some((d) => d.toLowerCase() === dayText))
      return "TH";
    if (lang.weekdays.friday.some((d) => d.toLowerCase() === dayText))
      return "FR";
    if (lang.weekdays.saturday.some((d) => d.toLowerCase() === dayText))
      return "SA";
    if (lang.weekdays.sunday.some((d) => d.toLowerCase() === dayText))
      return "SU";
    return "MO";
  }
  /**
   * Helper to get RRule weekday code from plural weekday text.
   */
  getPluralWeekdayRRuleCode(dayText, lang) {
    if (lang.pluralWeekdays.tuesday.some((d) => d.toLowerCase() === dayText))
      return "TU";
    if (lang.pluralWeekdays.wednesday.some((d) => d.toLowerCase() === dayText))
      return "WE";
    if (lang.pluralWeekdays.thursday.some((d) => d.toLowerCase() === dayText))
      return "TH";
    if (lang.pluralWeekdays.friday.some((d) => d.toLowerCase() === dayText))
      return "FR";
    if (lang.pluralWeekdays.saturday.some((d) => d.toLowerCase() === dayText))
      return "SA";
    if (lang.pluralWeekdays.sunday.some((d) => d.toLowerCase() === dayText))
      return "SU";
    return "MO";
  }
  /**
   * Extracts recurrence from text and generates rrule strings using cached language-aware patterns.
   * All patterns are internationalized and sourced from language configurations.
   */
  extractRecurrence(text, result) {
    for (const pattern of this.recurrencePatterns) {
      const match = text.match(pattern.regex);
      if (match) {
        const rruleString = pattern.handler(match);
        if (this.isValidRRuleString(rruleString)) {
          result.recurrence = rruleString;
          return this.cleanupWhitespace(text.replace(pattern.regex, ""));
        }
      }
    }
    return text;
  }
  /**
   * Validate an rrule string to prevent parsing errors
   */
  isValidRRuleString(rruleString) {
    if (rruleString.includes("BYDAY=undefined") || rruleString.includes("BYDAY=;") || rruleString.includes("BYDAY=")) {
      const byDayMatch = rruleString.match(/BYDAY=([^;]*)/);
      if (byDayMatch && (!byDayMatch[1] || byDayMatch[1] === "undefined" || byDayMatch[1].trim() === "")) {
        return false;
      }
    }
    if (!rruleString.includes("FREQ=")) {
      return false;
    }
    return true;
  }
  /**
   * Extracts time estimate from text using language-aware patterns.
   * Supports combined formats (1h30m), hours only (2hrs), and minutes only (45min).
   *
   * Pattern examples:
   * - Combined: "2h 30m" → 150 minutes
   * - Hours: "3 hours" → 180 minutes
   * - Minutes: "45 minutes" → 45 minutes
   *
   * @param text Input text to parse
   * @param result ParsedTaskData object to populate
   * @returns Text with time estimate patterns removed
   */
  extractTimeEstimate(text, result) {
    const langConfig = this.languageConfig.timeEstimate;
    const { boundary, endBoundary } = this.boundaries;
    const patterns = [
      // Combined format: 1h30m
      {
        regex: new RegExp(`${boundary}(\\d+)(${langConfig.hours.map((p) => this.escapeRegex(p)).join("|")})\\s*(\\d+)(${langConfig.minutes.map((p) => this.escapeRegex(p)).join("|")})${endBoundary}`, "i"),
        handler: (m) => parseInt(m[1]) * 60 + parseInt(m[3])
      },
      // Hours: 1hr, 2 hours, 3h
      {
        regex: new RegExp(`${boundary}(\\d+)\\s*(${langConfig.hours.map((p) => this.escapeRegex(p)).join("|")})${endBoundary}`, "i"),
        handler: (m) => parseInt(m[1]) * 60
      },
      // Minutes: 30min, 45 m, 15 minutes
      {
        regex: new RegExp(`${boundary}(\\d+)\\s*(${langConfig.minutes.map((p) => this.escapeRegex(p)).join("|")})${endBoundary}`, "i"),
        handler: (m) => parseInt(m[1])
      }
    ];
    let workingText = text;
    let totalEstimate = 0;
    for (const pattern of patterns) {
      const match = workingText.match(pattern.regex);
      if (match) {
        totalEstimate += pattern.handler(match);
        workingText = this.cleanupWhitespace(workingText.replace(pattern.regex, ""));
      }
    }
    if (totalEstimate > 0) {
      result.estimate = totalEstimate;
    }
    return workingText;
  }
  /**
   * Ensures the final parsed data is valid and clean.
   */
  validateAndCleanupResult(result) {
    if (!result.title.trim()) {
      result.title = "Untitled Task";
    }
    result.tags = [...new Set(result.tags.filter(Boolean))];
    result.contexts = [...new Set(result.contexts.filter(Boolean))];
    result.projects = [...new Set(result.projects.filter(Boolean))];
    if (result.dueDate && !this.isValidDateString(result.dueDate))
      delete result.dueDate;
    if (result.scheduledDate && !this.isValidDateString(result.scheduledDate))
      delete result.scheduledDate;
    if (result.dueTime && !this.isValidTimeString(result.dueTime))
      delete result.dueTime;
    if (result.scheduledTime && !this.isValidTimeString(result.scheduledTime))
      delete result.scheduledTime;
    return result;
  }
  /**
   * Generates a user-friendly preview of the parsed data.
   * Icons are placeholders for the UI layer to interpret.
   */
  getPreviewData(parsed) {
    const parts = [];
    if (parsed.title)
      parts.push({ icon: "edit-3", text: `"${parsed.title}"` });
    if (parsed.details)
      parts.push({
        icon: "file-text",
        text: `Details: "${parsed.details.substring(0, 50)}${parsed.details.length > 50 ? "..." : ""}"`
      });
    if (parsed.dueDate) {
      const dateStr = parsed.dueTime ? `${parsed.dueDate} at ${parsed.dueTime}` : parsed.dueDate;
      parts.push({ icon: "calendar", text: `Due: ${dateStr}` });
    }
    if (parsed.scheduledDate) {
      const dateStr = parsed.scheduledTime ? `${parsed.scheduledDate} at ${parsed.scheduledTime}` : parsed.scheduledDate;
      parts.push({ icon: "calendar-clock", text: `Scheduled: ${dateStr}` });
    }
    if (parsed.priority)
      parts.push({ icon: "alert-triangle", text: `Priority: ${parsed.priority}` });
    if (parsed.status)
      parts.push({ icon: "activity", text: `Status: ${parsed.status}` });
    if (parsed.contexts && parsed.contexts.length > 0)
      parts.push({
        icon: "map-pin",
        text: `Contexts: ${parsed.contexts.map((c) => "@" + c).join(", ")}`
      });
    if (parsed.projects && parsed.projects.length > 0) {
      const projectDisplay = parsed.projects.map((p) => `+${p}`).join(", ");
      parts.push({ icon: "folder", text: `Projects: ${projectDisplay}` });
    }
    if (parsed.tags && parsed.tags.length > 0)
      parts.push({
        icon: "tag",
        text: `Tags: ${parsed.tags.map((t) => "#" + t).join(", ")}`
      });
    if (parsed.recurrence) {
      let recurrenceText = "Invalid recurrence";
      try {
        if (parsed.recurrence.includes("FREQ=") && this.isValidRRuleString(parsed.recurrence)) {
          recurrenceText = RRule2.fromString(parsed.recurrence).toText();
        }
      } catch (error) {
        console.debug("Error parsing rrule for preview:", error);
      }
      parts.push({ icon: "repeat", text: `Recurrence: ${recurrenceText}` });
    }
    if (parsed.estimate)
      parts.push({ icon: "clock", text: `Estimate: ${parsed.estimate} min` });
    if (parsed.userFields && Object.keys(parsed.userFields).length > 0) {
      for (const [fieldId, value] of Object.entries(parsed.userFields)) {
        const userField = this.triggerConfig.getUserField(fieldId);
        const displayName = userField?.displayName || fieldId;
        let displayValue;
        if (Array.isArray(value)) {
          displayValue = value.join(", ");
        } else {
          displayValue = value;
        }
        parts.push({
          icon: "box",
          text: `${displayName}: ${displayValue}`
        });
      }
    }
    return parts;
  }
  /**
   * Generates a simple text-only preview of the parsed data.
   */
  getPreviewText(parsed) {
    return this.getPreviewData(parsed).map((part) => part.text).join(" \u2022 ");
  }
  /**
   * Get status suggestions for autocomplete
   */
  getStatusSuggestions(query, limit = 10) {
    const q = query.toLowerCase();
    return this.statusConfigs.filter((s) => s && typeof s.value === "string" && typeof s.label === "string").filter((s) => s.value.trim() !== "" && s.label.trim() !== "").filter((s) => s.value.toLowerCase().includes(q) || s.label.toLowerCase().includes(q)).slice(0, limit).map((s) => ({
      value: s.value,
      label: s.label,
      display: s.label
    }));
  }
};

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

// src/nlp.ts
async function createParser(flagPath) {
  const collectionPath = resolveCollectionPath(flagPath);
  const configResult = await loadConfig2(collectionPath);
  if (!configResult.valid || !configResult.config) {
    throw new Error(`Failed to load mdbase config at ${collectionPath}: ${configResult.error?.message}`);
  }
  const typeResult = await getType2(collectionPath, configResult.config, "task");
  if (!typeResult.valid || !typeResult.type) {
    throw new Error(`Failed to load task type definition: ${typeResult.error?.message}`);
  }
  const normalized = normalizeTaskTypeDefinition(typeResult.type);
  const fields = normalized.fields;
  const mapping = buildFieldMapping(fields, normalized.displayNameKey);
  const statusConfigs = [];
  const statusField = fields[mapping.roleToField.status];
  const completedSet = new Set(mapping.completedStatuses);
  if (statusField?.values) {
    statusField.values.forEach((value, index) => {
      const isCompleted = completedSet.has(value);
      statusConfigs.push({
        id: value,
        value,
        label: value.charAt(0).toUpperCase() + value.slice(1).replace(/-/g, " "),
        color: isCompleted ? "#888888" : "#ffffff",
        isCompleted,
        order: index,
        autoArchive: false,
        autoArchiveDelay: 0
      });
    });
  }
  const priorityConfigs = [];
  const priorityField = fields[mapping.roleToField.priority];
  if (priorityField?.values) {
    priorityField.values.forEach((value, index) => {
      priorityConfigs.push({
        id: value,
        value,
        label: value.charAt(0).toUpperCase() + value.slice(1),
        color: "#ffffff",
        weight: index
      });
    });
  }
  return new NaturalLanguageParserCore(statusConfigs, priorityConfigs, true, "en");
}
async function resolveDueDateExpression(input, flagPath) {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Due date cannot be empty.");
  }
  try {
    return validateDateString(trimmed);
  } catch {
  }
  const parser = await createParser(flagPath);
  const direct = parser.parseInput(trimmed);
  if (direct.dueDate) {
    return validateDateString(direct.dueDate);
  }
  const forcedDue = parser.parseInput(`due ${trimmed}`);
  if (forcedDue.dueDate) {
    return validateDateString(forcedDue.dueDate);
  }
  if (direct.scheduledDate) {
    return validateDateString(direct.scheduledDate);
  }
  throw new Error(
    `Could not parse due date "${input}". Try YYYY-MM-DD or a natural-language date like "tomorrow".`
  );
}

// src/mapper.ts
function mapToFrontmatter(parsed) {
  const fm = {};
  fm.title = parsed.title;
  if (parsed.dueDate) fm.due = parsed.dueDate;
  if (parsed.scheduledDate) fm.scheduled = parsed.scheduledDate;
  if (parsed.priority) fm.priority = parsed.priority;
  if (parsed.status) fm.status = parsed.status;
  if (parsed.tags && parsed.tags.length > 0) fm.tags = parsed.tags;
  if (parsed.contexts && parsed.contexts.length > 0) fm.contexts = parsed.contexts;
  if (parsed.projects && parsed.projects.length > 0) {
    fm.projects = parsed.projects.map(toProjectWikilink);
  }
  if (parsed.recurrence) fm.recurrence = parsed.recurrence;
  if (parsed.estimate) fm.timeEstimate = parsed.estimate;
  const body = parsed.details || void 0;
  return { frontmatter: fm, body };
}
function toProjectWikilink(project) {
  const trimmed = project.trim();
  return isWikilink(trimmed) ? trimmed : `[[projects/${trimmed}]]`;
}
function isWikilink(value) {
  return /^\[\[[^\]]+\]\]$/.test(value);
}
function extractProjectNames(projects2) {
  if (!projects2) return [];
  return projects2.filter(Boolean).map((p) => {
    const match = p.match(/\[\[(?:.*\/)?([^\]]+)\]\]/);
    return match ? match[1] : p;
  });
}

// src/format.ts
import chalk2 from "chalk";
import { format as fmtDate, isPast, parseISO, differenceInMinutes } from "date-fns";
import { basename as basename2 } from "path";
var STATUS_ICONS = {
  open: "\u2610",
  "in-progress": "\u25D0",
  done: "\u2611",
  cancelled: "\u2612"
};
var PRIORITY_COLORS = {
  urgent: chalk2.red,
  high: chalk2.red,
  normal: chalk2.yellow,
  low: chalk2.green
};
function getStatusIcon(status) {
  return STATUS_ICONS[status] || "\u2022";
}
function priorityColor(priority) {
  return PRIORITY_COLORS[priority] || chalk2.white;
}
function statusColor(status) {
  switch (status) {
    case "open":
      return chalk2.blue;
    case "in-progress":
      return chalk2.yellow;
    case "done":
      return chalk2.green;
    case "cancelled":
      return chalk2.gray;
    default:
      return chalk2.white;
  }
}
function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    if (isSameDateSafe(dateStr, getCurrentDateString())) return chalk2.cyan("today");
    const date = parseDateToLocal(dateStr);
    if (isPast(date)) return chalk2.red(fmtDate(date, "yyyy-MM-dd"));
    return fmtDate(date, "yyyy-MM-dd");
  } catch {
    return dateStr;
  }
}
function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
function formatTask(task) {
  return formatTaskForDate(task, todayString());
}
function formatTaskForDate(task, date) {
  const fm = task.frontmatter;
  const parts = [];
  const effectiveStatus = getEffectiveStatus(fm, date);
  parts.push(getStatusIcon(effectiveStatus));
  if (fm.priority && fm.priority !== "normal") {
    const color = priorityColor(fm.priority);
    parts.push(color(`[${fm.priority}]`));
  }
  parts.push(resolveTaskTitle(task));
  if (fm.due) {
    parts.push(chalk2.dim("due:") + formatDate(fm.due));
  }
  if (fm.scheduled) {
    parts.push(chalk2.dim("scheduled:") + formatDate(fm.scheduled));
  }
  if (fm.tags && fm.tags.length > 0) {
    parts.push(chalk2.cyan(fm.tags.map((t) => `#${t}`).join(" ")));
  }
  if (fm.contexts && fm.contexts.length > 0) {
    parts.push(chalk2.magenta(fm.contexts.map((c) => `@${c}`).join(" ")));
  }
  const projects2 = extractProjectNames(fm.projects);
  if (projects2.length > 0) {
    parts.push(chalk2.blue(projects2.map((p) => `+${p}`).join(" ")));
  }
  if (fm.timeEstimate) {
    parts.push(chalk2.dim(`~${formatDuration(fm.timeEstimate)}`));
  }
  return parts.join(" ");
}
function formatTaskDetailForDate(task, date) {
  const asOfDate = date ?? todayString();
  return formatTaskDetailInternal(task, asOfDate);
}
function formatTaskDetailInternal(task, asOfDate) {
  const fm = task.frontmatter;
  const lines = [];
  const effectiveStatus = getEffectiveStatus(fm, asOfDate);
  lines.push(
    `${getStatusIcon(effectiveStatus)} ${chalk2.bold(resolveTaskTitle(task))}`
  );
  lines.push(chalk2.dim("\u2500".repeat(60)));
  lines.push(
    `  Status:   ${statusColor(effectiveStatus)(effectiveStatus)}`
  );
  if (fm.priority) {
    lines.push(
      `  Priority: ${priorityColor(fm.priority)(fm.priority)}`
    );
  }
  if (fm.due) lines.push(`  Due:      ${formatDate(fm.due)}`);
  if (fm.scheduled) lines.push(`  Scheduled: ${formatDate(fm.scheduled)}`);
  if (fm.completedDate) lines.push(`  Completed: ${formatDate(fm.completedDate)}`);
  if (fm.dateCreated) lines.push(`  Created:  ${chalk2.dim(fm.dateCreated)}`);
  if (fm.tags && fm.tags.length > 0) {
    lines.push(`  Tags:     ${chalk2.cyan(fm.tags.map((t) => `#${t}`).join(" "))}`);
  }
  if (fm.contexts && fm.contexts.length > 0) {
    lines.push(`  Contexts: ${chalk2.magenta(fm.contexts.map((c) => `@${c}`).join(" "))}`);
  }
  const projects2 = extractProjectNames(fm.projects);
  if (projects2.length > 0) {
    lines.push(`  Projects: ${chalk2.blue(projects2.map((p) => `+${p}`).join(" "))}`);
  }
  if (fm.timeEstimate) {
    lines.push(`  Estimate: ${formatDuration(fm.timeEstimate)}`);
  }
  if (fm.recurrence) {
    lines.push(`  Recurs:   ${fm.recurrence}`);
  }
  if (fm.recurrence && Array.isArray(fm.completeInstances)) {
    const completed = fm.completeInstances.includes(asOfDate);
    const skipped = Array.isArray(fm.skippedInstances) && fm.skippedInstances.includes(asOfDate);
    const label = skipped ? chalk2.gray("skipped") : completed ? chalk2.green("completed") : chalk2.yellow("open");
    lines.push(`  Instance (${asOfDate}): ${label}`);
  }
  if (fm.timeEntries && fm.timeEntries.length > 0) {
    lines.push("");
    lines.push(chalk2.dim("  Time entries:"));
    for (const entry of fm.timeEntries) {
      const start = entry.startTime ? fmtDate(parseISO(entry.startTime), "yyyy-MM-dd HH:mm") : "?";
      const end = entry.endTime ? fmtDate(parseISO(entry.endTime), "HH:mm") : "running";
      const dur = entry.endTime ? ` (${formatDuration(differenceInMinutes(parseISO(entry.endTime), parseISO(entry.startTime)))})` : "";
      lines.push(`    ${start} \u2192 ${end}${dur}`);
    }
  }
  lines.push("");
  lines.push(chalk2.dim(`  Path: ${task.path}`));
  if (task.body) {
    lines.push("");
    lines.push(chalk2.dim("\u2500".repeat(60)));
    lines.push(task.body);
  }
  return lines.join("\n");
}
function showError(msg) {
  console.error(chalk2.red("\u2717") + " " + msg);
}
function showSuccess(msg) {
  console.log(chalk2.green("\u2713") + " " + msg);
}
function showWarning(msg) {
  console.log(chalk2.yellow("\u26A0") + " " + msg);
}
function getEffectiveStatus(fm, date = todayString()) {
  if (!fm.recurrence) return fm.status;
  const completeInstances = Array.isArray(fm.completeInstances) ? fm.completeInstances : [];
  if (completeInstances.includes(date)) return "done";
  const skippedInstances = Array.isArray(fm.skippedInstances) ? fm.skippedInstances : [];
  if (skippedInstances.includes(date)) return "cancelled";
  return "open";
}
function todayString() {
  return getCurrentDateString();
}
function resolveTaskTitle(task) {
  const raw = task.frontmatter?.title;
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw;
  }
  const fromPath = basename2(task.path, ".md").trim();
  return fromPath.length > 0 ? fromPath : task.path;
}

// src/create-compat.ts
import { format as format2 } from "date-fns";
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
function derivePathFromType(taskType, frontmatter, mapping, now2) {
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
  const values = buildTemplateValues(frontmatter, mapping, now2);
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
function buildTemplateValues(frontmatter, mapping, now2) {
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
  const todayDate = format2(now2, "yyyy-MM-dd");
  const dueDate = dueDateRaw || scheduledDateRaw || todayDate;
  const scheduledDate = scheduledDateRaw || dueDateRaw || todayDate;
  const contexts = readStringList(frontmatter[contextsField] ?? frontmatter.contexts).map((v) => sanitizeForPathSegment(v)).filter(Boolean);
  const projects2 = readStringList(frontmatter[projectsField] ?? frontmatter.projects).map(extractProjectName).map((v) => sanitizeForPathSegment(v)).filter(Boolean);
  const tags = readStringList(frontmatter[tagsField] ?? frontmatter.tags).map((v) => sanitizeForPathSegment(v)).filter(Boolean);
  const timeEstimate = frontmatter[estimateField] ?? frontmatter.timeEstimate;
  const zettel = generateZettel(now2);
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
    project: projects2[0] ?? "",
    projects: projects2.join("/"),
    tags: tags.join(", "),
    hashtags: tags.map((t) => `#${t}`).join(" "),
    timeEstimate: timeEstimate != null ? String(timeEstimate) : "",
    details: "",
    parentNote: "",
    date: format2(now2, "yyyy-MM-dd"),
    time: format2(now2, "HHmmss"),
    timestamp: format2(now2, "yyyy-MM-dd-HHmmss"),
    dateTime: format2(now2, "yyyy-MM-dd-HHmm"),
    year: format2(now2, "yyyy"),
    month: format2(now2, "MM"),
    day: format2(now2, "dd"),
    hour: format2(now2, "HH"),
    minute: format2(now2, "mm"),
    second: format2(now2, "ss"),
    shortDate: format2(now2, "yyMMdd"),
    shortYear: format2(now2, "yy"),
    monthName: format2(now2, "MMMM"),
    monthNameShort: format2(now2, "MMM"),
    dayName: format2(now2, "EEEE"),
    dayNameShort: format2(now2, "EEE"),
    week: format2(now2, "ww"),
    quarter: format2(now2, "q"),
    time12: sanitizeForPathSegment(format2(now2, "hh:mm a")),
    time24: sanitizeForPathSegment(format2(now2, "HH:mm")),
    hourPadded: format2(now2, "HH"),
    hour12: format2(now2, "hh"),
    ampm: format2(now2, "a"),
    unix: String(Math.floor(now2.getTime() / 1e3)),
    unixMs: String(now2.getTime()),
    milliseconds: format2(now2, "SSS"),
    ms: format2(now2, "SSS"),
    timezone: sanitizeForPathSegment(format2(now2, "xxx")),
    timezoneShort: sanitizeForPathSegment(format2(now2, "xx")),
    utcOffset: sanitizeForPathSegment(format2(now2, "xxx")),
    utcOffsetShort: sanitizeForPathSegment(format2(now2, "xx")),
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
function generateZettel(now2) {
  const datePart = format2(now2, "yyMMdd");
  const midnight2 = new Date(now2);
  midnight2.setHours(0, 0, 0, 0);
  const secondsSinceMidnight = Math.floor((now2.getTime() - midnight2.getTime()) / 1e3);
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

// src/commands/create.ts
async function createCommand(text, options) {
  const input = text.join(" ").trim();
  if (!input) {
    showError("Please provide task text.");
    process.exit(1);
  }
  try {
    const parser = await createParser(options.path);
    const parsed = parser.parseInput(input);
    const { frontmatter, body } = mapToFrontmatter(parsed);
    await withCollection(async (collection, mapping) => {
      const result = await createTaskWithCompat(
        collection,
        mapping,
        frontmatter,
        body
      );
      if (result.warnings && result.warnings.length > 0) {
        for (const warning of result.warnings) {
          showWarning(warning);
        }
      }
      if (result.error) {
        throw new Error(`Failed to create task: ${result.error.message}`);
      }
      const fm = normalizeFrontmatter(result.frontmatter, mapping);
      const task = {
        path: result.path,
        frontmatter: fm
      };
      showSuccess("Task created");
      console.log(formatTask(task));
      console.log(chalk3.dim(`  \u2192 ${result.path}`));
    }, options.path);
  } catch (err) {
    showError(err.message);
    process.exitCode = 1;
  }
}

// src/commands/list.ts
import chalk4 from "chalk";
async function listCommand(options) {
  try {
    const asOfDate = options.on ? validateDateString(options.on) : resolveDateOrToday();
    const dueDate = options.due && !options.where ? await resolveDueDateExpression(options.due, options.path) : void 0;
    const requestedTag = typeof options.tag === "string" ? options.tag.trim().toLowerCase() : "";
    const wantsArchivedTag = requestedTag === "archive" || requestedTag === "archived";
    await withCollection(async (collection, mapping) => {
      const conditions = [];
      if (options.where) {
        conditions.push(options.where);
      } else {
        const statusField = resolveField(mapping, "status");
        const priorityField = resolveField(mapping, "priority");
        const tagsField = resolveField(mapping, "tags");
        const dueField = resolveField(mapping, "due");
        const completedStatuses = mapping.completedStatuses;
        if (options.status && !options.on) {
          if (!isCompletedStatus(mapping, options.status)) {
            conditions.push({ [statusField]: { eq: options.status } });
          }
        } else if (!options.overdue) {
          for (const status of completedStatuses) {
            conditions.push({ [statusField]: { neq: status } });
          }
        }
        if (options.priority) {
          conditions.push({ [priorityField]: { eq: options.priority } });
        }
        if (options.tag) {
          conditions.push({ [tagsField]: { contains: options.tag } });
        }
        if (!options.status && !options.overdue && !wantsArchivedTag) {
          conditions.push({ not: { [tagsField]: { contains: "archive" } } });
          conditions.push({ not: { [tagsField]: { contains: "archived" } } });
        }
        if (dueDate) {
          conditions.push({ [dueField]: { eq: dueDate } });
        }
        if (options.overdue) {
          conditions.push({ [dueField]: { exists: true } });
          for (const status of completedStatuses) {
            conditions.push({ [statusField]: { neq: status } });
          }
        }
      }
      const where = conditions.length === 0 ? void 0 : conditions.length === 1 ? conditions[0] : { and: conditions };
      const limit = options.limit ? parseInt(options.limit, 10) : 50;
      const result = await collection.query({
        where: where === void 0 ? taskFilter(mapping) : { and: [taskFilter(mapping), where] },
        order_by: [{ field: resolveField(mapping, "due"), direction: "asc" }],
        limit
      });
      const rawTasks = result.results || [];
      const today2 = asOfDate;
      const tasks = rawTasks.filter((task) => {
        const fm = normalizeFrontmatter(task.frontmatter, mapping);
        if (options.overdue) {
          if (isCompletedStatus(mapping, typeof fm.status === "string" ? fm.status : void 0)) return false;
          if (typeof fm.due !== "string" || fm.due.trim().length === 0) return false;
          if (!isBeforeDateSafe(fm.due, today2)) return false;
        }
        const isRecurring = typeof fm.recurrence === "string" && fm.recurrence.trim().length > 0;
        if (!isRecurring) {
          if (!options.status) return true;
          return String(fm.status || "") === options.status;
        }
        const completeInstances = Array.isArray(fm.completeInstances) ? fm.completeInstances : [];
        const skippedInstances = Array.isArray(fm.skippedInstances) ? fm.skippedInstances : [];
        const effectiveStatus = completeInstances.includes(today2) ? "done" : skippedInstances.includes(today2) ? "cancelled" : "open";
        if (options.status) {
          if (isCompletedStatus(mapping, options.status)) {
            return effectiveStatus === "done" || effectiveStatus === "cancelled";
          }
          if (effectiveStatus !== "open") return false;
          return String(fm.status || "") === options.status;
        }
        return effectiveStatus !== "done" && effectiveStatus !== "cancelled";
      });
      if (options.json) {
        const clean = tasks.map((t) => {
          const fm = normalizeFrontmatter(t.frontmatter, mapping);
          const displayTitle = resolveDisplayTitle(fm, mapping, t.path);
          if (displayTitle) {
            fm.title = displayTitle;
          }
          return {
            path: t.path,
            ...fm
          };
        });
        console.log(JSON.stringify(clean, null, 2));
        return;
      }
      if (tasks.length === 0) {
        console.log(chalk4.dim("No tasks found."));
        return;
      }
      for (const task of tasks) {
        const fm = normalizeFrontmatter(task.frontmatter, mapping);
        const displayTitle = resolveDisplayTitle(fm, mapping, task.path);
        if (displayTitle) {
          fm.title = displayTitle;
        }
        if (options.on) {
          console.log(formatTaskForDate({ ...task, frontmatter: fm }, asOfDate));
        } else {
          console.log(formatTask({ ...task, frontmatter: fm }));
        }
      }
      if (result.meta?.has_more) {
        console.log(chalk4.dim(`
  ... and more (use --limit to show more)`));
      }
    }, options.path);
  } catch (err) {
    showError(err.message);
    process.exitCode = 1;
  }
}

// src/commands/show.ts
async function showCommand(pathOrTitle, options) {
  try {
    const asOfDate = options.on ? validateDateString(options.on) : void 0;
    await withCollection(async (collection, mapping) => {
      const taskPath = await resolveTaskPath(collection, pathOrTitle, mapping);
      const result = await collection.read(taskPath);
      if (result.error) {
        throw new Error(`Failed to read task: ${result.error.message}`);
      }
      const fm = normalizeFrontmatter(result.frontmatter, mapping);
      const displayTitle = resolveDisplayTitle(fm, mapping, taskPath);
      if (displayTitle) {
        fm.title = displayTitle;
      }
      const task = {
        path: taskPath,
        frontmatter: fm,
        body: result.body
      };
      console.log(formatTaskDetailForDate(task, asOfDate));
    }, options.path);
  } catch (err) {
    showError(err.message);
    process.exitCode = 1;
  }
}

// src/commands/complete.ts
import { buildSpecCompleteTaskUpdate } from "@tasknotes/model/operations";
async function completeCommand(pathOrTitle, options) {
  try {
    await withCollection(async (collection, mapping) => {
      const taskPath = await resolveTaskPath(collection, pathOrTitle, mapping);
      const read = await collection.read(taskPath);
      if (read.error) {
        throw new Error(`Failed to read task: ${read.error.message}`);
      }
      const fm = normalizeFrontmatter(read.frontmatter, mapping);
      const taskTitle = resolveDisplayTitle(fm, mapping, taskPath) || taskPath;
      const isRecurring = typeof fm.recurrence === "string" && fm.recurrence.trim().length > 0;
      const completionStatus = getDefaultCompletedStatus(mapping);
      if (!isRecurring && isCompletedStatus(mapping, typeof fm.status === "string" ? fm.status : void 0)) {
        showSuccess(`Task "${taskTitle}" is already completed.`);
        return;
      }
      if (isRecurring) {
        const targetDate = resolveOperationTargetDate(
          options.date,
          typeof fm.scheduled === "string" ? fm.scheduled : void 0,
          typeof fm.due === "string" ? fm.due : void 0
        );
        const plan2 = buildSpecCompleteTaskUpdate({
          frontmatter: fm,
          targetDate,
          completedStatus: completionStatus,
          path: taskPath
        });
        if (!plan2.changed) {
          showSuccess(`Recurring instance already completed on ${targetDate}: ${taskTitle}`);
          return;
        }
        const nextScheduled = typeof plan2.metadata?.nextScheduled === "string" ? plan2.metadata.nextScheduled : void 0;
        if (!nextScheduled) {
          const result3 = await collection.update({
            path: taskPath,
            fields: denormalizeFrontmatter(plan2.fields, mapping)
          });
          if (result3.error) {
            throw new Error(`Failed to complete task: ${result3.error.message}`);
          }
          showSuccess(`Completed: ${taskTitle}`);
          return;
        }
        const result2 = await collection.update({
          path: taskPath,
          fields: denormalizeFrontmatter(plan2.fields, mapping)
        });
        if (result2.error) {
          throw new Error(`Failed to complete recurring task: ${result2.error.message}`);
        }
        showSuccess(`Completed recurring instance: ${taskTitle} \u2192 next ${nextScheduled}`);
        return;
      }
      const today2 = resolveDateOrToday(options.date);
      const plan = buildSpecCompleteTaskUpdate({
        frontmatter: fm,
        targetDate: today2,
        completedStatus: completionStatus,
        path: taskPath
      });
      const result = await collection.update({
        path: taskPath,
        fields: denormalizeFrontmatter(plan.fields, mapping)
      });
      if (result.error) {
        throw new Error(`Failed to complete task: ${result.error.message}`);
      }
      showSuccess(`Completed: ${taskTitle}`);
    }, options.path);
  } catch (err) {
    showError(err.message);
    process.exitCode = 1;
  }
}

// src/commands/update.ts
async function updateCommand(pathOrTitle, options) {
  try {
    await withCollection(async (collection, mapping) => {
      const taskPath = await resolveTaskPath(collection, pathOrTitle, mapping);
      const read = await collection.read(taskPath);
      if (read.error) {
        throw new Error(`Failed to read task: ${read.error.message}`);
      }
      const fm = normalizeFrontmatter(read.frontmatter, mapping);
      const taskTitle = resolveDisplayTitle(fm, mapping, taskPath) || taskPath;
      const fields = {};
      if (options.status) fields.status = options.status;
      if (options.priority) fields.priority = options.priority;
      if (options.due) fields.due = options.due;
      if (options.scheduled) fields.scheduled = options.scheduled;
      if (options.title) fields.title = options.title;
      const assign = (assignment, allowNew) => {
        const separator = assignment.indexOf("=");
        if (separator <= 0) throw new Error("invalid_set_assignment");
        const field = assignment.slice(0, separator).trim();
        const value = assignment.slice(separator + 1);
        if (!field) throw new Error("invalid_set_assignment");
        if (!allowNew && !(field in read.frontmatter)) {
          throw new Error(`unknown_field:${field}`);
        }
        fields[field] = value;
      };
      for (const assignment of options.set ?? []) assign(assignment, false);
      for (const assignment of options.setNew ?? []) assign(assignment, true);
      const listed = /* @__PURE__ */ new Set();
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
        fields[field].push(value);
      }
      if (options.addTag || options.removeTag) {
        let tags = Array.isArray(fm.tags) ? [...fm.tags] : [];
        if (options.addTag) {
          for (const t of options.addTag) {
            if (!tags.includes(t)) tags.push(t);
          }
        }
        if (options.removeTag) {
          tags = tags.filter((t) => !options.removeTag.includes(t));
        }
        fields.tags = tags;
      }
      if (options.addContext || options.removeContext) {
        let contexts = Array.isArray(fm.contexts) ? [...fm.contexts] : [];
        if (options.addContext) {
          for (const c of options.addContext) {
            if (!contexts.includes(c)) contexts.push(c);
          }
        }
        if (options.removeContext) {
          contexts = contexts.filter((c) => !options.removeContext.includes(c));
        }
        fields.contexts = contexts;
      }
      if (Object.keys(fields).length === 0) {
        throw new Error("No fields to update. Use flags like --status, --priority, --due, etc.");
      }
      const result = await collection.update({
        path: taskPath,
        fields: denormalizeFrontmatter(fields, mapping)
      });
      if (result.error) {
        throw new Error(`Failed to update task: ${result.error.message}`);
      }
      showSuccess(`Updated: ${taskTitle}`);
    }, options.path);
  } catch (err) {
    showError(err.message);
    process.exitCode = 1;
  }
}

// src/commands/promote.ts
async function promoteCommand(taskPath, options) {
  try {
    if (!taskPath.endsWith(".md")) throw new Error("exact_markdown_path_required");
    await withCollection(async (collection, mapping) => {
      const read = await collection.read(taskPath);
      if (read.error) throw new Error(`Failed to read note: ${read.error.message}`);
      const frontmatter = read.frontmatter;
      const tags = Array.isArray(frontmatter.tags) ? [...frontmatter.tags] : [];
      if (!tags.includes("task")) tags.push("task");
      const result = await collection.update({
        path: taskPath,
        fields: denormalizeFrontmatter({
          tags,
          status: "to-do",
          Responsavel: [options.responsavel],
          Marca: [options.marca],
          Projeto: [options.projeto]
        }, mapping)
      });
      if (result.error) throw new Error(`Failed to promote note: ${result.error.message}`);
      showSuccess(`Promoted: ${taskPath}`);
    }, options.path);
  } catch (err) {
    showError(err.message);
    process.exitCode = 1;
  }
}

// src/commands/delete.ts
async function deleteCommand(pathOrTitle, options) {
  try {
    await withCollection(async (collection, mapping) => {
      const taskPath = await resolveTaskPath(collection, pathOrTitle, mapping);
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
    showError(err.message);
    process.exitCode = 1;
  }
}

// src/commands/archive.ts
async function archiveCommand(pathOrTitle, options) {
  try {
    await withCollection(async (collection, mapping) => {
      const taskPath = await resolveTaskPath(collection, pathOrTitle, mapping);
      const read = await collection.read(taskPath);
      if (read.error) {
        throw new Error(`Failed to read task: ${read.error.message}`);
      }
      const fm = normalizeFrontmatter(read.frontmatter, mapping);
      const taskTitle = resolveDisplayTitle(fm, mapping, taskPath) || taskPath;
      const tags = Array.isArray(fm.tags) ? [...fm.tags] : [];
      if (tags.includes("archive")) {
        showSuccess(`Task "${taskTitle}" is already archived.`);
        return;
      }
      tags.push("archive");
      const result = await collection.update({
        path: taskPath,
        fields: denormalizeFrontmatter({ tags }, mapping)
      });
      if (result.error) {
        throw new Error(`Failed to archive task: ${result.error.message}`);
      }
      showSuccess(`Archived: ${taskTitle}`);
    }, options.path);
  } catch (err) {
    showError(err.message);
    process.exitCode = 1;
  }
}

// src/commands/search.ts
import chalk5 from "chalk";
async function searchCommand(query, options) {
  const searchTerm = query.join(" ").trim().toLowerCase();
  if (!searchTerm) {
    showError("Please provide a search query.");
    process.exit(1);
  }
  try {
    await withCollection(async (collection, mapping) => {
      const result = await collection.query({
        where: taskFilter(mapping),
        include_body: true,
        limit: 200
      });
      const tasks = result.results || [];
      const scored = tasks.map((task) => {
        const fm = normalizeFrontmatter(task.frontmatter, mapping);
        const displayTitle = resolveDisplayTitle(fm, mapping, task.path);
        if (displayTitle) {
          fm.title = displayTitle;
        }
        let score = 0;
        const title = (fm.title || "").toLowerCase();
        const body = (task.body || "").toLowerCase();
        const tags = (fm.tags || []).join(" ").toLowerCase();
        const contexts = (fm.contexts || []).join(" ").toLowerCase();
        const projects2 = extractProjectNames(fm.projects).join(" ").toLowerCase();
        if (title.includes(searchTerm)) score += 10;
        if (tags.includes(searchTerm)) score += 5;
        if (contexts.includes(searchTerm)) score += 5;
        if (projects2.includes(searchTerm)) score += 5;
        if (body.includes(searchTerm)) score += 2;
        return { task: { ...task, frontmatter: fm }, score };
      }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score);
      const limit = options.limit ? parseInt(options.limit, 10) : 20;
      const results = scored.slice(0, limit);
      if (results.length === 0) {
        console.log(chalk5.dim(`No tasks matching "${searchTerm}".`));
        return;
      }
      console.log(chalk5.dim(`${results.length} result(s) for "${searchTerm}":
`));
      for (const { task } of results) {
        console.log(formatTask(task));
      }
    }, options.path);
  } catch (err) {
    showError(err.message);
    process.exitCode = 1;
  }
}

// src/commands/timer.ts
import chalk6 from "chalk";
import { format as format3, parseISO as parseISO2 } from "date-fns";
import {
  buildSpecStartTimeTrackingUpdate,
  buildSpecStopTimeTrackingUpdate
} from "@tasknotes/model/operations";
import {
  calculateElapsedTimeEntryMinutes,
  getActiveTimeEntry
} from "@tasknotes/model/time";
async function timerStartCommand(pathOrTitle, options) {
  try {
    await withCollection(async (collection, mapping) => {
      const taskPath = await resolveTaskPath(collection, pathOrTitle, mapping);
      const read = await collection.read(taskPath);
      if (read.error) {
        throw new Error(`Failed to read task: ${read.error.message}`);
      }
      const fm = normalizeFrontmatter(read.frontmatter, mapping);
      const running = getActiveTimeEntry({ timeEntries: fm.timeEntries });
      if (running) {
        throw new Error(`Timer already running since ${running.startTime}. Stop it first.`);
      }
      const plan = buildSpecStartTimeTrackingUpdate({
        frontmatter: fm,
        currentTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
        description: options.description,
        path: taskPath
      });
      const result = await collection.update({
        path: taskPath,
        fields: denormalizeFrontmatter(plan.fields, mapping)
      });
      if (result.error) {
        throw new Error(`Failed to start timer: ${result.error.message}`);
      }
      const taskTitle = resolveDisplayTitle(fm, mapping, taskPath) || taskPath;
      showSuccess(`Timer started for: ${taskTitle}`);
    }, options.path);
  } catch (err) {
    showError(err.message);
    process.exitCode = 1;
  }
}
async function timerStopCommand(options) {
  try {
    await withCollection(async (collection, mapping) => {
      if (options.pathOrTitle) {
        const taskPath = await resolveTaskPath(collection, options.pathOrTitle, mapping);
        const read = await collection.read(taskPath);
        if (read.error) throw new Error(`Failed to read task: ${read.error.message}`);
        const frontmatter = normalizeFrontmatter(read.frontmatter, mapping);
        const active = getActiveTimeEntry({ timeEntries: frontmatter.timeEntries });
        if (!active) throw new Error("timer_not_found");
        const plan2 = buildSpecStopTimeTrackingUpdate({ frontmatter, currentTimestamp: (/* @__PURE__ */ new Date()).toISOString(), stopTimestamp: (/* @__PURE__ */ new Date()).toISOString(), path: taskPath });
        const updateResult2 = await collection.update({ path: taskPath, fields: denormalizeFrontmatter(plan2.fields, mapping) });
        if (updateResult2.error) throw new Error(`Failed to stop timer: ${updateResult2.error.message}`);
        showSuccess(`Timer stopped for: ${resolveDisplayTitle(frontmatter, mapping, taskPath) || taskPath}`);
        return;
      }
      const result = await collection.query({
        where: taskFilter(mapping)
      });
      const rawTasks = result.results || [];
      const tasks = rawTasks.map((t) => ({
        ...t,
        frontmatter: normalizeFrontmatter(t.frontmatter, mapping)
      }));
      let found = null;
      for (const task2 of tasks) {
        const activeEntry = getActiveTimeEntry({ timeEntries: task2.frontmatter.timeEntries });
        if (activeEntry) {
          const idx = task2.frontmatter.timeEntries?.findIndex((entry) => entry.startTime === activeEntry.startTime && !entry.endTime) ?? -1;
          found = { task: task2, entryIndex: idx };
          break;
        }
      }
      if (!found) {
        throw new Error("No running timer found.");
      }
      const { task, entryIndex } = found;
      const stopTimestamp = (/* @__PURE__ */ new Date()).toISOString();
      const plan = buildSpecStopTimeTrackingUpdate({
        frontmatter: task.frontmatter,
        currentTimestamp: stopTimestamp,
        stopTimestamp,
        path: task.path
      });
      const stoppedEntry = plan.updatedTask.timeEntries?.[entryIndex];
      const duration = stoppedEntry ? calculateElapsedTimeEntryMinutes(stoppedEntry, stopTimestamp) : 0;
      const updateResult = await collection.update({
        path: task.path,
        fields: denormalizeFrontmatter(plan.fields, mapping)
      });
      if (updateResult.error) {
        throw new Error(`Failed to stop timer: ${updateResult.error.message}`);
      }
      const taskTitle = resolveDisplayTitle(task.frontmatter, mapping, task.path) || task.path;
      showSuccess(`Timer stopped for: ${taskTitle} (${formatDuration(duration)})`);
    }, options.path);
  } catch (err) {
    showError(err.message);
    process.exitCode = 1;
  }
}
async function timerStatusCommand(options) {
  try {
    await withCollection(async (collection, mapping) => {
      const result = await collection.query({
        where: taskFilter(mapping)
      });
      const rawTasks = result.results || [];
      const tasks = rawTasks.map((t) => ({
        ...t,
        frontmatter: normalizeFrontmatter(t.frontmatter, mapping)
      }));
      let found = false;
      for (const task of tasks) {
        const running = getActiveTimeEntry({ timeEntries: task.frontmatter.timeEntries });
        if (running) {
          const elapsed = calculateElapsedTimeEntryMinutes(running);
          const taskTitle = resolveDisplayTitle(task.frontmatter, mapping, task.path) || task.path;
          console.log(
            `${chalk6.green("\u25CF")} ${taskTitle} \u2014 ${formatDuration(elapsed)} elapsed` + (running.description ? chalk6.dim(` (${running.description})`) : "")
          );
          found = true;
        }
      }
      if (!found) {
        console.log(chalk6.dim("No active timers."));
      }
    }, options.path);
  } catch (err) {
    showError(err.message);
    process.exitCode = 1;
  }
}
async function timerLogCommand(options) {
  try {
    await withCollection(async (collection, mapping) => {
      const result = await collection.query({
        where: taskFilter(mapping)
      });
      const rawTasks = result.results || [];
      const tasks = rawTasks.map((t) => ({
        ...t,
        frontmatter: normalizeFrontmatter(t.frontmatter, mapping)
      }));
      const allEntries = [];
      for (const task of tasks) {
        const entries = task.frontmatter.timeEntries || [];
        for (const entry of entries) {
          if (!entry.endTime) continue;
          allEntries.push({
            taskTitle: resolveDisplayTitle(task.frontmatter, mapping, task.path) || task.path,
            taskPath: task.path,
            entry
          });
        }
      }
      let filtered = allEntries;
      if (options.from) {
        const fromTime = resolveDateTimeRangeBound(options.from, "from").getTime();
        filtered = filtered.filter((e) => {
          const startTime = parseISO2(e.entry.startTime).getTime();
          return !Number.isNaN(startTime) && startTime >= fromTime;
        });
      }
      if (options.to) {
        const toTime = resolveDateTimeRangeBound(options.to, "to").getTime();
        filtered = filtered.filter((e) => {
          const startTime = parseISO2(e.entry.startTime).getTime();
          return !Number.isNaN(startTime) && startTime <= toTime;
        });
      }
      if (options.period === "today") {
        const today2 = getCurrentDateString();
        filtered = filtered.filter((e) => e.entry.startTime.startsWith(today2));
      } else if (options.period === "week") {
        const weekAgo = /* @__PURE__ */ new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekStr = weekAgo.toISOString();
        filtered = filtered.filter((e) => e.entry.startTime >= weekStr);
      }
      filtered.sort((a, b) => a.entry.startTime.localeCompare(b.entry.startTime));
      if (filtered.length === 0) {
        console.log(chalk6.dim("No time entries found."));
        return;
      }
      let totalMinutes = 0;
      for (const { taskTitle, entry } of filtered) {
        const start = format3(parseISO2(entry.startTime), "yyyy-MM-dd HH:mm");
        const end = entry.endTime ? format3(parseISO2(entry.endTime), "HH:mm") : "running";
        const dur = entry.endTime ? calculateElapsedTimeEntryMinutes(entry) : 0;
        totalMinutes += dur;
        console.log(
          `  ${start} \u2192 ${end}  ${chalk6.dim(formatDuration(dur).padStart(6))}  ${taskTitle}` + (entry.description ? chalk6.dim(` \u2014 ${entry.description}`) : "")
        );
      }
      console.log(chalk6.dim("\u2500".repeat(60)));
      console.log(`  Total: ${chalk6.bold(formatDuration(totalMinutes))}`);
    }, options.path);
  } catch (err) {
    showError(err.message);
    process.exitCode = 1;
  }
}

// src/commands/projects.ts
import chalk7 from "chalk";
import { basename as basename3, dirname as dirname2 } from "path";
function fallbackProjectName(raw) {
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
async function buildResolverContext(collection) {
  const coll = collection;
  if (typeof coll.scanFiles !== "function" || typeof coll.buildFileCache !== "function" || typeof coll.scanAllFiles !== "function" || typeof coll.buildNonMarkdownSet !== "function") {
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
async function resolveProjectName(collection, mapping, sourcePath, rawProject, resolverContext, nameCache, readCache) {
  const cacheKey = `${dirname2(sourcePath)}::${rawProject}`;
  const cached = nameCache.get(cacheKey);
  if (cached) return cached;
  let resolvedName = fallbackProjectName(rawProject);
  try {
    const coll = collection;
    if (resolverContext && typeof coll.resolveLinkFullWithFiles === "function") {
      const resolution = coll.resolveLinkFullWithFiles(
        rawProject,
        sourcePath,
        resolverContext.files,
        void 0,
        resolverContext.fileCache,
        resolverContext.nonMdSet
      );
      const resolvedPath = resolution?.resolved;
      if (typeof resolvedPath === "string" && resolvedPath.length > 0) {
        let targetFm = readCache.get(resolvedPath);
        if (!targetFm) {
          const readResult = await collection.read(resolvedPath);
          if (!readResult.error) {
            targetFm = normalizeFrontmatter(
              readResult.frontmatter || {},
              mapping
            );
            readCache.set(resolvedPath, targetFm);
          }
        }
        if (targetFm) {
          const display = resolveDisplayTitle(targetFm, mapping, resolvedPath) || (typeof targetFm.title === "string" ? targetFm.title : void 0) || basename3(resolvedPath, ".md");
          if (display && display.trim().length > 0) {
            resolvedName = display.trim();
          }
        }
      }
    }
  } catch {
  }
  nameCache.set(cacheKey, resolvedName);
  return resolvedName;
}
async function resolveTaskProjectNames(collection, mapping, task, resolverContext, nameCache, readCache) {
  const rawProjects = Array.isArray(task.frontmatter.projects) ? task.frontmatter.projects : [];
  const names = [];
  for (const raw of rawProjects) {
    if (typeof raw !== "string" || raw.trim().length === 0) continue;
    const name = await resolveProjectName(
      collection,
      mapping,
      task.path,
      raw,
      resolverContext,
      nameCache,
      readCache
    );
    if (name.length > 0) {
      names.push(name);
    }
  }
  return names;
}
async function projectsListCommand(options) {
  try {
    await withCollection(async (collection, mapping) => {
      const result = await collection.query({
        where: taskFilter(mapping),
        limit: 500
      });
      const rawTasks = result.results || [];
      const tasks = rawTasks.map((t) => {
        const fm = normalizeFrontmatter(t.frontmatter, mapping);
        const displayTitle = resolveDisplayTitle(fm, mapping, t.path);
        if (displayTitle) {
          fm.title = displayTitle;
        }
        return {
          ...t,
          frontmatter: fm
        };
      });
      const resolverContext = await buildResolverContext(collection);
      const projectNameCache = /* @__PURE__ */ new Map();
      const readCache = /* @__PURE__ */ new Map();
      const projectMap = /* @__PURE__ */ new Map();
      for (const task of tasks) {
        const projects2 = await resolveTaskProjectNames(
          collection,
          mapping,
          task,
          resolverContext,
          projectNameCache,
          readCache
        );
        for (const project of projects2) {
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
        console.log(chalk7.dim("No projects found."));
        return;
      }
      const sorted = [...projectMap.entries()].sort(
        (a, b) => a[0].localeCompare(b[0])
      );
      for (const [name, counts] of sorted) {
        if (options.stats) {
          const pct = counts.total > 0 ? Math.round(counts.done / counts.total * 100) : 0;
          console.log(
            `  ${chalk7.blue(`+${name}`)}  ${counts.open} open, ${counts.done} done (${pct}%)`
          );
        } else {
          console.log(`  ${chalk7.blue(`+${name}`)}`);
        }
      }
    }, options.path);
  } catch (err) {
    showError(err.message);
    process.exitCode = 1;
  }
}
async function projectsShowCommand(name, options) {
  try {
    await withCollection(async (collection, mapping) => {
      const result = await collection.query({
        where: taskFilter(mapping),
        limit: 500
      });
      const rawTasks = result.results || [];
      const tasks = rawTasks.map((t) => {
        const fm = normalizeFrontmatter(t.frontmatter, mapping);
        const displayTitle = resolveDisplayTitle(fm, mapping, t.path);
        if (displayTitle) {
          fm.title = displayTitle;
        }
        return {
          ...t,
          frontmatter: fm
        };
      });
      const resolverContext = await buildResolverContext(collection);
      const projectNameCache = /* @__PURE__ */ new Map();
      const readCache = /* @__PURE__ */ new Map();
      const filtered = [];
      for (const task of tasks) {
        const projects2 = await resolveTaskProjectNames(
          collection,
          mapping,
          task,
          resolverContext,
          projectNameCache,
          readCache
        );
        if (projects2.some((p) => p.toLowerCase() === name.toLowerCase())) {
          filtered.push(task);
        }
      }
      if (filtered.length === 0) {
        console.log(chalk7.dim(`No tasks in project "${name}".`));
        return;
      }
      console.log(chalk7.bold(`Project: +${name}
`));
      for (const task of filtered) {
        console.log(formatTask(task));
      }
    }, options.path);
  } catch (err) {
    showError(err.message);
    process.exitCode = 1;
  }
}

// src/commands/stats.ts
import chalk8 from "chalk";
import { parseISO as parseISO3, differenceInMinutes as differenceInMinutes2 } from "date-fns";
async function statsCommand(options) {
  try {
    await withCollection(async (collection, mapping) => {
      const result = await collection.query({
        where: taskFilter(mapping),
        limit: 1e3
      });
      const rawTasks = result.results || [];
      const tasks = rawTasks.map((t) => ({
        ...t,
        frontmatter: normalizeFrontmatter(t.frontmatter, mapping)
      }));
      const total = tasks.length;
      if (total === 0) {
        console.log(chalk8.dim("No tasks found."));
        return;
      }
      const byStatus = /* @__PURE__ */ new Map();
      for (const task of tasks) {
        const s = task.frontmatter.status || "unknown";
        byStatus.set(s, (byStatus.get(s) || 0) + 1);
      }
      const byPriority = /* @__PURE__ */ new Map();
      for (const task of tasks) {
        const p = task.frontmatter.priority || "unset";
        byPriority.set(p, (byPriority.get(p) || 0) + 1);
      }
      const today2 = getCurrentDateString();
      const overdue = tasks.filter(
        (t) => t.frontmatter.due && isBeforeDateSafe(t.frontmatter.due, today2) && !isCompletedStatus(mapping, t.frontmatter.status)
      ).length;
      const completedCount = tasks.filter((t) => isCompletedStatus(mapping, t.frontmatter.status)).length;
      const completionRate = Math.round(completedCount / total * 100);
      let totalMinutes = 0;
      for (const task of tasks) {
        const entries = task.frontmatter.timeEntries || [];
        for (const entry of entries) {
          if (entry.endTime) totalMinutes += differenceInMinutes2(parseISO3(entry.endTime), parseISO3(entry.startTime));
        }
      }
      console.log(chalk8.bold("Task Statistics\n"));
      console.log(`  Total tasks:     ${total}`);
      console.log(`  Completion rate: ${completionRate}%`);
      console.log(`  Overdue:         ${overdue > 0 ? chalk8.red(String(overdue)) : "0"}`);
      console.log(chalk8.dim("\n  By status:"));
      for (const [status, count] of [...byStatus.entries()].sort()) {
        const bar = "\u2588".repeat(Math.ceil(count / total * 30));
        console.log(`    ${status.padEnd(14)} ${String(count).padStart(4)}  ${chalk8.dim(bar)}`);
      }
      console.log(chalk8.dim("\n  By priority:"));
      for (const [priority, count] of [...byPriority.entries()].sort()) {
        const bar = "\u2588".repeat(Math.ceil(count / total * 30));
        console.log(`    ${priority.padEnd(14)} ${String(count).padStart(4)}  ${chalk8.dim(bar)}`);
      }
      if (totalMinutes > 0) {
        console.log(`
  Time tracked:    ${formatDuration(totalMinutes)}`);
      }
    }, options.path);
  } catch (err) {
    showError(err.message);
    process.exitCode = 1;
  }
}

// src/commands/interactive.ts
import * as readline from "readline";
import chalk9 from "chalk";
var lastInput = "";
var previewTimer = null;
var lastPreviewText = "";
var lastKeyTime = 0;
function getAdaptiveDelay(str, key, timeSinceLastKey) {
  if (str === "@" || str === "#" || str === "+" || str === "!") return 50;
  if (str === " ") return 100;
  if (key && (key.name === "backspace" || key.name === "delete")) return 150;
  if (timeSinceLastKey < 100) return 300;
  if (timeSinceLastKey < 300) return 180;
  return 120;
}
function formatPreviewInline(parser, input) {
  const parsed = parser.parseInput(input);
  const parts = [];
  if (parsed.title) parts.push(chalk9.cyan(`"${parsed.title}"`));
  if (parsed.status) parts.push(chalk9.yellow(`[${parsed.status}]`));
  if (parsed.priority) parts.push(chalk9.red(`[${parsed.priority}]`));
  if (parsed.tags?.length) parts.push(parsed.tags.map((t) => chalk9.cyan(`#${t}`)).join(" "));
  if (parsed.contexts?.length) parts.push(parsed.contexts.map((c) => chalk9.magenta(`@${c}`)).join(" "));
  if (parsed.projects?.length) parts.push(parsed.projects.map((p) => chalk9.blue(`+${p}`)).join(" "));
  if (parsed.dueDate) parts.push(chalk9.yellow(`due:${parsed.dueDate}`));
  if (parsed.scheduledDate) parts.push(chalk9.cyan(`scheduled:${parsed.scheduledDate}`));
  if (parsed.estimate) parts.push(chalk9.dim(`~${parsed.estimate}m`));
  if (parsed.recurrence) parts.push(chalk9.green(`recur:${parsed.recurrence}`));
  return parts.join(" ");
}
function updatePreview(text) {
  process.stdout.write("\x1B[s");
  process.stdout.write("\x1B[3A");
  process.stdout.write("\r\x1B[K");
  process.stdout.write(chalk9.dim("Preview: ") + text);
  process.stdout.write("\x1B[u");
}
async function interactiveCommand(options) {
  try {
    const parser = await createParser(options.path);
    await withCollection(async (collection, mapping) => {
      console.log(chalk9.bold("mdbase-tasknotes Interactive Mode"));
      console.log(chalk9.dim("Type a task description and press Enter to create"));
      console.log(chalk9.dim("Press Ctrl+C to exit"));
      console.log("\u2500".repeat(process.stdout.columns || 80));
      console.log(chalk9.dim("Preview: (will appear here as you type)"));
      console.log("\u2500".repeat(process.stdout.columns || 80));
      console.log("");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk9.green("Task: ")
      });
      rl.prompt();
      rl.on("line", async (input) => {
        const trimmed = input.trim();
        if (!trimmed) {
          rl.prompt();
          return;
        }
        process.stdout.write("\r\x1B[K");
        console.log(chalk9.dim("Creating task..."));
        try {
          const parsed = parser.parseInput(trimmed);
          const { frontmatter, body } = mapToFrontmatter(parsed);
          const result = await createTaskWithCompat(
            collection,
            mapping,
            frontmatter,
            body
          );
          if (result.warnings && result.warnings.length > 0) {
            for (const warning of result.warnings) {
              showWarning(warning);
            }
          }
          if (result.error) {
            throw new Error(`Failed to create task: ${result.error.message}`);
          } else {
            const fm = normalizeFrontmatter(result.frontmatter, mapping);
            const task = {
              path: result.path,
              frontmatter: fm
            };
            showSuccess("Task created");
            console.log(formatTask(task));
            console.log(chalk9.dim(`  \u2192 ${result.path}`));
          }
        } catch (err) {
          showError(err.message);
        }
        console.log("\n" + "\u2500".repeat(process.stdout.columns || 80));
        console.log(chalk9.dim("Preview: (will appear here as you type)"));
        console.log("\u2500".repeat(process.stdout.columns || 80));
        console.log("");
        lastInput = "";
        lastPreviewText = "";
        lastKeyTime = 0;
        rl.prompt();
      });
      rl.on("close", () => {
        console.log("\nGoodbye!");
        process.exit(0);
      });
      process.stdin.on("keypress", (str, key) => {
        if (key && (key.ctrl || key.meta || key.name === "return" || key.name === "enter")) {
          return;
        }
        const now2 = Date.now();
        const timeSinceLastKey = now2 - lastKeyTime;
        lastKeyTime = now2;
        if (previewTimer) clearTimeout(previewTimer);
        const delay = getAdaptiveDelay(str, key, timeSinceLastKey);
        previewTimer = setTimeout(() => {
          const currentInput = rl.line ? rl.line.trim() : "";
          if (currentInput && currentInput !== lastInput) {
            lastInput = currentInput;
            const preview = formatPreviewInline(parser, currentInput);
            if (preview !== lastPreviewText) {
              lastPreviewText = preview;
              updatePreview(preview);
            }
          } else if (!currentInput && lastPreviewText) {
            updatePreview("(will appear here as you type)");
            lastPreviewText = "";
          }
        }, delay);
      });
      await new Promise(() => {
      });
    }, options.path);
  } catch (err) {
    showError(err.message);
  }
}

// src/commands/config.ts
import chalk10 from "chalk";
function configCommand(options) {
  if (options.set) {
    const eqIndex = options.set.indexOf("=");
    if (eqIndex === -1) {
      showError("Invalid format. Use --set key=value (e.g., --set collectionPath=/path/to/vault)");
      process.exit(1);
    }
    const key = options.set.slice(0, eqIndex);
    const value = options.set.slice(eqIndex + 1);
    if (key !== "collectionPath" && key !== "language") {
      showError(`Unknown config key: ${key}. Valid keys: collectionPath, language`);
      process.exit(1);
    }
    setConfig(key, value || null);
    showSuccess(`Set ${key} = ${value || "(null)"}`);
    return;
  }
  if (options.get) {
    const config2 = getConfig();
    const key = options.get;
    if (!(key in config2)) {
      showError(`Unknown config key: ${key}. Valid keys: collectionPath, language`);
      process.exit(1);
    }
    console.log(config2[key] ?? "(not set)");
    return;
  }
  const config = getConfig();
  console.log(chalk10.dim(`Config file: ${getConfigPath()}
`));
  for (const [key, value] of Object.entries(config)) {
    console.log(`  ${key}: ${value ?? chalk10.dim("(not set)")}`);
  }
}

// src/commands/skip.ts
import { buildSpecRecurringSkipUpdate } from "@tasknotes/model/operations";
async function skipCommand(pathOrTitle, options) {
  await setSkipState(pathOrTitle, { ...options, skip: true });
}
async function unskipCommand(pathOrTitle, options) {
  await setSkipState(pathOrTitle, { ...options, skip: false });
}
async function setSkipState(pathOrTitle, options) {
  try {
    await withCollection(async (collection, mapping) => {
      const taskPath = await resolveTaskPath(collection, pathOrTitle, mapping);
      const read = await collection.read(taskPath);
      if (read.error) {
        throw new Error(`Failed to read task: ${read.error.message}`);
      }
      const fm = normalizeFrontmatter(read.frontmatter, mapping);
      const taskTitle = resolveDisplayTitle(fm, mapping, taskPath) || taskPath;
      if (typeof fm.recurrence !== "string" || fm.recurrence.trim().length === 0) {
        throw new Error("Skip/unskip is only supported for recurring tasks.");
      }
      const targetDate = resolveOperationTargetDate(
        options.date,
        typeof fm.scheduled === "string" ? fm.scheduled : void 0,
        typeof fm.due === "string" ? fm.due : void 0
      );
      const plan = buildSpecRecurringSkipUpdate({
        frontmatter: fm,
        targetDate,
        skip: options.skip,
        path: taskPath
      });
      if (!plan.changed) {
        showSuccess(
          `Recurring instance already ${options.skip ? "skipped" : "unskipped"} on ${targetDate}: ${taskTitle}`
        );
        return;
      }
      const result = await collection.update({
        path: taskPath,
        fields: denormalizeFrontmatter(plan.fields, mapping)
      });
      if (result.error) {
        throw new Error(`Failed to ${options.skip ? "skip" : "unskip"} recurring instance: ${result.error.message}`);
      }
      const verb = options.skip ? "Skipped" : "Unskipped";
      const nextScheduled = typeof plan.metadata?.nextScheduled === "string" ? plan.metadata.nextScheduled : void 0;
      const nextInfo = nextScheduled ? ` \u2192 next ${nextScheduled}` : "";
      showSuccess(`${verb} recurring instance (${targetDate}): ${taskTitle}${nextInfo}`);
    }, options.path);
  } catch (err) {
    showError(err.message);
    process.exitCode = 1;
  }
}

// src/cli.ts
var program = new Command();
var cliVersion = readPackageVersion();
program.name("mtn").description("Standalone CLI for managing markdown tasks via mdbase").version(cliVersion).option("-p, --path <path>", "Path to mdbase collection");
program.command("init [path]").description("Initialize a new mdbase-tasknotes collection").option("-f, --force", "Overwrite existing files").action(initCommand);
program.command("create <text...>").description("Create a task from natural language text").action((text, opts) => {
  const parentOpts = program.opts();
  return createCommand(text, { path: parentOpts.path });
});
program.command("list").alias("ls").description("List tasks with optional filters").option("-s, --status <status>", "Filter by status").option("--priority <priority>", "Filter by priority").option("-t, --tag <tag>", "Filter by tag").option("-d, --due <date>", "Filter by due date").option("--overdue", "Show overdue tasks").option("-w, --where <expr>", "Raw mdbase where expression").option("--on <date>", "Evaluate recurring instance state on date (YYYY-MM-DD)").option("-l, --limit <n>", "Maximum results").option("--json", "Output as JSON").action((opts) => {
  const parentOpts = program.opts();
  return listCommand({ ...opts, path: parentOpts.path });
});
program.command("show <pathOrTitle>").description("Show full task detail").option("--on <date>", "Show recurring instance state on date (YYYY-MM-DD)").action((pathOrTitle, opts) => {
  const parentOpts = program.opts();
  return showCommand(pathOrTitle, { ...opts, path: parentOpts.path });
});
program.command("complete <pathOrTitle>").alias("done").description("Mark a task as completed").option("-d, --date <date>", "Recurring instance date in YYYY-MM-DD (default: today)").action((pathOrTitle, opts) => {
  const parentOpts = program.opts();
  return completeCommand(pathOrTitle, { ...opts, path: parentOpts.path });
});
program.command("update <pathOrTitle>").description("Update task fields").option("-s, --status <status>", "Set status").option("--priority <priority>", "Set priority").option("-d, --due <date>", "Set due date").option("--scheduled <date>", "Set scheduled date").option("-t, --title <title>", "Set title").option("--add-tag <tag>", "Add a tag", collect, []).option("--remove-tag <tag>", "Remove a tag", collect, []).option("--add-context <ctx>", "Add a context", collect, []).option("--remove-context <ctx>", "Remove a context", collect, []).option("--set <field=value>", "Set an existing schema field", collect, []).option("--set-new <field=value>", "Set a field, creating it when absent", collect, []).option("--set-new-list <field=value>", "Set a list field, creating it when absent; repeat for more values", collect, []).action((pathOrTitle, opts) => {
  const parentOpts = program.opts();
  return updateCommand(pathOrTitle, {
    ...opts,
    path: parentOpts.path,
    addTag: opts.addTag?.length ? opts.addTag : void 0,
    removeTag: opts.removeTag?.length ? opts.removeTag : void 0,
    addContext: opts.addContext?.length ? opts.addContext : void 0,
    removeContext: opts.removeContext?.length ? opts.removeContext : void 0,
    set: opts.set?.length ? opts.set : void 0,
    setNew: opts.setNew?.length ? opts.setNew : void 0,
    setNewList: opts.setNewList?.length ? opts.setNewList : void 0
  });
});
program.command("promote <taskPath>").description("Promote an existing note to a TaskNotes task").requiredOption("--responsavel <wikilink>", "Task owner wikilink").requiredOption("--marca <wikilink>", "Brand wikilink").requiredOption("--projeto <wikilink>", "Project wikilink").action((taskPath, opts) => {
  const parentOpts = program.opts();
  return promoteCommand(taskPath, { ...opts, path: parentOpts.path });
});
program.command("delete <pathOrTitle>").alias("rm").description("Delete a task").option("-f, --force", "Skip backlink check").action((pathOrTitle, opts) => {
  const parentOpts = program.opts();
  return deleteCommand(pathOrTitle, { ...opts, path: parentOpts.path });
});
program.command("archive <pathOrTitle>").description("Archive a task (add archive tag)").action((pathOrTitle) => {
  const parentOpts = program.opts();
  return archiveCommand(pathOrTitle, { path: parentOpts.path });
});
program.command("skip <pathOrTitle>").description("Skip a recurring task instance").option("-d, --date <date>", "Instance date in YYYY-MM-DD (default: today)").action((pathOrTitle, opts) => {
  const parentOpts = program.opts();
  return skipCommand(pathOrTitle, { ...opts, path: parentOpts.path });
});
program.command("unskip <pathOrTitle>").description("Unskip a recurring task instance").option("-d, --date <date>", "Instance date in YYYY-MM-DD (default: today)").action((pathOrTitle, opts) => {
  const parentOpts = program.opts();
  return unskipCommand(pathOrTitle, { ...opts, path: parentOpts.path });
});
program.command("search <query...>").description("Full-text search across tasks").option("-l, --limit <n>", "Maximum results").action((query, opts) => {
  const parentOpts = program.opts();
  return searchCommand(query, { ...opts, path: parentOpts.path });
});
var timer = program.command("timer").description("Time tracking commands");
timer.command("start <pathOrTitle>").description("Start a timer for a task").option("-d, --description <desc>", "Timer description").action((pathOrTitle, opts) => {
  const parentOpts = program.opts();
  return timerStartCommand(pathOrTitle, { ...opts, path: parentOpts.path });
});
timer.command("stop [pathOrTitle]").description("Stop the running timer").action((pathOrTitle) => {
  const parentOpts = program.opts();
  return timerStopCommand({ path: parentOpts.path, pathOrTitle });
});
timer.command("status").description("Show active timers").action(() => {
  const parentOpts = program.opts();
  return timerStatusCommand({ path: parentOpts.path });
});
timer.command("log").description("Show time entry log").option("--from <date>", "Start date filter").option("--to <date>", "End date filter").option("--period <period>", "Predefined period (today, week)").action((opts) => {
  const parentOpts = program.opts();
  return timerLogCommand({ ...opts, path: parentOpts.path });
});
var projects = program.command("projects").description("Project management commands");
projects.command("list").alias("ls").description("List all projects").option("--stats", "Show completion statistics").action((opts) => {
  const parentOpts = program.opts();
  return projectsListCommand({ ...opts, path: parentOpts.path });
});
projects.command("show <name>").description("Show tasks for a project").action((name) => {
  const parentOpts = program.opts();
  return projectsShowCommand(name, { path: parentOpts.path });
});
projects.action((opts) => {
  const parentOpts = program.opts();
  return projectsListCommand({ ...opts, path: parentOpts.path });
});
program.command("stats").description("Show task statistics").action(() => {
  const parentOpts = program.opts();
  return statsCommand({ path: parentOpts.path });
});
program.command("interactive").alias("i").description("Interactive REPL with live NLP preview").action(() => {
  const parentOpts = program.opts();
  return interactiveCommand({ path: parentOpts.path });
});
program.command("config").description("Manage CLI configuration").option("--set <key=value>", "Set a config value").option("--get <key>", "Get a config value").option("--list", "List all config values").action(configCommand);
function collect(value, previous) {
  return previous.concat([value]);
}
function readPackageVersion() {
  const raw = readFileSync2(new URL("../package.json", import.meta.url), "utf8");
  const pkg2 = JSON.parse(raw);
  if (typeof pkg2.version !== "string" || pkg2.version.trim().length === 0) {
    throw new Error("Package version is missing from package.json");
  }
  return pkg2.version;
}
program.parse();
