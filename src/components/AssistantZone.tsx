/**
 * Assistant Zone
 *
 * Home of Ned, the AI assistant.
 */

import React from 'react';
import { NedChat } from './ned/NedChat';
import { BACKGROUND_GRADIENT } from '../design-system/theme';

export default function AssistantZone() {
  return (
    <div className={`h-full w-full ${BACKGROUND_GRADIENT.primary} overflow-hidden`}>
      <div className="h-full pt-20">
        <div className="h-full max-w-6xl mx-auto">
          <NedChat />
        </div>
      </div>
    </div>
  );
}
