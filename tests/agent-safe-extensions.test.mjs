// Extensoes que o adaptador de agentes da Madame Labs exige do mtn: parar o
// timer de uma tarefa exata sem tocar nas irmas, e escrever user field somente
// quando ele ja existe no frontmatter. Sao o Gate B do plano de cutover.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runCli, makeTempDir, stripAnsi } from "./helpers.mjs";

function collectionWithTasks(prefix, titles) {
  const collectionPath = makeTempDir(prefix);
  assert.equal(runCli(["init", collectionPath]).status, 0);
  for (const title of titles) {
    assert.equal(runCli(["create", title, "--path", collectionPath]).status, 0);
  }
  return collectionPath;
}

const taskFile = (collectionPath, title) =>
  readFileSync(join(collectionPath, "tasks", `${title}.md`), "utf8");

const runningEntries = (body) =>
  body.split("\n").filter((line) => line.includes("startTime")).length -
  body.split("\n").filter((line) => line.includes("endTime")).length;

test("timer stop with an exact path leaves every sibling timer running", () => {
  const path = collectionWithTasks("mtn-agent-stop-", ["Alvo", "Irma"]);
  assert.equal(runCli(["timer", "start", "tasks/Alvo.md", "--path", path]).status, 0);
  assert.equal(runCli(["timer", "start", "tasks/Irma.md", "--path", path]).status, 0);

  const stopped = runCli(["timer", "stop", "tasks/Alvo.md", "--path", path]);
  assert.equal(stopped.status, 0);
  assert.match(stripAnsi(stopped.stdout), /Alvo/);

  assert.equal(runningEntries(taskFile(path, "Alvo")), 0);
  assert.equal(runningEntries(taskFile(path, "Irma")), 1);

  const status = stripAnsi(runCli(["timer", "status", "--path", path]).stdout);
  assert.match(status, /Irma/);
  assert.doesNotMatch(status, /Alvo/);
});

test("timer stop refuses an exact task that has no running timer", () => {
  const path = collectionWithTasks("mtn-agent-idle-", ["Parada", "Ativa"]);
  assert.equal(runCli(["timer", "start", "tasks/Ativa.md", "--path", path]).status, 0);

  const refused = runCli(["timer", "stop", "tasks/Parada.md", "--path", path]);
  assert.equal(refused.status, 1);
  assert.match(stripAnsi(refused.stdout + refused.stderr), /timer_not_found/);

  // A recusa nao pode virar parada global: a irma segue cronometrando.
  assert.equal(runningEntries(taskFile(path, "Ativa")), 1);
});

test("timer stop refuses an unknown path without stopping anything", () => {
  const path = collectionWithTasks("mtn-agent-ghost-", ["Ativa"]);
  assert.equal(runCli(["timer", "start", "tasks/Ativa.md", "--path", path]).status, 0);

  const refused = runCli(["timer", "stop", "tasks/Fantasma.md", "--path", path]);
  assert.equal(refused.status, 1);
  assert.equal(runningEntries(taskFile(path, "Ativa")), 1);
});

test("update --set writes a field that already exists in the frontmatter", () => {
  const path = collectionWithTasks("mtn-agent-set-", ["Campo"]);
  const applied = runCli(["update", "tasks/Campo.md", "--set", "status=em-andamento", "--path", path]);
  assert.equal(applied.status, 0);
  assert.match(taskFile(path, "Campo"), /status: em-andamento/);
});

test("update --set refuses a field absent from the frontmatter", () => {
  const path = collectionWithTasks("mtn-agent-unknown-", ["Campo"]);
  const before = taskFile(path, "Campo");

  const refused = runCli(["update", "tasks/Campo.md", "--set", "Responsavel=[[Arthur_Cardoso]]", "--path", path]);
  assert.equal(refused.status, 1);
  assert.match(stripAnsi(refused.stdout + refused.stderr), /unknown_field:Responsavel/);
  assert.equal(taskFile(path, "Campo"), before);
});

test("update --set refuses an assignment without a field name", () => {
  const path = collectionWithTasks("mtn-agent-badset-", ["Campo"]);
  const before = taskFile(path, "Campo");

  const refused = runCli(["update", "tasks/Campo.md", "--set", "=solto", "--path", path]);
  assert.equal(refused.status, 1);
  assert.match(stripAnsi(refused.stdout + refused.stderr), /invalid_set_assignment/);
  assert.equal(taskFile(path, "Campo"), before);
});

test("failures exit with 1 instead of aborting the process on Windows", () => {
  // process.exit durante o fechamento da colecao abortava com 0xC0000409 e
  // escondia o codigo real de saida de todo caminho de erro.
  const path = collectionWithTasks("mtn-agent-exit-", ["Campo"]);
  for (const args of [
    ["update", "tasks/Inexistente.md", "--status", "open", "--path", path],
    ["update", "tasks/Campo.md", "--path", path],
    ["timer", "stop", "tasks/Campo.md", "--path", path],
  ]) {
    assert.equal(runCli(args).status, 1, `esperado exit 1 em: ${args.join(" ")}`);
  }
});
