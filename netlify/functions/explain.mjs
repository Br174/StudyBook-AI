import handler from '../../api/explain.js';
import { runLegacyApi } from './_legacy-adapter.mjs';

export default async (request) => runLegacyApi(handler, request);

export const config = {
  path: '/api/explain',
};
