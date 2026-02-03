export type UsageQueryDefinition = {
  queryKey: string;
  queryKeyTitle: string;
  searchText?: string;
  regex: string;
  extensions: string[];
  flags?: string;
};

export type UsageSubTargetDefinition = {
  subTargetKey: string;
  subTargetTitle: string;
  queries: UsageQueryDefinition[];
};

export type UsageTargetDefinition = {
  targetKey: string;
  targetTitle: string;
  targetDependency: string;
  sourceProjects?: string[];
  subTargets: UsageSubTargetDefinition[];
};

export type UsageQuery = {
  targetKey: string;
  targetTitle: string;
  subTargetKey: string;
  subTargetTitle: string;
  queryKey: string;
  queryKeyTitle: string;
  searchText?: string;
  regex: string;
  extensions: string[];
  flags?: string;
};

const buildKey = (...parts: Array<string | undefined>) =>
  parts.filter((part) => part && part.length > 0).join("/");

export const usageTargets: UsageTargetDefinition[] = [
  {
    targetKey: "box-model-web",
    targetTitle: "@box-model/web",
    targetDependency: "@box-model/web",
    sourceProjects: ["michael.cebrian-group/box-model.dev"],
    subTargets: [
      {
        subTargetKey: "button",
        subTargetTitle: "@box-model/web/button",
        queries: [
          {
            queryKey: "markup-button-box",
            queryKeyTitle: "<button-box>",
            searchText: "<button-box",
            regex: "<button-box",
            extensions: ["html", "js", "ts", "jsx", "tsx"],
            flags: "g",
          },
          {
            queryKey: "markup-ButtonBox",
            queryKeyTitle: "<ButtonBox>",
            searchText: "<ButtonBox",
            regex: "<ButtonBox",
            extensions: ["jsx", "tsx"],
            flags: "g",
          },
          {
            queryKey: "import-button",
            queryKeyTitle: "import '@box-model/web/button'",
            searchText: "@box-model/web/button",
            regex: "import\\s+.*from\\s+['\\\"]@box-model\\/web\\/button['\\\"]",
            extensions: ["js", "ts", "jsx", "tsx"],
            flags: "g",
          },
        ],
      },
    ],
  },
];

export const usageQueries: UsageQuery[] = usageTargets.flatMap((target) =>
  target.subTargets.flatMap((subTarget) =>
    subTarget.queries.map((query) => ({
      targetKey: target.targetKey,
      targetTitle: target.targetTitle,
      subTargetKey: buildKey(target.targetKey, subTarget.subTargetKey),
      subTargetTitle: subTarget.subTargetTitle,
      queryKey: buildKey(
        target.targetKey,
        subTarget.subTargetKey,
        query.queryKey,
      ),
      queryKeyTitle: query.queryKeyTitle,
      searchText: query.searchText,
      regex: query.regex,
      extensions: query.extensions,
      flags: query.flags,
    })),
  ),
);
