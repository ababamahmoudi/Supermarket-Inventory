import { startPwa } from "./pwa-client";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-500.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/manrope/latin-800.css";
import "@fontsource/vazirmatn/arabic-400.css";
import "@fontsource/vazirmatn/arabic-500.css";
import "@fontsource/vazirmatn/arabic-600.css";
import "@fontsource/vazirmatn/arabic-700.css";
import "@fontsource/vazirmatn/arabic-800.css";
import "./styles.css";
import App from "./App";
import { DemoProvider } from "./store";
import { createBrowserProviderOptions } from "./e1-application-options";

// Load both scripts while online so switching language needs no later requests.
if (document.fonts) {
  for (const weight of [400, 500, 600, 700, 800]) {
    void document.fonts.load(`${weight} 16px Manrope`, "Workspace");
    void document.fonts.load(`${weight} 16px Vazirmatn`, "فارسی");
  }
}

const providerOptions = createBrowserProviderOptions();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DemoProvider options={providerOptions}>
      <App />
    </DemoProvider>
  </StrictMode>,
);

void startPwa();
