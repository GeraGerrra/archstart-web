export interface ProductionRedirect {
  source: string;
  destination: string;
  permanent: boolean;
}

export const HOME_ROUTE = "/";
export const COURSE_ROUTE = "/course";
export const DASHBOARD_ROUTE = "/dashboard";
export const REVIEW_ROUTE = "/review";
export const PRIVATE_CERTIFICATE_ROUTE = "/certificate";
export const PROFILE_ROUTE = "/profile";

export const LEGACY_SELECTED_A_ROOT = "/prototype/a";

const PROTECTED_EXACT_PATHS = new Set([
  DASHBOARD_ROUTE,
  REVIEW_ROUTE,
  PRIVATE_CERTIFICATE_ROUTE,
  PROFILE_ROUTE,
  "/onboarding",
  "/auth/update-password",
  `${LEGACY_SELECTED_A_ROOT}/dashboard`,
  `${LEGACY_SELECTED_A_ROOT}/review`,
  `${LEGACY_SELECTED_A_ROOT}/certificate`,
]);

export function isProtectedProductionPath(pathname: string): boolean {
  return PROTECTED_EXACT_PATHS.has(pathname);
}

export function courseModuleRoute(moduleCode: string): string {
  return `${COURSE_ROUTE}/${moduleCode.toLowerCase()}`;
}

export function courseProjectRoute(moduleCode: string): string {
  return `${courseModuleRoute(moduleCode)}/project`;
}

export function courseLessonItemRoute(
  moduleCode: string,
  lessonSlug: string,
  item: string,
): string {
  return `${courseModuleRoute(moduleCode)}/${lessonSlug.toLowerCase()}/${item}`;
}

export function canonicalizeLegacySelectedAPathname(pathname: string): string {
  if (pathname === LEGACY_SELECTED_A_ROOT || pathname === `${LEGACY_SELECTED_A_ROOT}/home`) {
    return HOME_ROUTE;
  }
  if (pathname === `${LEGACY_SELECTED_A_ROOT}/course`) return COURSE_ROUTE;
  if (pathname.startsWith(`${LEGACY_SELECTED_A_ROOT}/course/`)) {
    const courseTail = pathname.slice(`${LEGACY_SELECTED_A_ROOT}/course`.length);
    const legacyMaterialMatch = courseTail.match(/^\/(m0[1-8])\/(l0[1-5])\/(?:slides|transcript)$/iu);
    const moduleCode = legacyMaterialMatch?.[1];
    const lessonCode = legacyMaterialMatch?.[2];
    if (moduleCode && lessonCode) {
      return `${COURSE_ROUTE}/${moduleCode.toLowerCase()}/${lessonCode.toLowerCase()}/lecture-materials`;
    }
    return `${COURSE_ROUTE}${courseTail}`;
  }
  if (pathname === `${LEGACY_SELECTED_A_ROOT}/dashboard`) return DASHBOARD_ROUTE;
  if (pathname === `${LEGACY_SELECTED_A_ROOT}/review`) return REVIEW_ROUTE;
  if (pathname === `${LEGACY_SELECTED_A_ROOT}/certificate`) return PRIVATE_CERTIFICATE_ROUTE;
  return pathname;
}

const COMPATIBILITY_REDIRECTS: readonly ProductionRedirect[] = [
  {
    source: "/prototype/a/course/:moduleCode/:lessonCode/slides",
    destination: "/course/:moduleCode/:lessonCode/lecture-materials",
    permanent: true,
  },
  {
    source: "/prototype/a/course/:moduleCode/:lessonCode/transcript",
    destination: "/course/:moduleCode/:lessonCode/lecture-materials",
    permanent: true,
  },
  {
    source: "/course/:moduleCode/:lessonCode/slides",
    destination: "/course/:moduleCode/:lessonCode/lecture-materials",
    permanent: true,
  },
  {
    source: "/course/:moduleCode/:lessonCode/transcript",
    destination: "/course/:moduleCode/:lessonCode/lecture-materials",
    permanent: true,
  },
  {
    source: "/prototype/a",
    destination: HOME_ROUTE,
    permanent: true,
  },
  {
    source: "/prototype/a/home",
    destination: HOME_ROUTE,
    permanent: true,
  },
  {
    source: "/prototype/a/course",
    destination: COURSE_ROUTE,
    permanent: true,
  },
  {
    source: "/prototype/a/course/:path*",
    destination: "/course/:path*",
    permanent: true,
  },
  {
    source: "/prototype/a/dashboard",
    destination: DASHBOARD_ROUTE,
    permanent: true,
  },
  {
    source: "/prototype/a/review",
    destination: REVIEW_ROUTE,
    permanent: true,
  },
  {
    source: "/prototype/a/certificate",
    destination: PRIVATE_CERTIFICATE_ROUTE,
    permanent: true,
  },
];

export function productionRouteRedirects(): ProductionRedirect[] {
  return COMPATIBILITY_REDIRECTS.map((redirect) => ({ ...redirect }));
}
