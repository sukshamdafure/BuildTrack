
const cloudinary = require("../config/cloudinary");

const uploadImageBuffer = (buffer, folder) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: "image",
                allowed_formats: ["jpg", "jpeg", "png", "webp"]
            },
            (error, result) => {
                if (error) {
                    return reject(error);
                }

                if (!result || !result.secure_url || !result.public_id) {
                    return reject(
                        new Error("Cloudinary returned an invalid upload result.")
                    );
                }

                resolve({
                    url: result.secure_url,
                    publicId: result.public_id,
                    format: result.format || ""
                });
            }
        );

        stream.end(buffer);
    });
};

const deleteImage = async publicId => {
    if (!publicId) {
        return;
    }

    return cloudinary.uploader.destroy(publicId, {
        resource_type: "image",
        invalidate: true
    });
};

module.exports = {
    uploadImageBuffer,
    deleteImage
};
