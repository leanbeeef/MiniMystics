import { ComponentLoader } from 'adminjs';
import { fileURLToPath } from 'node:url';

const componentLoader = new ComponentLoader();

export const Components = {
  AdjustBalance: componentLoader.add(
    'AdjustBalance',
    fileURLToPath(new URL('./components/adjust-balance.js', import.meta.url)),
  ),
  ImagePreview: componentLoader.add(
    'ImagePreview',
    fileURLToPath(new URL('./components/image-preview.js', import.meta.url)),
  ),
};

export default componentLoader;
