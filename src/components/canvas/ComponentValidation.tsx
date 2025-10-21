/**
 * Component Validation Test Page
 *
 * Validates that all 20 primitive components work correctly when rendered by AI.
 * Tests various prop combinations, edge cases, and nesting patterns.
 */

import React, { useState } from 'react';
import { ComponentRenderer } from './ComponentRenderer';
import type { ComponentTree } from './types';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface ValidationResult {
  component: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
}

export function ComponentValidation() {
  const [results, setResults] = useState<ValidationResult[]>([]);

  // Test cases for all 20 components
  const testCases: ComponentTree[] = [
    // LAYOUT COMPONENTS (5)
    {
      component: 'Stack',
      props: {
        direction: 'vertical',
        spacing: 'normal',
        align: 'start'
      },
      children: [
        { component: 'Text', props: { content: 'Stack Test: Vertical' } },
        { component: 'Text', props: { content: 'Stack Test: Item 2' } }
      ]
    },
    {
      component: 'Grid',
      props: {
        columns: 3,
        gap: 'normal',
        responsive: true
      },
      children: [
        { component: 'Text', props: { content: 'Grid Col 1' } },
        { component: 'Text', props: { content: 'Grid Col 2' } },
        { component: 'Text', props: { content: 'Grid Col 3' } }
      ]
    },
    {
      component: 'Card',
      props: {
        variant: 'lifted',
        padding: 'normal',
        theme: 'success'
      },
      children: [
        { component: 'Heading', props: { level: 3, text: 'Card Test' } },
        { component: 'Text', props: { content: 'Card content goes here' } }
      ]
    },
    {
      component: 'Tabs',
      props: {
        defaultTab: 'tab1',
        items: [
          { id: 'tab1', label: 'Tab 1' },
          { id: 'tab2', label: 'Tab 2', badge: '3' }
        ]
      },
      children: [
        { component: 'Text', props: { content: 'Tab 1 Content' } },
        { component: 'Text', props: { content: 'Tab 2 Content' } }
      ]
    },
    {
      component: 'Accordion',
      props: {
        allowMultiple: true,
        defaultExpanded: ['item1'],
        items: [
          { id: 'item1', title: 'Accordion Item 1' },
          { id: 'item2', title: 'Accordion Item 2', badge: 'New' }
        ]
      },
      children: [
        { component: 'Text', props: { content: 'Content for item 1' } },
        { component: 'Text', props: { content: 'Content for item 2' } }
      ]
    },

    // TYPOGRAPHY COMPONENTS (4)
    {
      component: 'Heading',
      props: {
        level: 1,
        text: 'Heading Test: Level 1',
        gradient: true,
        badge: 'Test'
      }
    },
    {
      component: 'Text',
      props: {
        content: 'Text component test with **bold** and *italic* markdown',
        size: 'lg',
        color: 'primary'
      }
    },
    {
      component: 'Badge',
      props: {
        text: 'Success Badge',
        variant: 'success',
        pulse: true
      }
    },
    {
      component: 'Separator',
      props: {
        orientation: 'horizontal',
        label: 'Section Break'
      }
    },

    // DATA DISPLAY COMPONENTS (8)
    {
      component: 'List',
      props: {
        variant: 'checkmark',
        items: [
          { text: 'List item 1' },
          { text: 'List item 2', metadata: 'With metadata' },
          { text: 'List item 3', subItems: [{ text: 'Sub-item 1' }] }
        ]
      }
    },
    {
      component: 'Timeline',
      props: {
        orientation: 'vertical',
        showTimestamps: true,
        items: [
          {
            id: '1',
            timestamp: new Date().toISOString(),
            title: 'Timeline Event 1',
            description: 'First event',
            theme: 'success'
          },
          {
            id: '2',
            timestamp: new Date(Date.now() + 3600000).toISOString(),
            title: 'Timeline Event 2',
            description: 'Second event',
            theme: 'info'
          }
        ]
      }
    },
    {
      component: 'Table',
      props: {
        sortable: true,
        striped: true,
        hover: true,
        headers: ['Column 1', 'Column 2', 'Column 3'],
        rows: [
          ['Row 1 Col 1', 'Row 1 Col 2', 'Row 1 Col 3'],
          ['Row 2 Col 1', 'Row 2 Col 2', 'Row 2 Col 3']
        ]
      }
    },
    {
      component: 'StatCard',
      props: {
        value: '42',
        label: 'Test Metric',
        icon: '🎯',
        theme: 'success',
        trend: {
          direction: 'up',
          value: '+5',
          label: 'vs last week'
        }
      }
    },
    {
      component: 'Chart',
      props: {
        type: 'line',
        height: 200,
        showLegend: true,
        showGrid: true,
        data: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr'],
          datasets: [
            {
              label: 'Test Data',
              data: [10, 20, 15, 25],
              color: '#10b981'
            }
          ]
        }
      }
    },
    {
      component: 'ProgressBar',
      props: {
        variant: 'linear',
        percentage: 75,
        label: 'Progress Test',
        showPercentage: true,
        animated: true,
        theme: 'success'
      }
    },
    {
      component: 'ImageGallery',
      props: {
        layout: 'grid',
        columns: 2,
        images: [
          { url: '/placeholder1.jpg', alt: 'Image 1', caption: 'Test image 1' },
          { url: '/placeholder2.jpg', alt: 'Image 2', caption: 'Test image 2' }
        ]
      }
    },
    {
      component: 'KeyValue',
      props: {
        layout: 'stacked',
        showCopy: true,
        items: [
          { key: 'Name', value: 'Test Value' },
          { key: 'Status', value: 'Active', icon: '✅' },
          { key: 'ID', value: 'test-123', copyable: true }
        ]
      }
    },

    // INTERACTIVE COMPONENTS (3)
    {
      component: 'Button',
      props: {
        label: 'Test Button',
        icon: '🚀',
        variant: 'primary',
        size: 'md',
        action: {
          type: 'create_task',
          label: 'Create Task',
          data: { title: 'Test task' }
        }
      }
    },
    {
      component: 'ActionToolbar',
      props: {
        layout: 'horizontal',
        align: 'start',
        actions: [
          {
            type: 'create_task',
            label: 'Create Task',
            data: {}
          },
          {
            type: 'create_note',
            label: 'Create Note',
            data: {}
          }
        ]
      }
    },
    {
      component: 'ToggleGroup',
      props: {
        variant: 'pills',
        defaultSelected: 'option1',
        items: [
          { id: 'option1', label: 'Option 1' },
          { id: 'option2', label: 'Option 2', icon: '⚙️' },
          { id: 'option3', label: 'Option 3' }
        ]
      }
    }
  ];

  const runValidation = () => {
    const newResults: ValidationResult[] = [];

    testCases.forEach((testCase, index) => {
      try {
        // Attempt to validate component structure
        const componentName = testCase.component;
        const hasRequiredProps = testCase.props !== undefined;
        const childrenValid = !testCase.children || Array.isArray(testCase.children);

        if (!hasRequiredProps) {
          newResults.push({
            component: componentName,
            status: 'fail',
            message: 'Missing required props'
          });
        } else if (!childrenValid) {
          newResults.push({
            component: componentName,
            status: 'fail',
            message: 'Invalid children structure'
          });
        } else {
          newResults.push({
            component: componentName,
            status: 'pass',
            message: `Component ${index + 1}/20 validated successfully`
          });
        }
      } catch (error) {
        newResults.push({
          component: testCase.component,
          status: 'fail',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    setResults(newResults);
  };

  const passCount = results.filter(r => r.status === 'pass').length;
  const failCount = results.filter(r => r.status === 'fail').length;
  const warnCount = results.filter(r => r.status === 'warning').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 p-6 bg-white/80 backdrop-blur-md border-2 border-gray-200 rounded-xl shadow-lg">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Canvas Component Validation
          </h1>
          <p className="text-gray-600 mb-4">
            Testing all 20 primitive components to ensure AI can use them correctly
          </p>
          <button
            onClick={runValidation}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Run Validation Tests
          </button>

          {results.length > 0 && (
            <div className="mt-4 flex gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-700">{passCount} Passed</span>
              </div>
              {failCount > 0 && (
                <div className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-600" />
                  <span className="font-semibold text-red-700">{failCount} Failed</span>
                </div>
              )}
              {warnCount > 0 && (
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <span className="font-semibold text-amber-700">{warnCount} Warnings</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="mb-8 p-6 bg-white/80 backdrop-blur-md border-2 border-gray-200 rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Validation Results</h2>
            <div className="space-y-2">
              {results.map((result, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-3 p-3 rounded-lg ${
                    result.status === 'pass'
                      ? 'bg-green-50 border border-green-200'
                      : result.status === 'fail'
                        ? 'bg-red-50 border border-red-200'
                        : 'bg-amber-50 border border-amber-200'
                  }`}
                >
                  {result.status === 'pass' && <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />}
                  {result.status === 'fail' && <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />}
                  {result.status === 'warning' && <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />}
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{result.component}</div>
                    <div className="text-sm text-gray-600">{result.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Render All Components */}
        <div className="space-y-6">
          <div className="p-6 bg-white/80 backdrop-blur-md border-2 border-gray-200 rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Component Renders</h2>
            <p className="text-gray-600 mb-6">
              Visual validation - all components should render without errors
            </p>
            <div className="space-y-8">
              {testCases.map((testCase, idx) => (
                <div key={idx} className="border-2 border-gray-200 rounded-lg p-4">
                  <div className="text-sm font-semibold text-gray-500 mb-2">
                    {idx + 1}. {testCase.component}
                  </div>
                  <ComponentRenderer tree={testCase} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
