/**
 * Manifest Loader
 *
 * `templates/manifests/*.json` 의 선언적 파일 매니페스트를 로드한다.
 * 각 매니페스트는 `{ template, output }` 항목 배열로 구성되며, output 은
 * Handlebars 변수(`{{basePackagePath}}`, `{{entityName}}` 등)를 포함할 수 있다.
 *
 * 설계 원칙
 * ---------
 * - **stack 매트릭스가 매니페스트를 가리킨다.** `templates/stacks.json` 의
 *   각 stack 항목에 `manifest` 경로를 적고, 라우팅은 매트릭스가 단일 출처가 된다.
 * - **Handlebars 단일 의존**: output 경로 렌더링도 .hbs 본문과 같은 Handlebars 를
 *   재사용한다. 새 의존성 없음.
 * - **순수 함수 + 캐시**: stack 매트릭스와 동일한 패턴으로 매니페스트 파일을
 *   메모리 캐시한다. 테스트는 `clearManifestCache()` 로 초기화.
 * - **외부 경로 오버라이드**: `EGOVFRAME_SCAFFOLD_TEMPLATE_PATH` 가 있으면
 *   그 디렉터리를 기준으로 매니페스트를 해석한다.
 *
 * 새 파일 추가 = 매니페스트 JSON 한 줄 추가, 코드 수정 0줄.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";
/**
 * 운영 DB 마이그레이션 SQL 의 dialect 분기에 사용되는 7개 방언.
 * `expandDialects: true` 인 매니페스트 항목은 이 배열을 순회해 7개의 출력으로 fan-out 된다.
 *
 * 순서/식별자는 `dialectFullType` 헬퍼(`src/utils/scaffold/dialectTypes.ts`) 가 받는 값과 일치해야 한다.
 * `mysql` 은 MySQL/MariaDB 양쪽에 공용 (동일 SQL 문법).
 */
export const SUPPORTED_DIALECTS = [
    "oracle",
    "tibero",
    "altibase",
    "cubrid",
    "goldilocks",
    "mysql",
    "postgres",
];
const cache = new Map();
/**
 * 테스트나 핫리로드 시 캐시를 비운다.
 */
export function clearManifestCache() {
    cache.clear();
}
/**
 * 매니페스트 파일의 절대 경로를 해석한다.
 * 우선순위:
 *   1. `manifestPath` 가 절대경로면 그대로 사용
 *   2. `EGOVFRAME_SCAFFOLD_TEMPLATE_PATH` 가 있으면 그 디렉터리 기준 상대 해석
 *   3. `<repo>/templates` 기준 상대 해석
 */
export function resolveManifestPath(manifestPath) {
    if (path.isAbsolute(manifestPath))
        return manifestPath;
    if (process.env.EGOVFRAME_SCAFFOLD_TEMPLATE_PATH) {
        return path.join(process.env.EGOVFRAME_SCAFFOLD_TEMPLATE_PATH, manifestPath);
    }
    try {
        const here = fileURLToPath(import.meta.url);
        const projectRoot = path.resolve(path.dirname(here), "../../..");
        return path.join(projectRoot, "templates", manifestPath);
    }
    catch {
        return path.join(process.cwd(), "templates", manifestPath);
    }
}
/**
 * 매니페스트 JSON 을 읽고 검증한 뒤 캐시한다.
 */
