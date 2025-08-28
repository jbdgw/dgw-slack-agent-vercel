// Safe wrapper for pdf-parse to avoid debug mode issues in serverless environments

let pdfParse: any;

try {
  // Try to import pdf-parse normally first
  pdfParse = require('pdf-parse');
} catch (error) {
  // If that fails, create a mock that throws an informative error
  pdfParse = () => {
    throw new Error('PDF parsing is not available in this environment. Please disable RAG features that require PDF processing.');
  };
}

export default pdfParse;