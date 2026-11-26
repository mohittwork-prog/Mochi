// Runs after electron-builder packages the Mac app.
// Without an Apple Developer ID certificate, the app would ship with a broken signature,
// which macOS reports as "damaged". Re-sign every part of the app (ad-hoc) and verify it.
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  if (process.env.CSC_LINK) return; // a real Developer ID certificate already signed it properly
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  console.log('  • ad-hoc signing', app);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', app], { stdio: 'inherit' });
};
