'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { FileUpload } from '../../components/FileUpload';
import { Card } from '../../components/Card';
import { apiClient, getApiBaseUrl } from '../../utils/api';
import { useToast } from '../../components/ToastContext';
import { validateWorkOrder, validateFileSize, validateFileType } from '../../utils/validation';
import { WorkOrder } from '../../types';
import { WORK_TYPES } from '../../utils/workTypes';

interface CreateWorkOrderForm {
  work_order_no: string;
  work_order_date: string;
  equipment_number: string;
  km_hrs?: string;
  requested_by: string;
  work_type: string;
  work_type_other?: string;
  job_allocation_time: string;
  description: string;
  reference_document?: File;
}

export default function CreateWorkOrderPage() {
  const [formData, setFormData] = useState<CreateWorkOrderForm>({
    work_order_no: '',
    work_order_date: '',
    equipment_number: '',
    km_hrs: '',
    requested_by: '',
    work_type: '',
    work_type_other: '',
    job_allocation_time: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<CreateWorkOrderForm>>({});
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const router = useRouter();
  const toast = useToast();


  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get<WorkOrder[]>('/work-orders?status=all');
        if (res.success && res.data && res.data.length > 0) {
          let latest = res.data[0];
          if (res.data.length > 1) {
            latest = res.data.reduce((a, b) => {
              const aDate = a.created_at ? new Date(a.created_at).getTime() : a.id || 0;
              const bDate = b.created_at ? new Date(b.created_at).getTime() : b.id || 0;
              return bDate > aDate ? b : a;
            });
          }

          const normalizedDate = latest.work_order_date ? (new Date(latest.work_order_date).toISOString().split('T')[0]) : new Date().toISOString().split('T')[0];
          setFormData(prev => ({
            ...prev,
            work_order_no: latest.work_order_no || prev.work_order_no,
            work_order_date: normalizedDate
          }));
          return;
        }
      } catch {
      }

      const today = new Date().toISOString().split('T')[0];
      setFormData(prev => ({
        ...prev,
        work_order_date: today
      }));
    })();
  }, []);

  const validateForm = (): boolean => {
    const validation = validateWorkOrder({
      work_order_no: formData.work_order_no,
      equipment_number: formData.equipment_number,
      km_hrs: formData.km_hrs,
      requested_by: formData.requested_by,
      work_type: formData.work_type
    });

    if (!validation.isValid) {
      toast.showError('Validation Error', validation.errors[0].message);
      return false;
    }

    if (!formData.description || formData.description.trim().length < 5) {
      toast.showError('Validation Error', 'Please provide a brief description of the work (min 5 chars)');
      return false;
    }

    if (formData.work_type === 'Others' && (!formData.work_type_other || formData.work_type_other.trim() === '')) {
      toast.showError('Validation Error', 'Please specify the work type when selecting "Others"');
      return false;
    }

    if (!formData.work_order_date) {
      toast.showError('Validation Error', 'Work order date is required');
      return false;
    }

    if (!formData.job_allocation_time) {
      toast.showError('Validation Error', 'Job allocation time is required');
      return false;
    }

    if (formData.reference_document) {
      const fileSizeError = validateFileSize(formData.reference_document, 10); 
      if (fileSizeError) {
        toast.showError('Validation Error', fileSizeError.message);
        return false;
      }

      const fileTypeError = validateFileType(formData.reference_document, [
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ]);
      if (fileTypeError) {
        toast.showError('Validation Error', fileTypeError.message);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const workOrderDate = new Date(formData.work_order_date);
      const formattedWorkOrderDate = workOrderDate.toISOString().split('T')[0]; 

      const jobAllocationTime = new Date(formData.job_allocation_time);
      const formattedJobAllocationTime = jobAllocationTime.toISOString();

      let referenceDocumentPath: string | undefined;

      if (formData.reference_document) {
        setUploadProgress('Uploading file...');
        const uploadFormData = new FormData();
        uploadFormData.append('file', formData.reference_document);
        if (formData.work_order_no) {
          uploadFormData.append('work_order_no', formData.work_order_no);
        }

        const uploadResponse = await fetch(`${getApiBaseUrl()}/upload`, {
          method: 'POST',
          body: uploadFormData,
        });

        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json();
          if (uploadResult.success) {
            referenceDocumentPath = uploadResult.data.path;
            setUploadProgress('File uploaded successfully!');
          } else {
            setUploadProgress('');
            toast.showError('File Upload Error', uploadResult.error || 'File upload failed');
            return;
          }
        } else {
          setUploadProgress('');
          toast.showError('File Upload Error', 'File upload failed');
          return;
        }
      }

      let finalWorkType = formData.work_type;
      if (formData.work_type === 'Others' && formData.work_type_other) {
        finalWorkType = formData.work_type_other
          .toLowerCase()
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }

      const workOrderData = {
        work_order_no: formData.work_order_no,
        work_order_date: formattedWorkOrderDate,
        equipment_number: formData.equipment_number,
        km_hrs: formData.km_hrs ? parseInt(formData.km_hrs) : undefined,
        requested_by: formData.requested_by,
        work_type: finalWorkType,
        job_allocation_time: formattedJobAllocationTime,
        description: formData.description.trim(),
        reference_document: referenceDocumentPath,
        status: 'pending' as const
      };

      const response = await apiClient.post<WorkOrder>('/work-orders', workOrderData);
      if (response.success && response.data) {
        toast.showSuccess('Work order submitted for approval');
        router.push('/work-orders/ongoing');
      } else {
        toast.showError('Error', response.error || 'Failed to create work order');
      }
    } catch {
      setUploadProgress('');
      toast.showError('Error', 'An error occurred while creating the work order');
    } finally {
      setLoading(false);
      setUploadProgress('');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name as keyof CreateWorkOrderForm]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }

    if (name === 'work_type' && value !== 'Others') {
      setFormData(prev => ({
        ...prev,
        work_type_other: undefined
      }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        reference_document: file
      }));
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Work Order</h1>
        <p className="text-gray-600">Fill in the details below to create a new work order</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Input
                label="Work Order Number"
                name="work_order_no"
                type="text"
                value={formData.work_order_no}
                onChange={handleChange}
                error={errors.work_order_no}
                placeholder="e.g., WO-2024-001"
                required
              />
            </div>

            <Input
              label="Work Order Date"
              name="work_order_date"
              type="date"
              value={formData.work_order_date}
              onChange={handleChange}
              error={errors.work_order_date}
              required
            />

            <Input
              label="Equipment Number"
              name="equipment_number"
              type="text"
              value={formData.equipment_number}
              onChange={handleChange}
              error={errors.equipment_number}
              placeholder="e.g., EQ-001"
              required
            />

            <Input
              label="KM/Hrs"
              name="km_hrs"
              type="number"
              value={formData.km_hrs}
              onChange={handleChange}
              error={errors.km_hrs}
              placeholder="e.g., 5000 (Optional)"
            />

            <Input
              label="Requested By"
              name="requested_by"
              type="text"
              value={formData.requested_by}
              onChange={handleChange}
              error={errors.requested_by}
              placeholder="Enter requester name"
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Work Type <span className="text-red-500">*</span>
              </label>
              <select
                name="work_type"
                value={formData.work_type}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#08398F] focus:border-[#08398F] ${
                  errors.work_type ? 'border-red-300' : 'border-gray-300'
                }`}
                required
              >
                <option value="">Select work type</option>
                {WORK_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              {errors.work_type && (
                <p className="mt-1 text-sm text-red-600">{errors.work_type}</p>
              )}
            </div>

            {}
            {formData.work_type === 'Others' && (
              <Input
                label="Specify Work Type"
                name="work_type_other"
                type="text"
                value={formData.work_type_other || ''}
                onChange={handleChange}
                placeholder="Please specify the work type"
                required
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Work Description <span className="text-red-500">*</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe the work to be performed"
              className="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#08398F] focus:border-[#08398F]"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Provide enough detail to help during approval and execution.</p>
          </div>

          <Input
            label="Job Allocation Time"
            name="job_allocation_time"
            type="datetime-local"
            value={formData.job_allocation_time}
            onChange={handleChange}
            error={errors.job_allocation_time}
            required
          />

          <FileUpload
            label="Reference Document (Optional)"
            name="reference_document"
            onChange={handleFileChange}
            helperText="Upload photos, PDFs, or documents related to this work order"
            accept="image/*,.pdf,.doc,.docx"
          />
          {uploadProgress && (
            <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded-lg">
              {uploadProgress}
            </div>
          )}

          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={loading}
            >
              {loading ? 'Creating...' : 'Create Work Order'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
} 