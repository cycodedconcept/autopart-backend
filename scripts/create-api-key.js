const { parseArgs } = require('node:util');
const { createDependencies } = require('../src/app');
const { closePool } = require('../src/config/database');
const { createApiKeySchema } = require('../src/validators/api-keys.validator');
async function run() {
  try {
    const { values } = parseArgs({ options: { name: { type: 'string' } }, strict: true });
    const { value, error } = createApiKeySchema.validate({ body: { name: values.name }, params: {}, query: {} });
    if (error) throw new Error('Usage: npm run apikey:create -- --name "Partner name"');
    const result = await createDependencies().apiKeysService.create(value.body);
    process.stdout.write(`${result.key}\n`);
  } catch (_error) {
    // Do not print database errors: they can contain bound parameters.
    process.stderr.write('API key creation failed. Check --name, database configuration and migrations.\n');
    process.exitCode = 1;
  } finally { await closePool(); }
}
run();
