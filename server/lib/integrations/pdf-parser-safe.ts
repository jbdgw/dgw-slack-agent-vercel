// Safe wrapper for pdf-parse to avoid debug mode issues
// This module imports just the core parsing function without the debug wrapper

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// Import the core pdf-parse module directly (bypassing the debug wrapper in index.js)
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

export default pdfParse;