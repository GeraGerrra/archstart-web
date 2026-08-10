import type { ReactNode } from "react";
import { SkipLink } from "@/src/design-system";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { ModuleStrip } from "./ModuleStrip";
import type {
  HeaderLabels,
  ModuleNavigationItem,
  ModuleNavigationLabels,
  ShellBrand,
  ShellFooterContent,
  ShellHeaderProgress,
  ShellNavigationItem,
} from "./types";

export interface AppShellProps {
  children: ReactNode;
  brand: ShellBrand;
  navigationItems: readonly ShellNavigationItem[];
  activeNavigationItemId: string;
  headerLabels: HeaderLabels;
  headerProgress?: ShellHeaderProgress;
  modules: readonly ModuleNavigationItem[];
  moduleLabels: ModuleNavigationLabels;
  footer: ShellFooterContent;
  currentModule?: string;
  forceModuleMenu?: string | null;
  forceMobileModules?: boolean;
  defaultExpandedMobileModuleCode?: string;
}

export function AppShell({
  children,
  brand,
  navigationItems,
  activeNavigationItemId,
  headerLabels,
  headerProgress,
  modules,
  moduleLabels,
  footer,
  currentModule,
  forceModuleMenu,
  forceMobileModules,
  defaultExpandedMobileModuleCode,
}: AppShellProps) {
  return (
    <div className="asa" data-direction="a" data-selected-direction="studio-precision">
      <SkipLink href="#asa-main">Перейти к содержанию</SkipLink>
      <Header
        brand={brand}
        navigationItems={navigationItems}
        activeNavigationItemId={activeNavigationItemId}
        labels={headerLabels}
        progress={headerProgress}
      />
      <ModuleStrip
        modules={modules}
        labels={moduleLabels}
        currentModule={currentModule}
        forceOpen={forceModuleMenu}
        forceMobileOpen={forceMobileModules}
        defaultExpandedMobileModuleCode={defaultExpandedMobileModuleCode}
      />
      <main id="asa-main">{children}</main>
      <Footer content={footer} />
    </div>
  );
}
