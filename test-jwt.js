const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const jwt = require('jsonwebtoken');

const secret = process.env.JWT_SECRET;
console.log('JWT_SECRET Length:', secret ? secret.length : 'MISSING');

const testId = '654321098765432109876543'; // 24-char hex string
const token = jwt.sign({ id: testId }, secret, { expiresIn: '1h' });
console.log('Generated Token:', token.substring(0, 15) + '...');

try {
    const decoded = jwt.verify(token, secret);
    console.log('Verification SUCCESS');
    console.log('Decoded ID:', decoded.id);
    if (decoded.id === testId) {
        console.log('MATCH SUCCESS');
    } else {
        console.log('MATCH FAILED');
    }
} catch (err) {
    console.error('Verification FAILED:', err.message);
}
