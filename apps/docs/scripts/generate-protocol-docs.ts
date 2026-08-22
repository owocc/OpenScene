import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as ts from "typescript";

type Locale = "en" | "zh-CN";

const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
const sourcePath = path.join(repositoryRoot, "packages/protocol/src/index.ts");
const outputDirectory = path.join(import.meta.dirname, "../src/content/docs");

function isExported(node: ts.Node): boolean {
  return Boolean(node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
}

function documentationFor(node: ts.Node, locale: Locale): string {
  const docs = ts.getJSDocCommentsAndTags(node).filter(ts.isJSDoc);
  const english = docs
    .map((doc) => (typeof doc.comment === "string" ? doc.comment.trim() : ""))
    .filter(Boolean)
    .join("\n\n");
  if (locale === "en") return english;
  const chinese = docs
    .flatMap((doc) => doc.tags ?? [])
    .filter((tag) => tag.tagName.text === "zh")
    .map((tag) => (typeof tag.comment === "string" ? tag.comment.trim() : ""))
    .filter(Boolean)
    .join("\n\n");
  return chinese || english;
}

function declarationKind(node: ts.Node): string | null {
  if (ts.isInterfaceDeclaration(node)) return "Interface";
  if (ts.isTypeAliasDeclaration(node)) return "Type";
  if (ts.isFunctionDeclaration(node)) return "Function";
  if (ts.isVariableStatement(node)) return "Constant";
  return null;
}

function declarationName(node: ts.Node): string {
  if (ts.isVariableStatement(node)) return node.declarationList.declarations.map((item) => item.name.getText()).join(", ");
  return "name" in node && node.name ? node.name.getText() : "Declaration";
}

const source = ts.createSourceFile(sourcePath, await readFile(sourcePath, "utf8"), ts.ScriptTarget.Latest, true);
const declarations = source.statements
  .filter(isExported)
  .map((node) => ({ node, kind: declarationKind(node) }))
  .filter((entry): entry is { node: ts.Node; kind: string } => entry.kind !== null);

function render(locale: Locale): string {
  const chinese = locale === "zh-CN";
  const sections = declarations.map(({ node, kind }) => {
    const name = declarationName(node);
    const description = documentationFor(node, locale) || (chinese ? `由 \`@openscene/protocol\` 导出的协议${kind === "Interface" ? "接口" : "声明"}。` : `Protocol ${kind.toLowerCase()} exported by \`@openscene/protocol\`.`);
    return `## ${name}\n\n${description}\n\n**${chinese ? "类型" : "Kind"}:** ${kind}\n\n\`\`\`ts\n${node.getText(source).replace(/^export\s+/, "")}\n\`\`\``;
  });
  const title = chinese ? "Studio 桥接协议" : "Studio bridge protocol";
  const description = chinese
    ? "Studio 与渲染器之间版本化桥接协议的自动 TypeScript 参考。"
    : "Generated TypeScript reference for the versioned Studio-to-renderer bridge.";
  const generatedNotice = chinese ? "本模块由 `packages/protocol/src/index.ts` 自动生成。修改协议源码后运行 `bun run generate:protocol`；不要手动编辑此页面。" : "This module is generated from `packages/protocol/src/index.ts`. Run `bun run generate:protocol` after changing the protocol source; do not edit this page by hand.";
  const lifecycle = chinese ? "传输生命周期" : "Transport lifecycle";
  const steps = chinese
    ? ["Studio 将编辑器 query 参数加入 iframe URL。", "渲染器校验参数后，向配置的 Studio origin 发送 `SCENE_READY`。", "Studio 校验 origin 与 session 后，通过 `SCENE_CONNECT` 移交 `MessageChannel` 端口。", "渲染器通过端口发送 `SCENE_DOCUMENT` 与后续 `SCENE_NODE_SELECTED` 消息。", "Studio 节点树选择变化时发送 `SCENE_SELECT`。"]
    : ["Studio adds the editor query parameters to the iframe URL.", "The renderer validates them and posts `SCENE_READY` to the configured Studio origin.", "Studio validates origin and session, then transfers a `MessageChannel` port with `SCENE_CONNECT`.", "The renderer sends `SCENE_DOCUMENT` and subsequent `SCENE_NODE_SELECTED` messages through that port.", "Studio sends `SCENE_SELECT` when its node tree selection changes."];
  return `---\ntitle: ${title}\ndescription: ${description}\nsidebar:\n  order: 2\n---\n\n${generatedNotice}\n\n[${chinese ? "English" : "中文"}](${chinese ? "/en/protocol/" : "/zh-cn/protocol/"})\n\n## ${lifecycle}\n\n${steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}\n\n## ${chinese ? "公开 API" : "Public API"}\n\n${sections.join("\n\n")}`;
}

await Promise.all([
  writeFile(path.join(outputDirectory, "en/protocol.mdx"), render("en")),
  writeFile(path.join(outputDirectory, "zh-CN/protocol.mdx"), render("zh-CN")),
]);
console.log(`Generated localized protocol references from ${path.relative(repositoryRoot, sourcePath)}`);
