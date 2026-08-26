import { APP_TYPE_WEB, type AppType } from "@openscene-ai/core";
import { useStudioStore } from "@/stores/studio-store";
import type { StyleControlProps } from "./types";
import { WebStyleControl } from "./web";

export * from "./types";
export * from "./web";

export function StyleControl(props: StyleControlProps) {
  const storeAppType = useStudioStore((state) => state.bootstrap?.app.type);
  const effectiveAppType: AppType = props.appType ?? storeAppType ?? APP_TYPE_WEB;

  if (effectiveAppType === APP_TYPE_WEB) {
    return <WebStyleControl {...props} />;
  }

  // Fallback / future extension for react-native or flutter style editors
  return (
    <div className="grid gap-2">
      <WebStyleControl {...props} />
    </div>
  );
}
