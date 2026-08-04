import { SelectedAHome } from "@/src/prototypes/selected-a/SelectedAPrototype";

export default async function SelectedAHomePage({ searchParams }: { searchParams: Promise<{ state?: string | string[] }> }) {
  const query = await searchParams;
  const state = Array.isArray(query.state) ? query.state[0] : query.state;
  return <SelectedAHome forceModuleMenu={state === "module-menu-open" ? "M01" : null} forceMobileModules={state === "mobile-modules-open"} />;
}
