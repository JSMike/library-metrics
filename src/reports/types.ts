export type ReportDefinition = {
  reportId: string;
  title: string;
  description: string;
};

export type ReportModule<TData = unknown> = {
  definition: ReportDefinition;
  loadData: () => Promise<TData>;
  Component: (props: { data: TData; definition: ReportDefinition }) => JSX.Element;
};
