export interface ValidationError {
  field: string;
  message: string;
}
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}
export const validateRequired = (value: string | number | null | undefined, fieldName: string): ValidationError | null => {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return {
      field: fieldName,
      message: `${fieldName} is required`
    };
  }
  return null;
};
export const validateEmail = (email: string): ValidationError | null => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      field: 'email',
      message: 'Please enter a valid email address'
    };
  }
  return null;
};
export const validateMinLength = (value: string, minLength: number, fieldName: string): ValidationError | null => {
  if (value.length < minLength) {
    return {
      field: fieldName,
      message: `${fieldName} must be at least ${minLength} characters long`
    };
  }
  return null;
};
export const validateMaxLength = (value: string, maxLength: number, fieldName: string): ValidationError | null => {
  if (value.length > maxLength) {
    return {
      field: fieldName,
      message: `${fieldName} must be no more than ${maxLength} characters long`
    };
  }
  return null;
};
export const validateNumber = (value: string | number, fieldName: string): ValidationError | null => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) {
    return {
      field: fieldName,
      message: `${fieldName} must be a valid number`
    };
  }
  return null;
};
export const validatePositiveNumber = (value: string | number, fieldName: string): ValidationError | null => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num) || num <= 0) {
    return {
      field: fieldName,
      message: `${fieldName} must be a positive number`
    };
  }
  return null;
};
export const validateDate = (date: string, fieldName: string): ValidationError | null => {
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    return {
      field: fieldName,
      message: `${fieldName} must be a valid date`
    };
  }
  return null;
};
export const validateTime = (time: string, fieldName: string): ValidationError | null => {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(time)) {
    return {
      field: fieldName,
      message: `${fieldName} must be a valid time (HH:MM)`
    };
  }
  return null;
};
export const validateTimeRange = (startTime: string, endTime: string): ValidationError | null => {
  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);
  if (start >= end) {
    return {
      field: 'timeRange',
      message: 'End time must be after start time'
    };
  }
  return null;
};
export const validateFileSize = (file: File, maxSizeMB: number): ValidationError | null => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      field: 'file',
      message: `File size must be less than ${maxSizeMB}MB`
    };
  }
  return null;
};
export const validateFileType = (file: File, allowedTypes: string[]): ValidationError | null => {
  if (!allowedTypes.includes(file.type)) {
    return {
      field: 'file',
      message: `File type must be one of: ${allowedTypes.join(', ')}`
    };
  }
  return null;
};
export const validateWorkOrder = (data: {
  work_order_no: string;
  equipment_number: string;
  km_hrs?: string | number;
  requested_by: string;
  work_type: string;
}): ValidationResult => {
  const errors: ValidationError[] = [];
  const requiredFields = [
    { field: 'work_order_no', value: data.work_order_no, name: 'Work Order Number' },
    { field: 'equipment_number', value: data.equipment_number, name: 'Equipment Number' },
    { field: 'requested_by', value: data.requested_by, name: 'Requested By' },
    { field: 'work_type', value: data.work_type, name: 'Work Type' }
  ];
  requiredFields.forEach(({ value, name }) => {
    const error = validateRequired(value, name);
    if (error) errors.push(error);
  });
  if (data.km_hrs !== undefined && data.km_hrs !== '') {
    const kmHrsError = validatePositiveNumber(data.km_hrs, 'KM/Hrs');
    if (kmHrsError) errors.push(kmHrsError);
  }
  const lengthValidations = [
    { field: 'work_order_no', value: data.work_order_no, max: 50, name: 'Work Order Number' },
    { field: 'equipment_number', value: data.equipment_number, max: 100, name: 'Equipment Number' },
    { field: 'requested_by', value: data.requested_by, max: 100, name: 'Requested By' },
    { field: 'work_type', value: data.work_type, max: 100, name: 'Work Type' }
  ];
  lengthValidations.forEach(({ value, max, name }) => {
    const error = validateMaxLength(value, max, name);
    if (error) errors.push(error);
  });
  return {
    isValid: errors.length === 0,
    errors
  };
};
export const validateFinding = (data: { description: string }): ValidationResult => {
  const errors: ValidationError[] = [];
  const descriptionError = validateRequired(data.description, 'Finding Description');
  if (descriptionError) errors.push(descriptionError);
  const lengthError = validateMaxLength(data.description, 1000, 'Finding Description');
  if (lengthError) errors.push(lengthError);
  return {
    isValid: errors.length === 0,
    errors
  };
};
export const validateAction = (data: {
  description: string;
  action_date: string;
  start_time: string;
  end_time?: string;
}): ValidationResult => {
  const errors: ValidationError[] = [];
  const requiredFields = [
    { field: 'description', value: data.description, name: 'Action Description' },
    { field: 'action_date', value: data.action_date, name: 'Action Date' },
    { field: 'start_time', value: data.start_time, name: 'Start Time' }
  ];
  requiredFields.forEach(({ value, name }) => {
    const error = validateRequired(value, name);
    if (error) errors.push(error);
  });
  const startTimeError = validateTime(data.start_time, 'Start Time');
  if (startTimeError) errors.push(startTimeError);
  let endTimeError: ValidationError | null = null;
  if (data.end_time && data.end_time.trim() !== '') {
    endTimeError = validateTime(data.end_time, 'End Time');
    if (endTimeError) errors.push(endTimeError);
  }
  if (!startTimeError && !endTimeError && data.end_time && data.end_time.trim() !== '') {
    const timeRangeError = validateTimeRange(data.start_time, data.end_time);
    if (timeRangeError) errors.push(timeRangeError);
  }
  const lengthError = validateMaxLength(data.description, 1000, 'Action Description');
  if (lengthError) errors.push(lengthError);
  return {
    isValid: errors.length === 0,
    errors
  };
};
export const validateSparePart = (data: {
  part_name: string;
  part_number: string;
  quantity: string | number;
}): ValidationResult => {
  const errors: ValidationError[] = [];
  const requiredFields = [
    { field: 'part_name', value: data.part_name, name: 'Part Name' },
    { field: 'part_number', value: data.part_number, name: 'Part Number' },
    { field: 'quantity', value: data.quantity, name: 'Quantity' }
  ];
  requiredFields.forEach(({ value, name }) => {
    const error = validateRequired(value, name);
    if (error) errors.push(error);
  });
  const quantityError = validatePositiveNumber(data.quantity, 'Quantity');
  if (quantityError) errors.push(quantityError);
  const lengthValidations = [
    { field: 'part_name', value: data.part_name, max: 200, name: 'Part Name' },
    { field: 'part_number', value: data.part_number, max: 100, name: 'Part Number' }
  ];
  lengthValidations.forEach(({ value, max, name }) => {
    const error = validateMaxLength(value, max, name);
    if (error) errors.push(error);
  });
  return {
    isValid: errors.length === 0,
    errors
  };
};
export const validateTechnician = (data: {
  name: string;
  staff_id: string;
}): ValidationResult => {
  const errors: ValidationError[] = [];
  const requiredFields = [
    { field: 'name', value: data.name, name: 'Technician Name' },
    { field: 'staff_id', value: data.staff_id, name: 'Staff ID' }
  ];
  requiredFields.forEach(({ value, name }) => {
    const error = validateRequired(value, name);
    if (error) errors.push(error);
  });
  const lengthValidations = [
    { field: 'name', value: data.name, max: 100, name: 'Technician Name' },
    { field: 'staff_id', value: data.staff_id, max: 50, name: 'Staff ID' }
  ];
  lengthValidations.forEach(({ value, max, name }) => {
    const error = validateMaxLength(value, max, name);
    if (error) errors.push(error);
  });
  return {
    isValid: errors.length === 0,
    errors
  };
};
export const validateDateRange = (date: string, minDate: string, maxDate: string, fieldName: string): ValidationError | null => {
  const dateObj = new Date(date);
  const minDateObj = new Date(minDate);
  const maxDateObj = new Date(maxDate);
  if (dateObj < minDateObj) {
    return {
      field: fieldName,
      message: `${fieldName} cannot be before ${new Date(minDate).toLocaleDateString('en-GB')}`
    };
  }
  if (dateObj > maxDateObj) {
    return {
      field: fieldName,
      message: `${fieldName} cannot be after ${new Date(maxDate).toLocaleDateString('en-GB')}`
    };
  }
  return null;
};
export const validateActionDate = (
  actionDate: string, 
  workOrderDate: string, 
  previousActionDate?: string
): ValidationError | null => {
  const workOrderDateObj = new Date(workOrderDate);
  const actionDateObj = new Date(actionDate);
  if (actionDateObj < workOrderDateObj) {
    return {
      field: 'action_date',
      message: `Action date cannot be before work order date (${workOrderDateObj.toLocaleDateString('en-GB')})`
    };
  }
  if (previousActionDate) {
    const previousActionDateObj = new Date(previousActionDate);
    if (actionDateObj < previousActionDateObj) {
      return {
        field: 'action_date',
        message: `Action date cannot be before previous action date (${previousActionDateObj.toLocaleDateString('en-GB')})`
      };
    }
  }
  return null;
};
export const validateCompletionDate = (
  completionDate: string,
  workOrderDate: string,
  lastActionDate?: string
): ValidationError | null => {
  const completionDateObj = new Date(completionDate);
  const workOrderDateObj = new Date(workOrderDate);
  if (completionDateObj < workOrderDateObj) {
    return {
      field: 'completion_date',
      message: `Completion date cannot be before work order date (${workOrderDateObj.toLocaleDateString('en-GB')})`
    };
  }
  if (lastActionDate) {
    const lastActionDateObj = new Date(lastActionDate);
    if (completionDateObj < lastActionDateObj) {
      return {
        field: 'completion_date',
        message: `Completion date cannot be before the last action date (${lastActionDateObj.toLocaleDateString('en-GB')})`
      };
    }
  }
  return null;
};