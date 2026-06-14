import fs from 'fs';
import path from 'path';
import { specs } from '../config/swagger';

/**
 * Write the generated OpenAPI spec to `openapi.json` in the project root.
 * Run with: `npm run openapi`
 * Importable into Postman/Insomnia/Swagger Editor or any OpenAPI 3 tool.
 */
const outputPath = path.resolve(process.cwd(), 'openapi.json');
fs.writeFileSync(outputPath, JSON.stringify(specs, null, 2), 'utf-8');

const pathCount = Object.keys((specs as any)?.paths ?? {}).length;
// eslint-disable-next-line no-console
console.log(`OpenAPI spec written to ${outputPath} (${pathCount} paths)`);
