import { Text } from 'react-native';

import { withLayoutContext } from '../layouts/withLayoutContext';
import { NativeTabs } from '../native-tabs/NativeTabs';
import { TabRouter, useNavigationBuilder, type RouteSource } from '../react-navigation/native';
import { renderRouter } from '../testing-library';
import { TabList, TabTrigger, useTabsWithChildren } from '../ui';

// Records descriptors so tests can assert on `routeSource`. Uses TabRouter so
// every route is present in state (and therefore described) from the start.
let recordedDescriptors: Record<string, any> = {};

const ProbeNavigator = (props: any) => {
  const { state, descriptors, NavigationContent } = useNavigationBuilder(TabRouter, props);
  recordedDescriptors = descriptors;
  return <NavigationContent>{descriptors[state.routes[state.index]!.key]!.render()}</NavigationContent>;
};

const Probe = withLayoutContext(ProbeNavigator);

function descriptorByRouteName(
  name: string
): { route: { name: string }; routeSource?: RouteSource } | undefined {
  return Object.values(recordedDescriptors).find((descriptor) => descriptor.route.name === name);
}

beforeEach(() => {
  recordedDescriptors = {};
});

it('marks layout-declared screens as layout and filesystem-only screens as filesystem', () => {
  renderRouter(
    {
      _layout: () => (
        <Probe>
          <Probe.Screen name="a" />
        </Probe>
      ),
      a: () => <Text testID="a">A</Text>,
      b: () => <Text testID="b">B</Text>,
    },
    { initialUrl: '/a' }
  );

  expect(descriptorByRouteName('a')?.routeSource).toBe('layout');
  expect(descriptorByRouteName('b')?.routeSource).toBe('filesystem');
});

it('marks screens declared by name matching an index file as layout', () => {
  renderRouter(
    {
      _layout: () => (
        <Probe>
          <Probe.Screen name="c" />
        </Probe>
      ),
      'c/index': () => <Text testID="c">C</Text>,
      d: () => <Text testID="d">D</Text>,
    },
    { initialUrl: '/c' }
  );

  expect(descriptorByRouteName('c/index')?.routeSource).toBe('layout');
  expect(descriptorByRouteName('d')?.routeSource).toBe('filesystem');
});

it('marks all screens as filesystem when the layout declares none', () => {
  renderRouter(
    {
      _layout: () => <Probe />,
      a: () => <Text testID="a">A</Text>,
      b: () => <Text testID="b">B</Text>,
    },
    { initialUrl: '/a' }
  );

  expect(descriptorByRouteName('a')?.routeSource).toBe('filesystem');
  expect(descriptorByRouteName('b')?.routeSource).toBe('filesystem');
});

it('keeps layout provenance for screens behind a failing guard', () => {
  renderRouter(
    {
      _layout: () => (
        <Probe>
          <Probe.Protected guard={false}>
            <Probe.Screen name="a" />
          </Probe.Protected>
        </Probe>
      ),
      a: () => <Text testID="a">A</Text>,
      b: () => <Text testID="b">B</Text>,
    },
    { initialUrl: '/b' }
  );

  expect(descriptorByRouteName('a')?.routeSource).toBe('layout');
  expect(descriptorByRouteName('b')?.routeSource).toBe('filesystem');
});

it('marks screens declared with NativeTabs.Trigger as layout', () => {
  renderRouter(
    {
      _layout: () => (
        <Probe>
          <NativeTabs.Trigger name="a" />
        </Probe>
      ),
      a: () => <Text testID="a">A</Text>,
      b: () => <Text testID="b">B</Text>,
    },
    { initialUrl: '/a' }
  );

  expect(descriptorByRouteName('a')?.routeSource).toBe('layout');
  expect(descriptorByRouteName('b')?.routeSource).toBe('filesystem');
});

it('marks screens declared with headless TabTrigger as layout', () => {
  function Layout() {
    const children = (
      <TabList>
        <TabTrigger name="a" href="/a" />
      </TabList>
    );
    const { descriptors, NavigationContent } = useTabsWithChildren({ children });
    recordedDescriptors = descriptors;
    return <NavigationContent>{children}</NavigationContent>;
  }

  renderRouter(
    {
      _layout: Layout,
      a: () => <Text testID="a">A</Text>,
      b: () => <Text testID="b">B</Text>,
    },
    { initialUrl: '/a' }
  );

  expect(descriptorByRouteName('a')?.routeSource).toBe('layout');
});
