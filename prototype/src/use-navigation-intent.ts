import { useLayoutEffect, useRef } from "react";

/** A completed command cannot replace a newer route, actor, location or mounted view. */
export function useNavigationIntent(context: string) {
  const current = useRef({ context, generation: 0, mounted: false });
  useLayoutEffect(() => {
    const witness = current.current;
    witness.mounted = true;
    const changed = () => {
      witness.generation += 1;
    };
    window.addEventListener("hashchange", changed);
    return () => {
      witness.mounted = false;
      witness.generation += 1;
      window.removeEventListener("hashchange", changed);
    };
  }, []);
  useLayoutEffect(() => {
    if (current.current.context !== context) {
      current.current.context = context;
      current.current.generation += 1;
    }
  }, [context]);
  return () => {
    const hash = window.location.hash;
    const { generation, context: capturedContext } = current.current;
    return () =>
      current.current.mounted &&
      current.current.generation === generation &&
      current.current.context === capturedContext &&
      window.location.hash === hash;
  };
}
