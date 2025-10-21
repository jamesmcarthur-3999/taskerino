/**
 * Sample Canvas Specification
 *
 * This is a comprehensive example that showcases all 20 primitive components
 * in a realistic session summary layout.
 */

import type { ComponentTree } from './types';

export const sampleCanvas: ComponentTree = {
  component: 'Stack',
  props: {
    direction: 'vertical',
    spacing: 'relaxed',
  },
  children: [
    // Header section with hero heading and badges
    {
      component: 'Card',
      props: {
        variant: 'lifted',
        padding: 'relaxed',
        theme: 'info',
      },
      children: [
        {
          component: 'Heading',
          props: {
            level: 1,
            text: 'Product Strategy Session',
            emphasis: 'hero',
            gradient: true,
            badge: 'AI Summary',
          },
        },
        {
          component: 'Text',
          props: {
            content: 'Deep dive into Q4 product roadmap with focus on user experience improvements and API integrations.',
            size: 'lg',
            color: 'secondary',
          },
        },
        {
          component: 'Stack',
          props: {
            direction: 'horizontal',
            spacing: 'normal',
            wrap: true,
          },
          children: [
            {
              component: 'Badge',
              props: {
                text: 'Strategy',
                variant: 'info',
              },
            },
            {
              component: 'Badge',
              props: {
                text: '2h 15m',
                variant: 'default',
              },
            },
            {
              component: 'Badge',
              props: {
                text: 'High Impact',
                variant: 'success',
                pulse: true,
              },
            },
          ],
        },
      ],
    },

    // Stats section - Grid of StatCards
    {
      component: 'Grid',
      props: {
        columns: 3,
        gap: 'normal',
        responsive: true,
      },
      children: [
        {
          component: 'StatCard',
          props: {
            value: '12',
            label: 'Key Decisions',
            icon: '🎯',
            theme: 'success',
            trend: {
              direction: 'up',
              value: '+3',
              label: 'vs last session',
            },
          },
        },
        {
          component: 'StatCard',
          props: {
            value: '8',
            label: 'Tasks Created',
            icon: '✓',
            theme: 'info',
            action: {
              type: 'custom',
              label: 'View Tasks',
            },
          },
        },
        {
          component: 'StatCard',
          props: {
            value: '3',
            label: 'Blockers Identified',
            icon: '⚠️',
            theme: 'warning',
            trend: {
              direction: 'down',
              value: '-2',
              label: 'resolved',
            },
          },
        },
      ],
    },

    // Tabs for organized content
    {
      component: 'Tabs',
      props: {
        defaultTab: 'timeline',
        orientation: 'horizontal',
        items: [
          {
            id: 'timeline',
            label: 'Timeline',
            icon: '📅',
          },
          {
            id: 'insights',
            label: 'Key Insights',
            badge: '5',
          },
          {
            id: 'data',
            label: 'Analytics',
          },
        ],
      },
      children: [
        // Timeline Tab
        {
          component: 'Timeline',
          props: {
            orientation: 'vertical',
            showTimestamps: true,
            interactive: true,
            items: [
              {
                id: '1',
                timestamp: 1704067200000,
                title: 'Session Started',
                description: 'Team gathered to discuss Q4 roadmap priorities',
                theme: 'info',
              },
              {
                id: '2',
                timestamp: 1704068100000,
                title: 'API Integration Discussion',
                description: 'Evaluated 3 different integration approaches. Decided on REST + webhooks.',
                theme: 'success',
                screenshotUrl: '/screenshots/example.jpg',
              },
              {
                id: '3',
                timestamp: 1704069000000,
                title: 'Blocker Identified',
                description: 'Authentication flow needs security audit before implementation',
                theme: 'warning',
              },
              {
                id: '4',
                timestamp: 1704069900000,
                title: 'Decision: Mobile-First Redesign',
                description: 'Unanimous decision to prioritize mobile experience in Q4',
                theme: 'success',
              },
            ],
          },
        },

        // Insights Tab
        {
          component: 'Stack',
          props: {
            direction: 'vertical',
            spacing: 'normal',
          },
          children: [
            {
              component: 'Accordion',
              props: {
                allowMultiple: true,
                defaultExpanded: ['insight1'],
                items: [
                  {
                    id: 'insight1',
                    title: '🚀 Breakthrough: Unified Authentication',
                    badge: 'High Priority',
                  },
                  {
                    id: 'insight2',
                    title: '💡 Innovation: Real-time Collaboration',
                  },
                  {
                    id: 'insight3',
                    title: '⚡ Quick Win: Performance Optimization',
                  },
                ],
              },
              children: [
                // Content for insight1
                {
                  component: 'Stack',
                  props: {
                    direction: 'vertical',
                    spacing: 'normal',
                  },
                  children: [
                    {
                      component: 'Text',
                      props: {
                        content: 'Team aligned on implementing **OAuth 2.0** with **PKCE** for enhanced security across all platforms.',
                        size: 'md',
                      },
                    },
                    {
                      component: 'List',
                      props: {
                        variant: 'checkmark',
                        items: [
                          { text: 'Supports web, mobile, and desktop' },
                          { text: 'Industry-standard security practices' },
                          { text: 'Enables third-party integrations' },
                        ],
                      },
                    },
                    {
                      component: 'ActionToolbar',
                      props: {
                        layout: 'horizontal',
                        actions: [
                          {
                            type: 'create_task',
                            label: 'Create Implementation Task',
                            data: {
                              title: 'Implement OAuth 2.0 with PKCE',
                              priority: 'high',
                            },
                          },
                          {
                            type: 'create_note',
                            label: 'Save to Notes',
                            data: {
                              content: 'OAuth 2.0 implementation details',
                            },
                          },
                        ],
                      },
                    },
                  ],
                },

                // Content for insight2
                {
                  component: 'Stack',
                  props: {
                    direction: 'vertical',
                    spacing: 'normal',
                  },
                  children: [
                    {
                      component: 'Text',
                      props: {
                        content: 'WebSocket implementation will enable **real-time collaboration** features.',
                        size: 'md',
                      },
                    },
                    {
                      component: 'Chart',
                      props: {
                        type: 'line',
                        height: 250,
                        showLegend: true,
                        showGrid: true,
                        data: {
                          labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                          datasets: [
                            {
                              label: 'Active Users',
                              data: [120, 190, 230, 280],
                              color: '#0ea5e9',
                            },
                            {
                              label: 'Projected with Real-time',
                              data: [120, 210, 290, 380],
                              color: '#10b981',
                            },
                          ],
                        },
                      },
                    },
                  ],
                },

                // Content for insight3
                {
                  component: 'Text',
                  props: {
                    content: 'Image optimization can reduce load times by **40%** with minimal effort.',
                    size: 'md',
                  },
                },
              ],
            },
          ],
        },

        // Analytics Tab
        {
          component: 'Stack',
          props: {
            direction: 'vertical',
            spacing: 'normal',
          },
          children: [
            {
              component: 'Heading',
              props: {
                level: 3,
                text: 'Session Analytics',
              },
            },
            {
              component: 'Grid',
              props: {
                columns: 2,
                gap: 'normal',
                responsive: true,
              },
              children: [
                {
                  component: 'Card',
                  props: {
                    variant: 'lifted',
                    padding: 'normal',
                    theme: 'default',
                  },
                  children: [
                    {
                      component: 'Heading',
                      props: {
                        level: 4,
                        text: 'Activity Distribution',
                      },
                    },
                    {
                      component: 'Chart',
                      props: {
                        type: 'pie',
                        height: 250,
                        showLegend: true,
                        data: {
                          labels: ['Discussion', 'Planning', 'Documentation', 'Review'],
                          datasets: [
                            {
                              label: 'Time Spent',
                              data: [45, 30, 15, 10],
                            },
                          ],
                        },
                      },
                    },
                  ],
                },
                {
                  component: 'Card',
                  props: {
                    variant: 'lifted',
                    padding: 'normal',
                    theme: 'default',
                  },
                  children: [
                    {
                      component: 'Heading',
                      props: {
                        level: 4,
                        text: 'Progress Over Time',
                      },
                    },
                    {
                      component: 'Chart',
                      props: {
                        type: 'area',
                        height: 250,
                        showLegend: true,
                        showGrid: true,
                        data: {
                          labels: ['0:00', '0:30', '1:00', '1:30', '2:00'],
                          datasets: [
                            {
                              label: 'Focus Level',
                              data: [70, 85, 90, 75, 80],
                              color: '#8b5cf6',
                            },
                          ],
                        },
                      },
                    },
                  ],
                },
              ],
            },
            {
              component: 'Table',
              props: {
                sortable: true,
                striped: true,
                hover: true,
                headers: ['Metric', 'Value', 'Change'],
                rows: [
                  ['Screenshot Count', '24', '+8'],
                  ['Audio Segments', '12', '+3'],
                  ['Topics Discussed', '7', '+2'],
                  ['Decisions Made', '12', '+5'],
                ],
              },
            },
          ],
        },
      ],
    },

    // Separator
    {
      component: 'Separator',
      props: {
        orientation: 'horizontal',
        label: 'Extracted Artifacts',
      },
    },

    // Grid with various components
    {
      component: 'Grid',
      props: {
        columns: 2,
        gap: 'normal',
        responsive: true,
      },
      children: [
        // Tasks
        {
          component: 'Card',
          props: {
            variant: 'lifted',
            padding: 'normal',
            theme: 'info',
            header: {
              component: 'Heading',
              props: {
                level: 3,
                text: 'Tasks Created',
                icon: '✓',
              },
            },
          },
          children: [
            {
              component: 'List',
              props: {
                variant: 'numbered',
                items: [
                  {
                    text: 'Implement OAuth 2.0 authentication',
                    metadata: 'High Priority • Due in 2 weeks',
                  },
                  {
                    text: 'Design mobile-first UI mockups',
                    metadata: 'Medium Priority • Due in 1 week',
                  },
                  {
                    text: 'Conduct security audit',
                    metadata: 'High Priority • Due in 3 days',
                  },
                ],
              },
            },
          ],
        },

        // Key Values
        {
          component: 'Card',
          props: {
            variant: 'lifted',
            padding: 'normal',
            theme: 'default',
            header: {
              component: 'Heading',
              props: {
                level: 3,
                text: 'Session Metadata',
                icon: '📋',
              },
            },
          },
          children: [
            {
              component: 'KeyValue',
              props: {
                layout: 'stacked',
                showCopy: true,
                items: [
                  { key: 'Duration', value: '2h 15m', icon: '⏱️' },
                  { key: 'Participants', value: '5 team members', icon: '👥' },
                  { key: 'Location', value: 'Conference Room A', icon: '📍' },
                  { key: 'Session ID', value: 'session-2024-01-01-001', icon: '🔑', copyable: true },
                ],
              },
            },
          ],
        },
      ],
    },

    // Progress indicators
    {
      component: 'Card',
      props: {
        variant: 'lifted',
        padding: 'normal',
        theme: 'default',
      },
      children: [
        {
          component: 'Heading',
          props: {
            level: 3,
            text: 'Goal Progress',
          },
        },
        {
          component: 'Stack',
          props: {
            direction: 'vertical',
            spacing: 'normal',
          },
          children: [
            {
              component: 'ProgressBar',
              props: {
                variant: 'linear',
                percentage: 85,
                label: 'Roadmap Planning',
                showPercentage: true,
                animated: true,
                theme: 'success',
              },
            },
            {
              component: 'ProgressBar',
              props: {
                variant: 'linear',
                percentage: 60,
                label: 'Technical Specifications',
                showPercentage: true,
                animated: true,
                theme: 'info',
              },
            },
            {
              component: 'ProgressBar',
              props: {
                variant: 'linear',
                percentage: 30,
                label: 'Implementation',
                showPercentage: true,
                animated: true,
                theme: 'warning',
              },
            },
          ],
        },
      ],
    },

    // Toggle group for view options
    {
      component: 'Card',
      props: {
        variant: 'lifted',
        padding: 'normal',
        theme: 'default',
      },
      children: [
        {
          component: 'Heading',
          props: {
            level: 3,
            text: 'Export Options',
          },
        },
        {
          component: 'ToggleGroup',
          props: {
            variant: 'pills',
            defaultSelected: 'pdf',
            items: [
              { id: 'pdf', label: 'PDF', icon: '📄' },
              { id: 'markdown', label: 'Markdown', icon: '📝' },
              { id: 'json', label: 'JSON', icon: '{...}' },
            ],
          },
        },
        {
          component: 'ActionToolbar',
          props: {
            layout: 'horizontal',
            align: 'end',
            actions: [
              {
                type: 'export',
                label: 'Export Summary',
                data: { format: 'pdf' },
              },
              {
                type: 'share',
                label: 'Share',
              },
            ],
          },
        },
      ],
    },

    // Image gallery (if screenshots available)
    {
      component: 'Card',
      props: {
        variant: 'lifted',
        padding: 'normal',
        theme: 'default',
      },
      children: [
        {
          component: 'Heading',
          props: {
            level: 3,
            text: 'Session Screenshots',
            icon: '📸',
          },
        },
        {
          component: 'ImageGallery',
          props: {
            layout: 'grid',
            columns: 4,
            images: [
              {
                url: '/screenshots/1.jpg',
                alt: 'API architecture diagram',
                caption: '0:15 - Architecture overview',
              },
              {
                url: '/screenshots/2.jpg',
                alt: 'Authentication flow',
                caption: '0:45 - Auth flow design',
              },
              {
                url: '/screenshots/3.jpg',
                alt: 'Mobile mockups',
                caption: '1:20 - Mobile UI concepts',
              },
              {
                url: '/screenshots/4.jpg',
                alt: 'Performance metrics',
                caption: '1:50 - Performance data',
              },
            ],
          },
        },
      ],
    },

    // Final action buttons
    {
      component: 'Card',
      props: {
        variant: 'lifted',
        padding: 'relaxed',
        theme: 'info',
      },
      children: [
        {
          component: 'Heading',
          props: {
            level: 3,
            text: 'Next Steps',
          },
        },
        {
          component: 'Text',
          props: {
            content: 'Ready to take action on this session?',
            size: 'md',
            color: 'secondary',
          },
        },
        {
          component: 'Stack',
          props: {
            direction: 'horizontal',
            spacing: 'normal',
            wrap: true,
          },
          children: [
            {
              component: 'Button',
              props: {
                label: 'Create All Tasks',
                icon: '✓',
                variant: 'primary',
                size: 'lg',
                action: {
                  type: 'create_task',
                  data: { sessionId: 'session-2024-01-01-001' },
                },
              },
            },
            {
              component: 'Button',
              props: {
                label: 'Save to Library',
                icon: '📚',
                variant: 'secondary',
                size: 'lg',
                action: {
                  type: 'create_note',
                  data: { sessionId: 'session-2024-01-01-001' },
                },
              },
            },
            {
              component: 'Button',
              props: {
                label: 'Share Summary',
                icon: '🔗',
                variant: 'ghost',
                size: 'lg',
                action: {
                  type: 'share',
                },
              },
            },
          ],
        },
      ],
    },
  ],
};
