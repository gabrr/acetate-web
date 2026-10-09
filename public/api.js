import { fetchEventSource } from '/vendor/sse/index.js';
import { followJob } from './jobs.js';
import { getAccessToken } from './auth.js';

export function classify(file, onEvent, options) {
  return followJob(file, onEvent, fetchEventSource, { ...options, getToken: getAccessToken });
}
