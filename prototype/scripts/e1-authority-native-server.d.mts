export interface AuthorityNativeServer {
  url: string;
  directory: string;
  source: {
    files: { path: string; bytes: number; sha256: string }[];
    fingerprint: string;
  };
  compiled: {
    command: string[];
    actualExitCode: number;
    files: { file: string; sha256: string; bytes: number }[];
  };
  assertSourceUnchanged(): Promise<void>;
  close(): Promise<void>;
}

export function createAuthorityNativeServer(): Promise<AuthorityNativeServer>;
