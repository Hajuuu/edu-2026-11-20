import * as path from "path";
import fs from "fs-extra";
import { writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import Handlebars from "handlebars";
import { parseDDL } from "./ddlParser.js";
import { resolveStack } from "./stackMatrix.js";
import { resolveManifest } from "./manifestLoader.js";
import { dialectFullType } from "./dialectTypes.js";
import { emitSkillFiles, emitDocFiles } from "./skillsEmitter.js";
import { assertInsideProject } from "./pathGuard.js";
import { osJunkCopyFilter } from "../fsCopyFilter.js";
import { validateRenderedFiles } from "./outputValidator.js";
import { nonRetryable } from "./toolMessages.js";
import { applyAttachmentContext } from "./attachmentContext.js";
/**
 * 템플릿 디렉터리의 절대 경로를 반환한다. `EGOVFRAME_SCAFFOLD_TEMPLATE_PATH`
 * 환경변수가 설정되어 있으면 그 값을 우선 사용한다. egov_add_entity 등 다른
 * 도구도 동일한 해석을 쓸 수 있도록 export 한다.
 */
export function getScaffoldTemplatePath() {
    if (process.env.EGOVFRAME_SCAFFOLD_TEMPLATE_PATH) {
        return process.env.EGOVFRAME_SCAFFOLD_TEMPLATE_PATH;
    }
    try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        // build/utils/scaffold → project root: 세 단계 위로
        const projectRoot = path.resolve(__dirname, "../../..");
        return path.join(projectRoot, "templates");
    }
    catch {
        return path.join(process.cwd(), "templates");
    }
}
/**
 * resolvedFks 를 부모 엔티티 entityName 기준으로 dedupe.
 * 같은 부모 (예: USER) 를 두 컬럼이 모두 참조하면 콤보 쿼리는 하나만 만들면 되기 때문.
 */
