import React, { useState, useEffect } from 'react';
import { Mic, Monitor, Camera, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AudioDevice, DisplayInfo, WebcamInfo } from '../../types';
import { getGlassClasses, getRadiusClass, TRANSITIONS } from '../../design-system/theme';

interface DeviceSelectorProps {
  type: 'audio-input' | 'audio-output' | 'display' | 'webcam';
  label: string;
  value?: string;
  onChange: (deviceId: string) => void;
  devices: AudioDevice[] | DisplayInfo[] | WebcamInfo[];
  disabled?: boolean;
  compact?: boolean;
  loading?: boolean;
}

export const DeviceSelector = React.memo(function DeviceSelector({
  type,
  label,
  value,
  onChange,
  devices,
  disabled = false,
  compact = false,
  loading = false,
}: DeviceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getIcon = () => {
    switch (type) {
      case 'audio-input':
      case 'audio-output':
        return <Mic size={16} className="text-gray-600" />;
      case 'display':
        return <Monitor size={16} className="text-gray-600" />;
      case 'webcam':
        return <Camera size={16} className="text-gray-600" />;
    }
  };

  const getSelectedDevice = () => {
    if (!value) return null;

    if (type === 'audio-input' || type === 'audio-output') {
      return (devices as AudioDevice[]).find(d => d.id === value);
    } else if (type === 'display') {
      return (devices as DisplayInfo[]).find(d => d.displayId === value);
    } else {
      return (devices as WebcamInfo[]).find(d => d.deviceId === value);
    }
  };

  const getDeviceName = (device: AudioDevice | DisplayInfo | WebcamInfo) => {
    if ('name' in device) return device.name;
    if ('displayName' in device) return device.displayName;
    if ('deviceName' in device) return device.deviceName;
    return 'Unknown Device';
  };

  const getDeviceId = (device: AudioDevice | DisplayInfo | WebcamInfo) => {
    if ('id' in device) return device.id;
    if ('displayId' in device) return device.displayId;
    if ('deviceId' in device) return device.deviceId;
    return '';
  };

  const selectedDevice = getSelectedDevice();
  const selectedName = selectedDevice
    ? getDeviceName(selectedDevice)
    : devices.length > 0
    ? getDeviceName(devices[0])
    : 'No devices available';

  // Auto-select first device if none selected
  useEffect(() => {
    if (!value && devices.length > 0) {
      onChange(getDeviceId(devices[0]));
    }
  }, [devices, value, onChange]);

  // Loading skeleton
  if (loading) {
    return compact ? (
      <div className={`${getGlassClasses('subtle')} ${getRadiusClass('field')} px-3 py-2 animate-pulse`}>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-300 rounded" />
          <div className="h-3 bg-gray-300 rounded w-32" />
        </div>
      </div>
    ) : (
      <div className="space-y-2">
        {label && <div className="h-4 bg-gray-300 rounded w-24 animate-pulse" />}
        <div className={`${getGlassClasses('subtle')} ${getRadiusClass('field')} px-4 py-3 animate-pulse`}>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-300 rounded" />
            <div className="h-4 bg-gray-300 rounded w-40" />
          </div>
        </div>
      </div>
    );
  }

  if (devices.length === 0) {
    return compact ? (
      <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
        No devices
      </div>
    ) : (
      <div className="space-y-2">
        <label className="text-sm font-semibold text-gray-900">{label}</label>
        <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
          No {type.replace('-', ' ')}s found
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? 'relative' : 'space-y-2 relative'}>
      {label && !compact && (
        <label className="text-sm font-semibold text-gray-900">{label}</label>
      )}

      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full text-left
          ${getGlassClasses('medium')}
          hover:bg-white/70 hover:border-cyan-300
          ${TRANSITIONS.fast}
          flex items-center justify-between
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${compact ? `px-3 py-2 ${getRadiusClass('field')} text-xs` : `px-4 py-3 ${getRadiusClass('field')}`}
        `}
        aria-label={`Select ${type.replace('-', ' ')}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          {getIcon()}
          <span className={compact ? 'text-xs text-gray-900' : 'text-sm text-gray-900'}>{selectedName}</span>
        </div>
        <ChevronDown
          size={compact ? 14 : 16}
          className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className={`
              absolute z-50 w-full mt-1
              ${getGlassClasses('extra-strong')}
              overflow-hidden
              ${compact ? getRadiusClass('field') : getRadiusClass('field')}
            `}
            role="listbox"
            aria-label={`${type.replace('-', ' ')} options`}
          >
            <div className="max-h-60 overflow-y-auto">
              {devices.map((device) => {
                const deviceId = getDeviceId(device);
                const deviceName = getDeviceName(device);
                const isSelected = value === deviceId;
                const isDefault = 'isDefault' in device && device.isDefault;
                const isPrimary = 'isPrimary' in device && device.isPrimary;

                return (
                  <button
                    key={deviceId}
                    type="button"
                    onClick={() => {
                      onChange(deviceId);
                      setIsOpen(false);
                    }}
                    className={`
                      w-full text-left
                      hover:bg-cyan-50 transition-colors
                      ${isSelected ? 'bg-cyan-100 text-cyan-900' : 'text-gray-700'}
                      flex items-center justify-between
                      ${compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm'}
                    `}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate">{deviceName}</span>
                      {(isDefault || isPrimary) && (
                        <span className={`flex-shrink-0 bg-cyan-500 text-white rounded-full ${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'}`}>
                          Default
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <div className={`rounded-full bg-cyan-500 flex-shrink-0 ${compact ? 'w-1.5 h-1.5' : 'w-2 h-2'}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
