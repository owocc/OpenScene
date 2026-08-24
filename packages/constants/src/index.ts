export const APP_TYPE_WEB = "web";
export const APP_TYPE_REACT_NATIVE = "react-native";
export const APP_TYPE_FLUTTER = "flutter";

export const APP_TYPES = [APP_TYPE_WEB, APP_TYPE_REACT_NATIVE, APP_TYPE_FLUTTER] as const;

export type AppType = (typeof APP_TYPES)[number];

/** DataTransfer MIME type carrying a component type id for drag-and-drop. */
export const COMPONENT_DRAG_MIME = "application/x-openscene-component";
