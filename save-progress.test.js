const { normalizeMobileNumber, buildProgressKey } = require('./game.js');

if (normalizeMobileNumber('+91 98765 43210') !== '919876543210') {
  throw new Error('normalizeMobileNumber failed for Indian mobile format');
}

if (buildProgressKey('9876543210') !== 'snake_game_progress:9876543210') {
  throw new Error('buildProgressKey failed');
}

console.log('save-progress test passed');
