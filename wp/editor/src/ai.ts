import apiFetch from '@wordpress/api-fetch';
import type { ModelImage, ModelProvider } from '@bestenberg/ai';

export interface AiStatus {
  available: boolean;
  /** Where an administrator connects a provider ('' if the user cannot). */
  connectorsUrl: string;
}

export function aiStatus(): Promise<AiStatus> {
  return apiFetch<AiStatus>({ path: '/bestenberg/v1/ai/status' });
}

/** Reaches the model through the site (WordPress AI Client or the hosted service). */
export const siteProvider: ModelProvider = {
  async generate(request) {
    const { text } = await apiFetch<{ text: string }>({
      path: '/bestenberg/v1/ai/generate',
      method: 'POST',
      data: request,
    });
    return text;
  },
};

const MAX_SIDE = 1568;

/** Reads a screenshot file as a JPEG data URL, scaled down so it is cheap to send. */
export async function readScreenshot(file: File): Promise<ModelImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot read the image.');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return { url: canvas.toDataURL('image/jpeg', 0.85), mimeType: 'image/jpeg' };
}
