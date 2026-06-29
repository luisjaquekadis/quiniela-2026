const crypto = require("crypto");
// fallback
let hash = 0;
const password = "Kimi_1506";
for (let i = 0; i < password.length; i++) {
  hash = (hash << 5) - hash + password.charCodeAt(i);
  hash |= 0;
}
console.log("Fallback Hash:", "fallback_" + hash);

// crypto 
const hashBuffer = crypto.createHash('sha256').update(password).digest();
const hashHex = Array.from(hashBuffer).map(b => b.toString(16).padStart(2, '0')).join('');
console.log("SHA-256 Hash:", hashHex);
