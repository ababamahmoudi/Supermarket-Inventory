import { useEffect, useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import { useDemo } from "../store";
import {
  Badge,
  Button,
  Card,
  DataTable,
  Dialog,
  DialogActions,
  EmptyState,
  Field,
  Menu,
  MenuItem,
  Select,
} from "../ui";
import { branchLabel } from "../settings";
import { WhatsMissing, type ValidationIssue } from "../WhatsMissing";
import type { RegisteredDevice } from "../authority-types";
import "./people-e1.css";

export default function RegisteredComputers() {
  const { actor, can, t, authorityGeneration } = useDemo();
  if (!actor || !can("devices.manage"))
    return (
      <EmptyState>
        {t(
          "You do not have permission for this action.",
          "اجازهٔ انجام این کار را ندارید.",
        )}
      </EmptyState>
    );
  const identity = JSON.stringify([
    actor.company_id,
    actor.user_id,
    actor.session_id,
    actor.authority_epoch,
    actor.person_version,
    authorityGeneration,
  ]);
  return <RegisteredComputersContent key={identity} identity={identity} />;
}

function RegisteredComputersContent({ identity }: { identity: string }) {
  const {
    state,
    can,
    registeredComputers,
    currentComputerId,
    authorityGeneration,
    authorityDirectoryVersion,
    lang,
    t,
  } = useDemo();
  const [snapshot, setSnapshot] = useState<{
    key: string;
    rows: readonly RegisteredDevice[];
    denied: boolean;
  }>({ key: "", rows: [], denied: false });
  const [editor, setEditor] = useState<RegisteredDevice | "new" | null>(null);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [reason, setReason] = useState("");
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [deactivating, setDeactivating] = useState<RegisteredDevice | null>(
    null,
  );
  const [version, setVersion] = useState(0);
  const listKey = JSON.stringify([
    identity,
    authorityGeneration,
    authorityDirectoryVersion,
    version,
  ]);
  const manageable = can("devices.manage");
  const codeOf = (value: unknown) =>
    value && typeof value === "object" && "code" in value
      ? String(value.code)
      : "permission";
  useEffect(() => {
    let active = true;
    if (manageable)
      void registeredComputers
        .list()
        .then((result) => {
          if (active)
            setSnapshot({ key: listKey, rows: result, denied: false });
        })
        .catch((failure) => {
          if (active && codeOf(failure) !== "session_changed") {
            setSnapshot({ key: listKey, rows: [], denied: true });
            setError(
              t(
                "You do not have permission for this action.",
                "اجازهٔ انجام این کار را ندارید.",
              ),
            );
          }
        });
    return () => {
      active = false;
    };
  }, [registeredComputers, listKey, manageable, t]);
  const denied = snapshot.key === listKey && snapshot.denied;
  if (!manageable || denied)
    return (
      <EmptyState>
        {t(
          "You do not have permission for this action.",
          "اجازهٔ انجام این کار را ندارید.",
        )}
      </EmptyState>
    );
  const rows = snapshot.key === listKey ? snapshot.rows : [];
  const open = (device: RegisteredDevice | "new") => {
    setEditor(device);
    setName(device === "new" ? "" : device.name);
    setLocation(device === "new" ? "" : device.location_id);
    setReason("");
    setIssues([]);
    setError("");
  };
  const save = async () => {
    const next: ValidationIssue[] = [];
    if (!name.trim())
      next.push({
        id: "name",
        fieldId: "computer-name",
        message: t("Name", "نام"),
      });
    if (!location)
      next.push({
        id: "location",
        fieldId: "computer-location",
        message: t("Location", "مکان"),
      });
    if (editor !== "new" && !reason.trim())
      next.push({
        id: "reason",
        fieldId: "computer-reason",
        message: t("Reason", "دلیل"),
      });
    setIssues(next);
    if (next.length || !editor) return;
    setPending(true);
    setError("");
    try {
      if (editor === "new")
        await registeredComputers.register({
          name: name.trim(),
          location_id: location,
        });
      else
        await registeredComputers.edit({
          device_id: editor.id,
          name: name.trim(),
          location_id: location,
          expected_version: editor.version,
          reason: reason.trim(),
        });
      setEditor(null);
      setVersion((value) => value + 1);
    } catch (failure) {
      setError(
        codeOf(failure) === "conflict"
          ? t(
              "This computer changed. Close and open the form again.",
              "این رایانه تغییر کرده است. فرم را ببندید و دوباره باز کنید.",
            )
          : t(
              "You do not have permission for this action.",
              "اجازهٔ انجام این کار را ندارید.",
            ),
      );
    } finally {
      setPending(false);
    }
  };
  const deactivate = async () => {
    if (!deactivating) return;
    if (!reason.trim()) {
      setIssues([
        {
          id: "reason",
          fieldId: "computer-deactivate-reason",
          message: t("Reason", "دلیل"),
        },
      ]);
      return;
    }
    setPending(true);
    setError("");
    try {
      await registeredComputers.deactivate({
        device_id: deactivating.id,
        expected_version: deactivating.version,
        reason: reason.trim(),
      });
      setDeactivating(null);
      setVersion((value) => value + 1);
    } catch (failure) {
      setError(
        codeOf(failure) === "conflict"
          ? t(
              "This computer changed. Close and open the form again.",
              "این رایانه تغییر کرده است. فرم را ببندید و دوباره باز کنید.",
            )
          : t(
              "You do not have permission for this action.",
              "اجازهٔ انجام این کار را ندارید.",
            ),
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <Card>
      <div className="card-heading">
        <h2>{t("Registered store computers", "رایانه‌های ثبت‌شده فروشگاه")}</h2>
        <Button onClick={() => open("new")}>
          <Plus size={16} />
          {t("Register computer", "ثبت رایانه")}
        </Button>
      </div>
      {error && !editor && (
        <p className="banner danger" role="alert">
          {error}
        </p>
      )}
      <DataTable
        columns={[
          { key: "name", required: true, minWidth: 240, priority: 1 },
          { key: "location", priority: 2 },
          { key: "status", priority: 3 },
          { key: "actions", actions: true, required: true },
        ]}
      >
        <thead>
          <tr>
            <th>{t("Name", "نام")}</th>
            <th>{t("Location", "مکان")}</th>
            <th>{t("Status", "وضعیت")}</th>
            <th>{t("Actions", "عملیات")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((device) => (
            <tr key={device.id}>
              <td>
                <bdi dir="auto">{device.name}</bdi>
                {device.id === currentComputerId && (
                  <small className="muted">
                    {t("This computer", "این رایانه")}
                  </small>
                )}
              </td>
              <td>{branchLabel(state.config, device.location_id, lang)}</td>
              <td>
                <Badge tone={device.active ? "approved" : "neutral"}>
                  {device.active
                    ? t("Active", "فعال")
                    : t("Deactivated", "غیرفعال")}
                </Badge>
              </td>
              <td>
                <div className="actions">
                  <Button
                    size="sm"
                    variant="neutral"
                    onClick={() => open(device)}
                  >
                    {t("Edit", "ویرایش")}
                  </Button>
                  <Menu
                    label={t("More actions", "کارهای بیشتر")}
                    iconOnly
                    icon={<MoreHorizontal size={20} />}
                  >
                    <MenuItem
                      disabled={
                        !device.active || device.id === currentComputerId
                      }
                      onClick={() =>
                        void registeredComputers
                          .selectCurrent(device.id)
                          .then(() => setVersion((value) => value + 1))
                          .catch(() =>
                            setError(
                              t(
                                "You do not have permission for this action.",
                                "اجازهٔ انجام این کار را ندارید.",
                              ),
                            ),
                          )
                      }
                    >
                      {t("Use on this computer", "استفاده در این رایانه")}
                    </MenuItem>
                    <MenuItem
                      disabled={!device.active}
                      onClick={() => {
                        setDeactivating(device);
                        setReason("");
                        setError("");
                        setIssues([]);
                      }}
                    >
                      {t("Deactivate", "غیرفعال کردن")}
                    </MenuItem>
                  </Menu>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      <Dialog
        open={Boolean(editor)}
        title={
          editor === "new"
            ? t("Register computer", "ثبت رایانه")
            : t("Edit computer", "ویرایش رایانه")
        }
        onOpenChange={(open) => {
          if (!open && !pending) setEditor(null);
        }}
        className="registered-computer-dialog"
      >
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <WhatsMissing issues={issues} />
          {error && (
            <p className="banner danger" role="alert">
              {error}
            </p>
          )}
          <Field
            label={t("Name", "نام")}
            error={issues.find((item) => item.id === "name")?.message}
          >
            <input
              id="computer-name"
              className="ui-input"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setIssues((current) =>
                  current.filter((item) => item.id !== "name"),
                );
              }}
            />
          </Field>
          <Field
            label={t("Location", "مکان")}
            error={issues.find((item) => item.id === "location")?.message}
          >
            <Select
              id="computer-location"
              value={location}
              onChange={(value) => {
                setLocation(value);
                setIssues((current) =>
                  current.filter((item) => item.id !== "location"),
                );
              }}
              options={[
                {
                  placeholder: true,
                  value: "",
                  label: t("Choose location", "انتخاب مکان"),
                },
                ...state.config.branches
                  .filter((item) => item.active !== false)
                  .map((item) => ({
                    value: item.id ?? item.code,
                    label: branchLabel(
                      state.config,
                      item.id ?? item.code,
                      lang,
                    ),
                  })),
              ]}
            />
          </Field>
          {editor !== "new" && (
            <Field
              label={t("Reason", "دلیل")}
              error={issues.find((item) => item.id === "reason")?.message}
            >
              <textarea
                id="computer-reason"
                className="ui-input"
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  setIssues((current) =>
                    current.filter((item) => item.id !== "reason"),
                  );
                }}
              />
            </Field>
          )}
          <DialogActions>
            <Button
              variant="neutral"
              disabled={pending}
              onClick={() => setEditor(null)}
            >
              {t("Cancel", "انصراف")}
            </Button>
            <Button type="submit" disabled={pending}>
              {t("Save", "ذخیره")}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      {deactivating && (
        <Dialog
          open
          title={t("Deactivate", "غیرفعال کردن")}
          onOpenChange={(open) => {
            if (!open && !pending) setDeactivating(null);
          }}
        >
          <WhatsMissing issues={issues} />
          {error && (
            <p className="banner danger" role="alert">
              {error}
            </p>
          )}
          <Field
            label={t("Reason", "دلیل")}
            error={issues.find((item) => item.id === "reason")?.message}
          >
            <textarea
              id="computer-deactivate-reason"
              className="ui-input"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setIssues([]);
              }}
            />
          </Field>
          <DialogActions>
            <Button
              variant="neutral"
              disabled={pending}
              onClick={() => setDeactivating(null)}
            >
              {t("Cancel", "انصراف")}
            </Button>
            <Button disabled={pending} onClick={() => void deactivate()}>
              {t("Confirm", "تأیید")}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Card>
  );
}
