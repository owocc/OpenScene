export const APP_TYPE_WEB = "web";

export const APP_TYPES = [APP_TYPE_WEB] as const;

export type AppType = (typeof APP_TYPES)[number];
