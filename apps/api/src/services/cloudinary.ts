import { v2 as cloudinary } from 'cloudinary';

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

let isCloudinaryConfigured = false;

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
  isCloudinaryConfigured = true;
}

export const uploadImageBuffer = (buffer: Buffer): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!isCloudinaryConfigured) {
      // Mock upload for local development bypass
      console.log('[Cloudinary Service]: Using Mock upload bypass. Saved placeholder.');
      // Return a random beautiful mock sports wear image
      const mockImages = [
        'https://res.cloudinary.com/demo/image/upload/v1580975618/sample.jpg',
        'https://res.cloudinary.com/demo/image/upload/v1574218321/bag.jpg',
        'https://res.cloudinary.com/demo/image/upload/v1524125862/pair.jpg'
      ];
      const randomImage = mockImages[Math.floor(Math.random() * mockImages.length)];
      return resolve(randomImage);
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'alphastryk/products',
        resource_type: 'image',
      },
      (error, result) => {
        if (error || !result) {
          console.error('[Cloudinary Service]: Upload failure', error);
          return reject(error || new Error('Upload result undefined'));
        }
        resolve(result.secure_url);
      }
    );

    uploadStream.end(buffer);
  });
};
export default cloudinary;
