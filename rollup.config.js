import path from "path";
import rollupTypescript from "rollup-plugin-ts";
import autoExternal from "rollup-plugin-auto-external";
import rollupTypes from "rollup-plugin-dts";
import getSortedPackages from "./build/packages";
import { terser } from "rollup-plugin-terser";

const EXTERNAL_DEPS = ["react/jsx-runtime"];

async function main() {
  const config = [];
  const packages = await getSortedPackages();
  packages.forEach((pkg) => {
    const { main, module, types, source, peerDependencies } = pkg.toJSON();
    const basePath = path.relative(__dirname, pkg.location);
    const srcPath = path.join(basePath, "src");
    config.push(
      {
        input: path.join(basePath, source),
        external: externalfromPeerDeps(peerDependencies),
        output: [
          {
            file: path.join(basePath, main),
            format: "cjs",
            sourcemap: true,
          },
          {
            file: path.join(basePath, module),
            format: "esm",
            sourcemap: true,
          },
        ],
        plugins: [
          autoExternal({ packagePath: basePath }),
          rollupTypescript({
            tsconfig: (resolvedConfig) => ({
              ...resolvedConfig,
              rootDir: srcPath,
              include: [srcPath],
            }),
          }),
          terser(),
        ],
      },
      {
        input: path.join(basePath, "src/index.ts"),
        output: [{ file: path.join(basePath, types), format: "es" }],
        plugins: [rollupTypes()],
        sourcemap: true,
      }
    );
  });
  return config;
}

function externalfromPeerDeps(deps = {}) {
  return [...Object.keys(deps), ...EXTERNAL_DEPS];
}

export default main();
