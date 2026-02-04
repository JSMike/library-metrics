import type { UsageTargetDefinition } from "./types";

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
            searchType: "zoekt",
            searchQuery: "<button-box",
            regex: "<button-box",
            extensions: ["html", "js", "ts", "jsx", "tsx"],
            flags: "g",
          },
          {
            queryKey: "markup-ButtonBox",
            queryKeyTitle: "<ButtonBox>",
            searchText: "<ButtonBox",
            searchType: "zoekt",
            searchQuery: "<ButtonBox",
            regex: "<ButtonBox",
            extensions: ["jsx", "tsx"],
            flags: "g",
          },
          {
            queryKey: "import-button",
            queryKeyTitle: "import '@box-model/web/button'",
            searchText: "@box-model/web/button",
            searchType: "zoekt",
            searchQuery: "@box-model/web/button",
            regex: "import\\s+.*from\\s+['\\\"]@box-model\\/web\\/button['\\\"]",
            extensions: ["js", "ts", "jsx", "tsx"],
            flags: "g",
          },
        ],
      },
    ],
  },
];
