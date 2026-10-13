import type {
  BusinessState,
  CommandRequest,
  DeviceInput,
  RegisteredDevice,
} from "./authority-types";
import {
  bindAuthoritySnapshot,
  configuredLocations,
  resolveActor,
} from "./authority";
import {
  snapshotOf,
  type AuthorityDocument,
  type MutableAuthorityRepository,
} from "./authority-document";
import { newAuthorityId } from "./credentials";
import { requireCapability } from "./permissions";

export class DeviceError extends Error {
  constructor(
    readonly code: "name" | "location" | "device" | "conflict" | "reason",
  ) {
    super(code);
    this.name = "DeviceError";
  }
}
export interface DeviceDependencies {
  repository: MutableAuthorityRepository;
  now?: () => Date;
  createId?: (prefix: string) => string;
}
function authorized(
  state: BusinessState,
  document: AuthorityDocument,
  identity: CommandRequest<unknown>["identity"],
  now: Date,
) {
  bindAuthoritySnapshot(state, snapshotOf(document));
  const actor = resolveActor(state, identity, now);
  requireCapability(
    state,
    actor,
    "devices.manage",
    { company_id: document.company_id, kind: "company_shared", mutation: true },
    now,
  );
  return actor;
}
function validateInput(state: BusinessState, input: DeviceInput) {
  const name = input.name.trim();
  if (!name) throw new DeviceError("name");
  if (
    !configuredLocations(state).some(
      (location) =>
        location.id === input.location_id && location.active !== false,
    )
  )
    throw new DeviceError("location");
  return { name, location_id: input.location_id };
}

export function createDevicesService(dependencies: DeviceDependencies) {
  const { repository } = dependencies;
  const clock = dependencies.now ?? (() => new Date());
  const id = dependencies.createId ?? newAuthorityId;
  return {
    async listDevices(request: CommandRequest<Record<string, never>>) {
      const now = clock();
      const result = await repository.transaction(
        request.identity.company_id,
        (document, state) => {
          authorized(state, document, request.identity, now);
          return structuredClone(
            document.devices.filter(
              (device) => device.company_id === document.company_id,
            ),
          );
        },
      );
      return result.value;
    },
    async registerDevice(request: CommandRequest<DeviceInput>) {
      const now = clock();
      const result = await repository.transaction(
        request.identity.company_id,
        (document, state) => {
          const actor = authorized(state, document, request.identity, now);
          const input = validateInput(state, request.input);
          const device_id = request.input.device_id ?? id("device");
          if (document.devices.some((device) => device.id === device_id))
            throw new DeviceError("device");
          const device: RegisteredDevice = {
            id: device_id,
            company_id: document.company_id,
            ...input,
            active: true,
            version: 1,
            registered_at: now.toISOString(),
            registered_by_user_id: actor.user_id,
          };
          document.devices.push(device);
          document.directory_version++;
          document.audit.push({
            id: id("device-audit"),
            company_id: document.company_id,
            actor_user_id: actor.user_id,
            actor_role_snapshot: actor.role,
            actor_name_snapshot: actor.actor,
            entity_type: "device",
            entity_id: device.id,
            action: "Register computer",
            reason: "",
            at: now.toISOString(),
            before: null,
            after: structuredClone(device),
          });
          return structuredClone(device);
        },
      );
      return result.value;
    },
    async editDevice(
      request: CommandRequest<DeviceInput & { device_id: string }>,
    ) {
      const now = clock();
      const result = await repository.transaction(
        request.identity.company_id,
        (document, state) => {
          const actor = authorized(state, document, request.identity, now);
          const previous = document.devices.find(
            (device) =>
              device.id === request.input.device_id &&
              device.company_id === document.company_id,
          );
          if (!previous) throw new DeviceError("device");
          if (previous.version !== request.input.expected_version)
            throw new DeviceError("conflict");
          if (!request.input.reason?.trim()) throw new DeviceError("reason");
          const input = validateInput(state, request.input);
          const device: RegisteredDevice = {
            ...structuredClone(previous),
            ...input,
            version: previous.version + 1,
          };
          document.devices[document.devices.indexOf(previous)] = device;
          document.directory_version++;
          document.audit.push({
            id: id("device-audit"),
            company_id: document.company_id,
            actor_user_id: actor.user_id,
            actor_role_snapshot: actor.role,
            actor_name_snapshot: actor.actor,
            entity_type: "device",
            entity_id: device.id,
            action: "Edit computer",
            reason: request.input.reason.trim(),
            at: now.toISOString(),
            before: structuredClone(previous),
            after: structuredClone(device),
          });
          return structuredClone(device);
        },
      );
      return result.value;
    },
    async deactivateDevice(
      request: CommandRequest<{
        device_id: string;
        expected_version: number;
        reason: string;
      }>,
    ) {
      const now = clock();
      const result = await repository.transaction(
        request.identity.company_id,
        (document, state) => {
          const actor = authorized(state, document, request.identity, now);
          const previous = document.devices.find(
            (device) =>
              device.id === request.input.device_id &&
              device.company_id === document.company_id,
          );
          if (!previous) throw new DeviceError("device");
          if (previous.version !== request.input.expected_version)
            throw new DeviceError("conflict");
          if (!request.input.reason.trim()) throw new DeviceError("reason");
          const device: RegisteredDevice = {
            ...structuredClone(previous),
            active: false,
            version: previous.version + 1,
          };
          document.devices[document.devices.indexOf(previous)] = device;
          document.directory_version++;
          document.audit.push({
            id: id("device-audit"),
            company_id: document.company_id,
            actor_user_id: actor.user_id,
            actor_role_snapshot: actor.role,
            actor_name_snapshot: actor.actor,
            entity_type: "device",
            entity_id: device.id,
            action: "Deactivate computer",
            reason: request.input.reason.trim(),
            at: now.toISOString(),
            before: structuredClone(previous),
            after: structuredClone(device),
          });
          return structuredClone(device);
        },
      );
      return result.value;
    },
    async currentDevice(company_id: string, device_id: string) {
      const result = await repository.transaction(company_id, (document) =>
        structuredClone(
          document.devices.find(
            (device) =>
              device.id === device_id &&
              device.company_id === company_id &&
              device.active,
          ) ?? null,
        ),
      );
      return result.value;
    },
  };
}
