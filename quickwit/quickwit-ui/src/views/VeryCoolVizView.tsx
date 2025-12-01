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
import {
  Selection,
  Snapshot,
  VeryCoolViz,
} from "../components/VeryCoolViz/VeryCoolViz";

export const VeryCoolVizView = () => {
  const systemSnapshot = useSystemSnapshot();
  const [selected, setSelected] = React.useState<Selection>(null);

  return (
    <ViewUnderAppBarBox sx={{ flexDirection: "row" }}>
      {systemSnapshot && (
        <VeryCoolViz
          snapshot={systemSnapshot}
          onSelect={setSelected}
          selected={selected}
        />
      )}
      {!systemSnapshot && <Loader />}
    </ViewUnderAppBarBox>
  );
};

const useSystemSnapshot = () => {
  const [snapshot, setSnapshot] = React.useState<Snapshot>();
  React.useEffect(() => {
    const quickwitClient = new Client();
    const abortController = new AbortController();

    const loop = async () => {
      if (abortController.signal.aborted) return;

      const res = await fetch("/ui/api-debug-example.json").then((res) =>
        res.json(),
      );

      const indexers = Object.keys(res)
        .filter((name) => name.includes("indexer-"))
        .map((nodeId) => ({ nodeId, ingestionRateBytePerSecond: 0 }));

      if (abortController.signal.aborted) return;

      setSnapshot({ indexers, indexes: [] });

      setTimeout(loop, 3_000);
    };

    loop();

    return () => {
      abortController.abort();
    };
  }, [setSnapshot]);

  return snapshot;
};

export default VeryCoolVizView;
