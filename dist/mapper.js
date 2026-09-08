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
function extractProjectNames(projects) {
  if (!projects) return [];
  return projects.filter(Boolean).map((p) => {
    const match = p.match(/\[\[(?:.*\/)?([^\]]+)\]\]/);
    return match ? match[1] : p;
  });
}
export {
  extractProjectNames,
  mapToFrontmatter
};
