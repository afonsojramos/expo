/* eslint-disable @typescript-eslint/no-unused-vars */
import type {
  NativeStackNavigationProp,
  Stack as RootStackValue,
} from 'expo-router';
import type StackEntryDefaultValue from 'expo-router/stack';
import type { Stack as StackEntryNamedValue } from 'expo-router/stack';

import type { ParamListBase } from '../../react-navigation/native';

type RootStack = typeof RootStackValue;
type StackEntryDefault = typeof StackEntryDefaultValue;
type StackEntryNamed = typeof StackEntryNamedValue;
type Navigation = NativeStackNavigationProp<ParamListBase>;
type Expect<T extends true> = T;

declare const Stack: RootStack;
declare const navigation: Navigation;

export type _DefaultEntryMatchesRoot = Expect<StackEntryDefault extends RootStack ? true : false>;
export type _NamedEntryMatchesRoot = Expect<StackEntryNamed extends RootStack ? true : false>;

export function _checkStackTypes() {
  navigation.push('index');
  navigation.replace('index');
  navigation.pop(2);
  navigation.popToTop();

  const layout = (
    <Stack
      ref={null}
      initialRouteName="index"
      screenOptions={({ navigation }) => {
        navigation.push('index');
        navigation.replace('index');
        navigation.popToTop();
        return { title: 'Index' };
      }}
      screenListeners={{
        transitionStart: (event) => event.data.closing,
        transitionEnd: (event) => event.data.closing,
        gestureCancel: (event) => event.target,
        sheetDetentChange: (event) => event.data.index,
      }}>
      <Stack.Screen name="index" listeners={{ transitionEnd: () => {} }} />
      <Stack.Protected guard>
        <Stack.Screen name="protected" />
      </Stack.Protected>
    </Stack>
  );

  // @ts-expect-error internal implementation prop
  const rawState = <Stack rawState={{}} />;
  // @ts-expect-error internal implementation prop
  const dispatch = <Stack dispatch={() => {}} />;
  // @ts-expect-error internal implementation prop
  const pop = <Stack pop={() => {}} />;
  // @ts-expect-error internal implementation prop
  const subscribeTabPress = <Stack subscribeTabPress={() => () => {}} />;

  return { layout, rawState, dispatch, pop, subscribeTabPress };
}

it('keeps the public Stack type contract compileable', () => {
  expect(true).toBe(true);
});
