import React, { useId } from 'react';
interface FileUploadProps {
  label?: string;
  name: string;
  accept?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
}
export const FileUpload: React.FC<FileUploadProps> = ({
  label,
  name,
  accept = "image/*,.pdf,.doc,.docx",
  onChange,
  error,
  helperText,
  required = false,
  disabled = false
}) => {
  const generatedId = useId();
  const inputId = generatedId;
  const baseClasses = 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-0 transition-colors text-gray-900';
  const stateClasses = error 
    ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
    : 'border-gray-300 focus:ring-[#08398F] focus:border-[#08398F]';
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        name={name}
        type="file"
        accept={accept}
        onChange={onChange}
        className={`${baseClasses} ${stateClasses} file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#08398F] file:text-white hover:file:bg-[#062a6b]`}
        required={required}
        disabled={disabled}
      />
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
}; 