// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The `firebase` package's "exports" map conflicts with Metro's package-exports
// resolution (enabled by default), causing runtime errors like "Component auth
// has not been registered yet" on iOS/Android. This is the documented fix.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
