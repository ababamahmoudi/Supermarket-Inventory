import base from "./playwright.config";
export default {
  ...base,
  use: { ...base.use, baseURL: "http://127.0.0.1:5250" },
  webServer: {
    command: "npm run preview -- --port 5250",
    url: "http://127.0.0.1:5250",
    reuseExistingServer: false,
    timeout: 30000,
  },
};
