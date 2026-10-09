import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/vazirmatn/arabic-400.css";
import "@fontsource/vazirmatn/arabic-500.css";
import "@fontsource/vazirmatn/arabic-600.css";
import "@fontsource/vazirmatn/arabic-700.css";
import "./styles.css";
import App from "./App";
import { DemoProvider } from "./store";

// Load both scripts while online so switching language needs no later requests.
if (document.fonts) {
  for (const weight of [400, 500, 600, 700]) {
    void document.fonts.load(`${weight} 16px Inter`, "Workspace");
    void document.fonts.load(`${weight} 16px Vazirmatn`, "فارسی");
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DemoProvider>
      <App />
    </DemoProvider>
  </StrictMode>,
);
