import type { QuestionLevel, SqlToken, TokenKind } from "../../src/protocol";

type FieldDefinition = [name: string, type: string, length: string, description: string, key: string];

export const databaseDictionary: Record<string, FieldDefinition[]> = {
  ELE: [["EID", "VARCHAR", "4", "科目代碼", "PK"], ["ENAME", "VARCHAR", "20", "科目完整名稱", ""], ["Teacher", "VARCHAR", "30", "負責老師", ""], ["MaxQuota", "INTEGER", "-", "收生名額上限", ""]],
  STD: [["SID", "VARCHAR", "8", "學生註冊編號", "PK"], ["SName", "VARCHAR", "30", "學生姓名", ""], ["CLS", "VARCHAR", "2", "學生班別", ""], ["CNO", "INTEGER", "-", "班內學號", ""]],
  ENROLL: [["SID", "VARCHAR", "8", "參照 STD.SID", "PK, FK"], ["EID", "VARCHAR", "4", "參照 ELE.EID", "PK, FK"], ["AYEAR", "VARCHAR", "9", "選修學年", ""], ["Pref", "INTEGER", "-", "志願優先次序", ""]],
};

export interface Mission {
  id: string;
  prompt: string;
  tables: string[];
  level: QuestionLevel;
  tokens: SqlToken[];
}

type MissionDefinition = [prompt: string, tables: string | string[], level: QuestionLevel, values: string[]];

