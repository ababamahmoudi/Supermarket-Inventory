import { Fragment } from "react";
import { selectMatchParts } from "./select-search";

export function SelectMatch({
  value,
  query,
}: {
  value: string;
  query: string;
}) {
  return (
    <>
      {selectMatchParts(value, query).map((part, index) =>
        part.match ? (
          <mark className="ui-select-match" key={index}>
            {part.text}
          </mark>
        ) : (
          <Fragment key={index}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}
