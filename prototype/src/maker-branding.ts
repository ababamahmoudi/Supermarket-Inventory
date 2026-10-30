import sourceConfig from "../../seed/arzon-config.json" with { type: "json" };

export type MakerIdentity = {
  name: string;
  /** Owner of configured logo/icon files; renaming a maker must not relabel old assets. */
  asset_identity?: string;
  enabled?: boolean;
  logo_file?: string;
  logo_dark_file?: string;
  mark_file?: string;
  favicon_file?: string;
  icon_192_file?: string;
  icon_512_file?: string;
};
export type MakerBranding = {
  maker: MakerIdentity | null;
  maker_support?: string;
};
export type MakerConfig = { branding?: MakerBranding };

/** Public presentation defaults only; reading old stores never migrates records. */
export function configuredMaker(config: MakerConfig): MakerIdentity | null {
  const maker = (config.branding ?? sourceConfig.branding).maker;
  if (!maker?.name.trim() || maker.enabled === false) return null;
  if (
    !maker.asset_identity ||
    maker.asset_identity.trim().toLocaleLowerCase() ===
      maker.name.trim().toLocaleLowerCase()
  )
    return maker;
  return {
    ...maker,
    logo_file: undefined,
    logo_dark_file: undefined,
    mark_file: undefined,
    favicon_file: undefined,
    icon_192_file: undefined,
    icon_512_file: undefined,
  };
}

export function makerSupport(config: MakerConfig): string {
  return configuredMaker(config)
    ? ((config.branding ?? sourceConfig.branding).maker_support?.trim() ?? "")
    : "";
}

/** Brand files are public presentation assets, resolved under the app base path. */
export function makerAsset(path: string): string {
  if (/^(?:https?:\/\/|data:image\/)/i.test(path)) return path;
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}

export function makerPageTitle(
  config: MakerConfig & { company: { name_en: string; name_fa: string } },
  language: "en" | "fa",
): string {
  const name =
    language === "fa" ? config.company.name_fa : config.company.name_en;
  const maker = configuredMaker(config);
  return maker ? `${name} · ${maker.name}` : name;
}

export function synchronizeMakerIcons(config: MakerConfig, target: Document) {
  const maker = configuredMaker(config);
  const favicon = maker?.favicon_file ?? "icons/company-192.png";
  const touch = maker?.icon_192_file ?? "icons/company-192.png";
  for (const [selector, path] of [
    ['link[rel="icon"]', favicon],
    ['link[rel="apple-touch-icon"]', touch],
  ]) {
    const link = target.querySelector<HTMLLinkElement>(selector);
    if (!link) continue;
    link.href = makerAsset(path);
    if (selector === 'link[rel="icon"]')
      link.type = path.endsWith(".svg") ? "image/svg+xml" : "image/png";
  }
}
