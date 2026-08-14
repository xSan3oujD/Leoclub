const CLOUDINARY_CLOUD_NAME = 'fgdmceru';
const CLOUDINARY_UPLOAD_PRESET = 'leoimgupload';

/**
 * Upload an image to Cloudinary using an unsigned upload preset.
 * @param {File} file - The image file to upload
 * @returns {Promise<string>} - Public URL of the uploaded image
 */
export async function uploadImage(file) {
    try {
        if (!file || !file.type.startsWith('image/')) {
            throw new Error('File must be an image');
        }

        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            throw new Error('Image size must be less than 5MB');
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        formData.append('cloud_name', CLOUDINARY_CLOUD_NAME);

        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok || !data.secure_url) {
            throw new Error(data.error?.message || 'Cloudinary upload failed');
        }

        return data.secure_url;
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        throw error;
    }
}

/**
 * Delete is not needed for the free Cloudinary upload flow unless you create a signed delete endpoint.
 * This function intentionally does nothing for browser-only uploads.
 */
export async function deleteImage() {
    return;
}

/**
 * Preview an image file before upload
 * @param {File} file - The image file to preview
 * @returns {Promise<string>} - Data URL for preview
 */
export function previewImageFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('File read failed'));
        reader.readAsDataURL(file);
    });
}
