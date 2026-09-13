import handler from '../../api/summarize.js';
import { runLegacyApi } from './_legacy-adapter.mjs';

export default async (request) => runLegacyApi(handler, request);

export const config = {
  path: '/api/summarize',
};