const definitions: MissionDefinition[] = [
  ["顯示所有科目資料。", "ELE", "basic", ["SELECT", "*", "FROM", "ELE"]],
  ["顯示所有科目的完整名稱。", "ELE", "basic", ["SELECT", "ENAME", "FROM", "ELE"]],
  ["顯示所有科目的負責老師。", "ELE", "basic", ["SELECT", "Teacher", "FROM", "ELE"]],
  ["找出收生名額上限至少為 30 的科目完整名稱。", "ELE", "medium", ["SELECT", "ENAME", "FROM", "ELE", "WHERE", "MaxQuota", ">=", "30"]],
  ["找出由 'Chan Tai Man' 負責的科目代碼。", "ELE", "medium", ["SELECT", "EID", "FROM", "ELE", "WHERE", "Teacher", "=", "'Chan Tai Man'"]],
  ["顯示收生名額上限少於 25 的所有科目資料。", "ELE", "medium", ["SELECT", "*", "FROM", "ELE", "WHERE", "MaxQuota", "<", "25"]],
  ["顯示所有學生資料。", "STD", "basic", ["SELECT", "*", "FROM", "STD"]],
  ["顯示所有學生的姓名。", "STD", "basic", ["SELECT", "SName", "FROM", "STD"]],
  ["找出 1A 班所有學生的姓名。", "STD", "medium", ["SELECT", "SName", "FROM", "STD", "WHERE", "CLS", "=", "'1A'"]],
  ["找出班內學號大於 20 的學生註冊編號。", "STD", "medium", ["SELECT", "SID", "FROM", "STD", "WHERE", "CNO", ">", "20"]],
  ["找出學生註冊編號為 '20240001' 的學生姓名。", "STD", "medium", ["SELECT", "SName", "FROM", "STD", "WHERE", "SID", "=", "'20240001'"]],
  ["顯示 2B 班所有學生資料。", "STD", "medium", ["SELECT", "*", "FROM", "STD", "WHERE", "CLS", "=", "'2B'"]],
  ["顯示所有選修記錄。", "ENROLL", "basic", ["SELECT", "*", "FROM", "ENROLL"]],
  ["顯示所有選修記錄中的學生註冊編號。", "ENROLL", "basic", ["SELECT", "SID", "FROM", "ENROLL"]],
  ["找出 2025-2026 學年的所有科目代碼。", "ENROLL", "medium", ["SELECT", "EID", "FROM", "ENROLL", "WHERE", "AYEAR", "=", "'2025-2026'"]],
  ["找出列為第一志願的學生註冊編號。", "ENROLL", "medium", ["SELECT", "SID", "FROM", "ENROLL", "WHERE", "Pref", "=", "1"]],
  ["顯示科目代碼為 'ICT1' 的所有選修記錄。", "ENROLL", "medium", ["SELECT", "*", "FROM", "ENROLL", "WHERE", "EID", "=", "'ICT1'"]],
  ["找出志願優先次序不高於 2 的科目代碼。", "ENROLL", "medium", ["SELECT", "EID", "FROM", "ENROLL", "WHERE", "Pref", "<=", "2"]],
  ["找出學生註冊編號為 '20240008' 的選修學年。", "ENROLL", "medium", ["SELECT", "AYEAR", "FROM", "ENROLL", "WHERE", "SID", "=", "'20240008'"]],
  ["顯示志願優先次序大於 3 的所有選修記錄。", "ENROLL", "medium", ["SELECT", "*", "FROM", "ENROLL", "WHERE", "Pref", ">", "3"]],
  ["顯示所有不同的學生班別。", "STD", "medium", ["SELECT", "DISTINCT", "CLS", "FROM", "STD"]],
  ["按班內學號由小至大顯示學生姓名。", "STD", "medium", ["SELECT", "SName", "FROM", "STD", "ORDER BY", "CNO", "ASC"]],
  ["按收生名額上限由大至小顯示科目完整名稱。", "ELE", "medium", ["SELECT", "ENAME", "FROM", "ELE", "ORDER BY", "MaxQuota", "DESC"]],
  ["計算學生總人數。", "STD", "medium", ["SELECT", "COUNT(*)", "FROM", "STD"]],
  ["計算所有科目的平均收生名額上限。", "ELE", "medium", ["SELECT", "AVG(MaxQuota)", "FROM", "ELE"]],
  ["找出最大的班內學號。", "STD", "medium", ["SELECT", "MAX(CNO)", "FROM", "STD"]],
  ["計算所有科目的收生名額上限總和。", "ELE", "medium", ["SELECT", "SUM(MaxQuota)", "FROM", "ELE"]],
  ["找出最小的志願優先次序。", "ENROLL", "medium", ["SELECT", "MIN(Pref)", "FROM", "ENROLL"]],
  ["按學生班別分組，計算每班學生人數。", "STD", "hard", ["SELECT", "CLS, COUNT(*)", "FROM", "STD", "GROUP BY", "CLS"]],
  ["按科目代碼分組，計算每科選修記錄數目。", "ENROLL", "hard", ["SELECT", "EID, COUNT(*)", "FROM", "ENROLL", "GROUP BY", "EID"]],
  ["找出選修記錄超過 5 筆的科目代碼及記錄數目。", "ENROLL", "hard", ["SELECT", "EID, COUNT(*)", "FROM", "ENROLL", "GROUP BY", "EID", "HAVING", "COUNT(*)", ">", "5"]],
  ["找出平均志願優先次序不高於 2 的科目代碼及平均值。", "ENROLL", "hard", ["SELECT", "EID, AVG(Pref)", "FROM", "ENROLL", "GROUP BY", "EID", "HAVING", "AVG(Pref)", "<=", "2"]],
  ["連接學生與選修記錄，顯示學生姓名及所選科目代碼。", ["STD", "ENROLL"], "hard", ["SELECT", "STD.SName, ENROLL.EID", "FROM", "STD", "INNER JOIN", "ENROLL", "ON", "STD.SID", "=", "ENROLL.SID"]],
  ["連接科目與選修記錄，顯示科目完整名稱及學生註冊編號。", ["ELE", "ENROLL"], "hard", ["SELECT", "ELE.ENAME, ENROLL.SID", "FROM", "ELE", "INNER JOIN", "ENROLL", "ON", "ELE.EID", "=", "ENROLL.EID"]],
  ["連接三個資料表，顯示學生姓名及所選科目的完整名稱。", ["STD", "ENROLL", "ELE"], "hard", ["SELECT", "STD.SName, ELE.ENAME", "FROM", "STD", "INNER JOIN", "ENROLL", "ON", "STD.SID", "=", "ENROLL.SID", "INNER JOIN", "ELE", "ON", "ENROLL.EID", "=", "ELE.EID"]],
  ["連接學生與選修記錄，顯示 2025-2026 學年的學生姓名及科目代碼。", ["STD", "ENROLL"], "hard", ["SELECT", "STD.SName, ENROLL.EID", "FROM", "STD", "INNER JOIN", "ENROLL", "ON", "STD.SID", "=", "ENROLL.SID", "WHERE", "ENROLL.AYEAR", "=", "'2025-2026'"]],
  ["連接科目與選修記錄，找出選修人數至少為 10 的科目名稱及人數。", ["ELE", "ENROLL"], "hard", ["SELECT", "ELE.ENAME, COUNT(*)", "FROM", "ELE", "INNER JOIN", "ENROLL", "ON", "ELE.EID", "=", "ENROLL.EID", "GROUP BY", "ELE.ENAME", "HAVING", "COUNT(*)", ">=", "10"]],
  ["按選修學年分組計算記錄數目，並按學年排序。", "ENROLL", "hard", ["SELECT", "AYEAR, COUNT(*)", "FROM", "ENROLL", "GROUP BY", "AYEAR", "ORDER BY", "AYEAR", "ASC"]],
  ["連接學生與選修記錄，按志願優先次序顯示學生姓名。", ["STD", "ENROLL"], "hard", ["SELECT", "STD.SName, ENROLL.Pref", "FROM", "STD", "INNER JOIN", "ENROLL", "ON", "STD.SID", "=", "ENROLL.SID", "ORDER BY", "ENROLL.Pref", "ASC"]],
  ["找出學生人數至少為 20 的班別及學生人數。", "STD", "hard", ["SELECT", "CLS, COUNT(*)", "FROM", "STD", "GROUP BY", "CLS", "HAVING", "COUNT(*)", ">=", "20"]],
];

const keywords = new Set(["SELECT", "DISTINCT", "FROM", "WHERE", "INNER JOIN", "ON", "GROUP BY", "HAVING", "ORDER BY", "ASC", "DESC"]);
const operators = new Set(["=", "!=", ">", "<", ">=", "<=", "LIKE"]);

function token(value: string): SqlToken {
  let kind: TokenKind = "field";
  if (keywords.has(value)) kind = "keyword";
  else if (Object.hasOwn(databaseDictionary, value)) kind = "table";
  else if (operators.has(value)) kind = "operator";
  else if (/^'.*'$|^\d+$/.test(value)) kind = "value";
  else if (value !== "*" && /[(),]/.test(value)) kind = "expression";
  return { kind, value };
}

export const missions: Mission[] = definitions.map(([prompt, tables, level, values], index) => ({
  id: `sql-${String(index + 1).padStart(2, "0")}`,
  prompt,
  tables: Array.isArray(tables) ? tables : [tables],
  level,
  tokens: values.map(token),
}));

export function missionView(mission: Mission) {
  return {
    id: mission.id,
    prompt: mission.prompt,
    level: mission.level,
    schema: {
      tables: mission.tables.map((name) => ({
        name,
        fields: (databaseDictionary[name] ?? []).map((field) => ({ name: field[0], description: field[3] })),
      })),
    },
    totalSteps: mission.tokens.length,
  };
}
