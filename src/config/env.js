const path = require('path');
const dotenv = require('dotenv');
const Joi = require('joi');

dotenv.config({
  path: path.resolve(process.cwd(), '.env')
});

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().integer().positive().default(4000),
  DB_HOST: Joi.alternatives().try(
    Joi.string().hostname(),
    Joi.string().ip({ version: ['ipv4', 'ipv6'] })
  ).required(),
  DB_PORT: Joi.number().integer().positive().default(3306),
  DB_USER: Joi.string().allow('').required(),
  DB_PASSWORD: Joi.string().allow('').required(),
  DB_NAME: Joi.string().required(),
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('1d'),
  BCRYPT_SALT_ROUNDS: Joi.number().integer().min(4).max(15).default(10),
  PASSWORD_RESET_TOKEN_TTL_MINUTES: Joi.number().integer().min(5).max(1440).default(30),
  PAYSTACK_SECRET_KEY: Joi.string().allow('').required(),
  PAYSTACK_PUBLIC_KEY: Joi.string().allow('').required()
}).unknown(true);

const { error, value } = envSchema.validate(process.env, {
  abortEarly: false,
  convert: true
});

if (error) {
  throw new Error(`Environment validation failed: ${error.message}`);
}

module.exports = value;
