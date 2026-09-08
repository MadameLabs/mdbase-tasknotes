// Extensoes que o adaptador de agentes da Madame Labs exige do mtn: parar o
// timer de uma tarefa exata sem tocar nas irmas, e escrever user field somente
// quando ele ja existe no frontmatter. Sao o Gate B do plano de cutover.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

test("promote turns one exact existing note into a TaskNotes task", () => {
  const path = makeTempDir("mtn-agent-promote-");
  assert.equal(runCli(["init", path]).status, 0);
  mkdirSync(join(path, "01-planejamento"));
  const notePath = join(path, "01-planejamento", "Plano.md");
  writeFileSync(notePath, "---\ntype: plano\ntitle: Plano\n---\n");

  const promoted = runCli([
    "promote", "01-planejamento/Plano.md",
    "--responsavel", "[[Arthur_Cardoso]]",
    "--marca", "[[Madame_Labs]]",
    "--projeto", "[[tasknotes-dual-vault-e-adaptador]]",
    "--path", path,
  ]);

  assert.equal(promoted.status, 0, promoted.stdout + promoted.stderr);
  const note = readFileSync(notePath, "utf8");
  assert.match(note, /type: plano/);
  assert.match(note, /tags:\n\s+- task/);
  assert.match(note, /status: to-do/);
  assert.match(note, /Responsavel:\n\s+- ['"]?\[\[Arthur_Cardoso\]\]['"]?/);
  assert.match(note, /Marca:\n\s+- ['"]?\[\[Madame_Labs\]\]['"]?/);
  assert.match(note, /Projeto:\n\s+- ['"]?\[\[tasknotes-dual-vault-e-adaptador\]\]['"]?/);
});

test("a nota promovida e tarefa pela tag, mesmo com type proprio e fora de tasks/", () => {
  // O vault ENGENHARIA usa taskIdentificationMethod = "tag": a nota-tarefa
  // vive em 01-planejamento/ e mantem o `type` do seu genero. Filtrar so por
  // types: ["task"] tornava essas notas invisiveis a todo o CLI -- list nao
  // mostrava, show nao achava, timer nao encontrava o que cronometrar.
  const path = makeTempDir("mtn-tag-identifica-");
  assert.equal(runCli(["init", path]).status, 0);
  mkdirSync(join(path, "01-planejamento"));
  writeFileSync(
    join(path, "01-planejamento", "Plano.md"),
    "---\ntype: plano\ntitle: Plano\nstatus: to-do\ntags:\n  - task\n---\n",
  );

  const listed = runCli(["list", "--path", path]);
  assert.equal(listed.status, 0, listed.stdout + listed.stderr);
  assert.match(stripAnsi(listed.stdout), /Plano/);

  const shown = runCli(["show", "Plano", "--path", path]);
  assert.equal(shown.status, 0, shown.stdout + shown.stderr);
  assert.match(stripAnsi(shown.stdout), /Plano/);
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

// Promocao de nota existente em tarefa: o --set exact so atualiza campo que ja
// esta no frontmatter, entao promover exige criar Responsavel, Marca e Projeto
// do zero. --set-new e a excecao explicita a essa regra, para o guard exact
// continuar sendo o default seguro de todo o resto.
test("update --set-new creates a field absent from the frontmatter", () => {
  const path = collectionWithTasks("mtn-agent-setnew-", ["Campo"]);
  const applied = runCli([
    "update", "tasks/Campo.md",
    "--set-new", "Responsavel=[[Arthur_Cardoso]]",
    "--path", path,
  ]);
  assert.equal(applied.status, 0);
  assert.match(taskFile(path, "Campo"), /Responsavel:/);
  assert.match(taskFile(path, "Campo"), /Arthur_Cardoso/);
});

test("update --set-new overwrites a field that already exists", () => {
  // Promover duas vezes nao pode falhar na segunda: o adaptador repete a
  // operacao inteira quando uma promocao anterior parou no meio.
  const path = collectionWithTasks("mtn-agent-setnew-idem-", ["Campo"]);
  const args = ["update", "tasks/Campo.md", "--set-new", "Marca=[[Madame_Labs]]", "--path", path];
  assert.equal(runCli(args).status, 0);
  assert.equal(runCli(args).status, 0);
  const body = taskFile(path, "Campo");
  assert.equal(body.split("Marca:").length - 1, 1);
});

test("update --set-new refuses an assignment without a field name", () => {
  const path = collectionWithTasks("mtn-agent-setnew-bad-", ["Campo"]);
  const before = taskFile(path, "Campo");

  const refused = runCli(["update", "tasks/Campo.md", "--set-new", "=solto", "--path", path]);
  assert.equal(refused.status, 1);
  assert.match(stripAnsi(refused.stdout + refused.stderr), /invalid_set_assignment/);
  assert.equal(taskFile(path, "Campo"), before);
});

test("update --set-new does not loosen the exact guard of --set", () => {
  const path = collectionWithTasks("mtn-agent-setnew-guard-", ["Campo"]);
  const refused = runCli(["update", "tasks/Campo.md", "--set", "Ausente=x", "--path", path]);
  assert.equal(refused.status, 1);
  assert.match(stripAnsi(refused.stdout + refused.stderr), /unknown_field:Ausente/);
});

// Promover e dar a tag `task` a uma nota que ja existe, sem tocar no `type`
// dela -- a mesma regra que o TaskNotes usa. Isso exige que `type` fique fora
// de explicit_type_keys: enquanto ele estiver la, uma nota com `type: plano`
// nunca chega a avaliar o match por tag e a promocao passa despercebida.
test("promoting a plain note by tag keeps its body and type, and becomes listable", () => {
  const path = collectionWithTasks("mtn-agent-promote-", ["Semente"]);
  const configPath = join(path, "mdbase.yaml");
  writeFileSync(
    configPath,
    readFileSync(configPath, "utf8").replace(/  explicit_type_keys:\r?\n    - type\r?\n/, "  explicit_type_keys:\n"),
  );

  const notePath = join(path, "nota-comum.md");
  writeFileSync(notePath, "---\ntype: plano\ntags:\n  - engenharia\n---\nCorpo preservado.\n\n- [ ] passo um\n");

  const promoted = runCli([
    "update", "nota-comum.md",
    "--add-tag", "task",
    "--status", "open",
    "--set-new-list", "Responsavel=[[Arthur_Cardoso]]",
    "--set-new-list", "Marca=[[Madame_Labs]]",
    "--set-new-list", "projects=[[projeto-x]]",
    "--path", path,
  ]);
  assert.equal(promoted.status, 0);

  const body = readFileSync(notePath, "utf8");
  assert.match(body, /Corpo preservado\./);
  assert.match(body, /- \[ \] passo um/);
  assert.match(body, /type: plano/);
  assert.doesNotMatch(body, /^types:/m);
  assert.match(body, /Arthur_Cardoso/);

  // Listavel pela tag: gravar os campos como string derrubava a leitura da
  // colecao inteira com `projects.filter is not a function`.
  const listed = stripAnsi(runCli(["list", "--path", path]).stdout);
  assert.match(listed, /nota-comum|plano/);
});

// Responsavel, Marca e Projeto sao listas no vault: gravar string quebra o
// contrato (`projects.filter is not a function`) e derruba a leitura da nota.
// O CLI ja resolve campo de lista com flag que monta lista, como --add-tag.
test("update --set-new-list writes a single value as a list", () => {
  const path = collectionWithTasks("mtn-agent-setlist-", ["Campo"]);
  const applied = runCli([
    "update", "tasks/Campo.md",
    "--set-new-list", "Responsavel=[[Arthur_Cardoso]]",
    "--path", path,
  ]);
  assert.equal(applied.status, 0);
  assert.match(taskFile(path, "Campo"), /Responsavel:\r?\n\s+- '?\[\[Arthur_Cardoso\]\]'?/);
});

test("update --set-new-list accumulates repeated assignments of the same field", () => {
  const path = collectionWithTasks("mtn-agent-setlist-multi-", ["Campo"]);
  const applied = runCli([
    "update", "tasks/Campo.md",
    "--set-new-list", "Projeto=[[um]]",
    "--set-new-list", "Projeto=[[dois]]",
    "--path", path,
  ]);
  assert.equal(applied.status, 0);
  const body = taskFile(path, "Campo");
  assert.match(body, /\[\[um\]\]/);
  assert.match(body, /\[\[dois\]\]/);
});

test("update --set-new-list replaces the previous list instead of appending", () => {
  const path = collectionWithTasks("mtn-agent-setlist-idem-", ["Campo"]);
  const args = ["update", "tasks/Campo.md", "--set-new-list", "Marca=[[Madame_Labs]]", "--path", path];
  assert.equal(runCli(args).status, 0);
  assert.equal(runCli(args).status, 0);
  assert.equal(taskFile(path, "Campo").split("Madame_Labs").length - 1, 1);
});

test("update --set-new-list refuses an assignment without a field name", () => {
  const path = collectionWithTasks("mtn-agent-setlist-bad-", ["Campo"]);
  const before = taskFile(path, "Campo");
  const refused = runCli(["update", "tasks/Campo.md", "--set-new-list", "=solto", "--path", path]);
  assert.equal(refused.status, 1);
  assert.match(stripAnsi(refused.stdout + refused.stderr), /invalid_set_assignment/);
  assert.equal(taskFile(path, "Campo"), before);
});
