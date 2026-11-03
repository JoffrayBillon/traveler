import { fileURLToPath } from "node:url";

const sourceDirectory = fileURLToPath(new URL("./src/", import.meta.url));
const sourceAliases = [
  "components",
  "features",
  "hooks",
  "i18n",
  "lib",
  "routes",
  "test",
  "theme",
  "types",
];

export const appAliases = [
  {
    find: /^@traveler\/api\//,
    replacement: `${sourceDirectory}api/`,
  },
  ...sourceAliases.map((directory) => ({
    find: new RegExp(`^@traveler/${directory}/`),
    replacement: `${sourceDirectory}${directory}/`,
  })),
  {
    find: "@traveler/router",
    replacement: `${sourceDirectory}router.tsx`,
  },
  {
    find: "@traveler/i18n",
    replacement: `${sourceDirectory}i18n/index.ts`,
  },
];
