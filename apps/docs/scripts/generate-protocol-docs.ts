import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as ts from "typescript";

type Locale = "en" | "zh-CN";

const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
const protocolSourcePaths = ["document.ts", "manifest.ts", "bridge.ts"].map((file) =>
  path.join(repositoryRoot, "packages/core/src", file),
);
const outputDirectory = path.join(import.meta.dirname, "../src/content/docs");

type Declaration = { node: ts.Node; kind: string; source: ts.SourceFile };

function isExported(node: ts.Node): boolean {
  return Boolean(
    ts.canHaveModifiers(node) &&
    ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
  );
}

function documentationFor(node: ts.Node, locale: Locale): string {
  const docs = ts.getJSDocCommentsAndTags(node).filter(ts.isJSDoc);
  const english = docs
    .map((doc) => (typeof doc.comment === "string" ? doc.comment.trim() : ""))
    .filter(Boolean)
    .join("\n\n")
    .replace(/ {2,}/g, " ");
  if (locale === "en") return english;
  const chinese = docs
    .flatMap((doc) => doc.tags ?? [])
    .filter((tag) => tag.tagName.text === "zh")
    .map((tag) => (typeof tag.comment === "string" ? tag.comment.trim() : ""))
    .filter(Boolean)
    .join("\n\n")
    .replace(/ {2,}/g, " ");
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
  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations.map((item) => item.name.getText()).join(", ");
  }
  if (
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isFunctionDeclaration(node)
  ) {
    return node.name?.getText() ?? "Declaration";
  }
  return "Declaration";
}

const sources = await Promise.all(
  protocolSourcePaths.map(async (filePath) =>
    ts.createSourceFile(filePath, await readFile(filePath, "utf8"), ts.ScriptTarget.Latest, true),
  ),
);
const declarations: Declaration[] = sources.flatMap((source) =>
  source.statements
    .filter(isExported)
    .map<Declaration | undefined>((node) => {
      const kind = declarationKind(node);
      return kind ? { node, kind, source } : undefined;
    })
    .filter((entry): entry is Declaration => entry !== undefined),
);

function protocolOverview(locale: Locale): string {
  if (locale === "zh-CN") {
    return (
      `## 文档外壳与 flat Spec

` +
      "```ts" +
      `
interface SceneDocument {
  schemaVersion: "1.0.0";
  pageInfo: {
    title: string;
    description: string;
    keywords: string[];
    locale: string;
    metadata: Record<string, unknown>;
  };
  globalConfig: {
    design?: unknown;
    body?: unknown;
    variables?: unknown;
    css?: unknown;
    i18n?: unknown;
  };
  spec: { root: string | null; elements: Record<string, UIElement>; state?: Record<string, unknown> };
}
` +
      "```" +
      `

OpenScene 的 page wrapper（页面外壳）将 json-render 的 flat identity map（flat Spec）放在 \`spec\` 字段中。节点身份**只有** \`spec.elements\` 的 map key：\`root\` 和每个 \`children\`、\`slots\` 引用都指向一个 key，element value 不得重复保存 id，也不得持久化 adapter 私有字段。json-render 原生处理 \`$state\`、\`$bindState\`、\`$bindItem\`、\`$template\`、\`$computed\`、\`$cond\`、visibility、repeat、watch 和 action binding。

\`spec.root\` 可以为 \`null\`：新建页面/模板不再自动创建 root 节点，作者手动添加的第一个节点会成为 root，运行时在存在 root 之前不渲染任何内容。

## OpenScene 指令

OpenScene 只增加两个 framework-neutral 指令：\`$page\` 从运行时 \`/__scene/pageInfo\` 读取页面信息；\`$t\` 按运行时语言和 \`globalConfig.i18n.defaultLocale\` 从 \`/i18n/{locale}\` 读取翻译。它们与 json-render 内建指令一起注册，不能用 adapter 私有 props 代替。

## Solid named-slot 限制

协议和 json-render core 支持 named slots，但首版 OpenScene Solid adapter 不支持非空 named slot。渲染前会以 node ID 和 slot 名称报告明确错误；空 \`slots\` 会被移除。请使用 children 或 \`View\` 组合来扩展组件，不要依赖无法渲染的 slot capability。

## Bridge v2 传输

所有消息都带有版本化 envelope，并由对应的 Zod discriminated union 校验。iframe window → Studio window 发送 \`RENDERER_READY { appType: "web" }\`；Studio window → iframe window 发送 \`STUDIO_CONNECT\` 并转移 \`MessagePort\`。端口上，Studio → client 发送 \`DOCUMENT_SET { document, revision }\` 和 \`EDITOR_STATE_SET { interactionMode, selectedElementIds }\`；client → Studio 发送 \`DOCUMENT_RENDERED { schemaVersion, root }\`、\`SELECTION_CHANGED { elementIds, primaryElementId, source: "click" | "marquee" }\` 或 \`RENDERER_ERROR { message }\`。接收端必须按方向使用具体 schema，不能只断言 payload。`
    );
  }
  return (
    `## Document wrapper and flat Spec

` +
    "```ts" +
    `
interface SceneDocument {
  schemaVersion: "1.0.0";
  pageInfo: {
    title: string;
    description: string;
    keywords: string[];
    locale: string;
    metadata: Record<string, unknown>;
  };
  globalConfig: {
    design?: unknown;
    body?: unknown;
    variables?: unknown;
    css?: unknown;
    i18n?: unknown;
  };
  spec: { root: string | null; elements: Record<string, UIElement>; state?: Record<string, unknown> };
}
` +
    "```" +
    `

The OpenScene page wrapper contains json-render's flat identity map (the flat Spec) in its \`spec\` field. Node identity is **only** the map key in \`spec.elements\`: \`root\` and every \`children\` or \`slots\` reference point to a key. Element values must not duplicate an id or persist adapter-private fields. json-render natively owns \`$state\`, \`$bindState\`, \`$bindItem\`, \`$template\`, \`$computed\`, \`$cond\`, visibility, repeat, watch, and action binding.

\`spec.root\` may be \`null\`: a newly created page/template has no root node. The first node the author adds manually becomes the root, and the runtime renders nothing until one exists.

## OpenScene directives

OpenScene adds only two framework-neutral directives: \`$page\` reads page information from runtime \`/__scene/pageInfo\`; \`$t\` resolves translations from \`/i18n/{locale}\` using the runtime language and \`globalConfig.i18n.defaultLocale\`. Register them alongside json-render's built-ins; do not replace them with adapter-private props.

## Solid named-slot constraint

The protocol and json-render core support named slots, but the first OpenScene Solid adapter does not support non-empty named slots. It reports a precise error containing the node ID and slot name before rendering; empty \`slots\` are removed. Use children or \`View\` composition for extensibility instead of publishing an unrenderable slot capability.

## Bridge v2 transport

Every message has a versioned envelope and is validated by the directional Zod discriminated union. iframe window → Studio window sends \`RENDERER_READY { appType: "web" }\`; Studio window → iframe window sends \`STUDIO_CONNECT\` and transfers a \`MessagePort\`. On the port, Studio → client sends \`DOCUMENT_SET { document, revision }\` and \`EDITOR_STATE_SET { interactionMode, selectedElementIds }\`; client → Studio sends \`DOCUMENT_RENDERED { schemaVersion, root }\`, \`SELECTION_CHANGED { elementIds, primaryElementId, source: "click" | "marquee" }\`, or \`RENDERER_ERROR { message }\`. Receivers must validate with the concrete schema for that direction rather than asserting the payload.`
  );
}