export function loadManifest(manifestPath) {
    const resolved = resolveManifestPath(manifestPath);
    const cached = cache.get(resolved);
    if (cached)
        return cached;
    let raw;
    try {
        raw = fs.readFileSync(resolved, "utf-8");
    }
    catch (e) {
        throw new Error(`매니페스트를 읽을 수 없습니다 (${resolved}). templates/manifests/*.json 이 누락되었거나 EGOVFRAME_SCAFFOLD_TEMPLATE_PATH 가 잘못 지정되었는지 확인하세요. (${e instanceof Error ? e.message : "Unknown error"})`);
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (e) {
        throw new Error(`매니페스트 파싱 실패 (${resolved}): ${e instanceof Error ? e.message : "Unknown error"}`);
    }
    validateManifest(parsed, resolved);
    cache.set(resolved, parsed);
    return parsed;
}
/**
 * 매니페스트의 각 항목을 컨텍스트로 렌더링해 최종 파일 매핑을 만든다.
 * 컴파일된 Handlebars 템플릿은 항목별로 한 번만 만들고 즉시 버린다 — 매니페스트
 * 항목 수가 100여개로 작아 컴파일 비용이 무시할 수 있다.
 *
 * `scopeFilter` 가 주어지면 해당 scope 의 항목만 반환한다. 누락된 scope 는
 * 'framework' 로 정규화되므로 명시되지 않은 항목은 framework 필터에만 매칭된다.
 */
export function resolveManifest(manifestPath, context, scopeFilter) {
    const manifest = loadManifest(manifestPath);
    const entries = scopeFilter
        ? manifest.files.filter((e) => (e.scope ?? "framework") === scopeFilter)
        : manifest.files;
    const out = [];
    for (const entry of entries) {
        const scope = entry.scope ?? "framework";
        const mode = entry.mode ?? "create";
        const resolveAppendTarget = (ctx) => {
            if (!entry.appendTarget)
                return undefined;
            return {
                glob: renderOutput(entry.appendTarget.glob, ctx, manifest.name),
                matchCount: entry.appendTarget.matchCount ?? 1,
            };
        };
        if (entry.expandDialects) {
            // 방언별 fan-out: dialect 를 컨텍스트에 주입해 output 경로를 7번 렌더링.
            for (const dialect of SUPPORTED_DIALECTS) {
                const ctx = { ...context, dialect };
                out.push({
                    template: entry.template,
                    output: renderOutput(entry.output, ctx, manifest.name),
                    scope,
                    mode,
                    appendTarget: resolveAppendTarget(ctx),
                    dialect,
                });
            }
        }
        else {
            out.push({
                template: entry.template,
                output: renderOutput(entry.output, context, manifest.name),
                scope,
                mode,
                appendTarget: resolveAppendTarget(context),
            });
        }
    }
    return out;
}
function renderOutput(template, context, manifestName) {
    // 출력 경로에는 변수가 없을 수도 있다. 변수 없으면 컴파일조차 건너뛴다.
    if (!template.includes("{{"))
        return template;
    try {
        return Handlebars.compile(template, { noEscape: true })(context);
    }
    catch (e) {
        throw new Error(`매니페스트 '${manifestName}' 의 output '${template}' 렌더링 실패: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
}
function validateManifest(file, source) {
    if (!file || typeof file !== "object") {
        throw new Error(`매니페스트 형식 오류 (${source}): 최상위 객체가 아닙니다.`);
    }
    if (typeof file.name !== "string" || !file.name) {
        throw new Error(`매니페스트 형식 오류 (${source}): 'name' 필드가 필요합니다.`);
    }
    if (!Array.isArray(file.files)) {
        throw new TypeError(`매니페스트 형식 오류 (${source}): 'files' 는 배열이어야 합니다.`);
    }
    for (const [idx, entry] of file.files.entries()) {
        if (!entry ||
            typeof entry.template !== "string" ||
            typeof entry.output !== "string" ||
            !entry.template ||
            !entry.output) {
            throw new Error(`매니페스트 형식 오류 (${source}): files[${idx}] 항목에 template/output 문자열이 모두 필요합니다.`);
        }
        if (entry.scope !== undefined && entry.scope !== "framework" && entry.scope !== "entity") {
            throw new Error(`매니페스트 형식 오류 (${source}): files[${idx}].scope 는 'framework' 또는 'entity' 여야 합니다 (현재: ${JSON.stringify(entry.scope)}).`);
        }
        if (entry.expandDialects !== undefined && typeof entry.expandDialects !== "boolean") {
            throw new TypeError(`매니페스트 형식 오류 (${source}): files[${idx}].expandDialects 는 boolean 이어야 합니다 (현재: ${JSON.stringify(entry.expandDialects)}).`);
        }
        if (entry.mode !== undefined && !["create", "append-idempotent", "append-fallback"].includes(entry.mode)) {
            throw new Error(`매니페스트 형식 오류 (${source}): files[${idx}].mode 는 'create'|'append-idempotent'|'append-fallback' 여야 합니다 (현재: ${JSON.stringify(entry.mode)}).`);
        }
        if (entry.appendTarget !== undefined) {
            if (!entry.appendTarget ||
                typeof entry.appendTarget !== "object" ||
                typeof entry.appendTarget.glob !== "string" ||
                !entry.appendTarget.glob) {
                throw new Error(`매니페스트 형식 오류 (${source}): files[${idx}].appendTarget 은 { glob: string, matchCount?: number } 구조여야 합니다.`);
            }
            if (entry.appendTarget.matchCount !== undefined &&
                (typeof entry.appendTarget.matchCount !== "number" || entry.appendTarget.matchCount < 0)) {
                throw new Error(`매니페스트 형식 오류 (${source}): files[${idx}].appendTarget.matchCount 는 0 이상 정수여야 합니다.`);
            }
        }
        if ((entry.mode === "append-idempotent" || entry.mode === "append-fallback") && !entry.appendTarget) {
            throw new Error(`매니페스트 형식 오류 (${source}): files[${idx}].mode='${entry.mode}' 는 appendTarget 이 필수입니다.`);
        }
    }
}
