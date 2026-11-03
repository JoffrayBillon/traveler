import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import type { TicketBlobStorage } from "./app";

export function createLocalTicketStorage(
  rootDirectory: string,
): TicketBlobStorage {
  const root = resolve(rootDirectory);

  function getPath(pathname: string) {
    const path = resolve(root, pathname);
    const fromRoot = relative(root, path);
    if (!fromRoot || fromRoot === ".." || fromRoot.startsWith(`..${sep}`)) {
      throw new Error("Ticket path is outside the local storage directory.");
    }
    return path;
  }

  return {
    async put(pathname, file) {
      const path = getPath(pathname);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, new Uint8Array(await file.arrayBuffer()), {
        flag: "wx",
      });
    },
    async get(pathname) {
      try {
        const content = await readFile(getPath(pathname));
        return { statusCode: 200, stream: new Blob([content]).stream() };
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          return null;
        }
        throw error;
      }
    },
    async del(pathname) {
      await rm(getPath(pathname), { force: true });
    },
  };
}
