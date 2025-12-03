import React from "react";
import { Snapshot } from "../components/VeryCoolViz/VeryCoolViz";
import { IndexMetadata, SplitMetadata } from "../utils/models";
import { DebugInfo } from "./VeryCoolVizView";

export const useSystemSnapshot = () => {
  const [snapshot, setSnapshot] = React.useState<Snapshot>();
  React.useEffect(() => {
    const abortController = new AbortController();

    const loop = async () => {
      if (abortController.signal.aborted) return;

      const parseMetrics = (text: string): Record<string, number> =>
        Object.fromEntries(
          [...text.matchAll(/^([^#\s]+)+\s+(.*)$/gm)].map(([, key, value]) => [
            key,
            +value!.trim(),
          ]),
        );

      const [debug, indexes, metrics] = await Promise.all([
        fetch("/api/developer/debug", { signal: abortController.signal })
          .then((res) => res.json())
          .then((d: DebugInfo) => d),

        fetch("/api/v1/indexes", { signal: abortController.signal })
          .then((res) => res.json())
          .then((indexes: IndexMetadata[]) =>
            Promise.all(
              indexes.map((index) =>
                fetch(
                  `/api/v1/indexes/${index.index_config.index_id}/splits?limit=200&split_states=Published,Staged`,
                  {
                    signal: abortController.signal,
                  },
                )
                  .then((res) => res.json())
                  .then(({ splits }: { splits: SplitMetadata[] }) => ({
                    index,
                    splits,
                  })),
              ),
            ),
          ),

        fetch("/metrics", { signal: abortController.signal })
          .then((res) => res.text())
          .then(parseMetrics),
      ]);

      const nodes = Object.values(debug).sort((a, b) =>
        a.node_config.node_id.localeCompare(b.node_config.node_id),
      );

      const indexers = nodes
        .filter((node) => node.node_config.enabled_services.includes("indexer"))
        .map((node) => ({
          nodeId: node.node_config.node_id,
          ingestionRateBytePerSecond: 0,
        }));

      const searchers = nodes
        .filter((node) =>
          node.node_config.enabled_services.includes("searcher"),
        )
        .map((node) => ({
          nodeId: node.node_config.node_id,
          ingestionRateBytePerSecond: 0,
        }));

      const metastores = nodes
        .filter((node) =>
          node.node_config.enabled_services.includes("metastore"),
        )
        .map((node) => ({
          nodeId: node.node_config.node_id,
          ingestionRateBytePerSecond: 0,
        }));

      const controlPlanes = [];

      if (abortController.signal.aborted) return;

      setSnapshot({
        indexers,
        indexes: indexes
          .map(({ index, splits }) => ({
            name: index.index_config.index_id,
            splits: splits
              .map((split) => ({
                uncompressed_docs_size_in_bytes:
                  split.uncompressed_docs_size_in_bytes,
                compressed_docs_size_in_bytes: split.footer_offsets.end,
                node_id: split.node_id,
                split_id: split.split_id,
                time_range: split.time_range!,
                num_docs: split.num_docs,
                num_merge_ops: split.num_merge_ops,
              }))
              .sort((a, b) => a.time_range.start - b.time_range.start),
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        searchers,
        metastores,
        controlPlanes,
        metrics,
      });

      setTimeout(loop, 5000);
    };

    loop();

    return () => {
      abortController.abort("component unmounted");
    };
  }, []);

  return snapshot;
};
