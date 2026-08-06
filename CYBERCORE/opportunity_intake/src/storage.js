import { open, readFile, readdir, rename, rm, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { StorageError } from "./errors.js";

export const STAGE_DIRECTORIES = Object.freeze([
  "incoming",
  "normalized",
  "validated",
  "strategic_queue",
  "commercial_pipeline",
  "archive",
  "events",
  "authorizations",
  "runs",
]);

export async function ensureDirectoryLayout(baseDir) {
  await Promise.all(STAGE_DIRECTORIES.map((directory) => (
    mkdir(path.join(baseDir, directory), { recursive: true })
  )));
}

export async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw new StorageError(`Unable to read JSON file: ${filePath}`, { filePath }, error);
  }
}

export async function writeJsonAtomic(filePath, value) {
  const directory = path.dirname(filePath);
  await mkdir(directory, { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(temporaryPath, filePath);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {});
    throw new StorageError(`Unable to atomically write JSON file: ${filePath}`, { filePath }, error);
  }
}

export async function appendJsonLine(filePath, value) {
  const directory = path.dirname(filePath);
  await mkdir(directory, { recursive: true });
  let handle;
  try {
    handle = await open(filePath, "a", 0o600);
    await handle.write(`${JSON.stringify(value)}\n`, null, "utf8");
    await handle.sync();
  } catch (error) {
    throw new StorageError(`Unable to append event file: ${filePath}`, { filePath }, error);
  } finally {
    await handle?.close().catch(() => {});
  }
}

export async function listJsonFiles(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => path.join(directory, entry.name))
      .sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw new StorageError(`Unable to list JSON files: ${directory}`, { directory }, error);
  }
}

export async function loadRecords(directory) {
  const files = await listJsonFiles(directory);
  const records = [];
  for (const filePath of files) {
    const value = await readJson(filePath);
    if (value) records.push(value);
  }
  return records;
}

export async function acquireExclusiveLock(baseDir, lockName = "opportunity-intake") {
  const lockPath = path.join(baseDir, "runs", `.${lockName}.lock`);
  await mkdir(path.dirname(lockPath), { recursive: true });
  let handle;
  try {
    handle = await open(lockPath, "wx", 0o600);
    await handle.write(`${JSON.stringify({ pid: process.pid, acquired_at: new Date().toISOString() })}\n`);
    await handle.sync();
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new StorageError(
        "An opportunity-intake operation is already running or a stale lock exists",
        { lockPath, recovery: `Confirm no process is active, then remove ${lockPath}` },
        error,
      );
    }
    throw new StorageError("Unable to acquire opportunity-intake lock", { lockPath }, error);
  }

  let released = false;
  return async () => {
    if (released) return;
    released = true;
    await handle.close();
    await rm(lockPath, { force: true });
  };
}

export function recordFilePath(baseDir, stage, recordId) {
  if (!STAGE_DIRECTORIES.includes(stage)) {
    throw new StorageError(`Unknown stage directory: ${stage}`, { stage });
  }
  if (!/^opp_[a-f0-9]{24}$/.test(recordId)) {
    throw new StorageError("Refusing unsafe or malformed opportunity record ID", { recordId });
  }
  return path.join(baseDir, stage, `${recordId}.json`);
}

export async function removeRecordFile(baseDir, stage, recordId) {
  const filePath = recordFilePath(baseDir, stage, recordId);
  try {
    await rm(filePath, { force: true });
  } catch (error) {
    throw new StorageError(`Unable to remove stale stage record: ${filePath}`, { filePath }, error);
  }
}
