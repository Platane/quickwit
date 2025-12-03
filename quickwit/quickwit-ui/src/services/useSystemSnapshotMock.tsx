import React from "react";
import { Snapshot } from "../components/VeryCoolViz/VeryCoolViz";

export const useSystemSnapshot = () => {
  const [snapshot, setSnapshot] = React.useState<Snapshot>();
  React.useEffect(() => {
    const abortController = new AbortController();

    const indexers = Array.from({ length: 30 }, (_, i) => ({
      nodeId: `indexer-${i}`,
    }));

    const searchers = Array.from({ length: 10 }, (_, i) => ({
      nodeId: `searchers-${i}`,
    }));

    const metastores = Array.from({ length: 2 }, (_, i) => ({
      nodeId: `metastore-${i}`,
    }));

    const controlPlanes = [];

    const indexes = Array.from({ length: 1 }, (_, i) => ({
      name: `index-${i}`,
      splits: Array.from({ length: 10 }, (_, i) => {
        const now = Date.now() / 1000;
        const end = now - Math.random() * 10 * 60;
        const start = end - (Math.random() + 0.5) * 5 * 60;

        return {
          split_id: `split-${i}`,
          node_id:
            indexers[Math.floor(Math.random() * indexers.length)]!.nodeId,
          time_range: { start, end },
          num_merge_ops: 0,
          create_timestamp: now,
          num_docs: Math.floor(Math.random() * 10_000),
        };
      }).sort((a, b) => a.time_range.start - b.time_range.start),
    }));

    const loop = async () => {
      if (abortController.signal.aborted) return;

      for (const index of indexes) {
        for (const indexer of indexers) {
          if (Math.random() < 0.3) {
            const now = Date.now() / 1000;
            const end = now;
            const start = end - (Math.random() + 0.5) * 0.1 * 60;

            index.splits.push({
              split_id: `split-${index.splits.length}-${Math.random()}`,
              node_id: indexer.nodeId,
              time_range: { start, end },
              num_merge_ops: 0,
              create_timestamp: now,
              num_docs: Math.floor(Math.random() * 10_000),
            });
          }
        }

        index.splits.sort((a, b) => a.create_timestamp - b.create_timestamp);
      }

      setSnapshot({
        indexers,
        searchers,
        metastores,
        controlPlanes,
        metrics: {},
        indexes: indexes
          .slice()
          .map((x) => ({ ...x, splits: x.splits.slice() })),
      });

      setTimeout(loop, 1000);
    };

    loop();

    return () => {
      abortController.abort("component unmounted");
    };
  }, []);

  return snapshot;
};
