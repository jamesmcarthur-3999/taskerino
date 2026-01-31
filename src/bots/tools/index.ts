// src/bots/tools/index.ts
export { queryTools, setQueryToolsState } from './query-tools';
export { mutationTools, setMutationToolsDispatch } from './mutation-tools';
export { sessionTools, setSessionToolsState } from './session-tools';

import { queryTools } from './query-tools';
import { mutationTools } from './mutation-tools';
import { sessionTools } from './session-tools';

// All tools combined
export const allNedTools = {
  ...queryTools,
  ...mutationTools,
  ...sessionTools,
};

// Read-only tools (no permission needed)
export const readOnlyTools = {
  ...queryTools,
  ...sessionTools,
};

// Write tools (require permission)
export const writeTools = {
  ...mutationTools,
};
