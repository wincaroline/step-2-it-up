/**
 * Runs before App.tsx loads so graphic fetches overlap JS parse/eval instead of waiting for React mount.
 */
import { collectAllGraphicAssetUrls, preloadGraphicUrls } from './utils';

preloadGraphicUrls(collectAllGraphicAssetUrls());
