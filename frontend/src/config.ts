import seedConfig from "../../seed/arzon-config.json";

type CompanyConfig = {
  name: string;
  name_en?: string;
  name_fa?: string;
  logo_file: string;
  timezone: string;
  branding?: { primary_color?: string; primary_hover_color?: string };
};

export const company: CompanyConfig = seedConfig.company;

// Vite bundles only the public logo named by the configuration. No credentials
// or operational records are loaded into the app shell.
const logos = import.meta.glob("../../assets/*.{png,svg,jpg,jpeg}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

export const companyLogo = logos[`../../${company.logo_file}`];

export function applyBrandTokens() {
  if (company.branding?.primary_color) {
    document.documentElement.style.setProperty(
      "--brand",
      company.branding.primary_color,
    );
  }
  if (company.branding?.primary_hover_color) {
    document.documentElement.style.setProperty(
      "--brand-hover",
      company.branding.primary_hover_color,
    );
  }
}
