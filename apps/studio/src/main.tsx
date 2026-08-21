import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import App from "./App.tsx";
import { ThemeProvider } from "@/components/theme-provider.tsx";
import { TypesafeI18n } from "@/i18n";
import { setupPreventPageZoom } from "@/lib/prevent-page-zoom";

setupPreventPageZoom();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <TypesafeI18n>
        <App />
      </TypesafeI18n>
    </ThemeProvider>
  </StrictMode>,
);
