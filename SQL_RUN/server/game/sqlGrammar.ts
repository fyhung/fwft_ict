import type { SqlToken, TokenKind } from "../../src/protocol";

export type SqlGrammarState =
  | "start"
  | "after_select"
  | "after_field"
  | "after_from"
  | "after_table"
  | "after_where"
  | "after_where_field"
  | "after_operator"
  | "complete";

const transitionKinds: Record<Exclude<SqlGrammarState, "complete">, TokenKind> = {
  start: "keyword",
  after_select: "field",
  after_field: "keyword",
  after_from: "table",
  after_table: "keyword",
  after_where: "field",
  after_where_field: "operator",
  after_operator: "value",
};

export function nextGrammarState(state: SqlGrammarState, token: SqlToken): SqlGrammarState | null {
  if (state === "complete" || transitionKinds[state] !== token.kind) return null;
  switch (state) {
    case "start": return token.value === "SELECT" ? "after_select" : null;
    case "after_select": return "after_field";
    case "after_field": return token.value === "FROM" ? "after_from" : null;
    case "after_from": return "after_table";
    case "after_table": return token.value === "WHERE" ? "after_where" : null;
    case "after_where": return "after_where_field";
    case "after_where_field": return ["=", "!=", ">", "<", ">=", "<="].includes(token.value) ? "after_operator" : null;
    case "after_operator": return "complete";
  }
}

export function validateMissionTokens(tokens: SqlToken[]): boolean {
  if (tokens.length < 4 || tokens[0]?.kind !== "keyword" || tokens[0].value !== "SELECT") return false;
  const fromIndex = tokens.findIndex((token) => token.kind === "keyword" && token.value === "FROM");
  if (fromIndex < 2 || tokens[fromIndex + 1]?.kind !== "table") return false;
  return tokens.every((token) => typeof token.value === "string" && token.value.length > 0);
}
