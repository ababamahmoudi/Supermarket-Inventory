import type { ImgHTMLAttributes } from "react";
import { useStoredFile } from "./use-stored-file";

export function StoredFileImage({
  value,
  companyId,
  ...props
}: Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  value?: string;
  companyId: string;
}) {
  const file = useStoredFile(value, companyId);
  return (
    <img
      {...props}
      src={file.url}
      aria-busy={file.loading || undefined}
      data-file-error={file.error || undefined}
    />
  );
}