function dedupeByParentEntityName(cols) {
    const seen = new Set();
    const out = [];
    for (const c of cols) {
        const key = c.fkParent?.entityName;
        if (!key || seen.has(key))
            continue;
        seen.add(key);
        out.push(c);
    }
    return out;
}
function extractRawTableName(ddl) {
    const match = ddl.match(/CREATE\s+(?:MEMORY\s+)?TABLE\s+[`"']?(\w+)[`"']?/i);
    return match ? match[1].toUpperCase() : "UNKNOWN";
}
/**
 * Handlebars 헬퍼를 전역에 등록한다. 멱등이므로 여러 번 호출해도 안전하다.
 * egov_add_entity 도 같은 헬퍼들을 필요로 한다.
 */
export function registerScaffoldHelpers() {
    Handlebars.registerHelper("eq", function (a, b) { return a === b; });
    Handlebars.registerHelper("concat", function (...args) { return args.slice(0, -1).join(""); });
    Handlebars.registerHelper("lowercase", function (str) { return typeof str === "string" ? str.toLowerCase() : ""; });
    Handlebars.registerHelper("uppercase", function (str) { return typeof str === "string" ? str.toUpperCase() : ""; });
    Handlebars.registerHelper("simpleJavaType", function (fullType) { if (!fullType)
        return fullType; return fullType.split(".").pop() || fullType; });
    Handlebars.registerHelper("add", function (a, b) { return (Number(a) || 0) + (Number(b) || 0); });
    Handlebars.registerHelper("empty", function (value) { return value === null || value === ""; });
    Handlebars.registerHelper("error", function (message) { console.error(message); return new Handlebars.SafeString(`<span class="error">${message}</span>`); });
    Handlebars.registerHelper("setVar", function (varName, varValue, options) { options.data.root[varName] = varValue; });
    Handlebars.registerHelper("thExpr", function (...args) {
        const parts = args.slice(0, -1);
        return new Handlebars.SafeString("${" + parts.join("") + "}");
    });
    // SQL 의 display 표현식 생성 — 부모 테이블의 표시 컬럼들을 alias prefix 와 함께
    // 묶는다.
    //   - 단일 컬럼: `alias.col` 만 반환
    //   - 다중 컬럼: `CONCAT(alias.c1, ' ', alias.c2, ...)` — Oracle 11g+ / MySQL / MariaDB /
    //     PostgreSQL 9.1+ / HSQL 모두 호환되는 함수 형태. 과거의 `||` 연결자는 MySQL/MariaDB
    //     에서 동작하지 않아 방언 호환을 위해 CONCAT 으로 단일화한다.
    Handlebars.registerHelper("joinSqlDisplay", function (cols, alias) {
        const arr = Array.isArray(cols) ? cols : [];
        const a = String(alias);
        if (arr.length === 0)
            return new Handlebars.SafeString(`'${a}'`); // fallback (should not happen)
        if (arr.length === 1)
            return new Handlebars.SafeString(`${a}.${arr[0]}`);
        const parts = [];
        arr.forEach((c, i) => {
            if (i > 0)
                parts.push("' '");
            parts.push(`${a}.${c}`);
        });
        return new Handlebars.SafeString(`CONCAT(${parts.join(", ")})`);
    });
    // 방언별 컬럼 타입 문자열 (예: dataType=VARCHAR, maxLength=36, dialect=oracle → "VARCHAR2(36)")
    // 길이 의미 있는 타입(VARCHAR/CHAR/NUMBER 등) 에만 (LEN) 을 붙이고, CLOB/TEXT/DATE 등은 길이 없이 반환.
    // 네 번째 인자 scale 은 DECIMAL(P,S) 의 소수 자릿수 — 생략하면 Handlebars options 객체가 들어오므로 0 으로 본다.
    Handlebars.registerHelper("dialectType", function (rawType, maxLength, dialect, scale) {
        const scaleValue = typeof scale === "object" ? 0 : Number(scale) || 0;
        return new Handlebars.SafeString(dialectFullType(String(rawType ?? ""), Number(maxLength) || 0, String(dialect), scaleValue));
    });
}
/**
 * `ScaffoldContext` 를 빌드한다. egov_add_entity 도 동일한 컨텍스트로 엔티티
 * 파일들을 렌더링하기 위해 export 한다.
 */
export function buildContext(params) {
    const { projectName, packageName, entityName, ddl, description, projectType, stackVersion } = params;
    const parsed = parseDDL(ddl);
    const rawTableName = extractRawTableName(ddl);
    const stack = resolveStack(projectType, stackVersion);
    const parts = packageName.split(".");
    const entityModule = parts[parts.length - 1];
    const basePackage = parts.slice(0, -1).join(".");
    const packagePath = packageName.replace(/\./g, "/");
    const basePackagePath = basePackage.replace(/\./g, "/");
    const groupId = basePackage;
    const entityNameLower = entityName.charAt(0).toLowerCase() + entityName.slice(1);
    const entityNameUpper = rawTableName;
    const nonPkAttributes = parsed.attributes.filter((a) => !a.isPrimaryKey);
    // 검색 dropdown 노출 컬럼:
    //   PK 제외 + java.lang.String + Y/N flag 제외 (CHAR(1)+_YN). FK 는 포함 유지 —
    //   List Mapper.xml 이 FK 컬럼을 부모 display 컬럼과 LIKE 매칭하도록 처리 중이므로
    //   사용자에게는 'Department' 이름 검색이 자연스럽게 동작한다.
    //   ※ 과거에는 `.slice(0, 2)` 로 임의 2개만 노출했었으나, 일반 String 컬럼이 많을 때
    //     사용자가 검색 의도와 다른 두 컬럼만 보게 되는 문제가 있어 제거.
    const searchableAttributes = parsed.attributes.filter((a) => !a.isPrimaryKey &&
        a.javaType === "java.lang.String" &&
        !a.isYnFlag);
    const idPrefix = entityNameUpper + "-";
    // Compute unique Java imports needed by entity attributes.
    // java.lang.* types are auto-imported and primitives don't need imports.
    const imports = Array.from(new Set(parsed.attributes
        .map((a) => a.javaType)
        .filter((t) => t && t.includes(".") && !t.startsWith("java.lang.")))).sort();
    return {
        projectName,
        groupId,
        artifactId: projectName,
        description: description || `eGovFrame ${stackVersion === "5.0" ? "5.0" : "4.3"} ${entityName} Project`,
        projectType,
        stackVersion,
        isPrimaryEntity: params.isPrimaryEntity ?? true,
        entities: params.entities ?? [
            // 기본값: 현재 호출의 단일 엔티티. primary 여부는 호출의 isPrimaryEntity 플래그를 따른다.
            // (egov_scaffold_project 첫 호출 → true, egov_add_entity → false 명시.
            //  add_entity 가 nav fragment 를 재생성할 때는 params.entities 를 직접 넘기므로 이 경로 미사용.)
            { entityName, entityNameLower, isPrimary: params.isPrimaryEntity ?? true },
        ],
        packageName, packagePath, basePackage, basePackagePath, entityModule,
        entityName, entityNameLower, entityNameUpper,
        tableName: rawTableName,
        attributes: parsed.attributes,
        pkAttributes: parsed.pkAttributes,
        ddlParserUsed: parsed.parserUsed,
        ddlWarnings: parsed.warnings,
        nonPkAttributes,
        searchableAttributes,
        hasCompositePk: parsed.pkAttributes.length > 1,
        hasDateAttr: parsed.attributes.some((a) => a.isDate),
        imports,
        // FK 해석은 egov_add_entity 가 discoverParentEntity 로 후속 채움.
        // egov_scaffold_project (첫 스캐폴드) 에서는 부모가 아직 없으므로 빈 배열로 시작.
        fkAttributes: parsed.attributes.filter((a) => !!a.fk),
        resolvedFks: parsed.attributes.filter((a) => !!a.fkParent),
        uniqueFkParents: dedupeByParentEntityName(parsed.attributes.filter((a) => !!a.fkParent)),
        hasFk: parsed.attributes.some((a) => !!a.fkParent),
        hasTrailingTableClauses: (parsed.pkAttributes.length > 1) || parsed.attributes.some((a) => !!a.fk),
        voName: entityNameLower + "VO",
        thVO: "${" + entityNameLower + "VO}",
        idPrefix,
        date: new Date().toISOString().split("T")[0],
        author: "eGovFrame",
        version: "1.0.0",
        stack,
        // egov_add_entity 의 idGeneration 옵션 (auto|manual) 이 활용하는 ctx 변수들의 기본값.
        // egov_scaffold_project 첫 호출은 항상 auto 와 동일하게 동작해야 한다 (기존 골든 호환).
        // egov_add_entity 는 호출 후 ctx 를 동적으로 override 해 manual 모드를 지원한다.
        idGenerationAuto: true,
        idGenerationManual: false,
    };
}
/**
 * 파일 매니페스트는 `templates/manifests/<stack>.json` 에서 선언적으로 관리한다.
 * 라우팅은 `templates/stacks.json` 의 `stack.manifest` 한 곳이 단일 출처이며,
 * 새 파일 추가 시 매니페스트 JSON 한 줄만 추가하면 코드 수정 없이 반영된다.
 */
function getFileManifest(ctx) {
    return resolveManifest(ctx.stack.manifest, ctx);
}
export async function generateScaffoldProject(params) {
    registerScaffoldHelpers();
    const ctx = buildContext(params);
    if (params.withAttachment) {
        applyAttachmentContext(ctx, { attachmentFieldName: "atchFileId", maxAttachmentCount: 0 });
    }
    const templateBasePath = getScaffoldTemplatePath();
    const projectDir = path.join(params.outputPath, params.projectName);
    await fs.ensureDir(projectDir);
    const generatedFiles = [];
    const manifest = getFileManifest(ctx);
    // Handlebars 로 렌더링된(=템플릿에서 그대로 복사되지 않은) 파일만 자체 검증 대상으로 모은다.
    const renderedManifestFiles = [];
    for (const mapping of manifest) {
        try {
            const templatePath = path.join(templateBasePath, mapping.template);
            const fullOutputPath = assertInsideProject(projectDir, path.join(projectDir, mapping.output));
            if (!(await fs.pathExists(templatePath))) {
                console.error(`Template not found: ${templatePath}`);
                continue;
            }
            const templateContent = await fs.readFile(templatePath, "utf-8");
            const compiled = Handlebars.compile(templateContent);
            // dialect 가 매핑에 채워져 있으면 방언별 fan-out 항목 — 템플릿이 `{{dialect}}` 분기에 사용.
            const renderCtx = mapping.dialect ? { ...ctx, dialect: mapping.dialect } : ctx;
            const rendered = compiled(renderCtx);
            await fs.ensureDir(path.dirname(fullOutputPath));
            await writeFile(fullOutputPath, rendered, "utf-8");
            generatedFiles.push(mapping.output);
            renderedManifestFiles.push({ relPath: mapping.output, content: rendered });
        }
        catch (error) {
            console.error(`Failed to generate ${mapping.output}:`, error);
            throw new Error(`Failed to generate ${mapping.output}: ${error}`);
        }
    }
    // 생성 결과 자체 검증 — egov_add_entity/egov_add_query_view/egov_add_attach_file_infrastructure
    // 와 달리 이 함수는 렌더링과 동시에 파일을 디스크에 쓰므로(render-then-write 분리가 침습적),
    // "쓰기 전" 이 아니라 "쓰기 후, 성공 반환 전" 검증으로 대체한다. 실패 시 이 시점까지 쓰여진
    // 파일은 롤백하지 않고, 그 사실을 에러 메시지에 명시해 호출자가 정리 방법을 알 수 있게 한다.
    const validationIssues = validateRenderedFiles(renderedManifestFiles);
    if (validationIssues.length > 0) {
        throw nonRetryable(`생성 결과 자체 검증 실패 — 생성기 내부 문제일 수 있습니다.\n${validationIssues.map((v) => `  - ${v}`).join("\n")}\n\n` +
            `⚠️  egov_scaffold_project 는 파일을 렌더링과 동시에 디스크에 쓰므로, 이 실패 시점까지 이미 일부 파일이 ` +
            `'${projectDir}' 에 작성된 상태입니다 (롤백되지 않음). 해당 디렉터리를 직접 정리한 뒤 다시 시도하세요.`);
    }
    // Static assets copy — 디렉터리명은 호환성 매트릭스의 stack.staticAssets 에서 가져온다.
    // (Boot 5.0 = static50, 그 외 = static)
    const staticDirName = ctx.stack.staticAssets;
    const staticSrcDir = path.join(templateBasePath, staticDirName);
    if (await fs.pathExists(staticSrcDir)) {
        if (ctx.projectType === "war") {
            // WAR: static assets go under src/main/webapp/
            const staticDestDir = path.join(projectDir, "src/main/webapp");
            await fs.copy(staticSrcDir, staticDestDir, { filter: osJunkCopyFilter });
            generatedFiles.push("src/main/webapp/ (CSS, JS, images)");
        }
        else {
            // Boot: static assets go under src/main/resources/static/
            const staticDestDir = path.join(projectDir, "src/main/resources/static");
            await fs.copy(staticSrcDir, staticDestDir, { filter: osJunkCopyFilter });
            generatedFiles.push("src/main/resources/static/ (CSS, JS, images)");
        }
    }
    // WAR-specific static files (validator-rules.xml, MANIFEST.MF)
    if (ctx.projectType === "war") {
        const warStaticDir = path.join(templateBasePath, "war", "static-files");
        if (await fs.pathExists(warStaticDir)) {
            const validatorRulesSrc = path.join(warStaticDir, "validator-rules.xml");
            if (await fs.pathExists(validatorRulesSrc)) {
                const validatorRulesDest = path.join(projectDir, "src/main/webapp/WEB-INF/config/egovframework/validator/validator-rules.xml");
                await fs.ensureDir(path.dirname(validatorRulesDest));
                await fs.copy(validatorRulesSrc, validatorRulesDest, { filter: osJunkCopyFilter });
                generatedFiles.push("src/main/webapp/WEB-INF/config/egovframework/validator/validator-rules.xml");
            }
            const manifestSrc = path.join(warStaticDir, "MANIFEST.MF");
            if (await fs.pathExists(manifestSrc)) {
                const manifestDest = path.join(projectDir, "src/main/webapp/META-INF/MANIFEST.MF");
                await fs.ensureDir(path.dirname(manifestDest));
                await fs.copy(manifestSrc, manifestDest, { filter: osJunkCopyFilter });
                generatedFiles.push("src/main/webapp/META-INF/MANIFEST.MF");
            }
        }
    }
    // AI 코딩 에이전트 스킬 emit (Claude Code / Cursor / OpenCode / Cline / Continue).
    // 원본 `templates/skills/original/*.md` 를 도구별 포맷으로 변환·복사한다.
    // 원본 폴더가 비어있거나 없으면 emitter 가 silently 0개를 반환하므로 호환에 안전하다.
    const skillsSourceDir = path.join(templateBasePath, "skills", "original");
    const skillFiles = await emitSkillFiles(skillsSourceDir, projectDir);
    for (const rel of skillFiles)
        generatedFiles.push(rel);
    // 사람-친화 레퍼런스 문서를 프로젝트의 docs/ 로 그대로 복사 (frontmatter 없는 마크다운).
    // 개발자 온보딩용 — AI 스킬과 별개. 원본 폴더가 없으면 silently skip.
    const docsSourceDir = path.join(templateBasePath, "docs");
    const docFiles = await emitDocFiles(docsSourceDir, projectDir);
    for (const rel of docFiles)
        generatedFiles.push(rel);
    // 프레임워크 라벨도 매트릭스에서 가져온다. 버전 업그레이드 시 stacks.json 만 갱신하면 된다.
    const frameworkVersion = ctx.stack.frameworkLabel;
    return JSON.stringify({
        success: true,
        projectDir,
        projectType: ctx.projectType,
        stackVersion: ctx.stackVersion,
        frameworkVersion,
        entityName: ctx.entityName,
        tableName: ctx.tableName,
        ddlParserUsed: ctx.ddlParserUsed,
        ddlWarnings: ctx.ddlWarnings,
        fileCount: generatedFiles.length,
        files: generatedFiles,
        selfValidatedFileCount: renderedManifestFiles.length,
    }, null, 2);
}
