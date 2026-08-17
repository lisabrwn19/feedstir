import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { storage } from '@/lib/firebase';

/**
 * Uploads a local photo (a `file://` URI from the image picker) to Firebase
 * Storage and returns its public download URL. Remote URLs (e.g. an image
 * pulled in via URL import) are already stable and don't need uploading.
 */
export async function uploadRecipePhoto(localUri: string, ownerId: string): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();

  // Derive the extension from the blob's actual MIME type rather than
  // string-parsing the source URI — file://, blob:, and data: URIs don't
  // reliably (or ever, for blob:/data:) end in a real file extension.
  const contentType = blob.type || 'image/jpeg';
  const extension = contentType.split('/').pop() || 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${extension}`;
  const storageRef = ref(storage, `recipe-photos/${ownerId}/${fileName}`);

  await uploadBytes(storageRef, blob, { contentType });
  return getDownloadURL(storageRef);
}

export function isLocalPhotoUri(uri: string): boolean {
  // file:// (iOS/Android), ph:// (raw iOS Photos asset), content:// (Android
  // picked media), and blob:/data: (web) are all only valid on the device or
  // browser tab that produced them — none of them survive being stored as-is
  // and loaded elsewhere.
  return (
    uri.startsWith('file://') ||
    uri.startsWith('ph://') ||
    uri.startsWith('content://') ||
    uri.startsWith('blob:') ||
    uri.startsWith('data:')
  );
}
