CONTEXT
Node.js + Express backend for a car parts marketplace, MySQL database.
Product images are currently uploaded to Cloudinary via multer + CloudinaryStorage.
The app has been migrated from Railway to shared cPanel hosting (persistent disk,
Apache + Phusion Passenger). The Cloudinary account has lapsed.

GOAL
Replace Cloudinary with local disk storage. Images are written to the server's
filesystem and served directly by Apache, not streamed through Express.

BEFORE CHANGING ANYTHING
Read and report back on:
- the multer/Cloudinary config file and every place it is imported
- seller-products.routes.js and its controller
- the Joi validation schema for product creation
- the product_images table definition and any seed files referencing image URLs
- whether the project uses ESM or CommonJS, and its existing error-handling pattern
Match existing conventions. Do not introduce new patterns or libraries beyond what
is listed below.

TASKS
1. Replace CloudinaryStorage with multer.diskStorage.
   - Destination: an uploads directory served by Apache (e.g. public_html/uploads/products).
     Read the base path from an env var UPLOAD_DIR with a sensible default.
   - Filenames: crypto.randomBytes(16).toString("hex") plus the lowercased extension.
     Never use the client-supplied filename.
   - Limits: 2MB per file.
   - fileFilter: accept only image/jpeg, image/png, image/webp. Reject anything else
     with a clear error that surfaces through the existing error handler.

2. Validate the real file type, not just the declared MIME type. Check magic bytes
   after write and delete the file if it does not match an allowed image format.

3. Strip EXIF metadata on upload.

4. Generate one resized thumbnail per image (max width 400px).
   Try sharp first. If sharp cannot be installed in this environment, fall back to
   ImageMagick via child_process, and if neither is available, skip thumbnail
   generation and log a warning rather than failing the upload.

5. Store a RELATIVE path in product_images.url (e.g. /uploads/products/<hash>.webp),
   not an absolute URL. Add a helper that builds the full URL from a BASE_URL env var
   when serializing responses, so the stored value stays portable.

6. On product deletion or image replacement, delete the corresponding files from
   disk. Orphaned files must not accumulate.

7. Create the uploads directory at startup if missing, and write an .htaccess into it
   containing:
       php_flag engine off
       Options -ExecCGI
       AddType text/plain .php .phtml .php3 .php4 .php5 .pl .py .cgi
   This is a security requirement, not optional.

8. Remove the cloudinary dependency from package.json, delete its config file, and
   strip CLOUDINARY_* variables from .env.example. Add UPLOAD_DIR and BASE_URL.

9. Write a migration script that finds product_images rows still holding Cloudinary
   URLs and reports them. Do not delete rows automatically — print a summary and let
   me decide.

CONSTRAINTS
- Do not route image serving through Express. Apache serves the uploads directory.
- Do not store files outside the configured upload directory. Sanitise any path input.
- Keep all existing endpoint paths, request field names, and response shapes unchanged
  so the frontend and Postman collection keep working.
- No new dependencies except sharp (optional, with the fallback above).

ACCEPTANCE
- POST to the existing seller product image endpoint with form-data succeeds and
  returns a working image URL.
- A .txt renamed to .jpg is rejected.
- A 5MB file is rejected with a clear message.
- Deleting a product removes its files from disk.
- No reference to "cloudinary" remains anywhere in the codebase.

When done, list every file you changed and anything you could not complete.