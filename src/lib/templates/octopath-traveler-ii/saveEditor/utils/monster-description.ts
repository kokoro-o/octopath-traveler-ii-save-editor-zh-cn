interface MonsterDescriptionSource {
  skillName: string;
  skillDesc: string;
}

const escapePattern = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Presentation only: retain source text and keep each skill's summary attached. */
export function describeMonsterSkills(source: MonsterDescriptionSource): {
  skills: { name: string; description: string }[];
  notes: string;
} {
  const names = [...new Set(source.skillName.split(" / "))];
  let remaining = source.skillDesc.replace(/\r\n/g, "\n");
  const details = new Map(names.map(name => [name, [] as string[]]));
  // Match whole names at line boundaries, not arbitrary substrings in effects.
  // Longer names first prevents a short name consuming another skill's prefix.
  for (const name of [...names].sort((a, b) => b.length - a.length)) {
    const pattern = escapePattern(name);
    remaining = remaining.replace(new RegExp(`(^|\\n)${pattern}[：:]([^\\n]*)`, "g"), (_match, boundary: string, summary: string) => {
      if (summary.trim()) details.get(name)!.push(summary.trim());
      return boundary;
    });
    remaining = remaining.replace(new RegExp(`(^|\\n)${pattern}(?=\\n|$)`, "g"), "$1");
    // Preserve official qualifiers such as （杖/火）, without repeating the name.
    remaining = remaining.replace(new RegExp(`(^|\\n)${pattern}([（(][^\\n]*[）)])(?=\\n|$)`, "g"), (_match, boundary: string, qualifier: string) => {
      details.get(name)!.push(qualifier);
      return boundary;
    });
  }
  return {
    skills: names.map(name => ({ name, description: [...new Set(details.get(name)!)].join("\n") })),
    notes: remaining.split("\n").filter(line => line.trim()).join("\n"),
  };
}
