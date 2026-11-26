import type { ReactNode } from "react";
import logo from "../../assets/arzon-logo.png?inline";
import { StoredFileImage } from "./stored-file";
import { useDemo } from "./store";

/** Public company identity only; never retains an actor across an auth step. */
export function AuthHeader({
  title,
  description,
  avatar,
}: {
  title: string;
  description?: ReactNode;
  avatar?: ReactNode;
}) {
  const { state, t } = useDemo();
  return (
    <header className="auth-header">
      {avatar ?? (
        <span className="signin-logo-tile">
          <StoredFileImage
            className="signin-logo"
            value={state.config.company.logo_data ?? logo}
            companyId={state.config.company.seed_key}
            alt={t(state.config.company.name_en, state.config.company.name_fa)}
          />
        </span>
      )}
      <h1>{title}</h1>
      {description && <p className="muted">{description}</p>}
    </header>
  );
}
