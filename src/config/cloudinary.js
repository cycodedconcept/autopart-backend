const { v2: cloudinary } = require('cloudinary');
const defaultEnv = require('./env');

function createCloudinaryClient({ env = defaultEnv } = {}) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true
  });

  return cloudinary;
}

module.exports = {
  createCloudinaryClient
};
