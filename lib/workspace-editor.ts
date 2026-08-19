export type WorkspaceLanguage = "typescript" | "javascript" | "json" | "markdown" | "css" | "html" | "shell" | "text";
export type SyntaxToken = { value: string; kind: "plain" | "comment" | "keyword" | "string" | "number" | "property" | "tag" };
export type DiffLine = { kind: "same" | "added" | "removed"; content: string; oldNumber?: number; newNumber?: number };

const extensionLanguage: Record<string, WorkspaceLanguage> = {
  ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript",
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  json: "json", md: "markdown", mdx: "markdown", css: "css", html: "html", htm: "html", sh: "shell", bash: "shell", zsh: "shell",
};

export function languageFromPath(path: string): WorkspaceLanguage {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  return extensionLanguage[extension] ?? "text";
}

export function languageLabel(language: WorkspaceLanguage) {
  return language === "typescript" ? "TypeScript" : language === "javascript" ? "JavaScript" : language === "json" ? "JSON" : language === "markdown" ? "Markdown" : language === "css" ? "CSS" : language === "html" ? "HTML" : language === "shell" ? "Shell" : "نص";
}

export function tokenizeCodeLine(line: string, language: WorkspaceLanguage): SyntaxToken[] {
  const matcher = language === "json"
    ? /("(?:\\.|[^"\\])*")(?=\s*:)|("(?:\\.|[^"\\])*")|(\btrue\b|\bfalse\b|\bnull\b)|(\b\d+(?:\.\d+)?\b)/g
    : language === "markdown"
      ? /(^#{1,6}\s.*$)|(`[^`]*`)|(\*\*[^*]+\*\*)/g
      : language === "html"
        ? /(<\/?[a-zA-Z][^>]*>)|(<!--.*?-->)|("(?:\\.|[^"\\])*")/g
        : language === "css"
          ? /(\/\*.*?\*\/)|("(?:\\.|[^"\\])*")|([.#]?[a-zA-Z_-][\w-]*(?=\s*:))|(\b\d+(?:\.\d+)?(?:px|rem|em|%)?\b)/g
          : language === "shell"
            ? /(#.*$)|("(?:\\.|[^"\\])*")|('\w[^']*')|(\b(?:if|then|fi|for|in|do|done|case|esac|function)\b)|(\$[\w{][\w}:-]*)/g
            : /(\/\/.*$|\/\*.*?\*\/)|("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*')|(\b(?:const|let|var|function|return|export|import|from|if|else|for|while|async|await|type|interface|class|new|throw|try|catch|true|false|null|undefined)\b)|(\b\d+(?:\.\d+)?\b)/g;
  const tokens: SyntaxToken[] = [];
  let cursor = 0;
  for (const match of line.matchAll(matcher)) {
    const index = match.index ?? 0;
    if (index > cursor) tokens.push({ value: line.slice(cursor, index), kind: "plain" });
    const value = match[0];
    const kind: SyntaxToken["kind"] = language === "json" && match[1] ? "property"
      : language === "html" && match[1] ? "tag"
      : match[1]?.startsWith("//") || match[1]?.startsWith("/*") || match[1]?.startsWith("#") || match[2]?.startsWith("<!--") ? "comment"
      : value.startsWith("\"") || value.startsWith("'") || value.startsWith("`") ? "string"
      : /^(true|false|null|undefined|const|let|var|function|return|export|import|from|if|else|for|while|async|await|type|interface|class|new|throw|try|catch|do|done|then|fi|case|esac)$/.test(value) ? "keyword"
      : /^\d/.test(value) ? "number"
      : "plain";
    tokens.push({ value, kind });
    cursor = index + value.length;
  }
  if (cursor < line.length || tokens.length === 0) tokens.push({ value: line.slice(cursor), kind: "plain" });
  return tokens;
}

export function buildLineDiff(previous: string, next: string): DiffLine[] {
  const oldLines = previous.split("\n");
  const newLines = next.split("\n");
  if (oldLines.length * newLines.length > 40_000) return [...oldLines.map((content, index) => ({ kind: "removed" as const, content, oldNumber: index + 1 })), ...newLines.map((content, index) => ({ kind: "added" as const, content, newNumber: index + 1 }))];
  const matrix = Array.from({ length: oldLines.length + 1 }, () => Array<number>(newLines.length + 1).fill(0));
  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex--) for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex--) matrix[oldIndex][newIndex] = oldLines[oldIndex] === newLines[newIndex] ? matrix[oldIndex + 1][newIndex + 1] + 1 : Math.max(matrix[oldIndex + 1][newIndex], matrix[oldIndex][newIndex + 1]);
  const result: DiffLine[] = [];
  let oldIndex = 0; let newIndex = 0;
  while (oldIndex < oldLines.length && newIndex < newLines.length) {
    if (oldLines[oldIndex] === newLines[newIndex]) { result.push({ kind: "same", content: oldLines[oldIndex], oldNumber: oldIndex + 1, newNumber: newIndex + 1 }); oldIndex++; newIndex++; }
    else if (matrix[oldIndex + 1][newIndex] >= matrix[oldIndex][newIndex + 1]) { result.push({ kind: "removed", content: oldLines[oldIndex], oldNumber: oldIndex + 1 }); oldIndex++; }
    else { result.push({ kind: "added", content: newLines[newIndex], newNumber: newIndex + 1 }); newIndex++; }
  }
  while (oldIndex < oldLines.length) { result.push({ kind: "removed", content: oldLines[oldIndex], oldNumber: oldIndex + 1 }); oldIndex++; }
  while (newIndex < newLines.length) { result.push({ kind: "added", content: newLines[newIndex], newNumber: newIndex + 1 }); newIndex++; }
  return result;
}

export function summarizeDiff(lines: DiffLine[]) {
  return lines.reduce((summary, line) => ({ ...summary, added: summary.added + Number(line.kind === "added"), removed: summary.removed + Number(line.kind === "removed"), changed: summary.changed || line.kind !== "same" }), { added: 0, removed: 0, changed: false });
}
