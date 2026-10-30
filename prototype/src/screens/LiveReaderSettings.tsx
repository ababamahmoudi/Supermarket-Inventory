import { useEffect, useRef, useState } from "react";
import {
  defaultReaderAddress,
  getLiveReaderSettings,
  normalizeReaderAddress,
  ReaderAddressError,
  saveLiveReaderSettings,
  testReaderConnection,
  type LiveReadingMode,
  type ReaderConnectionResult,
} from "../live-reader-settings";
import { useSettingsConfiguration } from "../settings-configuration";
import { useDemo } from "../store";
import { Button, Card, Field, Select } from "../ui";
import { useNavigationIntent } from "../use-navigation-intent";

export default function LiveReaderSettings() {
  const config = useSettingsConfiguration();
  return (
    <ReadingSettingsForm
      key={JSON.stringify([
        config.receiving.ai_reading_mode,
        config.receiving.ai_reader_address,
      ])}
    />
  );
}

function ReadingSettingsForm() {
  const { actor, authorityGeneration, command, t } = useDemo();
  const captureConnectionIntent = useNavigationIntent(
    JSON.stringify([
      actor?.company_id,
      actor?.user_id,
      actor?.session_id,
      actor?.authority_epoch,
      actor?.person_version,
      actor?.selection,
      authorityGeneration,
    ]),
  );
  const config = useSettingsConfiguration();
  const canonical = getLiveReaderSettings(config.receiving);
  const retainedAddress =
    config.receiving.ai_reader_address == null
      ? null
      : typeof config.receiving.ai_reader_address === "string"
        ? config.receiving.ai_reader_address.trim()
          ? config.receiving.ai_reader_address
          : null
        : canonical.readerAddress;
  const [mode, setMode] = useState<LiveReadingMode>(canonical.mode);
  const [address, setAddress] = useState<string | null>(retainedAddress);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connection, setConnection] = useState<ReaderConnectionResult | null>(
    null,
  );
  const connectionRequest = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      connectionRequest.current?.abort();
      connectionRequest.current = null;
    },
    [],
  );
  const shownAddress = address ?? defaultReaderAddress();
  const dirty = mode !== canonical.mode || address !== retainedAddress;
  function clearConnection() {
    connectionRequest.current?.abort();
    connectionRequest.current = null;
    setTesting(false);
    setConnection(null);
    setError("");
  }
  const addressError = () =>
    t(
      "Use an http:// or https:// reader address without a username, password, query or fragment.",
      "از نشانی خواننده با http:// یا https:// و بدون نام کاربری، رمز عبور، پرس‌وجو یا بخش پایانی استفاده کنید.",
    );
  async function save() {
    setPending(true);
    setError("");
    try {
      await command(
        "settings.manage",
        {
          company_id: config.company.seed_key,
          kind: "company_shared",
          mutation: true,
        },
        (draft, actor) =>
          saveLiveReaderSettings(draft, actor, {
            mode,
            readerAddress: address,
          }),
      );
    } catch (failure) {
      setError(
        failure instanceof ReaderAddressError
          ? addressError()
          : t(
              "Reading settings could not be saved. Check your access and try again.",
              "تنظیمات خواندن ذخیره نشد. دسترسی خود را بررسی و دوباره تلاش کنید.",
            ),
      );
    } finally {
      setPending(false);
    }
  }
  async function testConnection() {
    clearConnection();
    try {
      normalizeReaderAddress(shownAddress);
    } catch {
      setError(addressError());
      return;
    }
    const controller = new AbortController();
    const isCurrent = captureConnectionIntent();
    connectionRequest.current = controller;
    setTesting(true);
    try {
      const result = await testReaderConnection(
        shownAddress,
        controller.signal,
      );
      if (connectionRequest.current === controller && isCurrent())
        setConnection(result);
    } catch {
      // A changed address, closed page or new identity cancels this result.
    } finally {
      if (connectionRequest.current === controller) {
        connectionRequest.current = null;
        setTesting(false);
      }
    }
  }
  return (
    <Card
      className="settings-form-card settings-reader-card"
      title={t("AI reading", "خواندن با هوش مصنوعی")}
      data-testid="reader-settings-card"
    >
      <div className="settings-reader-fields">
        <Field
          className="settings-reader-mode"
          label={t("Reading mode", "حالت خواندن")}
        >
          <Select
            aria-label={t("Reading mode", "حالت خواندن")}
            value={mode}
            disabled={pending}
            onChange={(value) => {
              setMode(value as LiveReadingMode);
              clearConnection();
            }}
            options={[
              { value: "simulated", label: t("Simulated", "شبیه‌سازی‌شده") },
              { value: "live", label: t("Live", "زنده") },
            ]}
          />
        </Field>
        <Field
          className="settings-reader-address"
          label={t("Reader address", "نشانی خواننده")}
          hint={t(
            "localhost means this device. On a phone, use the reader computer’s address on the same Wi-Fi.",
            "localhost یعنی همین دستگاه. در تلفن، از نشانی رایانهٔ خواننده در همان وای‌فای استفاده کنید.",
          )}
        >
          <input
            type="url"
            dir="ltr"
            value={shownAddress}
            disabled={pending}
            onChange={(event) => {
              setAddress(event.target.value);
              clearConnection();
            }}
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
      </div>
      <div className="actions settings-reader-actions">
        <Button
          variant="neutral"
          disabled={pending}
          aria-label={t("Reset reader address", "بازنشانی نشانی خواننده")}
          onClick={() => {
            setAddress(null);
            clearConnection();
          }}
        >
          {t("Reset", "بازنشانی")}
        </Button>
        <Button
          variant="neutral"
          disabled={pending || testing}
          onClick={testConnection}
        >
          {testing
            ? t("Testing connection…", "در حال آزمایش اتصال…")
            : t("Test connection", "آزمایش اتصال")}
        </Button>
      </div>
      {dirty && (
        <div className="actions settings-reader-save">
          <Button
            variant="neutral"
            disabled={pending}
            onClick={() => {
              setMode(canonical.mode);
              setAddress(retainedAddress);
              clearConnection();
            }}
          >
            {t("Cancel", "لغو")}
          </Button>
          <Button disabled={pending} onClick={save}>
            {pending
              ? t("Saving…", "در حال ذخیره…")
              : t("Save changes", "ذخیره تغییرات")}
          </Button>
        </div>
      )}
      <div aria-live="polite" className="settings-reader-status">
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {connection?.ok && (
          <p>{t("Connected · reader ready", "متصل · خواننده آماده است")}</p>
        )}
        {connection && !connection.ok && (
          <p>
            {connection.reason === "http"
              ? t(
                  `The reader answered with HTTP ${connection.status}. Check the reader address and restart npm run serve on the Mac.`,
                  `خواننده پاسخ HTTP ${connection.status} داد. نشانی خواننده را بررسی و npm run serve را روی مک دوباره اجرا کنید.`,
                )
              : t(
                  `Can't reach the reader at ${shownAddress}. Is npm run serve running on the Mac, and is this device on the same Wi-Fi? The reader may also need to allow this page's address.`,
                  `دسترسی به خواننده در ${shownAddress} ممکن نیست. آیا npm run serve روی مک اجرا می‌شود و این دستگاه به همان وای‌فای متصل است؟ شاید لازم باشد خواننده نشانی این صفحه را نیز مجاز کند.`,
                )}
          </p>
        )}
      </div>
    </Card>
  );
}
