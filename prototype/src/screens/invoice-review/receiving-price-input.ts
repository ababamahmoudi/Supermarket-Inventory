import { setInvoiceReceivingPrice } from "../../invoice-receiving-price";
import type { WeightUnit } from "../../weighed";
import type { ReviewUpdate } from "./types";

/** Own keystrokes share returned tokens; other receivers never join this chain. */
export class ReceivingPriceInputQueue {
  private token = "";
  private latest: Promise<boolean> = Promise.resolve(true);
  pending = 0;
  failed = false;
  edited = false;

  refresh(token: string) {
    if (this.pending) return;
    this.token = token;
    this.failed = false;
    this.latest = Promise.resolve(true);
  }

  save(
    update: ReviewUpdate,
    index: number,
    value: string | null,
    unit?: WeightUnit,
  ): Promise<boolean> {
    this.edited = true;
    this.pending++;
    let expected: string | undefined;
    let tentative: string | undefined;
    const restore = () => {
      // A rejected repository commit must not leave an uncommitted token behind.
      if (tentative && this.token === tentative) this.token = expected!;
      this.failed = true;
      return false;
    };
    const saved = update((draft, actor) => {
      expected ??= this.token;
      tentative = setInvoiceReceivingPrice(
        draft,
        actor,
        index,
        value,
        expected,
        undefined,
        unit,
      );
      this.token = tentative;
      return tentative;
    })
      .then((result) => {
        if (typeof result !== "string") return restore();
        this.failed = false;
        return true;
      }, restore)
      .finally(() => {
        this.pending--;
      });
    this.latest = saved;
    return saved;
  }

  async settled() {
    return (await this.latest) && !this.failed;
  }
}
