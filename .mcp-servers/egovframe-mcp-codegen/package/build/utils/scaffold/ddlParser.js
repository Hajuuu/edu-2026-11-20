/**
 * DDL Parser — public entry point
 *
 * scaffold 가 사용하는 표준 IR (`ParsedDDL`) 을 돌려준다.
 * 내부적으로 다음 순서로 파싱을 시도한다.
 *
 *   1. AST 파서 (`ddlParserAst.ts`, MySQL dialect, `node-sql-parser`)
 *      - 정확성과 확장성 우선. `COMMENT 'x, y'` 같은 컬럼 안의 콤마 등
 *        정규식 파서가 다루기 어려운 케이스를 정확히 처리한다.
 *   2. Legacy 정규식 파서 (`ddlParserLegacy.ts`)
 *      - AST 가 dialect 한계로 실패한 입력 (`CREATE MEMORY TABLE` HSQLDB,
 *        `VARCHAR2` / `NUMBER` Oracle, `JSONB` PostgreSQL 등) 에 대해
 *        기존 동작을 보장하는 안전벨트.
 *
 * 두 경로 모두 같은 `ParsedDDL` 모양을 돌려주므로 호출부는 변경이 없다.
 *
 * 향후 Phase 3 의 dialect 어댑터(`DialectAdapter`) 도입 시 이 라우터를
 * MySQL/PostgreSQL/Oracle 등 dialect 라우팅 로직으로 확장한다.
 */
import { parseDDLWithAst } from "./ddlParserAst.js";
import { parseDDLLegacy } from "./ddlParserLegacy.js";
import { NON_MYSQL_TYPE_HINTS } from "./dialectTypes.js";
import { nonRetryable } from "./toolMessages.js";
/**
 * AST 의 default_val 노드 또는 정규식 매칭 결과를 SQL 표현 문자열로 렌더링한다.
 * 두 파서가 같은 형식으로 결과를 만들도록 공용 유틸로 둔다.
 */
export function renderDefaultValue(astValue) {
    if (astValue == null || typeof astValue !== "object")
        return null;
    // AST 의 default_val 구조: { type: "default", value: <expr> }
    const wrapper = astValue;
    const expr = wrapper.value ?? astValue; // 정규식 경로에서는 wrapper 없이 바로 expr 가 올 수 있음
    if (expr == null)
        return null;
    if (typeof expr === "string")
        return expr; // 이미 정규식으로 추출된 문자열
    const e = expr;
    switch (e.type) {
        case "single_quote_string":
            return `'${String(e.value ?? "")}'`;
        case "double_quote_string":
            return `"${String(e.value ?? "")}"`;
        case "string":
            return `'${String(e.value ?? "")}'`;
        case "number":
            return String(e.value ?? "");
        case "bool":
        case "boolean":
            return e.value ? "TRUE" : "FALSE";
        case "null":
            return "NULL";
        case "function": {
            // CURRENT_TIMESTAMP 같은 nullary 함수는 이름만 출력
            const name = e.name?.name?.[0]?.value ?? "";
            return name.toUpperCase();
        }
        default:
            return null;
    }
}
/**
 * 본문성 long-text 컬럼 판정 임계값. VARCHAR(maxLength) 가 이 값 이상이면 textarea 로 렌더링.
 * 정의상 긴 TEXT/CLOB 계열은 별도 집합으로 처리되므로 이 임계값과 무관하다.
 */
export const LONG_TEXT_LENGTH_THRESHOLD = 500;
/**
 * "정의상 긴" 텍스트 타입들의 집합 — VARCHAR 와 달리 길이를 보지 않고 무조건 textarea.
 */
export const LONG_TEXT_TYPES = new Set([
    "TEXT",
    "MEDIUMTEXT",
    "LONGTEXT",
    "TINYTEXT",
    "CLOB",
    "NCLOB",
    "NTEXT",
]);
/**
 * Column.isLongText 를 계산. 두 파서(AST/Legacy) 가 같은 규칙을 쓰도록 공용 헬퍼로 둔다.
 */
export function computeIsLongText(rawType, maxLength) {
    const t = rawType.toUpperCase();
    if (LONG_TEXT_TYPES.has(t))
        return true;
    // VARCHAR family with sufficient length
    if (/VARCHAR|NVARCHAR|VARCHAR2/.test(t) && maxLength >= LONG_TEXT_LENGTH_THRESHOLD) {
        return true;
    }
    return false;
}
/**
 * Column.isYnFlag 를 계산. CHAR(1) + `_YN` 접미사 컬럼만 YN 플래그로 인정한다.
 * 두 파서가 같은 규칙을 쓰도록 공용 헬퍼로 둔다.
 */
