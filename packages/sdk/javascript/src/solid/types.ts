import type { JSX } from "solid-js";
export interface PageInfo {
  title?: string;
  description?: string;
  keywords?: string[];
  locale?: string;
  metadata?: Record<string, unknown>;
}

export type CssLengthUnit =
  | "design"
  | "px"
  | "%"
  | "em"
  | "rem"
  | "vw"
  | "vh"
  | "dvw"
  | "dvh"
  | "vmin"
  | "vmax";

export interface UnitValue {
  value: number;
  unit: string;
}
export interface StateReadBinding {
  $state: string;
}
export interface StateWriteBinding {
  $bindState: string;
}
export interface TranslationBinding {
  $t: string;
}
export interface PageBinding {
  $page: string;
}
export interface TemplateBinding {
  $template: string;
}
export type DynamicValue<T> =
  | T
  | StateReadBinding
  | StateWriteBinding
  | TranslationBinding
  | PageBinding
  | TemplateBinding;

export interface CommonStyles {
  position?: "static" | "relative" | "absolute" | "fixed" | "sticky";
  top?: number | string | UnitValue;
  right?: number | string | UnitValue;
  bottom?: number | string | UnitValue;
  left?: number | string | UnitValue;
  zIndex?: number;
  display?: "block" | "inline" | "inline-block" | "flex" | "inline-flex" | "grid" | "none";
  visibility?: "visible" | "hidden";
  overflow?: "visible" | "hidden" | "scroll" | "auto";
  overflowX?: "visible" | "hidden" | "scroll" | "auto";
  overflowY?: "visible" | "hidden" | "scroll" | "auto";
  width?: number | string | UnitValue;
  height?: number | string | UnitValue;
  minWidth?: number | string | UnitValue;
  maxWidth?: number | string | UnitValue;
  minHeight?: number | string | UnitValue;
  maxHeight?: number | string | UnitValue;
  boxSizing?: "content-box" | "border-box";
  aspectRatio?: number | string;
  margin?: number | string | UnitValue;
  marginX?: number | string | UnitValue;
  marginY?: number | string | UnitValue;
  marginTop?: number | string | UnitValue;
  marginRight?: number | string | UnitValue;
  marginBottom?: number | string | UnitValue;
  marginLeft?: number | string | UnitValue;
  padding?: number | string | UnitValue;
  paddingX?: number | string | UnitValue;
  paddingY?: number | string | UnitValue;
  paddingTop?: number | string | UnitValue;
  paddingRight?: number | string | UnitValue;
  paddingBottom?: number | string | UnitValue;
  paddingLeft?: number | string | UnitValue;
  flexDirection?: "row" | "row-reverse" | "column" | "column-reverse";
  flexWrap?: "nowrap" | "wrap" | "wrap-reverse";
  justifyContent?:
    | "flex-start"
    | "flex-end"
    | "center"
    | "space-between"
    | "space-around"
    | "space-evenly";
  alignItems?: "stretch" | "flex-start" | "flex-end" | "center" | "baseline";
  alignSelf?: "auto" | "stretch" | "flex-start" | "flex-end" | "center" | "baseline";
  flex?: number | string;
  flexGrow?: number;
  flexShrink?: number;
  gap?: number | string | UnitValue;
  rowGap?: number | string | UnitValue;
  columnGap?: number | string | UnitValue;
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
  borderWidth?: number | string | UnitValue;
  borderStyle?: "none" | "solid" | "dashed" | "dotted" | "double";
  borderColor?: string;
  borderRadius?: number | string | UnitValue;
  boxShadow?: string;
  color?: string;
  fontFamily?: string;
  fontSize?: number | string | UnitValue;
  fontWeight?: number | string;
  lineHeight?: number | string;
  letterSpacing?: number | string | UnitValue;
  textAlign?: "left" | "center" | "right" | "justify";
  textDecoration?: string;
  whiteSpace?: string;
  wordBreak?: string;
  opacity?: number;
  cursor?: string;
  transform?: string;
  pointerEvents?: "auto" | "none";
  [key: string]: unknown;
}

export interface ElementProps {
  id?: string;
  className?: string;
  styles?: CommonStyles;
  style?: Record<string, string | number>;
  ariaLabel?: string;
  __slotMap?: Record<string, string>;
  [key: string]: unknown;
}
export interface ComponentRenderContext<P extends ElementProps = ElementProps> {
  elementId: string;
  elementType: string;
  props: P;
  children?: JSX.Element;
  slots?: Record<string, JSX.Element>;
}

export interface SpecElement {
  type: string;
  props?: ElementProps;
  children?: string[];
  slots?: Record<string, string[]>;
  visible?: DynamicValue<boolean>;
}
export interface Spec {
  root: string;
  elements: Record<string, SpecElement>;
  state?: Record<string, unknown>;
}
export interface GlobalConfig {
  design?: { width?: number | null };
  body?: { styles?: CommonStyles; style?: Record<string, string | number>; className?: string };
  variables?: Record<string, string | number | UnitValue>;
  i18n?: { defaultLocale?: string };
}
export interface SceneDocument {
  schemaVersion?: string;
  pageInfo?: PageInfo;
  globalConfig?: GlobalConfig;
  spec: Spec;
}
export type StateUpdater =
  | Record<string, unknown>
  | ((prev: Record<string, unknown>) => Record<string, unknown>);
export type ActionHandler = (
  params: Record<string, unknown>,
  context: {
    getState: () => Record<string, unknown>;
    setState: (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => void;
  },
) => unknown;
export type ComponentRenderer = (props: ComponentRenderContext) => JSX.Element;
export type ComponentRegistry = Record<string, ComponentRenderer>;
