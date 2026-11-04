const path = require('node:path');
module.exports = {
  packagerConfig: {
    name: '狗牛',
    executableName: process.platform === 'win32' ? 'DogCow' : '狗牛',
    appBundleId: 'app.dogcow.desktop',
    asar: true,
    icon: path.join(__dirname, 'assets', '狗牛'),
    prune: true,
    ignore: [
      /^\/\.git($|\/)/,
      /^\/\.github($|\/)/,
      /^\/work($|\/)/,
      /^\/build($|\/)/,
      /^\/dist($|\/)/,
      /^\/out($|\/)/,
      /^\/src($|\/)/,
      /^\/tests($|\/)/,
      /^\/scripts($|\/)/,
      /^\/native($|\/)/,
      /^\/app($|\/)/,
      /^\/\.build-dependencies($|\/)/,
    ],
  },
  makers: [
    { name: '@electron-forge/maker-zip', platforms: ['darwin'] },
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: {
        name: 'DogCow',
        authors: 'DogCow contributors',
        description: '狗牛：任务与工作时间计价',
      },
    },
  ],
};
