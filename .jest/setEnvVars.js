process.env.BW_SESSION = 'session';

// Set up default allowed directories for file path validation tests
// Include common test paths used across test files
const path = require('path');
const isWindows = process.platform === 'win32';
const platformDirs = isWindows
  ? 'C:/Users,C:/home/user,C:/path/to,C:/tmp,D:/Backup'
  : '/home/user,/path/to,/tmp';
process.env.BW_ALLOWED_DIRECTORIES = `${process.cwd()},${platformDirs}`;
