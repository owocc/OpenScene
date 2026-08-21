import type zh_CN from "./zh-CN";

export type BaseLocale = "zh-CN";

export type Locales = "zh-CN" | "en-US";

export type Translation = typeof zh_CN;

export type TranslationFunctions = {
  common: {
    save: () => string;
    undo: () => string;
    redo: () => string;
    delete: () => string;
    done: () => string;
    add: () => string;
    selectComponent: () => string;
    searchComponent: () => string;
    placeholder: () => string;
  };
  sidebar: {
    file: () => string;
    agents: () => string;
    assets: () => string;
    tools: () => string;
    variables: () => string;
    collapse: () => string;
    expand: () => string;
    expandProperties: () => string;
    fileTabTooltip: () => string;
    agentsTabTooltip: () => string;
    assetsTabTooltip: () => string;
    toolsTabTooltip: () => string;
    variablesTabTooltip: () => string;
  };
  panels: {
    file: {
      pages: () => string;
      layers: () => string;
      nodeCount: (arg: { count: number }) => string;
      emptyDoc: () => string;
      addComponent: () => string;
    };
    agents: {
      title: () => string;
      description: () => string;
      appKey: () => string;
      manifestVersion: () => string;
      componentTypes: () => string;
      componentCount: (arg: { count: number }) => string;
      status: () => string;
      valid: () => string;
      needsReview: () => string;
      rev: (arg: { rev: number }) => string;
      diagnostics: () => string;
    };
    assets: {
      title: () => string;
      description: (arg: { count: number }) => string;
    };
    tools: {
      modes: () => string;
      visual: () => string;
      text: () => string;
      developer: () => string;
      preview: () => string;
    };
    variables: {
      locales: () => string;
    };
  };
  toolbar: {
    select: () => string;
    interact: () => string;
    pan: () => string;
    zoom: () => string;
    rotate: () => string;
    restoreOrientation: () => string;
  };
  menu: {
    file: () => string;
    edit: () => string;
    view: () => string;
    preferences: () => string;
    theme: () => string;
    language: () => string;
    chinese: () => string;
    english: () => string;
    saveDocument: () => string;
    copyJson: () => string;
    undo: () => string;
    redo: () => string;
    frameSize: () => string;
    orientation: () => string;
    portrait: () => string;
    landscape: () => string;
    rotateOrientation: () => string;
    mobileCategory: () => string;
    tabletCategory: () => string;
    desktopCategory: () => string;
    zoomRatio: (arg: { percent: number }) => string;
    zoomIn: () => string;
    zoomOut: () => string;
    zoom100: () => string;
    shortcuts: () => string;
    light: () => string;
    dark: () => string;
    system: () => string;
    expandSidebar: () => string;
    collapseSidebar: () => string;
    backgroundPattern: () => string;
    canvasSettings: () => string;
  };
  canvasSettings: {
    title: () => string;
    description: () => string;
    background: () => string;
    backgroundDescription: () => string;
    texture: () => string;
    dots: () => string;
    grid: () => string;
  };
  properties: {
    title: () => string;
    empty: () => string;
    layerName: () => string;
    runtimeTitle: () => string;
    runtimeDesc: () => string;
  };
  status: {
    loadingTitle: () => string;
    loadingDesc: () => string;
    standaloneTitle: () => string;
    standaloneDesc: () => string;
    missingServerUrlTitle: () => string;
    missingServerUrlDesc: () => string;
    sessionUnavailableTitle: () => string;
  };
  notices: {
    jsonCopied: () => string;
    saveSent: () => string;
    saveNotPersisted: () => string;
  };
  shortcuts: {
    title: () => string;
    description: () => string;
    visualMode: () => string;
    textMode: () => string;
    developerMode: () => string;
    previewMode: () => string;
    undoRedo: () => string;
    save: () => string;
    copyJson: () => string;
    close: () => string;
  };
};

export type Formatters = Record<string, never>;
