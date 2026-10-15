import { useState } from "react";
import { useDemo } from "./store";
import { Button, Field, SegmentedControl } from "./ui";

/** Rendered before every business route; incomplete setup never receives an actor. */
export default function SecondSignInStep() {
  const {
    authStage,
    secondStepMethod,
    setupSecondStep,
    completeSecondStep,
    signOut,
    state,
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
    <section className="sign-in-card" aria-labelledby="second-sign-in-title">
      <h1 id="second-sign-in-title">
        {setup
          ? t("Choose a second sign-in step", "انتخاب مرحلهٔ دوم ورود")
          : t("Second sign-in step", "مرحلهٔ دوم ورود")}
      </h1>
      <p className="muted">
        {t(
          "Simulated in this prototype",
          "در این نمونهٔ آزمایشی شبیه‌سازی شده است",
        )}
      </p>
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
        <Button type="submit" disabled={pending}>
          {selected === "passkey"
            ? t("Use simulated passkey", "استفاده از کلید ورود شبیه‌سازی‌شده")
            : t("Continue", "ادامه")}
        </Button>
        <Button
          variant="neutral"
          disabled={pending}
          onClick={() => void signOut()}
        >
          {t("Sign out", "خروج")}
        </Button>
      </form>
    </section>
  );
}
