import { act } from '@testing-library/react-native';
import { useState } from 'react';
import { Text } from 'react-native';

import { store } from '../global-state/router-store';
import Stack from '../layouts/Stack';
import { withLayoutContext } from '../layouts/withLayoutContext';
import { TabRouter, useNavigationBuilder } from '../react-navigation/native';
import { renderRouter } from '../testing-library';

function nestedState() {
  return store.navigationRef.getRootState().routes[0]!.state!;
}

it('registers every filesystem route when a Stack layout declares a subset', () => {
  renderRouter(
    {
      _layout: () => (
        <Stack>
          <Stack.Screen name="a" />
        </Stack>
      ),
      a: () => <Text>A</Text>,
      b: () => <Text>B</Text>,
      c: () => <Text>C</Text>,
    },
    { initialUrl: '/a' }
  );

  expect(nestedState().routeNames).toEqual(['a', 'b', 'c']);
});

it('keeps Stack route names and keys when layout configuration changes', () => {
  let setConfigured!: (configured: boolean) => void;

  function Layout() {
    const [configured, set] = useState(true);
    setConfigured = set;
    return (
      <Stack>
        <Stack.Screen name="a" options={{ title: configured ? 'First' : 'Updated' }} />
        {configured && <Stack.Screen name="b" />}
      </Stack>
    );
  }

  renderRouter(
    {
      _layout: Layout,
      a: () => <Text>A</Text>,
      b: () => <Text>B</Text>,
      c: () => <Text>C</Text>,
    },
    { initialUrl: '/a' }
  );

  const stateBefore = nestedState();
  const routeKeysBefore = stateBefore.routes.map((route) => route.key);

  act(() => setConfigured(false));

  const stateAfter = nestedState();
  expect(stateAfter.routeNames).toEqual(stateBefore.routeNames);
  expect(stateAfter.key).toBe(stateBefore.key);
  expect(stateAfter.routes.map((route) => route.key)).toEqual(routeKeysBefore);
});

it('keeps Stack route names and navigator key across guard flips', () => {
  let setGuard!: (guard: boolean) => void;

  function Layout() {
    const [guard, set] = useState(true);
    setGuard = set;
    return (
      <Stack>
        <Stack.Protected guard={guard}>
          <Stack.Screen name="a" />
        </Stack.Protected>
      </Stack>
    );
  }

  renderRouter(
    {
      _layout: Layout,
      a: () => <Text>A</Text>,
      b: () => <Text>B</Text>,
      c: () => <Text>C</Text>,
    },
    { initialUrl: '/a' }
  );

  const routeNames = nestedState().routeNames;
  const key = nestedState().key;

  act(() => setGuard(false));
  expect(nestedState().routeNames).toEqual(routeNames);
  expect(nestedState().key).toBe(key);

  act(() => setGuard(true));
  expect(nestedState().routeNames).toEqual(routeNames);
  expect(nestedState().key).toBe(key);
});

it('always gives custom layout-context navigators the full filesystem route set', () => {
  const routeNameSnapshots: string[][] = [];
  let setDeclared!: (declared: boolean) => void;

  const ProbeNavigator = (props: any) => {
    const { state, descriptors, NavigationContent } = useNavigationBuilder(TabRouter, props);
    routeNameSnapshots.push(state.routeNames);
    return (
      <NavigationContent>{descriptors[state.routes[state.index]!.key]!.render()}</NavigationContent>
    );
  };
  const Probe = withLayoutContext(ProbeNavigator);

  function Layout() {
    const [declared, set] = useState(true);
    setDeclared = set;
    return declared ? (
      <Probe>
        <Probe.Screen name="a" />
      </Probe>
    ) : (
      <Probe />
    );
  }

  renderRouter(
    {
      _layout: Layout,
      a: () => <Text>A</Text>,
      b: () => <Text>B</Text>,
      c: () => <Text>C</Text>,
    },
    { initialUrl: '/a' }
  );

  act(() => setDeclared(false));

  expect(routeNameSnapshots.length).toBeGreaterThan(1);
  expect(routeNameSnapshots).toEqual(routeNameSnapshots.map(() => ['a', 'b', 'c']));
});
