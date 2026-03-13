const fs = require('fs');
const js = fs.readFileSync('/tmp/main.js', 'utf8');

// The error is: (await _0x58f13f())[_0x3109ac(0xaec)](_0x5a0cf7=>_0x3109ac(0xc51)===_0x5a0cf7['key'])[_0x3109ac(0xba8)]

// We want to extract what setting keys it uses.
const keys = [];
// find array definitions like ['a', 'b', 'c']
// it's obfuscated, so let's just use string extraction.
const match = js.match(/\[([^\]]+)\]/g);
console.log("Analyzing...");
const stringLiterals = new Set();
const matches = js.matchAll(/['"]([^'"]{4,30})['"]/g);
for (const m of matches) {
   if (m[1].includes('Msg') || m[1].includes('accept') || m[1].includes('Type')) {
      stringLiterals.add(m[1]);
   }
}
console.log(Array.from(stringLiterals).filter(s => s.indexOf(' ') === -1 && s.indexOf('/') === -1));
