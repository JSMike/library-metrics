import type { UsageQuery, UsageTargetDefinition } from "./types";
import { usageTargets as boxModelUsageTargets } from "./box-model";

const buildKey = (...parts: Array<string | undefined>) =>
  parts.filter((part) => part && part.length > 0).join("/");

export const usageTargets: UsageTargetDefinition[] = [
  ...boxModelUsageTargets,
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
      searchType: query.searchType,
      searchQuery: query.searchQuery,
      regex: query.regex,
      extensions: query.extensions,
      flags: query.flags,
    })),
  ),
);

export type {
  UsageQuery,
  UsageQueryDefinition,
  UsageSubTargetDefinition,
  UsageTargetDefinition,
} from "./types";
