'use client';

import { createContext, use, useMemo, type ReactNode } from 'react';

import type { RouteNode } from '../Route';
import { sortRoutesWithInitial } from '../Route';
import { getContextKey, stripInvisibleSegmentsFromPath } from '../matchers';
import type { Href } from '../types';

// `Href` = guarded with a redirect, `null` = guarded with no available destination.
export type GuardRedirect = Href | null;
// Per route name; a missing entry means the route is unguarded.
export type ResolvedGuards = Map<string, GuardRedirect>;

export const GuardContext = createContext<ResolvedGuards | null>(null);

export function useGuardRedirect(
  routeName: string
):
  | { hasRedirect: true; redirectHref: GuardRedirect }
  | { hasRedirect: false; redirectHref?: undefined } {
  const guards = use(GuardContext);
  if (guards) {
    // `has`-based lookups so a `null` value (guarded, no destination) is not
    // mistaken for a missing entry (unguarded).
    if (guards.has(routeName)) {
      return { hasRedirect: true, redirectHref: guards.get(routeName) ?? null };
    }
    const stripped = routeName.replace(/\/index$/, '');
    if (guards.has(stripped)) {
      return { hasRedirect: true, redirectHref: guards.get(stripped) ?? null };
    }
  }
  return { hasRedirect: false };
}

function matchesRouteName(route: string, name: string) {
  return route === name || route === `${name}/index` || route.replace(/\/index$/, '') === name;
}

function routeNodeToHref(route: Pick<RouteNode, 'contextKey'>): Href {
  return (stripInvisibleSegmentsFromPath(getContextKey(route.contextKey)) || '/') as Href;
}

function serializeGuardedRedirects(guardedRedirects: Map<string, Href | undefined>): string {
  return Array.from(guardedRedirects.entries())
    .map(([name, href]) => `${name}=${href ?? ''}`)
    .join('|');
}

function resolveDefaultHref(
  node: Pick<RouteNode, 'children' | 'initialRouteName'>,
  guardedRedirects: Map<string, Href | undefined>
) {
  const children = [...node.children].sort(sortRoutesWithInitial(node.initialRouteName));
  const anchor = node.initialRouteName
    ? children.find((child) => matchesRouteName(child.route, node.initialRouteName!))
    : null;

  if (
    anchor &&
    !guardedRedirects.has(anchor.route) &&
    !guardedRedirects.has(anchor.route.replace(/\/index$/, ''))
  ) {
    return routeNodeToHref(anchor);
  }

  const firstAvailable = children.find(
    (child) =>
      !guardedRedirects.has(child.route) &&
      !guardedRedirects.has(child.route.replace(/\/index$/, ''))
  );

  return firstAvailable ? routeNodeToHref(firstAvailable) : undefined;
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
  const signature = useMemo(() => serializeGuardedRedirects(guardedRedirects), [guardedRedirects]);

  const resolved = useMemo(() => {
    const defaultHref = node
      ? resolveDefaultHref(
          { children: node.children, initialRouteName: node.initialRouteName },
          guardedRedirects
        )
      : '/';

    return new Map<string, GuardRedirect>(
      Array.from(
        guardedRedirects,
        ([name, redirectTo]) => [name, redirectTo ?? defaultHref ?? null] as const
      )
    );
  }, [signature, node?.children, node?.initialRouteName]);

  return <GuardContext value={resolved}>{children}</GuardContext>;
}
