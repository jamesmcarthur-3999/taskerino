/**
 * CanvasChart - Data Display Component
 *
 * Data visualization using recharts library.
 * Supports line, bar, area, pie, and donut charts.
 */

import React from 'react';
import {
  LineChart,
  BarChart,
  AreaChart,
  PieChart,
  Line,
  Bar,
  Area,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ChartProps } from '../types';

// Chart color palette
const CHART_COLORS = [
  '#0ea5e9', // cyan-500
  '#8b5cf6', // purple-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#06b6d4', // cyan-600
];

export function CanvasChart({
  type,
  data,
  height = 300,
  showLegend = true,
  showGrid = true,
  tooltip = true,
}: ChartProps) {
  // Prepare data for recharts
  const chartData = data.labels.map((label, index) => {
    const dataPoint: any = { name: label };
    data.datasets.forEach((dataset) => {
      dataPoint[dataset.label] = dataset.data[index];
    });
    return dataPoint;
  });

  // Common chart props
  const commonProps = {
    data: chartData,
    margin: { top: 5, right: 30, left: 20, bottom: 5 },
  };

  // Pie/Donut chart data format
  const pieData = data.datasets[0]?.data.map((value, index) => ({
    name: data.labels[index],
    value,
  }));

  if (type === 'pie' || type === 'donut') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }: { name: string; percent: number }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            outerRadius={type === 'donut' ? 80 : 100}
            innerRadius={type === 'donut' ? 50 : 0}
            fill="#8884d8"
            dataKey="value"
          >
            {pieData?.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          {tooltip && <Tooltip />}
          {/* @ts-expect-error - React 19 + recharts type compatibility issue */}
          {showLegend && <Legend />}
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart {...commonProps}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
          <XAxis dataKey="name" stroke="#6b7280" />
          <YAxis stroke="#6b7280" />
          {tooltip && <Tooltip />}
          {/* @ts-expect-error - React 19 + recharts type compatibility issue */}
          {showLegend && <Legend />}
          {data.datasets.map((dataset, index) => (
            <Line
              key={dataset.label}
              type="monotone"
              dataKey={dataset.label}
              stroke={dataset.color || CHART_COLORS[index % CHART_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart {...commonProps}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
          <XAxis dataKey="name" stroke="#6b7280" />
          <YAxis stroke="#6b7280" />
          {tooltip && <Tooltip />}
          {/* @ts-expect-error - React 19 + recharts type compatibility issue */}
          {showLegend && <Legend />}
          {data.datasets.map((dataset, index) => (
            <Bar
              key={dataset.label}
              dataKey={dataset.label}
              fill={dataset.color || CHART_COLORS[index % CHART_COLORS.length]}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'area') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart {...commonProps}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
          <XAxis dataKey="name" stroke="#6b7280" />
          <YAxis stroke="#6b7280" />
          {tooltip && <Tooltip />}
          {/* @ts-expect-error - React 19 + recharts type compatibility issue */}
          {showLegend && <Legend />}
          {data.datasets.map((dataset, index) => (
            <Area
              key={dataset.label}
              type="monotone"
              dataKey={dataset.label}
              stroke={dataset.color || CHART_COLORS[index % CHART_COLORS.length]}
              fill={dataset.color || CHART_COLORS[index % CHART_COLORS.length]}
              fillOpacity={0.6}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return <div className="text-gray-500 p-4">Unsupported chart type: {type}</div>;
}
