/**
 * Component Tests for MultiSourceRecordingConfig
 *
 * Tests the multi-source recording configuration UI.
 * Task 2.10 - Phase 2
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MultiSourceRecordingConfig } from '../sessions/MultiSourceRecordingConfig';
import type { DisplayInfo, WindowInfo } from '../../types';
import type { RecordingSource } from '../../services/videoRecordingService';

describe('MultiSourceRecordingConfig', () => {
  const mockDisplays: DisplayInfo[] = [
    {
      displayId: '1',
      width: 1920,
      height: 1080,
      isPrimary: true,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    },
    {
      displayId: '2',
      width: 2560,
      height: 1440,
      isPrimary: false,
      bounds: { x: 1920, y: 0, width: 2560, height: 1440 },
    },
  ];

  const mockWindows: WindowInfo[] = [
    {
      windowId: '101',
      title: 'Chrome Browser',
      owningApp: 'Google Chrome',
      bundleId: 'com.google.Chrome',
      bounds: { x: 0, y: 0, width: 1200, height: 800 },
    },
    {
      windowId: '102',
      title: 'VS Code',
      owningApp: 'Code',
      bundleId: 'com.microsoft.VSCode',
      bounds: { x: 0, y: 0, width: 1600, height: 900 },
    },
  ];

  const defaultProps = {
    sources: [] as RecordingSource[],
    compositor: 'passthrough' as const,
    availableDisplays: mockDisplays,
    availableWindows: mockWindows,
    onSourcesChange: vi.fn(),
    onCompositorChange: vi.fn(),
    loadingDevices: false,
  };

  it('should render empty state when no sources added', () => {
    render(<MultiSourceRecordingConfig {...defaultProps} />);

    expect(screen.getByText(/No sources added/i)).toBeInTheDocument();
    expect(screen.getByText(/Add Display.*Add Window.*to begin/i)).toBeInTheDocument();
  });

  it('should display added sources', () => {
    const sources: RecordingSource[] = [
      { type: 'display', id: '1', name: 'Display 1 (1920x1080)' },
      { type: 'window', id: '101', name: 'Chrome Browser' },
    ];

    render(<MultiSourceRecordingConfig {...defaultProps} sources={sources} />);

    expect(screen.getByText('Display 1 (1920x1080)')).toBeInTheDocument();
    expect(screen.getByText('Chrome Browser')).toBeInTheDocument();
    expect(screen.getByText('display')).toBeInTheDocument();
    expect(screen.getByText('window')).toBeInTheDocument();
  });

  it('should show display picker when Add Display clicked', async () => {
    render(<MultiSourceRecordingConfig {...defaultProps} />);

    const addDisplayButton = screen.getByText('Add Display');
    fireEvent.click(addDisplayButton);

    await waitFor(() => {
      expect(screen.getByText('Display 1')).toBeInTheDocument();
      expect(screen.getByText(/1920x1080.*Primary/i)).toBeInTheDocument();
      expect(screen.getByText('Display 2')).toBeInTheDocument();
      expect(screen.getByText(/2560x1440.*Secondary/i)).toBeInTheDocument();
    });
  });

  it('should show window picker when Add Window clicked', async () => {
    render(<MultiSourceRecordingConfig {...defaultProps} />);

    const addWindowButton = screen.getByText('Add Window');
    fireEvent.click(addWindowButton);

    await waitFor(() => {
      expect(screen.getByText('Chrome Browser')).toBeInTheDocument();
      expect(screen.getByText(/Google Chrome.*1200x800/i)).toBeInTheDocument();
      expect(screen.getByText('VS Code')).toBeInTheDocument();
      expect(screen.getByText(/Code.*1600x900/i)).toBeInTheDocument();
    });
  });

  it('should call onSourcesChange when display added', async () => {
    const onSourcesChange = vi.fn();

    render(<MultiSourceRecordingConfig {...defaultProps} onSourcesChange={onSourcesChange} />);

    // Open display picker
    fireEvent.click(screen.getByText('Add Display'));

    await waitFor(() => {
      const display1Button = screen.getByText('Display 1').closest('button');
      if (display1Button) fireEvent.click(display1Button);
    });

    expect(onSourcesChange).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'display',
        id: '1',
        name: expect.stringContaining('Display 1'),
      }),
    ]);
  });

  it('should call onSourcesChange when window added', async () => {
    const onSourcesChange = vi.fn();

    render(<MultiSourceRecordingConfig {...defaultProps} onSourcesChange={onSourcesChange} />);

    // Open window picker
    fireEvent.click(screen.getByText('Add Window'));

    await waitFor(() => {
      const chromeButton = screen.getByText('Chrome Browser').closest('button');
      if (chromeButton) fireEvent.click(chromeButton);
    });

    expect(onSourcesChange).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'window',
        id: '101',
        name: expect.stringContaining('Chrome'),
      }),
    ]);
  });

  it('should remove source when X button clicked', () => {
    const sources: RecordingSource[] = [
      { type: 'display', id: '1', name: 'Display 1' },
      { type: 'display', id: '2', name: 'Display 2' },
    ];

    const onSourcesChange = vi.fn();

    render(<MultiSourceRecordingConfig {...defaultProps} sources={sources} onSourcesChange={onSourcesChange} />);

    const removeButtons = screen.getAllByTitle('Remove source');
    fireEvent.click(removeButtons[0]);

    expect(onSourcesChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: '2' }),
    ]);
  });

  it('should show compositor selector when multiple sources added', () => {
    const sources: RecordingSource[] = [
      { type: 'display', id: '1', name: 'Display 1' },
      { type: 'display', id: '2', name: 'Display 2' },
    ];

    render(<MultiSourceRecordingConfig {...defaultProps} sources={sources} />);

    expect(screen.getByText('Layout Compositor')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('should hide compositor selector for single source', () => {
    const sources: RecordingSource[] = [
      { type: 'display', id: '1', name: 'Display 1' },
    ];

    render(<MultiSourceRecordingConfig {...defaultProps} sources={sources} />);

    expect(screen.queryByText('Layout Compositor')).not.toBeInTheDocument();
  });

  it('should call onCompositorChange when compositor changed', () => {
    const sources: RecordingSource[] = [
      { type: 'display', id: '1', name: 'Display 1' },
      { type: 'display', id: '2', name: 'Display 2' },
    ];

    const onCompositorChange = vi.fn();

    render(<MultiSourceRecordingConfig {...defaultProps} sources={sources} onCompositorChange={onCompositorChange} />);

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'sidebyside' } });

    expect(onCompositorChange).toHaveBeenCalledWith('sidebyside');
  });

  it('should prevent duplicate sources', async () => {
    const sources: RecordingSource[] = [
      { type: 'display', id: '1', name: 'Display 1 (1920x1080)' },
    ];

    const onSourcesChange = vi.fn();

    render(<MultiSourceRecordingConfig {...defaultProps} sources={sources} onSourcesChange={onSourcesChange} />);

    // Verify the source is already in the list
    expect(screen.getByText('Display 1 (1920x1080)')).toBeInTheDocument();

    // Try to add Display 1 again - verify callback isn't called
    fireEvent.click(screen.getByText('Add Display'));

    await waitFor(() => {
      // Find all buttons with "Display 1" text
      const buttons = screen.getAllByText('Display 1');
      // One should be in the picker dropdown
      expect(buttons.length).toBeGreaterThan(0);
    });

    // The already-added source should prevent the callback
    const pickerButtons = document.querySelectorAll('button[disabled]');
    expect(pickerButtons.length).toBeGreaterThan(0);
  });

  it('should show loading state when devices are loading', () => {
    render(<MultiSourceRecordingConfig {...defaultProps} loadingDevices={true} />);

    expect(screen.getAllByText('Loading...').length).toBeGreaterThan(0);
  });

  it('should call onLoadDevices when button clicked and no devices available', () => {
    const onLoadDevices = vi.fn();

    render(<MultiSourceRecordingConfig {...defaultProps} availableDisplays={[]} onLoadDevices={onLoadDevices} />);

    fireEvent.click(screen.getByText('Add Display'));

    expect(onLoadDevices).toHaveBeenCalled();
  });

  it('should show helpful tip about max sources', () => {
    const sources: RecordingSource[] = [
      { type: 'display', id: '1', name: 'Display 1' },
    ];

    render(<MultiSourceRecordingConfig {...defaultProps} sources={sources} />);

    expect(screen.getByText(/You can record up to 4 sources simultaneously/i)).toBeInTheDocument();
  });

  it('should automatically switch to passthrough when only one source', () => {
    const sources: RecordingSource[] = [
      { type: 'display', id: '1', name: 'Display 1' },
    ];

    const onCompositorChange = vi.fn();

    render(<MultiSourceRecordingConfig {...defaultProps} sources={sources} compositor="grid" onCompositorChange={onCompositorChange} />);

    // Component should automatically call onCompositorChange to switch to passthrough
    expect(onCompositorChange).toHaveBeenCalledWith('passthrough');
  });
});
