const ncc = require('../dist/ncc/index.js');
const path = require('path');
const { writeFile } = require('fs');

ncc(path.resolve('mailchimp.js'), {
      cache: false,
      externals: [],
      filterAssetBase: process.cwd(),
      minify: true,
      sourceMap: false,
      sourceMapBasePrefix: '../',
      sourceMapRegister: false,
      watch: false,
      v8cache: false,
      quiet: false,
      debugLog: false
    }).then(({ code }) => {
      writeFile('out.js', code, (e) => {
        if (e) {
          console.log('BUILD ERROR');
	  console.log(e);
          process.exit(1)
        } else {
	  console.log('BUILD OK');
	}
      })
    })
      .catch((e) => console.log(e))

