import { getPackages } from "@lerna/project";
import { filterPackages } from "@lerna/filter-packages";
import { PackageGraph } from "@lerna/package-graph";

async function getSortedPackages(scope, ignore) {
  const packages = await getPackages(__dirname);
  const filtered = filterPackages(packages, scope, ignore, false);
  return batchPackages(filtered).flatMap((b) => b);
}

function batchPackages(packagesToBatch) {
  const graph = new PackageGraph(packagesToBatch);
  const [cyclePaths, cycleNodes] = graph.partitionCycles();
  const batches = [];

  if (cyclePaths.size) {
    graph.prune(...cycleNodes);
  }

  // pick the current set of nodes _without_ localDependencies (aka it is a "source" node)
  while (graph.size) {
    const vals = Array.from(graph.values());
    const batch = vals.filter((node) => node.localDependencies.size === 0);
    batches.push(batch.map((node) => node.pkg));
    graph.prune(...batch);
  }

  // isolate cycles behind a single-package batch of the cyclical package with the most dependents
  if (cycleNodes.size) {
    const [king, ...rats] = Array.from(cycleNodes)
      .sort((a, b) => b.localDependents.size - a.localDependents.size)
      .map((node) => node.pkg);
    batches.push([king]);
    batches.push(rats);
  }

  return batches;
}

export default getSortedPackages;
