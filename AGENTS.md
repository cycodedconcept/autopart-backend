Migrate product image uploads from local multer storage to Cloudinary

Currently product images are uploaded via multer to the local filesystem (UPLOAD_DIR=./uploads) and served from /api/v1/uploads/product-images/.... This is broken on Railway because the container filesystem is ephemeral — uploaded files are wiped on every deploy/restart, causing 404s. Move image storage to Cloudinary so URLs persist.

Please implement:

Add Cloudinary integration. Install cloudinary and multer-storage-cloudinary. Create a Cloudinary config module reading credentials from environment variables: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET. Add these to the Joi env schema in src/config/env.js as required strings.
Update the upload flow. Replace the local multer disk storage for product images with multer-storage-cloudinary, uploading to a product-images folder in Cloudinary. Follow the existing multer setup in the seller-products route/controller.
Store the returned Cloudinary URL. When an image is uploaded, save the secure Cloudinary URL (the path/secure_url returned by multer-storage-cloudinary) into product_images.url, instead of the local /api/v1/uploads/... path.
Remove or retain the static file serving for /api/v1/uploads as appropriate — it's no longer needed for product images once they're on Cloudinary, but check nothing else depends on it before removing.
Existing broken URLs: the product_images table contains old local/placeholder URLs that no longer resolve. Add a short note in the PR description flagging that these existing rows need to be re-uploaded or backfilled — do not attempt to auto-migrate them.

Follow the existing service/repository/controller structure and keep validation and error handling consistent with the repo. Show the plan and diff before applying.