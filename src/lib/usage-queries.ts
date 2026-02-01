export type UsageQuery = {
  targetKey: string;
  subTargetKey: string;
  queryKey: string;
  regex: string;
  extensions: string[];
  flags?: string;
};

export const usageQueries: UsageQuery[] = [
  {
    targetKey: "box-model",
    subTargetKey: "box-model/button",
    queryKey: "box-model/button/markup-button-box",
    regex: "<button-box",
    extensions: [".html", ".jsx", ".tsx", ".mdx"],
    flags: "g",
  },
  {
    targetKey: "box-model",
    subTargetKey: "box-model/button",
    queryKey: "box-model/button/markup-ButtonBox",
    regex: "<ButtonBox",
    extensions: [".html", ".jsx", ".tsx", ".mdx"],
    flags: "g",
  },
  {
    targetKey: "box-model",
    subTargetKey: "box-model/button",
    queryKey: "box-model/button/import-button",
    regex: "import\\s+.*from\\s+['\\\"]@box-model\\/web\\/button['\\\"]",
    extensions: [".js", ".ts", ".jsx", ".tsx", ".mdx"],
    flags: "g",
  },
];
