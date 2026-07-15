'use client';

import { createContext, use, useMemo, type ReactNode } from 'react';

import type { RouteNode } from '../Route';
import { LocalRouteParamsContext, sortRoutesWithInitial } from '../Route';
import { getContextKey, stripInvisibleSegmentsFromPath } from '../matchers';
import type { Href } from '../types';

// `Href` = guarded with a redirect, `null` = guarded with no available destination.
export type GuardRedirect = Href | null;
// Per route name; a missing entry means the route is unguarded.
export type ResolvedGuards = Map<string, GuardRedirect>;

export const GuardContext = createContext<ResolvedGuards | null>(null);

/**
 * Destination used when a guarded route does not provide `redirectTo`.
 */
type GuardRedirectFallback = {
  href: Href;

  /**
   * Filesystem identity of the fallback's target route.
   * `null` represents the synthetic root fallback.
   */
  targetRouteContextKey: string | null;
};

const GuardRedirectFallbackContext = createContext<GuardRedirectFallback[]>([]);

export function useGuardRedirect(
  routeName: string
):
  | { isGuarded: true; redirectHref: GuardRedirect }
  | { isGuarded: false; redirectHref?: undefined } {
  const guards = use(GuardContext);
  if (guards) {
    if (guards.has(routeName)) {
      return { isGuarded: true, redirectHref: guards.get(routeName) ?? null };
    }
    const stripped = routeName.replace(/\/index$/, '');
    if (guards.has(stripped)) {
      return { isGuarded: true, redirectHref: guards.get(stripped) ?? null };
    }
  }
  return { isGuarded: false };
}

function matchesRouteName(route: string, name: string) {
  return route === name || route === `${name}/index` || route.replace(/\/index$/, '') === name;
}

function isRouteGuarded(
  routeName: string,
  guardedRedirects: Map<string, Href | undefined>
): boolean {
  return guardedRedirects.has(routeName) || guardedRedirects.has(routeName.replace(/\/index$/, ''));
}

/**
 * Finds the route used when a guarded screen omits `redirectTo`.
 * Prefers this navigator's unguarded anchor, then its first unguarded route.
 */
function findDefaultRedirectRouteInNavigator(
  navigatorNode: Pick<RouteNode, 'children' | 'initialRouteName'>,
  guardedRedirects: Map<string, Href | undefined>
): RouteNode | undefined {
  const children = [...navigatorNode.children].sort(
    sortRoutesWithInitial(navigatorNode.initialRouteName)
  );
  const anchor = navigatorNode.initialRouteName
    ? children.find((child) => matchesRouteName(child.route, navigatorNode.initialRouteName!))
    : undefined;

  if (anchor && !isRouteGuarded(anchor.route, guardedRedirects)) {
    return anchor;
  }

  return children.find((child) => !isRouteGuarded(child.route, guardedRedirects));
}

function createGuardRedirectFallback(
  route: Pick<RouteNode, 'contextKey'>,
  params: object | undefined
): GuardRedirectFallback {
  const pathname = stripInvisibleSegmentsFromPath(getContextKey(route.contextKey)) || '/';
  return {
    href: Object.keys(params ?? {}).length ? ({ pathname, params } as Href) : (pathname as Href),
    targetRouteContextKey: route.contextKey,
  };
}

function serializeGuardedRedirects(guardedRedirects: Map<string, Href | undefined>): string {
  return JSON.stringify(Array.from(guardedRedirects.entries()));
}

function excludeFallbackTargetingNavigator(
  redirectFallbacks: GuardRedirectFallback[],
  navigatorContextKey: string | undefined
): GuardRedirectFallback[] {
  // Route identity is required because pathless groups can share the same visible URL.
  return redirectFallbacks.filter(
    (fallback) => fallback.targetRouteContextKey !== navigatorContextKey
  );
}

function resolveGuardRedirects(
  guardedRedirects: Map<string, Href | undefined>,
  fallbackHref: Href | undefined
): ResolvedGuards {
  return new Map<string, GuardRedirect>(
    Array.from(
      guardedRedirects,
      ([name, redirectTo]) => [name, redirectTo ?? fallbackHref ?? null] as const
    )
  );
}

export function GuardContextProvider({
  node,
  guardedRedirects,
  children,
}: {
  node: RouteNode | null;
  guardedRedirects: Map<string, Href | undefined>;
  children: ReactNode;
}) {
  const parentRedirectFallbacks = use(GuardRedirectFallbackContext);
  const params = use(LocalRouteParamsContext);
  const guardConfigurationKey = useMemo(
    () => serializeGuardedRedirects(guardedRedirects),
    [guardedRedirects]
  );

  const currentNavigatorFallbackRoute = useMemo(
    () => (node ? findDefaultRedirectRouteInNavigator(node, guardedRedirects) : undefined),
    [guardConfigurationKey, node?.children, node?.initialRouteName]
  );
  const currentNavigatorRedirectFallback = useMemo(
    () =>
      currentNavigatorFallbackRoute
        ? createGuardRedirectFallback(currentNavigatorFallbackRoute, params)
        : node
          ? undefined
          : { href: '/' as Href, targetRouteContextKey: null },
    [currentNavigatorFallbackRoute, node, params]
  );
  const ancestorRedirectFallbacks = useMemo(
    () => excludeFallbackTargetingNavigator(parentRedirectFallbacks, node?.contextKey),
    [node?.contextKey, parentRedirectFallbacks]
  );
  const redirectFallbacks = useMemo(
    () =>
      currentNavigatorRedirectFallback
        ? [currentNavigatorRedirectFallback, ...ancestorRedirectFallbacks]
        : ancestorRedirectFallbacks,
    [ancestorRedirectFallbacks, currentNavigatorRedirectFallback]
  );
  const fallbackHref = redirectFallbacks[0]?.href;
  const resolvedGuards = useMemo(
    () => resolveGuardRedirects(guardedRedirects, fallbackHref),
    [fallbackHref, guardConfigurationKey]
  );

  return (
    <GuardRedirectFallbackContext value={redirectFallbacks}>
      <GuardContext value={resolvedGuards}>{children}</GuardContext>
    </GuardRedirectFallbackContext>
  );
}
