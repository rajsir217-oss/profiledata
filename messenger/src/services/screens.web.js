/**
 * Web stub for react-native-screens.
 * On web, screens are just Views.
 */

export const enableScreens = () => {};
export const screensEnabled = () => true;
export const enableFreeze = () => {};

export const Screen = ({ children }) => children;
export const ScreenContainer = ({ children }) => children;
export const NativeScreen = ({ children }) => children;
export const NativeScreenContainer = ({ children }) => children;
export const ScreenStack = ({ children }) => children;
export const ScreenStackHeaderConfig = () => null;

export default {
  enableScreens,
  screensEnabled,
  enableFreeze,
  Screen,
  ScreenContainer,
  NativeScreen,
  NativeScreenContainer,
  ScreenStack,
  ScreenStackHeaderConfig,
};
