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
export {
  getConfig,
  getConfigPath,
  resolveCollectionPath,
  resolveUserPath,
  setConfig
};
