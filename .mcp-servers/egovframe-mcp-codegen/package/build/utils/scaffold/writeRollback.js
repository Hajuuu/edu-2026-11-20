import path from "node:path";
import fs from "fs-extra";
import { retryAfterAction } from "./toolMessages.js";
export class FileWriteJournal {
    entries = [];
    /** absPath 를 생성/수정하기 직전에 호출해 원본 상태를 기록한다. */
    async recordBeforeWrite(absPath) {
        if (await fs.pathExists(absPath)) {
            this.entries.push({
                absPath,
                existedBefore: true,
                originalContent: await fs.readFile(absPath, "utf-8"),
            });
        }
        else {
            this.entries.push({ absPath, existedBefore: false });
        }
    }
    get recordedCount() {
        return this.entries.length;
    }
    /**
     * 기록 역순으로 원상 복구한다. 개별 복원 실패는 예외로 전파하지 않고 목록으로
     * 모아 반환한다 — 복구 중 2차 예외가 원인 에러를 가리면 안 되기 때문.
     */
    async rollback() {
        let restoredCount = 0;
        const failedPaths = [];
        for (const e of [...this.entries].reverse()) {
            try {
                if (e.existedBefore) {
                    await fs.writeFile(e.absPath, e.originalContent ?? "", "utf-8");
                }
                else {
                    await fs.remove(e.absPath);
                }
                restoredCount += 1;
            }
            catch {
                failedPaths.push(e.absPath);
            }
        }
        return { restoredCount, failedPaths };
    }
}
/** 롤백 결과를 사용자 안내 문구로 변환한다 (경로는 프로젝트 상대 경로로만 노출). */
export function formatRollbackNotice(projectDir, outcome) {
    if (outcome.failedPaths.length > 0) {
        const rel = outcome.failedPaths.map((p) => path.relative(projectDir, p));
        return (`원상 복구를 시도했으나 다음 ${rel.length}개 파일은 복구하지 못했습니다 — 직접 확인 후 정리가 필요합니다:\n` +
            rel.map((f) => `  - ${f}`).join("\n"));
    }
    return outcome.restoredCount > 0
        ? `이미 작성된 ${outcome.restoredCount}개 파일은 쓰기 전 상태로 원상 복구했습니다.`
        : `파일이 작성되기 전이므로 프로젝트는 변경되지 않았습니다.`;
}
/**
 * apply() 안에서 파일을 쓰기 직전마다 journal.recordBeforeWrite() 를 호출한다는
 * 전제 하에, 중간 실패 시 롤백을 수행하고 루프 차단형 에러로 변환해 던진다.
 * 롤백이 성공하면 프로젝트는 쓰기 전 상태이므로, 원인(권한/디스크 풀)을 해결한 뒤
 * 같은 인자로 재시도하는 것이 실제로 유효하다 — retryAfterAction 으로 분류한다.
 */
export async function withWriteRollback(projectDir, journal, apply) {
    try {
        return await apply();
    }
    catch (error) {
        const outcome = await journal.rollback();
        const cause = error instanceof Error ? error.message : String(error);
        // OS 에러 메시지(EACCES 등)에 절대 경로가 포함될 수 있어 프로젝트 경로를 가린다.
        const sanitizedCause = cause.split(path.resolve(projectDir)).join("<projectDir>");
        throw retryAfterAction(`파일 쓰기 중 오류가 발생해 작업을 중단했습니다: ${sanitizedCause}\n` +
            `${formatRollbackNotice(projectDir, outcome)}\n` +
            `원인(권한/디스크 공간 등)을 해결한 뒤 같은 인자로 다시 시도하세요.`);
    }
}
