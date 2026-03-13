const fs = require('fs');
const js = fs.readFileSync('/tmp/main.js', 'utf8');

// The alert "sua sessao expirou. por favor entre" translates from "auth.toasts.sessionExpired" in whaticket.
// The toast text: "Sua sessão expirou, por favor, entre novamente."
const match = js.match(/.{0,50}Sua sessão expirou.{0,50}/g);
console.log(match);