const sourcePath = protocolSourcePaths[0];

function render(locale: Locale): string {
  const chinese = locale === "zh-CN";
  const sections = declarations.map(({ node, kind, source }) => {
    const name = declarationName(node);
    const description =
      documentationFor(node, locale) ||
      (chinese
        ? `由 \`@openscene-ai/core\` 导出的协议${kind === "Interface" ? "接口" : "声明"}。`
        : `Protocol ${kind.toLowerCase()} exported by \`@openscene-ai/core\`.`);
    return `## ${name}\n\n${description}\n\n**${chinese ? "类型" : "Kind"}:** ${kind}\n\n\`\`\`ts\n${node
      .getText(source)
      .replace(/^export\s+/, "")}\n\`\`\``;
  });
  const title = chinese ? "Studio 桥接协议" : "Studio bridge protocol";
  const description = chinese
    ? "Studio 与渲染器之间版本化桥接协议的自动 TypeScript 参考。"
    : "Generated TypeScript reference for the versioned Studio-to-renderer bridge.";
  const generatedNotice = chinese
    ? "本模块由 `packages/protocol/src/index.ts` 自动生成。修改协议源码后运行 `bun run generate:protocol`；不要手动编辑此页面。"
    : "This module is generated from `packages/protocol/src/index.ts`. Run `bun run generate:protocol` after changing the protocol source; do not edit this page by hand.";
  const lifecycle = chinese ? "传输生命周期" : "Transport lifecycle";
  const steps = chinese
    ? [
        "Studio 将三个 editor query 参数加入 iframe URL。",
        '渲染器校验参数后，向配置的 Studio origin 发送带 `appType: "web"` 的 `RENDERER_READY`。',
        "Studio 校验 origin、source 与 session 后，通过 `STUDIO_CONNECT` 移交 `MessageChannel` 端口。",
        "Studio 通过端口发送 `DOCUMENT_SET` 和 `EDITOR_STATE_SET`；渲染器返回 `DOCUMENT_RENDERED`、`SELECTION_CHANGED` 或 `RENDERER_ERROR`。",
      ]
    : [
        "Studio adds the three editor query parameters to the iframe URL.",
        'The renderer validates them and posts `RENDERER_READY` with `appType: "web"` to the configured Studio origin.',
        "Studio validates origin, source, and session, then transfers a `MessageChannel` port with `STUDIO_CONNECT`.",
        "Studio sends `DOCUMENT_SET` and `EDITOR_STATE_SET` through the port; the renderer returns `DOCUMENT_RENDERED`, `SELECTION_CHANGED`, or `RENDERER_ERROR`.",
      ];
  return `---\ntitle: ${title}\ndescription: ${description}\nsidebar:\n  order: 2\n---\n\n${generatedNotice}\n\n[${chinese ? "English" : "中文"}](${chinese ? "/en/protocol/" : "/zh-cn/protocol/"})\n\n## ${lifecycle}\n\n${steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}\n\n${protocolOverview(locale)}\n\n## ${chinese ? "公开 API" : "Public API"}\n\n${sections.join("\n\n")}\n`;
}

await Promise.all([
  writeFile(path.join(outputDirectory, "en/protocol.mdx"), render("en")),
  writeFile(path.join(outputDirectory, "zh-CN/protocol.mdx"), render("zh-CN")),
]);
console.log(
  `Generated localized protocol references from ${path.relative(repositoryRoot, sourcePath)}`,
);
