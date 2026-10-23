
const multer = require("multer");

const allowedMimeTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp"
]);

const storage = multer.memoryStorage();

const upload = multer({
    storage,

    limits: {
        files: 5,
        fileSize: 5 * 1024 * 1024
    },

    fileFilter: (req, file, callback) => {
        if (!allowedMimeTypes.has(file.mimetype)) {
            return callback(
                new Error(
                    "Only JPEG, PNG and WebP images are allowed."
                )
            );
        }

        callback(null, true);
    }
});

module.exports = upload;
