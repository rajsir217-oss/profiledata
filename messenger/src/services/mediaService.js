/**
 * Media upload service for L3V3L Messenger.
 * Handles image/document/audio uploads via multipart form data.
 */

import { MESSENGER_API } from '../config/api';
import useAuthStore from '../stores/authStore';

/**
 * Upload a media file to the server.
 * @param {object} file - { uri, name, type } from image-picker or document-picker
 * @returns {object|null} - { url, thumbnailUrl, mimeType, fileSize, fileName } or null on failure
 */
export async function uploadMedia(file) {
  const { token } = useAuthStore.getState();
  if (!token || !file?.uri) return null;

  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    name: file.name || 'file',
    type: file.type || 'application/octet-stream',
  });

  try {
    const res = await fetch(`${MESSENGER_API}/media/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Upload failed');
    }

    const data = await res.json();
    return data.media;
  } catch (e) {
    return null;
  }
}
