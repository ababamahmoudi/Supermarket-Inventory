import { BrowserAuthorityRepository } from "./authority-repository";
import type { AuthenticatedActor, CommandIdentity } from "./authority-types";
import { freshActor, cloneWithAuthority } from "./authority";
import { can, requireCapability, requireConcreteLocation } from "./permissions";
import {
  projectProductReadDTO,
  type ProductReadDTO,
} from "./catalog-read-model";
import { hasApprovedPriceAtLocation } from "./lookup-branch";
import { effectivePrice } from "./catalog";
import { calculatePackagePrice, type PackageUnit } from "./package-pricing";
import { capturePriceUpdateChanges } from "./price-updates";
import {
  addWeightPackage,
  editWeightPackage,
  archiveWeightPackage,
  packageParentSnapshot,
  WeightPackageError,
  type NewWeightPackageInput,
  type WeightPackageEdits,
} from "./weight-packages";
import type { DemoState } from "./types";

/** Public read API: return only ordinary catalog DTOs, never canonical costs. */
export function readWeightPackages(
  state: DemoState,
  actor: AuthenticatedActor,
  parentCode: string,
): ProductReadDTO[] {
  actor = freshActor(state, actor);
  if (!can(state, actor, "lookup.read").allowed)
    requireCapability(state, actor, "catalog.read");
  const parent = state.products.find(
    (product) =>
      product.company_id === actor.company_id && product.code === parentCode,
  );
  if (!parent || parent.sold_by !== "weight" || parent.package_of_product_id)
    throw new WeightPackageError("parent");
  return state.products
    .filter(
      (product) =>
        product.company_id === actor.company_id &&
        product.package_of_product_id === parentCode &&
        product.status !== "archived",
    )
    .map((product) => projectProductReadDTO(state, actor, product));
}

export function previewWeightPackage(
  state: DemoState,
  actor: AuthenticatedActor,
  parentCode: string,
  size: string,
  unit: PackageUnit,
  branch: string,
  now = new Date(),
) {
  actor = freshActor(state, actor);
  requireCapability(state, actor, "catalog.package_edit", {
    company_id: actor.company_id,
    kind: "company_shared",
  });
  requireConcreteLocation(state, actor, branch);
  const parent = state.products.find(
    (product) =>
      product.company_id === actor.company_id &&
      product.code === parentCode &&
      product.sold_by === "weight" &&
      !product.package_of_product_id &&
      product.status !== "archived",
  );
  if (!parent) throw new WeightPackageError("parent");
  const price = hasApprovedPriceAtLocation(state, parent, branch, now)
    ? effectivePrice(state, parent, branch, now)
    : null;
  if (!price)
    return {
      price: null,
      size_lb: null,
      formula: null,
      cost_before_tax: null,
      margin: null,
    };
  const result = calculatePackagePrice(
    size,
    unit,
    price,
    parent.last_cost_before_tax,
    parent.pricing_category,
    state.config,
  );
  const financial = can(state, actor, "catalog.cost_read", {
    company_id: actor.company_id,
    kind: "company_shared",
  }).allowed;
  return {
    price: result.selling_price,
    size_lb: result.size_lb,
    formula: result.formula,
    cost_before_tax: financial ? result.cost_before_tax : null,
    margin: financial ? result.margin : null,
  };
}

/** Minimal versioned prototype API backed by the actual canonical authority lock. */
export function createPackageService(repository: BrowserAuthorityRepository) {
  const mutate = async (
    identity: CommandIdentity,
    operation: (state: DemoState, actor: AuthenticatedActor) => string,
    now: Date,
  ) => {
    const result = await repository.runBusinessCommand<DemoState, string>(
      identity,
      (state, actor) => {
        const before = cloneWithAuthority(state);
        const code = operation(state, actor);
        capturePriceUpdateChanges(before, state, actor, now);
        return code;
      },
      {
        capability: "catalog.package_edit",
        resource: {
          company_id: identity.company_id,
          kind: "company_shared",
          mutation: true,
        },
      },
      now,
    );
    return {
      product_code: result.value,
      business_revision: result.business.revision,
    };
  };
  return {
    list: async (identity: CommandIdentity, parentCode: string) =>
      (
        await repository.queryBusiness<DemoState, ProductReadDTO[]>(
          identity,
          (state, actor) => readWeightPackages(state, actor, parentCode),
        )
      ).value,
    parentSnapshot: async (identity: CommandIdentity, parentCode: string) =>
      (
        await repository.queryBusiness<DemoState, string>(
          identity,
          (state, actor) => packageParentSnapshot(state, actor, parentCode),
        )
      ).value,
    preview: async (
      identity: CommandIdentity,
      parentCode: string,
      size: string,
      unit: PackageUnit,
      branch: string,
      now = new Date(),
    ) =>
      (
        await repository.queryBusiness(
          identity,
          (state, actor) =>
            previewWeightPackage(
              state as DemoState,
              actor,
              parentCode,
              size,
              unit,
              branch,
              now,
            ),
          undefined,
          now,
        )
      ).value,
    add: (
      identity: CommandIdentity,
      input: NewWeightPackageInput,
      now = new Date(),
    ) =>
      mutate(
        identity,
        (state, actor) => addWeightPackage(state, actor, input, now).code,
        now,
      ),
    edit: (
      identity: CommandIdentity,
      code: string,
      edits: WeightPackageEdits,
      now = new Date(),
    ) =>
      mutate(
        identity,
        (state, actor) =>
          editWeightPackage(state, actor, code, edits, now).code,
        now,
      ),
    archive: (
      identity: CommandIdentity,
      code: string,
      expectedVersion: number,
      reason: string,
      now = new Date(),
    ) =>
      mutate(
        identity,
        (state, actor) => {
          archiveWeightPackage(
            state,
            actor,
            code,
            expectedVersion,
            reason,
            now,
          );
          return code;
        },
        now,
      ),
  };
}
