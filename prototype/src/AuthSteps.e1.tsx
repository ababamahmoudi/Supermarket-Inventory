import { useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { AuthHeader } from "./AuthHeader";
import { configuredRoleLabel } from "./people-presentation.e1";
import { useDemo } from "./store";
import { Badge, Button, Field, SegmentedControl } from "./ui";

/** Rendered before every business route; incomplete setup never receives an actor. */
export default function SecondSignInStep() {
  const {
    authStage,
    secondStepMethod,
    setupSecondStep,
    completeSecondStep,
    signOut,
    state,
    user,
    t,
  } = useDemo();
  const [method, setMethod] = useState<"passkey" | "authenticator">(
    secondStepMethod ?? "passkey",
  );
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const setup = authStage === "second_step_setup";
  const selected = setup ? method : secondStepMethod;
  const finish = async () => {
    setError("");
    setPending(true);
    try {
      if (setup) {
        const failure = await setupSecondStep(method);
        if (failure) {
          setError(
            t(
              "Complete the second sign-in step.",
              "مرحلهٔ دوم ورود را کامل کنید.",
            ),
          );
          return;
        }
      }
      const failure = await completeSecondStep(
        selected === "passkey" ? "simulated-passkey" : response,
      );
      if (failure)
        setError(
          t(
            "Enter the correct simulated code.",
            "کد شبیه‌سازی‌شدهٔ درست را وارد کنید.",
          ),
        );
    } finally {
      setPending(false);
    }
  };
  return (
    <section className="auth-second-step">
      <AuthHeader
        title={
          setup
            ? t("Choose a second sign-in step", "انتخاب مرحلهٔ دوم ورود")
            : t("Confirm it's you", "تأیید هویت")
        }
        description={t(
          `${user?.name_en ?? user?.name ?? ""} needs a second step to open ${configuredRoleLabel(state.config, user?.role ?? "manager", "en").toLowerCase()} tools.`,
          "برای ابزارهای مدیر یک مرحلهٔ دوم لازم است.",
        )}
      />
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!pending) void finish();
        }}
      >
        {setup && (
          <SegmentedControl
            value={method}
            onChange={(value) => {
              setMethod(value as "passkey" | "authenticator");
              setError("");
            }}
            options={[
              { value: "passkey", label: t("Passkey", "کلید ورود") },
              {
                value: "authenticator",
                label: t("Authenticator app code", "کد برنامهٔ احراز هویت"),
              },
            ]}
          />
        )}
        <div className="auth-step-explanation">
          <span className="auth-step-icon">
            {selected === "passkey" ? (
              <KeyRound size={26} aria-hidden="true" />
            ) : (
              <ShieldCheck size={26} aria-hidden="true" />
            )}
          </span>
          <div>
            <strong>
              {selected === "passkey"
                ? t("Use your passkey", "از کلید ورود استفاده کنید")
                : t(
                    "Use your authenticator app",
                    "از برنامهٔ احراز هویت استفاده کنید",
                  )}
            </strong>
            <span className="muted">
              {selected === "passkey"
                ? t(
                    "Your device asks for your fingerprint, face or PIN.",
                    "دستگاه اثر انگشت، چهره یا پین می‌خواهد.",
                  )
                : t(
                    "Enter the code from your authenticator app.",
                    "کد برنامهٔ احراز هویت را وارد کنید.",
                  )}
            </span>
          </div>
        </div>
        {selected === "authenticator" && (
          <Field
            label={t("Authenticator app code", "کد برنامهٔ احراز هویت")}
            error={error}
          >
            <input
              className="ui-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={response}
              onChange={(event) => {
                setResponse(event.target.value);
                setError("");
              }}
            />
            <small className="muted">
              {t("Demo code", "کد نمایشی")}:{" "}
              {state.config.session.simulated_authenticator_code}
            </small>
          </Field>
        )}
        {selected === "passkey" && error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" className="signin-submit" disabled={pending}>
          {selected === "passkey"
            ? t("Continue with passkey", "ادامه با کلید ورود")
            : t("Continue", "ادامه")}
        </Button>
        <p className="auth-simulated-note">
          <Badge>{t("Simulated", "شبیه‌سازی")}</Badge>
          <span>
            {selected === "passkey"
              ? t(
                  "In this prototype the passkey is simulated.",
                  "در این نمونه کلید ورود شبیه‌سازی شده است.",
                )
              : t(
                  "In this prototype the authenticator code is simulated.",
                  "در این نمونه کد احراز هویت شبیه‌سازی شده است.",
                )}
          </span>
        </p>
        <Button
          variant="plain"
          className="auth-secondary"
          disabled={pending}
          onClick={() => void signOut()}
        >
          {t("Sign in as someone else", "ورود با حساب دیگر")}
        </Button>
      </form>
    </section>
  );
}
