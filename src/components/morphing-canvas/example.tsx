/**
 * Morphing Canvas Example
 *
 * Complete example showing how to use the Morphing Canvas system
 */

import { useEffect, useState } from 'react';
import { MorphingCanvas, initializeModuleRegistry } from './index';
import type { MorphingCanvasConfig, ModuleAction } from './types';
import { defaultMorphingCanvasConfig } from './configs/defaultConfig';

/**
 * Example component showing basic usage
 */
export function MorphingCanvasExample() {
  const [config] = useState<MorphingCanvasConfig>(defaultMorphingCanvasConfig);

  // Initialize the module registry on mount
  useEffect(() => {
    initializeModuleRegistry();
  }, []);

  // Handle module actions
  const handleAction = (action: ModuleAction) => {
    console.log('Module action received:', action);

    // Handle different action types
    switch (action.type) {
      case 'quick-action':
        console.log('Quick action triggered:', action.payload);
        // Implement your action handling logic here
        break;

      default:
        console.log('Unhandled action type:', action.type);
    }
  };

  // Handle layout changes
  const handleLayoutChange = (layoutId: string) => {
    console.log('Layout changed to:', layoutId);
    // You could persist the layout preference here
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <MorphingCanvas
        config={config}
        onAction={handleAction}
        onLayoutChange={handleLayoutChange}
      />
    </div>
  );
}

/**
 * Example with custom session data
 */
export function MorphingCanvasWithSession() {
  const [config] = useState<MorphingCanvasConfig>(defaultMorphingCanvasConfig);

  useEffect(() => {
    initializeModuleRegistry();
  }, []);

  // Example session data
  const sessionData = {
    userId: 'user-123',
    preferences: {
      theme: 'dark',
      notifications: true,
    },
    permissions: ['create', 'edit', 'delete'],
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <MorphingCanvas
        config={config}
        sessionData={sessionData}
        onAction={(action) => console.log('Action:', action)}
        onLayoutChange={(layoutId) => console.log('Layout:', layoutId)}
      />
    </div>
  );
}

/**
 * Example with dynamic configuration
 */
export function DynamicMorphingCanvas() {
  const [config, setConfig] = useState<MorphingCanvasConfig>(
    defaultMorphingCanvasConfig
  );

  useEffect(() => {
    initializeModuleRegistry();
  }, []);

  // Function to update configuration
  const updateConfig = (updates: Partial<MorphingCanvasConfig>) => {
    setConfig((prev) => ({
      ...prev,
      ...updates,
    }));
  };

  // Example: Toggle theme
  const toggleTheme = () => {
    updateConfig({
      theme: {
        ...config.theme,
        mode: config.theme.mode === 'light' ? 'dark' : 'light',
      },
    });
  };

  // Example: Enable/disable a module
  const toggleModule = (moduleId: string) => {
    setConfig((prev) => ({
      ...prev,
      modules: prev.modules.map((module) =>
        module.id === moduleId
          ? { ...module, enabled: !module.enabled }
          : module
      ),
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Controls */}
      <div className="fixed top-4 left-4 z-50 flex flex-col gap-2">
        <button
          onClick={toggleTheme}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          Toggle Theme
        </button>
        <button
          onClick={() => toggleModule('notes-1')}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
        >
          Toggle Notes
        </button>
      </div>

      {/* Canvas */}
      <MorphingCanvas
        config={config}
        onAction={(action) => console.log('Action:', action)}
        onLayoutChange={(layoutId) => console.log('Layout:', layoutId)}
      />
    </div>
  );
}

/**
 * How to create a custom module
 *
 * 1. Define your module component:
 *
 * ```tsx
 * import type { ModuleProps } from './types';
 *
 * interface MyModuleData {
 *   items: string[];
 * }
 *
 * export function MyCustomModule({ config, data }: ModuleProps<MyModuleData>) {
 *   return (
 *     <div className="p-4">
 *       <h3>{config.chrome?.title || 'My Module'}</h3>
 *       <ul>
 *         {data?.items.map((item, i) => (
 *           <li key={i}>{item}</li>
 *         ))}
 *       </ul>
 *     </div>
 *   );
 * }
 * ```
 *
 * 2. Register your module:
 *
 * ```tsx
 * import { registerModule } from './registry';
 * import { MyCustomModule } from './modules/MyCustomModule';
 *
 * registerModule({
 *   type: 'custom',
 *   component: MyCustomModule,
 *   displayName: 'My Custom Module',
 *   description: 'A custom module example',
 *   defaultConfig: {
 *     id: '',
 *     type: 'custom',
 *     slotId: '',
 *     chrome: {
 *       showHeader: true,
 *       title: 'My Custom Module',
 *     },
 *   },
 * });
 * ```
 *
 * 3. Add it to your configuration:
 *
 * ```tsx
 * const config: MorphingCanvasConfig = {
 *   // ... other config
 *   modules: [
 *     {
 *       id: 'my-module-1',
 *       type: 'custom',
 *       slotId: 'main-content',
 *       enabled: true,
 *     },
 *   ],
 * };
 * ```
 */
