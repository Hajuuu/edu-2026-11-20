/**
 * Stack Matrix Loader
 *
 * `templates/stacks.json` 의 호환성 매트릭스를 로드해 (projectType, stackVersion)
 * 조합으로 stack 메타데이터를 돌려준다. 템플릿과 scaffold 코드 양쪽이 같은
 * 데이터를 참조하도록 단일 출처로 만든다.
 *
 * 설계 원칙
 * ---------
 * - **순수 함수 + 캐시**: 매트릭스는 프로세스 수명 동안 1회만 읽고 메모리 캐시한다.
 *   테스트에서 caching 을 끄고 싶으면 `resolveStack` 호출 직전 `clearStackMatrixCache()`.
 * - **외부 경로 오버라이드**: `EGOVFRAME_SCAFFOLD_TEMPLATE_PATH` 또는
 *   `EGOVFRAME_STACK_MATRIX_PATH` 로 매트릭스 위치를 바꿀 수 있다. 조직별
 *   커스텀 스택을 검증할 때 유용하다.
 * - **모순 조합 차단**: `egov_scaffold_project` 의 Zod 스키마가 WAR + 5.0 을 이미
 *   차단하지만, 매트릭스에도 명시적으로 등재되지 않은 조합은 여기서 다시 막는다.
 *
 * 매트릭스 키 형식은 `templates/stacks.json` 의 `$comment` 를 참고할 것.
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
let cachedMatrix;
let cachedPath;
/**
 * 매트릭스 파일 경로를 해석한다.
 * 우선순위:
 *   1. `EGOVFRAME_STACK_MATRIX_PATH` 환경변수
 *   2. `EGOVFRAME_SCAFFOLD_TEMPLATE_PATH/stacks.json`
 *   3. `<repo>/templates/stacks.json`
 */
export function resolveStackMatrixPath() {
    if (process.env.EGOVFRAME_STACK_MATRIX_PATH) {
        return process.env.EGOVFRAME_STACK_MATRIX_PATH;
    }
    if (process.env.EGOVFRAME_SCAFFOLD_TEMPLATE_PATH) {
        return path.join(process.env.EGOVFRAME_SCAFFOLD_TEMPLATE_PATH, "stacks.json");
    }
    try {
        const here = fileURLToPath(import.meta.url);
        const projectRoot = path.resolve(path.dirname(here), "../../..");
        return path.join(projectRoot, "templates", "stacks.json");
    }
    catch {
        return path.join(process.cwd(), "templates", "stacks.json");
    }
}
/**
 * 매트릭스 파일을 1회 읽어 메모리에 캐시한다. 경로가 바뀌었거나
 * `clearStackMatrixCache()` 가 호출된 경우 다시 읽는다.
 */
export function loadStackMatrix(matrixPath) {
    const resolved = matrixPath ?? resolveStackMatrixPath();
    if (cachedMatrix && cachedPath === resolved) {
        return cachedMatrix;
    }
    let raw;
    try {
        raw = fs.readFileSync(resolved, "utf-8");
    }
    catch (e) {
        throw new Error(`Stack matrix 를 읽을 수 없습니다 (${resolved}). 'templates/stacks.json' 이 누락되었거나 EGOVFRAME_STACK_MATRIX_PATH 가 잘못 지정되었는지 확인하세요. (${e instanceof Error ? e.message : "Unknown error"})`);
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (e) {
        throw new Error(`Stack matrix 파싱 실패 (${resolved}): ${e instanceof Error ? e.message : "Unknown error"}`);
    }
    validateMatrix(parsed, resolved);
    cachedMatrix = parsed;
    cachedPath = resolved;
    return parsed;
}
/**
 * 테스트나 핫리로드 시 매트릭스 캐시를 비운다.
 */
export function clearStackMatrixCache() {
    cachedMatrix = undefined;
    cachedPath = undefined;
}
/**
 * (projectType, stackVersion) 으로 stack 메타데이터를 해석한다.
 * 매트릭스에 등재되지 않은 조합이면 명확한 에러를 던진다.
 */
export function resolveStack(projectType, stackVersion, matrixPath) {
    const matrix = loadStackMatrix(matrixPath);
    const sel = matrix.selection.find((s) => s.projectType === projectType && s.stackVersion === stackVersion);
    if (!sel) {
        throw new Error(`지원하지 않는 스택 조합입니다: projectType='${projectType}', stackVersion='${stackVersion}'. templates/stacks.json 의 selection 에 등재된 조합만 허용됩니다.`);
    }
    const entry = matrix.stacks[sel.stack];
    if (!entry) {
        throw new Error(`Stack matrix 파일이 손상되었습니다: selection 이 '${sel.stack}' 을 참조하지만 stacks 에 해당 키가 없습니다.`);
    }
    // 매트릭스 무결성: 항목의 projectType/stackVersion 과 selection 키가 일치해야 한다.
    if (entry.projectType !== projectType || entry.stackVersion !== stackVersion) {
        throw new Error(`Stack matrix 무결성 위반: '${sel.stack}' 의 projectType/stackVersion 이 selection 키와 다릅니다.`);
    }
    return entry;
}
function validateMatrix(file, source) {
    if (!file || typeof file !== "object") {
        throw new Error(`Stack matrix 형식 오류 (${source}): 최상위 객체가 아닙니다.`);
    }
    if (!file.stacks || typeof file.stacks !== "object") {
        throw new Error(`Stack matrix 형식 오류 (${source}): 'stacks' 필드가 없습니다.`);
    }
    if (!Array.isArray(file.selection)) {
        throw new Error(`Stack matrix 형식 오류 (${source}): 'selection' 필드는 배열이어야 합니다.`);
    }
    for (const sel of file.selection) {
        if (!sel.projectType || !sel.stackVersion || !sel.stack) {
            throw new Error(`Stack matrix 형식 오류 (${source}): selection 항목에 projectType/stackVersion/stack 가 모두 필요합니다.`);
        }
        if (!file.stacks[sel.stack]) {
            throw new Error(`Stack matrix 형식 오류 (${source}): selection 이 stacks 에 없는 '${sel.stack}' 을 참조합니다.`);
        }
    }
}
