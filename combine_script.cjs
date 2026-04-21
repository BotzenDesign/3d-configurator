const fs = require('fs');

let f1 = fs.readFileSync('server/services/fileValidationService.ts', 'utf8');
let f2 = fs.readFileSync('server/services/geometryAnalysisService.ts', 'utf8');
let f3 = fs.readFileSync('server/services/materialEstimationEngine.ts', 'utf8');
let f4 = fs.readFileSync('server/services/pricingService.ts', 'utf8');
let q = fs.readFileSync('supabase/functions/quote/index.ts', 'utf8');

// Strip out existing local imports in pricingService
f4 = f4.replace(/import\s+type\s+\{[^}]+\}\s+from\s+['"\.\/]+[a-zA-Z0-9_\.]+['"];?/g, '');
f4 = f4.replace(/import\s+\{[^}]+\}\s+from\s+['"\.\/]+[a-zA-Z0-9_\.]+['"];?/g, '');

// Strip imports from quote index
q = q.replace(/import\s+\{[^}]+\}\s+from\s+['"\.]+\/server\/services\/[^;]+;/g, '');

const final = `
${f1}

${f2}

${f3}

${f4}

${q}
`;

fs.writeFileSync('SupabaseQuoteMonolith.ts', final);
console.log('File written to SupabaseQuoteMonolith.ts');
