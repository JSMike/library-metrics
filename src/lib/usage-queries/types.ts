export type UsageQueryDefinition = {
  queryKey: string;
  queryKeyTitle: string;
  searchText?: string;
  searchType?: "zoekt";
  searchQuery?: string;
  regex?: string;
  extensions?: string[];
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
  targetDependency: string | true;
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
  searchType?: "zoekt";
  searchQuery?: string;
  regex?: string;
  extensions?: string[];
  flags?: string;
};
