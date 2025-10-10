/**
 * Assistant Zone
 *
 * Home of Ned, the AI assistant.
 */

import React from 'react';
import { NedChat } from './ned/NedChat';

export function AssistantZone() {
  return (
    <div className="h-full w-full bg-gradient-to-br from-cyan-500/20 via-blue-500/20 to-teal-500/20 overflow-hidden">
      <div className="h-full pt-20">
        <div className="h-full max-w-6xl mx-auto">
          <NedChat />
        </div>
      </div>
    </div>
  );
}
