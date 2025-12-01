// Copyright 2021-Present Datadog, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import React from "react";
import { ViewUnderAppBarBox } from "../components/LayoutUtils";
import Loader from "../components/Loader";
import { Client } from "../services/client";
import { SplitMetadata } from "../utils/models";
import * as styles from "./VeryCoolVizView.module.css";

export const VeryCoolVizView = () => {
  const data = useData();

  if (!data) return <Loader />;

  console.log(
    data,
    data.map((s) => [...new Set(s.splits.map((s) => s.maturity.type))]),
  );

  const index_width = 100;

  const timeScale = 0.2; // s per drawing unit
  const now = Date.now() / 1000;

  return (
    <ViewUnderAppBarBox sx={{ flexDirection: "row" }}>
      <svg
        className={styles.viz}
        style={{ width: "100%", height: "100%" }}
        viewBox={[-20, -20, index_width * data.length + 20 * 2, 400].join(" ")}
        preserveAspectRatio="xMidYMid meet"
      >
        <title>very cool viz</title>
        {data.map(({ indexName, splits }, i) => (
          <g key={indexName} transform={`translate(${i * index_width},0)`}>
            <rect
              width={index_width - 10}
              height={100}
              x={5}
              fill="#aaa"
            ></rect>
            <text x={5} y={5} style={{ fontSize: 5 }}>
              {indexName}
            </text>

            {splits.map((s, i) => (
              <g key={s.split_id}>
                <rect
                  title={`split_id:${s.split_id}`}
                  className={styles.split}
                  width={index_width - 20}
                  x={10 + i}
                  y={(now - s.time_range!.end) * timeScale}
                  height={(s.time_range?.end - s.time_range!.start) * timeScale}
                  fill={
                    (s.split_state === "Published" && "#888") ||
                    (s.split_state === "MarkedForDeletion" && "red")
                  }
                ></rect>
              </g>
            ))}
          </g>
        ))}
      </svg>
    </ViewUnderAppBarBox>
  );
};

const useData = () => {
  const [splits, setSplits] = React.useState<
    {
      indexName: string;
      splits: SplitMetadata[];
    }[]
  >();
  React.useEffect(() => {
    const quickwitClient = new Client();
    const abortController = new AbortController();

    const loop = async () => {
      if (abortController.signal.aborted) return;

      const indexes = await quickwitClient.listIndexes();

      const data = await Promise.all(
        indexes.map(async (index) => {
          const splits = await quickwitClient.getAllSplits(
            index.index_config.index_id,
          );

          splits.sort(
            (a, b) => (b.time_range?.end ?? 1) - (a.time_range?.end ?? 1),
          );

          return { indexName: index.index_config.index_id, splits };
        }),
      );

      if (abortController.signal.aborted) return;
      setSplits(data);

      setTimeout(loop, 3_000);
    };

    loop();

    return () => {
      abortController.abort();
    };
  }, [setSplits]);

  return splits;
};

export default VeryCoolVizView;
