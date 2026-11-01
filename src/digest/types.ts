export type RunStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  // ISO timestamps retain the offset from the log.
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string;
  rows: DigestRow[];
  badLines: number;
};

// The reader contract, implemented in ./read.ts:
//   readNight(runsDir: string, night: string): Night | null
// null means no file; otherwise rows are job-sorted (empty means no valid rows), and badLines counts parse failures.
export type ReadNight = (runsDir: string, night: string) => Night | null;
