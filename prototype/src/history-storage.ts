/** Lossless representation deduplication for large immutable History values.
 * Active business state stays ordinary JSON. Every bound value expands before
 * any permission, Undo, conflict or projection logic can inspect it. */
const archiveKey = "prototype_history_dictionary";
const bindingMinimum = 1024;
type Node =
  | ["value", null | boolean | number | string]
  | ["array", Node[]]
  | ["object", [string, Node][]]
  | ["ref", number];
type Path = (string | number)[];
interface HistoryDictionary {
  version: 1;
  blocks: Node[];
  bindings: Path[];
  integrity: string;
}
// This detects accidental corruption; it is not authentication or a signature.
export function historyStorageChecksum(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++)
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}
const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
export class HistoryStorageError extends Error {
  constructor() {
    super("The saved History dictionary is invalid.");
    this.name = "HistoryStorageError";
  }
}
function atPath(root: unknown, path: Path): unknown {
  let value = root;
  for (const key of path) {
    if ((!object(value) && !Array.isArray(value)) || !Object.hasOwn(value, key))
      throw new HistoryStorageError();
    value = (value as Record<string | number, unknown>)[key];
  }
  return value;
}
function setPath(root: unknown, path: Path, value: unknown) {
  const parent = atPath(root, path.slice(0, -1));
  (parent as Record<string | number, unknown>)[path.at(-1)!] = value;
}
function permittedBinding(path: unknown): path is Path {
  if (!Array.isArray(path) || !Number.isInteger(path[0]) || path[0] < 0)
    return false;
  if (path.length === 2) return path[1] === "before" || path[1] === "after";
  if (path[1] !== "reversal" || !Number.isInteger(path[2]) || path[2] < 0)
    return false;
  if (path.length === 4)
    return [
      "before",
      "after",
      "transfer_events",
      "transfer_movements",
    ].includes(path[3]);
  return (
    path.length === 6 &&
    path[3] === "guards" &&
    Number.isInteger(path[4]) &&
    path[4] >= 0 &&
    path[5] === "after"
  );
}
export function encodeHistoryStorage<T>(input: T): T {
  if (!object(input) || !Array.isArray(input.activity)) return input;
  if (Object.hasOwn(input, archiveKey)) throw new HistoryStorageError();
  const activity = structuredClone(input.activity);
  const dictionary: HistoryDictionary = {
    version: 1,
    blocks: [],
    bindings: [],
    integrity: "",
  };
  const shared = new Map<string, number>();
  const encode = (value: unknown, depth = 0): Node => {
    if (depth > 128) throw new HistoryStorageError();
    const text = JSON.stringify(value);
    const previous = shared.get(text);
    if (previous !== undefined) return ["ref", previous];
    let node: Node;
    if (Array.isArray(value))
      node = ["array", value.map((child) => encode(child, depth + 1))];
    else if (object(value))
      node = [
        "object",
        Object.entries(value).map(([key, child]) => [
          key,
          encode(child, depth + 1),
        ]),
      ];
    else if (
      value === null ||
      typeof value === "boolean" ||
      typeof value === "string" ||
      (typeof value === "number" && Number.isFinite(value))
    )
      node = ["value", value];
    else throw new HistoryStorageError();
    if (text.length >= 96) {
      const index = dictionary.blocks.length;
      dictionary.blocks.push(node);
      shared.set(text, index);
      return ["ref", index];
    }
    return node;
  };
  const bind = (path: Path) => {
    const original = atPath(activity, path);
    if (
      original === undefined ||
      JSON.stringify(original).length < bindingMinimum
    )
      return;
    // Normalize exactly as ordinary JSON persistence already does (undefined
    // object fields omitted), then encode without altering the active object.
    const value = JSON.parse(JSON.stringify(original));
    const node = encode(value);
    if (node[0] !== "ref") throw new HistoryStorageError();
    setPath(activity, path, { __c6_history_ref: node[1] });
    dictionary.bindings.push(path);
  };
  activity.forEach((entry: unknown, index: number) => {
    if (!object(entry)) return;
    for (const name of ["before", "after"])
      if (Object.hasOwn(entry, name)) bind([index, name]);
    if (!Array.isArray(entry.reversal)) return;
    entry.reversal.forEach((patch: unknown, patchIndex: number) => {
      if (!object(patch)) return;
      for (const name of [
        "before",
        "after",
        "transfer_events",
        "transfer_movements",
      ])
        if (Object.hasOwn(patch, name))
          bind([index, "reversal", patchIndex, name]);
      if (Array.isArray(patch.guards))
        patch.guards.forEach((guard: unknown, guardIndex: number) => {
          if (object(guard) && Object.hasOwn(guard, "after"))
            bind([
              index,
              "reversal",
              patchIndex,
              "guards",
              guardIndex,
              "after",
            ]);
        });
    });
  });
  if (!dictionary.bindings.length) return input;
  dictionary.integrity = historyStorageChecksum({
    blocks: dictionary.blocks,
    bindings: dictionary.bindings,
    activity,
  });
  const encoded = { ...input, activity, [archiveKey]: dictionary };
  // Small histories need no representation change. Keep the archive only when
  // its complete serialized form is actually smaller.
  return JSON.stringify(encoded).length < JSON.stringify(input).length
    ? (encoded as T)
    : input;
}
export function decodeHistoryStorage(input: unknown): unknown {
  if (!object(input) || !Object.hasOwn(input, archiveKey)) return input;
  const archive = input[archiveKey];
  if (
    !object(archive) ||
    archive.version !== 1 ||
    !Array.isArray(archive.blocks) ||
    !Array.isArray(archive.bindings) ||
    !Array.isArray(input.activity) ||
    typeof archive.integrity !== "string"
  )
    throw new HistoryStorageError();
  if (
    Object.keys(archive).some(
      (key) => !["version", "blocks", "bindings", "integrity"].includes(key),
    )
  )
    throw new HistoryStorageError();
  const blocks = archive.blocks;
  if (
    archive.integrity !==
    historyStorageChecksum({
      blocks,
      bindings: archive.bindings,
      activity: input.activity,
    })
  )
    throw new HistoryStorageError();
  const validated = new Set<number>();
  const validate = (node: unknown, ancestors: Set<number>, depth = 0): void => {
    if (depth > 128 || !Array.isArray(node) || node.length !== 2)
      throw new HistoryStorageError();
    const [kind, value] = node;
    if (kind === "ref") {
      if (
        !Number.isInteger(value) ||
        value < 0 ||
        value >= blocks.length ||
        ancestors.has(value)
      )
        throw new HistoryStorageError();
      if (!validated.has(value)) {
        validate(blocks[value], new Set([...ancestors, value]), depth + 1);
        validated.add(value);
      }
    } else if (kind === "value") {
      if (!(
        value === null ||
        typeof value === "string" ||
        typeof value === "boolean" ||
        (typeof value === "number" && Number.isFinite(value))
      ))
        throw new HistoryStorageError();
    } else if (kind === "array") {
      if (!Array.isArray(value)) throw new HistoryStorageError();
      value.forEach((child) => validate(child, ancestors, depth + 1));
    } else if (kind === "object") {
      if (!Array.isArray(value)) throw new HistoryStorageError();
      const names = new Set<string>();
      value.forEach((pair) => {
        if (
          !Array.isArray(pair) ||
          pair.length !== 2 ||
          typeof pair[0] !== "string" ||
          names.has(pair[0])
        )
          throw new HistoryStorageError();
        names.add(pair[0]);
        validate(pair[1], ancestors, depth + 1);
      });
    } else throw new HistoryStorageError();
  };
  blocks.forEach((node, index) => validate(node, new Set([index])));
  const decode = (node: Node): unknown => {
    if (node[0] === "ref") return decode(blocks[node[1]] as Node);
    if (node[0] === "value") return node[1];
    if (node[0] === "array") return node[1].map(decode);
    return Object.fromEntries(
      node[1].map(([key, value]) => [key, decode(value)]),
    );
  };
  const result: Record<string, unknown> & { activity: unknown[] } = {
    ...input,
    activity: structuredClone(input.activity),
  };
  const bound = new Set<string>();
  for (const path of archive.bindings) {
    if (!permittedBinding(path)) throw new HistoryStorageError();
    const label = JSON.stringify(path);
    if (bound.has(label)) throw new HistoryStorageError();
    bound.add(label);
    const placeholder = atPath(result.activity, path);
    if (
      !object(placeholder) ||
      Object.keys(placeholder).length !== 1 ||
      !Object.hasOwn(placeholder, "__c6_history_ref")
    )
      throw new HistoryStorageError();
    const index = placeholder.__c6_history_ref;
    if (
      typeof index !== "number" ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= blocks.length
    )
      throw new HistoryStorageError();
    setPath(result.activity, path, decode(blocks[index] as Node));
  }
  delete result[archiveKey];
  return result;
}
