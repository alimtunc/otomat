export interface SkillFrontmatter {
  name: string | null;
  description: string | null;
}

function stripQuotes(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value.at(-1);
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

/**
 * Reads the leading YAML frontmatter block of a `SKILL.md`, returning `null`
 * when the file has no `---` delimited block. Only the flat `key: value` pairs
 * needed for a skill's provenance (`name`, `description`) are parsed; the body
 * is never interpreted or executed.
 */
export function parseFrontmatter(content: string): SkillFrontmatter | null {
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return null;
  let end = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index]?.trim() === "---") {
      end = index;
      break;
    }
  }
  if (end === -1) return null;

  const fields: Record<string, string> = {};
  for (let index = 1; index < end; index += 1) {
    const line = lines[index] ?? "";
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    if (key === "") continue;
    fields[key] = stripQuotes(line.slice(separator + 1).trim());
  }
  return { name: fields.name ?? null, description: fields.description ?? null };
}
