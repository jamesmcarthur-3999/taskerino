import React, { useState, forwardRef } from 'react';
import { Search, Eye, EyeOff } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { getInputClasses, RADIUS, SHADOWS, TRANSITIONS } from '../design-system/theme';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  variant?: 'default' | 'search' | 'password';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      variant = 'default',
      className = '',
      type = 'text',
      disabled = false,
      ...props
    },
    ref
  ) => {
    const { colorScheme } = useTheme();
    const [showPassword, setShowPassword] = useState(false);

    // Determine the actual input type based on variant and password visibility
    const actualType = variant === 'password'
      ? (showPassword ? 'text' : 'password')
      : type;

    // Determine icons based on variant
    const actualLeftIcon = variant === 'search'
      ? <Search className="w-5 h-5 text-gray-500" />
      : leftIcon;

    const actualRightIcon = variant === 'password'
      ? (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className={`text-gray-500 hover:text-gray-700 ${TRANSITIONS.fast} focus:outline-none`}
            tabIndex={-1}
            disabled={disabled}
          >
            {showPassword ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        )
      : rightIcon;

    // Calculate padding based on icons
    const paddingLeft = actualLeftIcon ? 'pl-11' : 'pl-4';
    const paddingRight = actualRightIcon ? 'pr-11' : 'pr-4';

    // Error state classes
    const errorClasses = error
      ? 'border-red-500 focus:ring-red-400 focus:border-red-500'
      : '';

    // Disabled state classes
    const disabledClasses = disabled
      ? 'opacity-50 cursor-not-allowed'
      : '';

    return (
      <div className="w-full space-y-1">
        {label && (
          <label className={`block text-sm font-medium text-gray-700 ${disabled ? 'opacity-50' : ''}`}>
            {label}
          </label>
        )}

        <div className="relative">
          {actualLeftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              {actualLeftIcon}
            </div>
          )}

          <input
            ref={ref}
            type={actualType}
            disabled={disabled}
            className={`
              w-full
              ${paddingLeft}
              ${paddingRight}
              py-2.5
              text-gray-900
              placeholder:text-gray-500
              ${getInputClasses(colorScheme)}
              ${errorClasses}
              ${disabledClasses}
              ${className}
            `}
            {...props}
          />

          {actualRightIcon && (
            <div className={`absolute right-3 top-1/2 -translate-y-1/2 ${variant === 'password' ? '' : 'pointer-events-none'}`}>
              {actualRightIcon}
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 flex items-center gap-1">
            {error}
          </p>
        )}

        {helperText && !error && (
          <p className="text-xs text-gray-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