export function computeIsYnFlag(rawType, maxLength, columnName) {
    const t = rawType.toUpperCase();
    // CHAR / NCHAR 만 인정. maxLength 가 0 (length 정보 없음) 이거나 1 이하면 통과.
    const isCharOne = /^N?CHAR$/.test(t) && (maxLength === 0 || maxLength <= 1);
    if (!isCharOne)
        return false;
    // 컬럼명 끝이 _YN (대소문자 무관)
    return /_YN$/i.test(columnName);
}
/**
 * `node-sql-parser`(pegjs) 구문 에러의 line/column 위치와 그 줄의 원문(앞뒤 공백
 * 트리밍)을 "N행 M열: <원문>" 형태로 만든다. 사용자 자신이 입력한 DDL 을 그대로
 * 돌려주는 것이므로 내부 SQL 노출 금지 규칙에 해당하지 않는다.
 * 위치 정보가 없으면 undefined.
 */
function buildLocationSnippet(ddl, location) {
    if (!location)
        return undefined;
    const lines = ddl.split(/\r\n|\r|\n/);
    const lineText = lines[location.line - 1]?.trim();
    const pos = `${location.line}행 ${location.column}열`;
    return lineText ? `${pos}: ${lineText}` : pos;
}
/**
 * 입력 DDL 에서 잘 알려진 비-MySQL 방언 타입 토큰(`NON_MYSQL_TYPE_HINTS`)을
 * 스캔해, 발견되면 "Oracle 등 타 DBMS 방언으로 보입니다" 힌트 문장을 만든다.
 * 아무 토큰도 없으면 undefined.
 */
function buildForeignDialectHint(ddl) {
    const upper = ddl.toUpperCase();
    const found = Object.keys(NON_MYSQL_TYPE_HINTS).filter((token) => new RegExp(`\\b${token}\\b`).test(upper));
    if (found.length === 0)
        return undefined;
    const conversions = found.map((t) => `${t} → ${NON_MYSQL_TYPE_HINTS[t]}`).join(", ");
    return (`Oracle 등 타 DBMS 방언으로 보입니다 — ${conversions} 변환 또는 ` +
        `normalizeDdl 옵션 활용을 검토하세요.`);
}
/**
 * AST/Legacy 두 경로 모두 실패했을 때의 최종 에러를 만든다. 같은 인자로
 * 재호출해도 항상 같은 이유로 실패하므로 `nonRetryable` 로 감싸 재시도 루프를
 * 차단한다.
 */
function buildParseFailureError(ddl, astError, astErrorLocation, legacyError) {
    const locationSnippet = buildLocationSnippet(ddl, astErrorLocation);
    const astPart = locationSnippet
        ? `AST(MySQL) 경로: ${astError ?? "n/a"} (${locationSnippet})`
        : `AST(MySQL) 경로: ${astError ?? "n/a"}`;
    const messageParts = [`DDL 파싱 실패. ${astPart} / Legacy 경로: ${legacyError}`];
    const dialectHint = buildForeignDialectHint(ddl);
    if (dialectHint)
        messageParts.push(dialectHint);
    return nonRetryable(messageParts.join(" "));
}
export function parseDDL(ddl) {
    const { parsed, source, astError, astErrorLocation } = parseDDLWithDiagnostics(ddl);
    const warnings = [];
    if (source === "legacy") {
        const locationSnippet = buildLocationSnippet(ddl, astErrorLocation);
        const astErrorText = locationSnippet
            ? `${astError ?? "알 수 없음"} (${locationSnippet})`
            : astError ?? "알 수 없음";
        warnings.push(`입력 DDL 이 표준 SQL(MySQL dialect) 로 파싱되지 않아 legacy 정규식 파서로 처리되었습니다. ` +
            `비표준 문법(HSQLDB CREATE MEMORY TABLE, Oracle VARCHAR2/NUMBER, PostgreSQL JSONB 등)이 ` +
            `포함된 것으로 보입니다. (AST 파싱 실패 사유: ${astErrorText})`);
    }
    return { ...parsed, parserUsed: source, warnings };
}
export function parseDDLWithDiagnostics(ddl) {
    let astError;
    let astErrorLocation;
    try {
        const parsed = parseDDLWithAst(ddl);
        // 안전 검사: AST 가 컬럼 0개를 돌려주면 legacy 로 한 번 더 시도한다.
        if (parsed.attributes.length > 0) {
            return { parsed, source: "ast" };
        }
        astError = "AST produced 0 columns";
    }
    catch (e) {
        astError = e instanceof Error ? e.message : String(e);
        astErrorLocation =
            typeof e === "object" && e !== null
                ? e.location
                : undefined;
    }
    try {
        const parsed = parseDDLLegacy(ddl);
        return { parsed, source: "legacy", astError, astErrorLocation };
    }
    catch (legacyErr) {
        // 둘 다 실패하면 사용자에게 두 경로 정보를 모두 노출한다.
        const legacyMsg = legacyErr instanceof Error ? legacyErr.message : String(legacyErr);
        throw buildParseFailureError(ddl, astError, astErrorLocation, legacyMsg);
    }
}
