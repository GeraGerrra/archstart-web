import type { ResourcesItemViewModel } from "./types";

export interface ResourcesItemProps {
  model: ResourcesItemViewModel;
}

export function ResourcesItem({ model }: ResourcesItemProps) {
  return <div className="asa-item asa-resources-item"><h2>{model.title}</h2></div>;
}
