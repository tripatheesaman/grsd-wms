'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { Button } from '../../components/Button';
import { useAuth } from '../../components/AuthProvider';
import { Input } from '../../components/Input';
import { Card } from '../../components/Card';
import { apiClient, getApiBaseUrl, toPublicUrl } from '../../utils/api';
import { useToast } from '../../components/ToastContext';
import { validateAction, validateSparePart, validateFinding, validateCompletionDate } from '../../utils/validation';
import { WorkOrder, Finding, Action, SparePart, Technician, ActionTechnician, ActionDate, Unit } from '../../types';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { WORK_TYPES } from '../../utils/workTypes';

function toTimeHHMM(value: string): string {
  if (!value) return '';
  const timeMatch = value.match(/T(\d{2}:\d{2})/);
  if (timeMatch && timeMatch[1]) return timeMatch[1];
  const hhmmMatch = value.match(/^(\d{2}:\d{2})/);
  if (hhmmMatch && hhmmMatch[1]) return hhmmMatch[1];
  const parts = value.split(' ');
  if (parts.length > 1 && /\d{2}:\d{2}/.test(parts[1])) return parts[1].slice(0,5);
  return '';
}

interface WorkOrderDetail extends WorkOrder {
  status: 'pending' | 'ongoing' | 'completion_requested' | 'completed' | 'rejected';
  requested_by_id?: number;
  rejection_reason?: string;
  completion_approved_by_name?: string;
  completion_requested_by_name?: string;
  findings: FindingWithActions[];
}

interface FindingWithActions extends Finding {
  actions: ActionWithSpareParts[];
}

interface ActionWithSpareParts extends Action {
  spare_parts: SparePart[];
}

interface NewFinding {
  description: string;
  reference_image?: File;
}

interface NewAction {
  description: string;
  action_date: string;
  start_time: string;
  end_time?: string;
  is_completed?: boolean;
  remarks?: string;
}

interface NewSparePart {
  part_name: string;
  part_number: string;
  quantity: number;
  unit?: string;
}

export default function WorkOrderDetailPage() {
  const { user } = useAuth();
  const [isEditingRejected, setIsEditingRejected] = useState(false);
  const params = useParams();
  const workOrderId = Number(params.id);
  const [workOrder, setWorkOrder] = useState<WorkOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editCore, setEditCore] = useState({
    equipment_number: '',
    work_type: '',
    work_type_other: '',
    requested_by: '',
    km_hrs: 0,
    work_order_date: '',
  });
  const [isEditingWorkOrder, setIsEditingWorkOrder] = useState(false);
  const [isApprovingWorkOrder, setIsApprovingWorkOrder] = useState(false);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [newFinding, setNewFinding] = useState<NewFinding>({ description: '' });
  const [selectedFindingForAction, setSelectedFindingForAction] = useState<number | null>(null);
  const [selectedActionForSparePart, setSelectedActionForSparePart] = useState<number | null>(null);
  const [editingFinding, setEditingFinding] = useState<number | null>(null);
  const [editingAction, setEditingAction] = useState<number | null>(null);
  const [editingSparePart, setEditingSparePart] = useState<number | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showCompletionIssuesModal, setShowCompletionIssuesModal] = useState(false);
  const [completionIssuesMessage, setCompletionIssuesMessage] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showReferenceImageModal, setShowReferenceImageModal] = useState(false);
  const [referenceImageFile, setReferenceImageFile] = useState<File | null>(null);
  const [isUploadingReferenceImage, setIsUploadingReferenceImage] = useState(false);
  const [completionDate, setCompletionDate] = useState(new Date().toISOString().split('T')[0]);
  const [showStartAgainModal, setShowStartAgainModal] = useState(false);
  const [selectedActionForStartAgain, setSelectedActionForStartAgain] = useState<number | null>(null);
  const [startAgainData, setStartAgainData] = useState({
    action_date: new Date().toISOString().split('T')[0],
    start_time: '',
    end_time: '',
    technician_ids: [] as number[]
  });
  const [actionDates, setActionDates] = useState<{ [actionId: number]: ActionDate[] }>({});
  const [editingActionDate, setEditingActionDate] = useState<number | null>(null);
  const [editActionDateData, setEditActionDateData] = useState({
    action_date: '',
    start_time: '',
    end_time: '',
    is_completed: false,
    technician_ids: [] as number[]
  });
  const [newAction, setNewAction] = useState<NewAction>({
    description: '',
    action_date: new Date().toISOString().split('T')[0],
    start_time: '',
    end_time: '',
    is_completed: false
  });
  const [newActionTechnicianIds, setNewActionTechnicianIds] = useState<number[]>([]);
  const [addFindingFor, setAddFindingFor] = useState<number | null>(null);
  const [newSparePart, setNewSparePart] = useState<NewSparePart>({
    part_name: '',
    part_number: '',
    quantity: 1,
    unit: ''
  });
  const [editFinding, setEditFinding] = useState<NewFinding>({ description: '' });
  const [editAction, setEditAction] = useState<NewAction>({
    description: '',
    action_date: new Date().toISOString().split('T')[0],
    start_time: '',
    end_time: ''
  });
  const [editSparePart, setEditSparePart] = useState<NewSparePart>({
    part_name: '',
    part_number: '',
    quantity: 1,
    unit: ''
  });

  const [showDeleteFindingModal, setShowDeleteFindingModal] = useState(false);
  const [showDeleteActionModal, setShowDeleteActionModal] = useState(false);
  const [showDeleteSparePartModal, setShowDeleteSparePartModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: number; type: 'finding' | 'action' | 'sparePart' } | null>(null);

  const toast = useToast();

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get<Technician[]>('/technicians');
        if (res.success && res.data) setTechnicians(res.data);
        const ures = await apiClient.get<Unit[]>('/units');
        if (ures.success && ures.data) setUnits(ures.data);
      } catch {
      }
    })();
  }, []);

  const fetchWorkOrderDetails = useCallback(async () => {
    try {
      const response = await apiClient.get<WorkOrderDetail>(`/work-orders/${workOrderId}`);
      if (response.success && response.data) {
        const workOrderWithArrays = {
          ...response.data,
          findings: response.data.findings || []
        };
        workOrderWithArrays.findings = workOrderWithArrays.findings.map(finding => ({
          ...finding,
          actions: finding.actions || []
        }));
        workOrderWithArrays.findings = workOrderWithArrays.findings.map(finding => ({
          ...finding,
          actions: finding.actions.map(action => ({
            ...action,
            spare_parts: action.spare_parts || []
          }))
        }));
        setWorkOrder(workOrderWithArrays);
        setEditCore({
          equipment_number: workOrderWithArrays.equipment_number,
          work_type: workOrderWithArrays.work_type,
          work_type_other: '',
          requested_by: workOrderWithArrays.requested_by,
          km_hrs: workOrderWithArrays.km_hrs || 0,
          work_order_date: workOrderWithArrays.work_order_date,
        });

        (async () => {
          try {
            const actionIds: number[] = [];
            for (const f of workOrderWithArrays.findings) {
              for (const a of f.actions) {
                if (a && a.id) actionIds.push(a.id);
              }
            }
            await Promise.all(actionIds.map(id => fetchActionDates(id)));
          } catch {
          }
        })();
      }
    } catch (error) {
      console.error('Error fetching work order details:', error);
    } finally {
      setLoading(false);
    }
  }, [workOrderId]);



  useEffect(() => {
    if (workOrderId) {
      fetchWorkOrderDetails();
    }
  }, [workOrderId, fetchWorkOrderDetails]);

  useEffect(() => {
    if (workOrder && workOrder.findings) {
      workOrder.findings.forEach(finding => {
        if (finding.actions) {
          finding.actions.forEach(action => {
            fetchActionDates(action.id);
          });
        }
      });
    }
  }, [workOrder]);

  const handleAddFinding = async () => {
    try {
      const validation = validateFinding({ description: newFinding.description });
      if (!validation.isValid) {
        toast.showError('Validation Error', validation.errors[0].message);
        return;
      }

      let referenceImagePath: string | undefined;

      if (newFinding.reference_image) {
        const uploadFormData = new FormData();
        uploadFormData.append('file', newFinding.reference_image);

        const uploadResponse = await fetch(`${getApiBaseUrl()}/upload`, {
          method: 'POST',
          body: uploadFormData,
        });

        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json();
          if (uploadResult.success) {
            referenceImagePath = uploadResult.data.path;
          } else {
            toast.showError('Error uploading image', uploadResult.error);
            return;
          }
        } else {
          toast.showError('Error uploading image');
          return;
        }
      }

      const response = await apiClient.post<Finding>('/findings', {
        work_order_id: workOrderId,
        description: newFinding.description,
        reference_image: referenceImagePath
      });
      if (response.success) {
        setNewFinding({ description: '' });
        fetchWorkOrderDetails();
        toast.showSuccess('Finding added successfully');
      }
    } catch (error) {
      console.error('Error adding finding:', error);
      toast.showError('Error adding finding');
    }
  };

  const fetchActionDates = async (actionId: number) => {
    try {
      const response = await apiClient.get(`/actions/${actionId}/dates`);
      if (response.success && response.data) {
        setActionDates(prev => ({
          ...prev,
          [actionId]: response.data as ActionDate[]
        }));
      }
    } catch (error) {
      console.error('Error fetching action dates:', error);
    }
  };

  const handleStartAgain = async () => {
    if (!selectedActionForStartAgain) return;
    try {
      const response = await apiClient.post(`/actions/${selectedActionForStartAgain}/dates`, {
        action_date: startAgainData.action_date,
        start_time: startAgainData.start_time,
        end_time: startAgainData.end_time,
        is_completed: false
      });
      if (!response.success) {
        if (response.data) {
          const respData = response.data as unknown as { previous_action_date?: { action_date?: string } };
          const prev = respData.previous_action_date;
          if (prev) {
            const prevDate = prev.action_date ? new Date(prev.action_date).toLocaleDateString('en-GB') : String(prev.action_date);
            if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) document.activeElement.blur();
            toast.showError('Cannot start again', `Please enter an end time for the previous action date (${prevDate}) before starting again.`);
            return;
          }
        }

        toast.showError('Error adding action date', response.error || response.message || 'Failed to add action date');
        return;
      }

      if (response.success) {
        if (startAgainData.technician_ids.length > 0) {
          for (const techId of startAgainData.technician_ids) {
            try {
              await apiClient.post(`/actions/${selectedActionForStartAgain}/technicians`, { technician_id: techId });
            } catch {}
          }
        }
        setShowStartAgainModal(false);
        setSelectedActionForStartAgain(null);
        setStartAgainData({
          action_date: new Date().toISOString().split('T')[0],
          start_time: '',
          end_time: '',
          technician_ids: []
        });
        fetchWorkOrderDetails();
        fetchActionDates(selectedActionForStartAgain);
        toast.showSuccess('Action date added successfully');
      }
    } catch (error) {
      console.error('Error adding action date:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error adding action date';
      if (errorMessage.includes('already exists') || errorMessage.includes('duplicate') || errorMessage.includes('unique')) {
        toast.showError('This date already exists for this action. Please choose a different date.');
      } else {
        toast.showError(errorMessage);
      }
    }
  };

  const handleEditActionDate = async (actionId: number) => {
    if (!editingActionDate) return;
    try {
      const response = await apiClient.put(`/actions/${actionId}/dates/${editingActionDate}`, {
        action_date: editActionDateData.action_date,
        start_time: editActionDateData.start_time,
        end_time: editActionDateData.end_time || null,
        is_completed: editActionDateData.is_completed
      });
      if (response.success) {
        setEditingActionDate(null);
        setEditActionDateData({
          action_date: '',
          start_time: '',
          end_time: '',
          is_completed: false,
          technician_ids: []
        });
        fetchWorkOrderDetails();
        fetchActionDates(actionId);
        toast.showSuccess('Action date updated successfully');
      } else {
        toast.showError('Error updating action date', response.error);
      }
    } catch (error) {
      console.error('Error updating action date:', error);
      toast.showError('Error updating action date');
    }
  };

  const handleCompleteAction = async (actionId: number, actionDateId: number) => {
    try {
      const response = await apiClient.put(`/actions/${actionId}/dates/${actionDateId}`, { is_completed: true });
      if (response.success) {
        fetchWorkOrderDetails();
        fetchActionDates(actionId);
        toast.showSuccess('Action marked as completed');
      } else {
        toast.showError('Error', response.error || 'Failed to complete action');
      }
    } catch (error) {
      console.error('Error completing action date:', error);
      toast.showError('Error completing action date');
    }
  };

  const handleRevertAction = async (actionId: number, actionDateId: number) => {
    try {
      const response = await apiClient.put(`/actions/${actionId}/dates/${actionDateId}`, { is_completed: false });
      if (response.success) {
        fetchWorkOrderDetails();
        fetchActionDates(actionId);
        toast.showSuccess('Action completion reverted');
      } else {
        toast.showError('Error', response.error || 'Failed to revert completion');
      }
    } catch (error) {
      console.error('Error reverting action date completion:', error);
      toast.showError('Error reverting action date completion');
    }
  };

  const handleDeleteActionDate = async (actionId: number, actionDateId: number) => {
    try {
      const response = await apiClient.delete(`/actions/${actionId}/dates/${actionDateId}`);
      if (response.success) {
        fetchActionDates(actionId);
        toast.showSuccess('Action date deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting action date:', error);
      toast.showError('Error deleting action date');
    }
  };

  const handleAddAction = async (findingId: number) => {
    try {
      const validation = validateAction(newAction);
      if (!validation.isValid) {
        toast.showError('Validation Error', validation.errors[0].message);
        return;
      }

      if (!workOrder) {
        toast.showError('Error', 'Work order not found');
        return;
      }


      const response = await apiClient.post<Action>('/actions', {
        finding_id: findingId,
        description: newAction.description,
        action_date: newAction.action_date,
        start_time: newAction.start_time,
        end_time: newAction.end_time,
        is_completed: newAction.is_completed,
        remarks: newAction.remarks || null
      });
      if (response.success) {
        const createdAction = response.data as unknown as Action;
        if (createdAction && Array.isArray(newActionTechnicianIds) && newActionTechnicianIds.length > 0) {
          for (const techId of newActionTechnicianIds) {
            try {
              await apiClient.post<ActionTechnician>(`/actions/${createdAction.id}/technicians`, { technician_id: techId });
            } catch {}
          }
        }
        setNewAction({
          description: '',
          action_date: new Date().toISOString().split('T')[0],
          start_time: '',
          end_time: '',
          is_completed: false,
          remarks: ''
        });
        setNewActionTechnicianIds([]);
        setSelectedFindingForAction(null);
        fetchWorkOrderDetails();
        toast.showSuccess('Action added successfully');
      }
    } catch (error) {
      console.error('Error adding action:', error);
      toast.showError('Error adding action');
    }
  };

  const handleAddSparePart = async (actionId: number) => {
    try {
      const validation = validateSparePart(newSparePart);
      if (!validation.isValid) {
        toast.showError('Validation Error', validation.errors[0].message);
        return;
      }

      const response = await apiClient.post<SparePart>('/spare-parts', {
        action_id: actionId,
        part_name: newSparePart.part_name,
        part_number: newSparePart.part_number,
        quantity: newSparePart.quantity,
        unit: newSparePart.unit
      });
      if (response.success) {
        setNewSparePart({
          part_name: '',
          part_number: '',
          quantity: 1,
          unit: ''
        });
        setSelectedActionForSparePart(null);
        fetchWorkOrderDetails();
        toast.showSuccess('Spare part added successfully');
      }
    } catch (error) {
      console.error('Error adding spare part:', error);
      toast.showError('Error adding spare part');
    }
  };



  const handleEditFinding = async (findingId: number) => {
    try {
      const validation = validateFinding({ description: editFinding.description });
      if (!validation.isValid) {
        toast.showError('Validation Error', validation.errors[0].message);
        return;
      }

      const response = await apiClient.put<Finding>(`/findings/${findingId}`, {
        description: editFinding.description,
        reference_image: editFinding.reference_image
      });
      if (response.success) {
        setEditFinding({ description: '' });
        setEditingFinding(null);
        fetchWorkOrderDetails();
        toast.showSuccess('Finding updated successfully');
      }
    } catch (error) {
      console.error('Error updating finding:', error);
      toast.showError('Error updating finding');
    }
  };

  const handleDeleteFinding = async (findingId: number) => {
    setItemToDelete({ id: findingId, type: 'finding' });
    setShowDeleteFindingModal(true);
  };

  const confirmDeleteFinding = async () => {
    if (!itemToDelete) return;
    try {
      const response = await apiClient.delete(`/findings/${itemToDelete.id}`);
      if (response.success) {
        fetchWorkOrderDetails();
        toast.showSuccess('Finding deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting finding:', error);
      toast.showError('Error deleting finding');
    } finally {
      setShowDeleteFindingModal(false);
      setItemToDelete(null);
    }
  };

  const handleEditAction = async (actionId: number) => {
    try {
      const validation = validateAction(editAction);
      if (!validation.isValid) {
        toast.showError('Validation Error', validation.errors[0].message);
        return;
      }

      if (!workOrder) {
        toast.showError('Error', 'Work order not found');
        return;
      }

      let currentAction: Action | undefined;
      let finding: FindingWithActions | undefined;
      for (const f of workOrder.findings) {
        const action = f.actions.find(a => a.id === actionId);
        if (action) {
          currentAction = action;
          finding = f;
          break;
        }
      }

      if (!currentAction || !finding) {
        toast.showError('Error', 'Action not found');
        return;
      }

      const response = await apiClient.put<Action>(`/actions/${actionId}`, {
        description: editAction.description,
        action_date: editAction.action_date,
        start_time: editAction.start_time,
        end_time: editAction.end_time,
        remarks: editAction.remarks || null
      });
      if (response.success) {
        setEditAction({
          description: '',
          action_date: new Date().toISOString().split('T')[0],
          start_time: '',
          end_time: '',
          remarks: ''
        });
        setEditingAction(null);
        fetchWorkOrderDetails();
        toast.showSuccess('Action updated successfully');
      }
    } catch (error) {
      console.error('Error updating action:', error);
      toast.showError('Error updating action');
    }
  };

  const handleDeleteAction = async (actionId: number) => {
    setItemToDelete({ id: actionId, type: 'action' });
    setShowDeleteActionModal(true);
  };

  const confirmDeleteAction = async () => {
    if (!itemToDelete) return;
    try {
      const response = await apiClient.delete(`/actions/${itemToDelete.id}`);
      if (response.success) {
        fetchWorkOrderDetails();
        toast.showSuccess('Action deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting action:', error);
      toast.showError('Error deleting action');
    } finally {
      setShowDeleteActionModal(false);
      setItemToDelete(null);
    }
  };

  const handleEditSparePart = async (sparePartId: number) => {
    try {
      const validation = validateSparePart(editSparePart);
      if (!validation.isValid) {
        toast.showError('Validation Error', validation.errors[0].message);
        return;
      }

      const response = await apiClient.put<SparePart>(`/spare-parts/${sparePartId}`, {
        part_name: editSparePart.part_name,
        part_number: editSparePart.part_number,
        quantity: editSparePart.quantity,
        unit: editSparePart.unit
      });
      if (response.success) {
        setEditSparePart({
          part_name: '',
          part_number: '',
          quantity: 1,
          unit: ''
        });
        setEditingSparePart(null);
        fetchWorkOrderDetails();
        toast.showSuccess('Spare part updated successfully');
      }
    } catch (error) {
      console.error('Error updating spare part:', error);
      toast.showError('Error updating spare part');
    }
  };

  const handleDeleteSparePart = async (sparePartId: number) => {
    setItemToDelete({ id: sparePartId, type: 'sparePart' });
    setShowDeleteSparePartModal(true);
  };

  const confirmDeleteSparePart = async () => {
    if (!itemToDelete) return;
    try {
      const response = await apiClient.delete(`/spare-parts/${itemToDelete.id}`);
      if (response.success) {
        fetchWorkOrderDetails();
        toast.showSuccess('Spare part deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting spare part:', error);
      toast.showError('Error deleting spare part');
    } finally {
      setShowDeleteSparePartModal(false);
      setItemToDelete(null);
    }
  };

  const handleCompleteWork = async () => {
    setShowCompleteModal(true);
  };

  const handleCompleteWorkConfirm = async () => {
    if (!completionDate) {
      toast.showError('Validation Error', 'Please select a completion date');
      return;
    }

    if (!workOrder) {
      toast.showError('Error', 'Work order not found');
      return;
    }

    const hasMissingEndTimes = workOrder.findings.some(f => (f.actions || []).some(a => {
      const datesForAction = actionDates[a.id] || [];
      if (datesForAction && datesForAction.length > 0) {
        const latest = [...datesForAction].sort((x, y) => new Date(y.action_date).getTime() - new Date(x.action_date).getTime())[0];
        return !latest.end_time || String(latest.end_time).trim() === '';
      }
      return !a.end_time || String(a.end_time).trim() === '';
    }));
    if (hasMissingEndTimes) {
      toast.showError('Validation Error', 'Please fill end times for all actions before requesting completion');
      return;
    }

    const allActions: Action[] = [];
    workOrder.findings.forEach(finding => {
      if (finding.actions) {
        allActions.push(...finding.actions);
      }
    });

    const latestActionDate = allActions.length > 0 
      ? Math.max(...allActions.map(a => new Date(a.action_date).getTime()))
      : null;
    const lastActionDate = latestActionDate 
      ? new Date(latestActionDate).toISOString().split('T')[0]
      : undefined;

    const dateValidation = validateCompletionDate(
      completionDate,
      workOrder.work_order_date,
      lastActionDate
    );
    if (dateValidation) {
      toast.showError('Validation Error', dateValidation.message);
      return;
    }

    try {
      const response = await apiClient.put<WorkOrder>(`/work-orders/${workOrderId}/complete`, {
        work_completed_date: completionDate
      });
      if (response.success) {
        setShowCompleteModal(false);
        fetchWorkOrderDetails();
        toast.showSuccess('Completion request submitted successfully');
        return;
      }

      if (!response.success && response.data) {
        const parts: string[] = [];
        const respData = response.data as unknown as { incomplete_actions?: Array<{ id: number; description?: string }>; missing_end_times?: Array<{ action_id: number; action_date: string }>; };
        if (respData.incomplete_actions && Array.isArray(respData.incomplete_actions)) {
          parts.push('Incomplete actions:\n' + respData.incomplete_actions.map(a => `- ${a.description || `Action #${a.id}`}`).join('\n'));
        }
        if (respData.missing_end_times && Array.isArray(respData.missing_end_times)) {
          parts.push('Action dates missing end time:\n' + respData.missing_end_times.map(r => `action_id=${r.action_id}, date=${r.action_date}`).join('\n'));
        }
        const message = parts.length > 0 ? parts.join('\n\n') : (response.error || 'Unable to submit completion request');
        setCompletionIssuesMessage(message);
        if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) document.activeElement.blur();
        setShowCompletionIssuesModal(true);
        return;
      }

      if (!response.success) {
        if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) document.activeElement.blur();
        toast.showError('Error submitting completion request', response.error || 'Unable to submit completion request');
        return;
      }
    } catch (error) {
      console.error('Error submitting completion request:', error);
      toast.showError('Error submitting completion request');
    }
  };

  const handleApproveCompletion = async () => {
    try {
      const response = await apiClient.put<WorkOrder>(`/work-orders/${workOrderId}/approve-completion`, {
        approved: true
      });
      if (response.success) {
        setShowCompleteModal(false);
        fetchWorkOrderDetails();
        toast.showSuccess('Completion request approved successfully');
        return;
      }

      if (!response.success && response.data) {
        const parts: string[] = [];
        const respData = response.data as unknown as { missing_end_times?: Array<{ action_id: number; action_date: string }>; };
        if (respData.missing_end_times && Array.isArray(respData.missing_end_times)) {
          parts.push('Action dates missing end time:\n' + respData.missing_end_times.map(r => `action_id=${r.action_id}, date=${r.action_date}`).join('\n'));
        }
        const message = parts.length > 0 ? parts.join('\n\n') : (response.error || 'Unable to approve completion');
        setCompletionIssuesMessage(message);
        if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) document.activeElement.blur();
        setShowCompletionIssuesModal(true);
        return;
      }

      if (!response.success) {
        if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) document.activeElement.blur();
        toast.showError('Error approving completion', response.error || 'Unable to approve completion');
        return;
      }
    } catch (error) {
      console.error('Error approving completion:', error);
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) document.activeElement.blur();
      toast.showError('Error approving completion');
    }
  };

  const handleApproveWorkOrder = async () => {
    try {
      const response = await apiClient.put<WorkOrder>(`/work-orders/${workOrderId}/approve`, {});
      if (response.success) {
        fetchWorkOrderDetails();
        toast.showSuccess('Work order approved successfully');
      } else {
        toast.showError('Error approving work order', response.error);
      }
    } catch (error) {
      console.error('Error approving work order:', error);
      toast.showError('Error approving work order');
    }
  };

  const handleRejectWorkOrder = async () => {
    if (!rejectionReason.trim()) {
      toast.showError('Validation Error', 'Please provide a rejection reason');
      return;
    }

    try {
      const response = await apiClient.put<WorkOrder>(`/work-orders/${workOrderId}/reject`, {
        reason: rejectionReason
      });
      if (response.success) {
        setShowRejectModal(false);
        setRejectionReason('');
        fetchWorkOrderDetails();
        toast.showSuccess('Work order rejected successfully');
      } else {
        toast.showError('Error rejecting work order', response.error);
      }
    } catch (error) {
      console.error('Error rejecting work order:', error);
      toast.showError('Error rejecting work order');
    }
  };

  const handleReferenceImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { 
        toast.showError('File too large', 'Please select a file smaller than 5MB');
        return;
      }
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        toast.showError('Invalid file type', 'Please select an image file or PDF');
        return;
      }
      setReferenceImageFile(file);
    }
  };

  const handleUploadReferenceImage = async () => {
    if (!referenceImageFile) {
      toast.showError('No file selected', 'Please select an image to upload');
      return;
    }

    setIsUploadingReferenceImage(true);
    try {
      const formData = new FormData();
      formData.append('reference_image', referenceImageFile);

      const token = localStorage.getItem('token');
      if (!token) {
        toast.showError('Authentication Error', 'Please log in again');
        return;
      }

      const response = await fetch(`${getApiBaseUrl()}/work-orders/${workOrderId}/reference-image`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();
      if (result.success) {
        setShowReferenceImageModal(false);
        setReferenceImageFile(null);
        fetchWorkOrderDetails();
        toast.showSuccess('Reference image updated successfully');
      } else {
        toast.showError('Error updating reference image', result.error);
      }
    } catch (error) {
      console.error('Error updating reference image:', error);
      toast.showError('Error updating reference image');
    } finally {
      setIsUploadingReferenceImage(false);
    }
  };

  const handleDeleteReferenceImage = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.showError('Authentication Error', 'Please log in again');
        return;
      }

      const response = await fetch(`${getApiBaseUrl()}/work-orders/${workOrderId}/reference-image`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        fetchWorkOrderDetails();
        toast.showSuccess('Reference image deleted successfully');
      } else {
        toast.showError('Error deleting reference image', result.error);
      }
    } catch (error) {
      console.error('Error deleting reference image:', error);
      toast.showError('Error deleting reference image');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#08398F]"></div>
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Work Order not found</h2>
      </div>
    );
  }

  const canEditRejected = workOrder.status === 'rejected' && user && workOrder.requested_by_id === user.id;

  return (
    <div className="space-y-6">
      {}
      {workOrder.status === 'rejected' && workOrder.rejection_reason && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <span className="text-2xl">❌</span>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-lg font-semibold text-red-800">Work Order Rejected</h3>
              <p className="mt-1 text-sm text-red-700">
                <span className="font-medium">Reason:</span> {workOrder.rejection_reason}
              </p>
              {canEditRejected && (
                <p className="mt-2 text-sm text-red-800">
                  Please review the rejection reason, make necessary edits below, and click the &quot;Edit &amp; Resubmit&quot; button to resubmit this work order.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Work Order: {workOrder.work_order_no}
          </h1>
          <p className="text-gray-600">Manage findings, actions, spare parts, and completion</p>
        </div>
        <div className="flex space-x-3">
          {workOrder.status === 'pending' && user && (user.role === 'admin' || user.role === 'superadmin') && (
            <>
              {!isApprovingWorkOrder && !isEditingWorkOrder && (
                <>
                  <Button variant="primary" onClick={() => setIsApprovingWorkOrder(true)}>
                    ✏️ Edit & Approve Work Order
                  </Button>
                  <Button variant="primary" onClick={handleApproveWorkOrder}>
                    ✅ Approve Without Editing
                  </Button>
                  <Button variant="outline" onClick={() => setShowRejectModal(true)}>
                    ❌ Reject Work Order
                  </Button>
                </>
              )}
            </>
          )}
          {(user?.role === 'superadmin' && (workOrder.status === 'ongoing' || workOrder.status === 'completed')) && (
            <>
              {!isEditingWorkOrder && (
                <Button variant="primary" onClick={() => setIsEditingWorkOrder(true)}>
                  ✏️ Edit Work Order
                </Button>
              )}
            </>
          )}
          {workOrder.status === 'ongoing' && (
            <Button variant="secondary" onClick={handleCompleteWork}>
              ✅ Request Completion
            </Button>
          )}
          {workOrder.status === 'completion_requested' && user && (user.role === 'admin' || user.role === 'superadmin') && (
            <Button variant="primary" onClick={() => setShowCompleteModal(true)}>
              🔍 Review Completion Request
            </Button>
          )}
          {canEditRejected && !isEditingRejected && (
            <Button variant="primary" onClick={() => {
              setIsEditingRejected(true);
            }}>
              ✏️ Edit & Resubmit
            </Button>
          )}
          {canEditRejected && isEditingRejected && (
            <>
              <Button
                variant="primary"
                onClick={async () => {
                  try {
                    if (editCore.work_type === 'Others' && (!editCore.work_type_other || editCore.work_type_other.trim() === '')) {
                      toast.showError('Validation Error', 'Please specify the work type when selecting "Others"');
                      return;
                    }

                    let finalWorkType = editCore.work_type;
                    if (editCore.work_type === 'Others' && editCore.work_type_other) {
                      finalWorkType = editCore.work_type_other
                        .toLowerCase()
                        .split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                    }

                    const saveRes = await apiClient.put<WorkOrder>(`/work-orders/${workOrderId}`, {
                      equipment_number: editCore.equipment_number,
                      work_type: finalWorkType,
                      requested_by: editCore.requested_by,
                      km_hrs: editCore.km_hrs,
                      work_order_date: editCore.work_order_date,
                    });
                    if (!saveRes.success) {
                      toast.showError('Failed to save changes', saveRes.error);
                      return;
                    }
                    const res = await apiClient.put<WorkOrder>(`/work-orders/${workOrderId}/resubmit`);
                    if (res.success) {
                      toast.showSuccess('Work order resubmitted successfully');
                      await fetchWorkOrderDetails();
                      setIsEditingRejected(false);
                    } else {
                      toast.showError('Failed to resubmit work order', res.error);
                    }
                  } catch {
                    toast.showError('Error', 'Could not resubmit work order');
                  }
                }}
              >
                ✅ Save & Resubmit
              </Button>
              <Button variant="outline" onClick={() => setIsEditingRejected(false)}>
                Cancel Edit
              </Button>
            </>
          )}
          {(isEditingWorkOrder || isApprovingWorkOrder) && (
            <>
              <Button
                variant="primary"
                onClick={async () => {
                  try {
                    if (editCore.work_type === 'Others' && (!editCore.work_type_other || editCore.work_type_other.trim() === '')) {
                      toast.showError('Validation Error', 'Please specify the work type when selecting "Others"');
                      return;
                    }

                    let finalWorkType = editCore.work_type;
                    if (editCore.work_type === 'Others' && editCore.work_type_other) {
                      finalWorkType = editCore.work_type_other
                        .toLowerCase()
                        .split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                    }

                    const saveRes = await apiClient.put<WorkOrder>(`/work-orders/${workOrderId}`, {
                      equipment_number: editCore.equipment_number,
                      work_type: finalWorkType,
                      requested_by: editCore.requested_by,
                      km_hrs: editCore.km_hrs,
                      work_order_date: editCore.work_order_date,
                    });
                    if (!saveRes.success) {
                      toast.showError('Failed to save changes', saveRes.error);
                      return;
                    }

                    if (isApprovingWorkOrder) {
                      const approveRes = await apiClient.put(`/work-orders/${workOrderId}/approve`);
                      if (approveRes.success) {
                        toast.showSuccess('Work order edited and approved successfully');
                        setIsApprovingWorkOrder(false);
                        await fetchWorkOrderDetails();
                      } else {
                        toast.showError('Failed to approve work order', approveRes.error);
                      }
                    } else {
                      toast.showSuccess('Work order updated successfully');
                      setIsEditingWorkOrder(false);
                      await fetchWorkOrderDetails();
                    }
                  } catch {
                    toast.showError('Error', 'Could not save changes');
                  }
                }}
              >
                {isApprovingWorkOrder ? '✅ Save & Approve' : '✅ Save Changes'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsEditingWorkOrder(false);
                  setIsApprovingWorkOrder(false);
                  setEditCore({
                    equipment_number: workOrder.equipment_number,
                    work_type: workOrder.work_type,
                    work_type_other: '',
                    requested_by: workOrder.requested_by,
                    km_hrs: workOrder.km_hrs || 0,
                    work_order_date: workOrder.work_order_date,
                  });
                }}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Work Order Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="font-medium text-gray-700">Equipment:</span>
            {(canEditRejected && isEditingRejected) || isEditingWorkOrder || isApprovingWorkOrder ? (
              <Input
                label=""
                value={editCore.equipment_number}
                onChange={(e) => setEditCore(prev => ({ ...prev, equipment_number: e.target.value }))}
                placeholder="Enter equipment number"
              />
            ) : (
              <p className="text-gray-900">{workOrder.equipment_number}</p>
            )}
          </div>
          <div>
            <span className="font-medium text-gray-700">Work Type:</span>
            {(canEditRejected && isEditingRejected) || isEditingWorkOrder || isApprovingWorkOrder ? (
              <div>
                <select
                  value={editCore.work_type}
                  onChange={(e) => setEditCore(prev => ({ 
                    ...prev, 
                    work_type: e.target.value,
                    work_type_other: e.target.value !== 'Others' ? '' : prev.work_type_other
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#08398F] focus:border-[#08398F]"
                >
                <option value="">Select work type</option>
                {WORK_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
                </select>
                {editCore.work_type === 'Others' && (
              <Input
                label=""
                    value={editCore.work_type_other || ''}
                    onChange={(e) => setEditCore(prev => ({ ...prev, work_type_other: e.target.value }))}
                    placeholder="Please specify the work type"
                    className="mt-2"
                  />
                )}
              </div>
            ) : (
              <p className="text-gray-900">{workOrder.work_type}</p>
            )}
          </div>
          <div>
            <span className="font-medium text-gray-700">Requested By:</span>
            {(canEditRejected && isEditingRejected) || isEditingWorkOrder || isApprovingWorkOrder ? (
              <Input
                label=""
                value={editCore.requested_by}
                onChange={(e) => setEditCore(prev => ({ ...prev, requested_by: e.target.value }))}
                placeholder="Requested by"
              />
            ) : (
              <p className="text-gray-900">{workOrder.requested_by}</p>
            )}
          </div>
          <div>
            <span className="font-medium text-gray-700">KM/Hrs:</span>
            {(canEditRejected && isEditingRejected) || isEditingWorkOrder || isApprovingWorkOrder ? (
              <Input
                label=""
                type="number"
                value={editCore.km_hrs}
                onChange={(e) => setEditCore(prev => ({ ...prev, km_hrs: Number(e.target.value) || 0 }))}
                placeholder="Enter KM/Hrs"
              />
            ) : (
              <p className="text-gray-900">{workOrder.km_hrs || 'N/A'}</p>
            )}
          </div>
          <div>
            <span className="font-medium text-gray-700">Status:</span>
            <p className="text-gray-900 capitalize">{workOrder.status}</p>
          </div>
          <div>
            <span className="font-medium text-gray-700">Order Date:</span>
            {(canEditRejected && isEditingRejected) || isEditingWorkOrder || isApprovingWorkOrder ? (
              <Input
                label=""
                type="date"
                value={editCore.work_order_date}
                onChange={(e) => setEditCore(prev => ({ ...prev, work_order_date: e.target.value }))}
              />
            ) : (
              <p className="text-gray-900">
                {new Date(workOrder.work_order_date).toLocaleDateString('en-GB')}
              </p>
            )}
          </div>
          <div>
            <span className="font-medium text-gray-700">Description:</span>
            <p className="text-gray-900 whitespace-pre-line">{workOrder.description || '—'}</p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center mb-2">
            <span className="font-medium text-gray-700">Reference Document/Image:</span>
            {user && (user.role === 'admin' || user.role === 'superadmin') && (
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowReferenceImageModal(true)}
                >
                  {workOrder.reference_document ? '✏️ Edit' : '📁 Upload'} Reference
                </Button>
                {workOrder.reference_document && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDeleteReferenceImage}
                    className="text-red-600 hover:text-red-700"
                  >
                    🗑️ Delete
                  </Button>
                )}
              </div>
            )}
          </div>
          {workOrder.reference_document ? (
            <div className="mt-2">
              {workOrder.reference_document.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <div className="space-y-2">
                  <Image
                    src={toPublicUrl(workOrder.reference_document)}
                    alt="Reference"
                    width={400}
                    height={300}
                    className="max-w-xs rounded border h-auto w-auto"
                  />
              <a
                href={toPublicUrl(workOrder.reference_document)}
                target="_blank"
                rel="noreferrer"
                    className="text-[#08398F] underline text-sm"
              >
                    View full size
              </a>
            </div>
              ) : workOrder.reference_document.match(/\.pdf$/i) ? (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-md">
                    <span className="text-red-600 text-lg">📄</span>
                    <div>
                      <p className="text-sm font-medium text-red-800">PDF Document</p>
                      <p className="text-xs text-red-700">Click below to view</p>
          </div>
                  </div>
                  <a
                    href={toPublicUrl(workOrder.reference_document)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#08398F] underline text-sm"
                  >
                    📄 View PDF Document
                  </a>
                </div>
              ) : (
                <a
                  href={toPublicUrl(workOrder.reference_document)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#08398F] underline"
                >
                  📄 View document
                </a>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No reference document uploaded yet.</p>
          )}
        </div>

        {workOrder.status === 'rejected' && workOrder.rejection_reason && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <span className="font-medium text-gray-700 text-red-600">Rejection Reason:</span>
            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800">{workOrder.rejection_reason}</p>
            </div>
          </div>
        )}

        {workOrder.status === 'completion_requested' && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <span className="font-medium text-blue-600">Completion Request Status:</span>
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-blue-800">
                ✅ Completion requested on {workOrder.completion_requested_at ? 
                  new Date(workOrder.completion_requested_at).toLocaleDateString('en-GB') : 'N/A'}
                <br />
                📅 Requested completion date: {workOrder.work_completed_date ? 
                  new Date(workOrder.work_completed_date).toLocaleDateString('en-GB') : 'N/A'}
                <br />
                ⏳ Awaiting admin approval...
              </p>
            </div>
          </div>
        )}

        {}
        {workOrder.status === 'completed' && workOrder.completion_approved_at && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <span className="font-medium text-green-600">Completion Approved:</span>
            <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-green-800">
                ✅ Completion approved on {new Date(workOrder.completion_approved_at).toLocaleDateString('en-GB')}
                <br />
                👤 Approved by: {workOrder.completion_approved_by_name || 'N/A'}
                <br />
                📅 Completed on: {workOrder.work_completed_date ? 
                  new Date(workOrder.work_completed_date).toLocaleDateString('en-GB') : 'N/A'}
              </p>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Findings</h2>
        </div>

        {}

        {}
        {(workOrder.findings || []).length === 0 ? (
          <div className="space-y-4">
            {(workOrder.status !== 'completed' && workOrder.status !== 'completion_requested') && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="p-3 bg-white rounded border">
                  <div className="flex items-end gap-2">
                    <Button size="sm" onClick={() => setAddFindingFor(-1)}>
                      {addFindingFor === -1 ? '✖️ Close Add Finding' : '➕ Add Finding'}
                    </Button>
                  </div>
                </div>
                {addFindingFor === -1 && (
                  <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                    <h5 className="font-medium text-blue-900 mb-2">Add Finding</h5>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                      <div className="md:col-span-3">
                        <Input
                          label="Finding Description"
                          value={newFinding.description}
                          onChange={(e) => setNewFinding(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Describe the finding or defect..."
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button className="w-full" onClick={async () => { await handleAddFinding(); setAddFindingFor(null); }}>
                          ➕ Add Finding
                        </Button>
                        <Button variant="outline" onClick={() => { setAddFindingFor(null); setNewFinding({ description: '' }); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {[...(workOrder.findings || [])].reverse().map((finding) => (
              <div key={finding.id} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-medium text-gray-900">{finding.description}</h4>
                  <div className="flex space-x-2">
                    {(workOrder.status !== 'completed' && workOrder.status !== 'completion_requested') && (
                      <>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setEditFinding({ description: finding.description });
                            setEditingFinding(finding.id);
                          }}
                        >
                          ✏️ Edit
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleDeleteFinding(finding.id)}
                        >
                          🗑️ Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {finding.reference_image && (
                  <Image 
                    src={toPublicUrl(finding.reference_image)} 
                    alt="Reference" 
                    width={200}
                    height={150}
                    className="mb-3 max-w-xs rounded" 
                  />
                )}

                {}
                {editingFinding === finding.id && (
                  <div className="mb-3 p-3 bg-white rounded border">
                    <h5 className="font-medium text-gray-800 mb-2">Edit Finding</h5>
                    <Input
                      label="Finding Description"
                      value={editFinding.description}
                      onChange={(e) => setEditFinding(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe the finding or defect..."
                    />
                    <div className="flex space-x-3 mt-3">
                      <Button size="sm" onClick={() => handleEditFinding(finding.id)}>
                        Update Finding
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingFinding(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {}
                <div className="ml-4 space-y-3">
                  {(finding.actions || []).map((action) => (
                    <div key={action.id} className="p-3 bg-white rounded border">
                      <div className="flex justify-between items-start mb-2">
                        <h5 className="font-medium text-gray-800">{action.description}</h5>
                        {action.remarks && (
                          <div className="text-sm text-gray-700 mt-1">
                            <strong>Remarks:</strong> {action.remarks}
                          </div>
                        )}
                        <div className="flex space-x-2">
                          {workOrder.status !== 'completed' && (
                            <>
                              {}
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  const raw = (action.action_date || '').toString();
                                  let normalized = '';
                                  if (raw) {
                                    const d = new Date(raw);
                                    const y = d.getFullYear();
                                    const m = String(d.getMonth() + 1).padStart(2, '0');
                                    const da = String(d.getDate()).padStart(2, '0');
                                    normalized = `${y}-${m}-${da}`;
                                  }
                                  setEditAction({
                                    description: action.description,
                                    action_date: normalized,
                                    start_time: toTimeHHMM(action.start_time),
                                    end_time: toTimeHHMM(action.end_time as unknown as string),
                                    remarks: action.remarks || ''
                                  });
                                  setEditingAction(action.id);
                                }}
                              >
                                ✏️ Edit
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleDeleteAction(action.id)}
                              >
                                🗑️ Delete
                              </Button>
                              {}
                              {(() => {
                                const firstActionDate = (actionDates[action.id] && actionDates[action.id].length > 0) ? actionDates[action.id][0] : undefined;
                                return (
                                  <>
                                    {firstActionDate && !firstActionDate.is_completed && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleCompleteAction(action.id, firstActionDate.id)}
                                      >
                                        ✅ Complete
                                      </Button>
                                    )}
                                    {firstActionDate && firstActionDate.is_completed && (user?.role === 'admin' || user?.role === 'superadmin') && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleRevertAction(action.id, firstActionDate.id)}
                                      >
                                        ↩️ Revert
                                      </Button>
                                    )}
                                  </>
                                );
                              })()}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 mb-2">
                        <span>Date: {new Date(action.action_date).toLocaleDateString('en-GB')}</span>
                        <span className="mx-2">|</span>
                        <span>Start: {action.start_time}</span>
                        <span className="mx-2">|</span>
                        <span>End: {action.end_time}</span>
                      </div>

                      {}
                      <div className="mt-3">
                        <div className="flex justify-between items-center mb-2">
                          <h6 className="font-medium text-gray-700">Action Dates:</h6>
                          {(actionDates[action.id] && actionDates[action.id].length > 0 ? !actionDates[action.id][0].is_completed : !action.is_completed) && selectedActionForStartAgain !== action.id ? (
                            <Button 
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedActionForStartAgain(action.id);
                                setStartAgainData(prev => ({
                                  ...prev,
                                  action_date: new Date().toISOString().split('T')[0],
                                  start_time: '',
                                  end_time: '',
                                  technician_ids: (action.technicians || [])
                                    .map((t) => t.technician_id)
                                    .filter((id): id is number => typeof id === 'number')
                                }));
                              }}
                            >
                              🔄 Start Again
                            </Button>
                          ) : null}
                        </div>

                        {}
                        {selectedActionForStartAgain === action.id && (
                          <div className="mb-3 p-3 bg-blue-50 rounded border border-blue-200">
                            <div className="flex items-end gap-2">
                              <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-700 mb-1">Work Date</label>
                                <Input
                                  label=""
                                  type="date"
                                  value={startAgainData.action_date}
                                  min={(actionDates[action.id] && actionDates[action.id].length > 0) ? actionDates[action.id][0].action_date : undefined}
                                  onChange={(e) => setStartAgainData(prev => ({ ...prev, action_date: e.target.value }))}
                                />
                              </div>
                              <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-700 mb-1">From Time *</label>
                                <Input
                                  label=""
                                  type="time"
                                  value={startAgainData.start_time}
                                  onChange={(e) => setStartAgainData(prev => ({ ...prev, start_time: e.target.value }))}
                                />
                              </div>
                              <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-700 mb-1">To Time (optional)</label>
                                <Input
                                  label=""
                                  type="time"
                                  value={startAgainData.end_time}
                                  onChange={(e) => setStartAgainData(prev => ({ ...prev, end_time: e.target.value }))}
                                />
                              </div>
                              <div>
                                <Button 
                                  size="sm" 
                                  onClick={async () => {
                                    await handleStartAgain();
                                    setStartAgainData(prev => ({
                                      ...prev,
                                      action_date: new Date().toISOString().split('T')[0],
                                      start_time: '',
                                      end_time: '',
                                      technician_ids: []
                                    }));
                                    setSelectedActionForStartAgain(null);
                                  }}
                                  disabled={!startAgainData.action_date || !startAgainData.start_time}
                                >
                                  ✓ Save
                                </Button>
                              </div>
                              <div>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedActionForStartAgain(null);
                                  }}
                                >
                                  ✖ Cancel
                                </Button>
                              </div>
                            </div>
                            <div className="text-xs text-gray-500 mt-2">
                              * From time is required. To time is optional until completion approval.
                            </div>
                          </div>
                        )}
                        {actionDates[action.id] && actionDates[action.id].length > 0 ? (
                          <div className="space-y-2">
                            {actionDates[action.id].map((actionDate) => (
                              <div key={actionDate.id} className="p-2 bg-gray-50 rounded border">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="text-sm text-gray-600">
                                      <span>Date: {new Date(actionDate.action_date).toLocaleDateString('en-GB')}</span>
                                      <span className="mx-2">|</span>
                                      <span>Start: {actionDate.start_time}</span>
                                      <span className="mx-2">|</span>
                                      <span>End: {actionDate.end_time}</span>
                                      <span className="mx-2">|</span>
                                      <span className={`font-medium ${actionDate.is_completed ? 'text-green-600' : 'text-orange-600'}`}>
                                        {actionDate.is_completed ? '✓ Completed' : '⏳ In Progress'}
                                      </span>
                                    </div>
                                    {actionDate.technicians && actionDate.technicians.length > 0 && (
                                      <div className="text-xs text-gray-500 mt-1">
                                        Technicians: {actionDate.technicians.map((t: ActionTechnician) => t.name).join(', ')}
                                      </div>
                                    )}
                                  </div>
                                    <div className="flex space-x-1">
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => {
                                          const rawDate = (actionDate.action_date || '').toString();
                                          let normalizedDate = '';
                                          if (rawDate) {
                                            const d = new Date(rawDate);
                                            const y = d.getFullYear();
                                            const m = String(d.getMonth() + 1).padStart(2, '0');
                                            const da = String(d.getDate()).padStart(2, '0');
                                            normalizedDate = `${y}-${m}-${da}`;
                                          }

                                        setEditingActionDate(actionDate.id);
                                        setEditActionDateData({
                                          action_date: normalizedDate,
                                          start_time: actionDate.start_time || '',
                                          end_time: actionDate.end_time || '',
                                          is_completed: !!actionDate.is_completed,
                                          technician_ids: actionDate.technicians?.map((t: ActionTechnician) => t.technician_id || 0) || []
                                        });
                                      }}
                                    >
                                      ✏️
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => handleDeleteActionDate(action.id, actionDate.id)}
                                    >
                                      🗑️
                                    </Button>
                                  </div>
                                </div>
                                {}
                                {editingActionDate === actionDate.id && (
                                  <div className="mt-2 p-2 bg-white rounded border">
                                    <h6 className="font-medium text-gray-800 mb-2">Edit Action Date</h6>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                      <Input
                                        label="Date"
                                        type="date"
                                        value={editActionDateData.action_date}
                                        onChange={(e) => setEditActionDateData(prev => ({ ...prev, action_date: e.target.value }))}
                                      />
                                      <Input
                                        label="Start Time"
                                        type="time"
                                        value={editActionDateData.start_time}
                                        onChange={(e) => setEditActionDateData(prev => ({ ...prev, start_time: e.target.value }))}
                                      />
                                      <Input
                                        label="End Time"
                                        type="time"
                                        value={editActionDateData.end_time}
                                        onChange={(e) => setEditActionDateData(prev => ({ ...prev, end_time: e.target.value }))}
                                      />
                                    </div>
                                    <div className="flex items-center mt-2 space-x-3">
                                          <div className="flex items-center space-x-2">
                                            {(() => {
                                              const latestForAction = actionDates[action.id] && actionDates[action.id].length > 0 ? actionDates[action.id][0] : undefined;
                                              const isLatest = latestForAction ? latestForAction.id === actionDate.id : false;
                                              const allowToggle = isLatest || (user && (user.role === 'admin' || user.role === 'superadmin') && actionDate.is_completed);
                                              return (
                                                <>
                                                  <input
                                                    type="checkbox"
                                                    checked={editActionDateData.is_completed}
                                                    onChange={(e) => setEditActionDateData(prev => ({ ...prev, is_completed: e.target.checked }))}
                                                    className="rounded border-gray-300"
                                                    disabled={!allowToggle}
                                                  />
                                                  <span className="text-sm font-medium text-gray-700">Completed</span>
                                                </>
                                              );
                                            })()}
                                          </div>
                                    </div>
                                    <div className="flex space-x-2 mt-2">
                                      <Button size="sm" onClick={() => handleEditActionDate(action.id)}>
                                        Update
                                      </Button>
                                      <Button size="sm" variant="outline" onClick={() => setEditingActionDate(null)}>
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 italic">No additional dates added</div>
                        )}
                      </div>
                      {}
                      {editingAction === action.id && (
                        <div className="mb-3 p-3 bg-gray-50 rounded border">
                          <h6 className="font-medium text-gray-800 mb-2">Edit Action</h6>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input
                              label="Action Description"
                              value={editAction.description}
                              onChange={(e) => setEditAction(prev => ({ ...prev, description: e.target.value }))}
                              placeholder="Describe the action taken..."
                            />
                            <Input
                              label="Action Date"
                              type="date"
                              value={editAction.action_date}
                              onChange={(e) => setEditAction(prev => ({ ...prev, action_date: e.target.value }))}
                            />
                            <Input
                              label="Start Time"
                              type="time"
                              value={editAction.start_time}
                              onChange={(e) => setEditAction(prev => ({ ...prev, start_time: e.target.value }))}
                            />
                            <Input
                              label="End Time"
                              type="time"
                              value={editAction.end_time}
                              onChange={(e) => setEditAction(prev => ({ ...prev, end_time: e.target.value }))}
                            />
                            <Input
                              label="Remarks (optional)"
                              value={editAction.remarks ?? ''}
                              onChange={(e) => setEditAction(prev => ({ ...prev, remarks: e.target.value }))}
                              placeholder="Any notes or remarks about this action"
                            />
                          </div>
                          <div className="flex space-x-3 mt-3">
                            <Button size="sm" onClick={() => handleEditAction(action.id)}>
                              Update Action
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingAction(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                      {}
                      <div className="ml-4 mt-3">
                        <div className="flex justify-between items-center mb-1">
                          <h6 className="font-medium text-gray-700">Spare Parts:</h6>
                          {workOrder.status !== 'completed' && (
                            <div className="flex items-end gap-2">
                              <Input
                                label=""
                                value={newSparePart.part_name}
                                onChange={(e) => setNewSparePart(prev => ({ ...prev, part_name: e.target.value }))}
                                placeholder="Part name"
                              />
                              <Input
                                label=""
                                value={newSparePart.part_number}
                                onChange={(e) => setNewSparePart(prev => ({ ...prev, part_number: e.target.value }))}
                                placeholder="Part number"
                              />
                              <Input
                                label=""
                                type="number"
                                value={newSparePart.quantity}
                                onChange={(e) => setNewSparePart(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                                min="1"
                              />
                              <select
                                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#08398F] focus:border-[#08398F]"
                                value={newSparePart.unit || ''}
                                onChange={(e) => setNewSparePart(prev => ({ ...prev, unit: e.target.value }))}
                              >
                                <option value="">Unit</option>
                                {units.map(u => (
                                  <option key={u.id} value={u.name}>{u.name}</option>
                                ))}
                              </select>
                              <Button 
                                size="sm" 
                                onClick={() => handleAddSparePart(action.id)}
                              >
                                ➕ Add Spare
                              </Button>
                            </div>
                          )}
                        </div>
                        {(action.spare_parts || []).length > 0 && (
                          <div className="space-y-1">
                            {(action.spare_parts || []).map((sparePart) => (
                              <div key={sparePart.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                <div className="text-sm text-gray-600">
                                  {sparePart.part_name} ({sparePart.part_number}) - Qty: {sparePart.quantity}{sparePart.unit ? ` ${sparePart.unit}` : ''}
                                </div>
                                {workOrder.status !== 'completed' && (
                                  <div className="flex space-x-1">
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => {
                                        setEditSparePart({
                                          part_name: sparePart.part_name,
                                          part_number: sparePart.part_number,
                                          quantity: sparePart.quantity,
                                          unit: sparePart.unit || ''
                                        });
                                        setEditingSparePart(sparePart.id);
                                      }}
                                    >
                                      ✏️
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => handleDeleteSparePart(sparePart.id)}
                                    >
                                      🗑️
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {(action.spare_parts || []).length === 0 && (
                          <p className="text-sm text-gray-500 italic">No spare parts added yet.</p>
                        )}
                      </div>

                      {}
                      {editingSparePart && (action.spare_parts || []).find(sp => sp.id === editingSparePart) && (
                        <div className="ml-4 mt-3 p-3 bg-gray-50 rounded border">
                          <h6 className="font-medium text-gray-800 mb-2">Edit Spare Part</h6>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <Input
                              label="Part Name"
                              value={editSparePart.part_name}
                              onChange={(e) => setEditSparePart(prev => ({ ...prev, part_name: e.target.value }))}
                              placeholder="Enter part name"
                            />
                            <Input
                              label="Part Number"
                              value={editSparePart.part_number}
                              onChange={(e) => setEditSparePart(prev => ({ ...prev, part_number: e.target.value }))}
                              placeholder="Enter part number"
                            />
                            <Input
                              label="Quantity"
                              type="number"
                              value={editSparePart.quantity}
                              onChange={(e) => setEditSparePart(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                              min="1"
                            />
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                              <select
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#08398F] focus:border-[#08398F]"
                                value={editSparePart.unit || ''}
                                onChange={(e) => setEditSparePart(prev => ({ ...prev, unit: e.target.value }))}
                              >
                                <option value="">Select unit</option>
                                {units.map(u => (
                                  <option key={u.id} value={u.name}>{u.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="flex space-x-3 mt-3">
                            <Button size="sm" onClick={() => handleEditSparePart(editingSparePart)}>
                              Update Spare Part
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingSparePart(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}

                      {}
                      <div className="mt-3 ml-4">
                        <h6 className="font-medium text-gray-700 mb-1">Technicians:</h6>
                        {}
                        {(editingAction !== action.id) && (
                          <div className="space-y-1">
                            {(action.technicians || []).length === 0 ? (
                              <p className="text-sm text-gray-500">No technicians assigned to this action.</p>
                            ) : (
                              (action.technicians || []).map((t) => (
                                <div key={t.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                  <div className="text-sm text-gray-700">{t.name} ({t.staff_id})</div>
                                </div>
                              ))
                            )}
                          </div>
                        )}

                        {}
                        {(editingAction === action.id && workOrder.status !== 'completed') && (
                          <div className="mt-2 p-2 bg-white border rounded">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Select Technicians</label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-auto">
                                {technicians.map((t) => {
                                  const assigned = (action.technicians || []).some(at => (at.technician_id ? at.technician_id === t.id : at.staff_id === t.staff_id));
                                  return (
                                    <label key={t.id} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                                      <input
                                        type="checkbox"
                                        checked={assigned}
                                        onChange={async (e) => {
                                          const checked = e.target.checked;
                                          try {
                                            if (checked) {
                                              const res = await apiClient.post<ActionTechnician>(`/actions/${action.id}/technicians`, { technician_id: t.id });
                                              if (!res.success) {
                                                toast.showError('Error', res.error || 'Failed to add technician');
                                              }
                                            } else {
                                              if (!(user && (user.role === 'admin' || user.role === 'superadmin'))) {
                                                toast.showError('Not allowed', 'Only admins can remove technicians');
                                                return;
                                              }
                                              const existing = (action.technicians || []).find(at => (at.technician_id ? at.technician_id === t.id : at.staff_id === t.staff_id));
                                              if (existing) {
                                                const res = await apiClient.delete(`/actions/${action.id}/technicians?action_technician_id=${existing.id}`);
                                                if (!res.success) {
                                                  toast.showError('Error', res.error || 'Failed to remove technician');
                                                }
                                              }
                                            }
                                            fetchWorkOrderDetails();
                                          } catch {
                                            toast.showError('Error', 'Operation failed');
                                          }
                                        }}
                                      />
                                      <span className="text-sm text-gray-800">{t.name} ({t.staff_id})</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {(workOrder.status !== 'completed' && workOrder.status !== 'completion_requested') && (
                    <div className="p-3 bg-white rounded border">
                      <div className="flex items-end gap-2">
                        <Button size="sm" onClick={() => setSelectedFindingForAction(prev => prev === finding.id ? null : finding.id)}>
                          {selectedFindingForAction === finding.id ? '✖️ Close Add Action' : '➕ Add Action'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setAddFindingFor(prev => prev === finding.id ? null : finding.id)}>
                          {addFindingFor === finding.id ? '✖️ Close Add Finding' : '➕ Add Finding'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {}
                {selectedFindingForAction === finding.id && (
                  <div className="ml-4 mt-3 p-3 bg-white rounded border">
                    <h5 className="font-medium text-gray-800 mb-2">Add Action</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input
                        label="Action Description"
                        value={newAction.description}
                        onChange={(e) => setNewAction(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Describe the action taken..."
                      />
                      <Input
                        label="Action Date"
                        type="date"
                        value={newAction.action_date}
                        onChange={(e) => setNewAction(prev => ({ ...prev, action_date: e.target.value }))}
                      />
                      <Input
                        label="Start Time"
                        type="time"
                        value={newAction.start_time}
                        onChange={(e) => setNewAction(prev => ({ ...prev, start_time: e.target.value }))}
                      />
                      <Input
                        label="End Time (optional)"
                        type="time"
                        value={newAction.end_time}
                        onChange={(e) => setNewAction(prev => ({ ...prev, end_time: e.target.value }))}
                      />
                      <Input
                        label="Remarks (optional)"
                        value={newAction.remarks || ''}
                        onChange={(e) => setNewAction(prev => ({ ...prev, remarks: e.target.value }))}
                        placeholder="Any notes or remarks about this action"
                      />
                      <div className="text-xs text-gray-500 col-span-1 md:col-span-2">
                        From time is required; To time is optional. To time becomes required when requesting completion approval.
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={newAction.is_completed || false}
                          onChange={(e) => setNewAction(prev => ({ ...prev, is_completed: e.target.checked }))}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm font-medium text-gray-700">Mark as completed</span>
                      </label>
                    </div>

                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Assign Technicians</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-auto">
                        {technicians.map(t => {
                          const checked = newActionTechnicianIds.includes(t.id);
                          return (
                            <label key={t.id} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const isChecked = e.target.checked;
                                  setNewActionTechnicianIds(prev => isChecked ? [...prev, t.id] : prev.filter(id => id !== t.id));
                                }}
                              />
                              <span className="text-sm text-gray-800">{t.name} ({t.staff_id})</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex space-x-3 mt-3">
                      <Button size="sm" onClick={() => handleAddAction(finding.id)}>
                        Add Action
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setSelectedFindingForAction(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {}
                {addFindingFor === finding.id && (
                  <div className="ml-4 mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                    <h5 className="font-medium text-blue-900 mb-2">Add Finding</h5>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                      <div className="md:col-span-3">
                        <Input
                          label="Finding Description"
                          value={newFinding.description}
                          onChange={(e) => setNewFinding(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Describe the finding or defect..."
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button className="w-full" onClick={async () => { await handleAddFinding(); setAddFindingFor(null); }}>
                          ➕ Add Finding
                        </Button>
                        <Button variant="outline" onClick={() => { setAddFindingFor(null); setNewFinding({ description: '' }); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {}
                {selectedActionForSparePart && (finding.actions || []).find(a => a.id === selectedActionForSparePart) && (
                  <div className="ml-8 mt-3 p-3 bg-white rounded border">
                    <h5 className="font-medium text-gray-800 mb-2">Add Spare Part</h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Input
                        label="Part Name"
                        value={newSparePart.part_name}
                        onChange={(e) => setNewSparePart(prev => ({ ...prev, part_name: e.target.value }))}
                        placeholder="Enter part name"
                      />
                      <Input
                        label="Part Number"
                        value={newSparePart.part_number}
                        onChange={(e) => setNewSparePart(prev => ({ ...prev, part_number: e.target.value }))}
                        placeholder="Enter part number"
                      />
                      <Input
                        label="Quantity"
                        type="number"
                        value={newSparePart.quantity}
                        onChange={(e) => setNewSparePart(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                        min="1"
                      />
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#08398F] focus:border-[#08398F]"
                          value={newSparePart.unit || ''}
                          onChange={(e) => setNewSparePart(prev => ({ ...prev, unit: e.target.value }))}
                        >
                          <option value="">Select unit</option>
                          {units.map(u => (
                            <option key={u.id} value={u.name}>{u.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex space-x-3 mt-3">
                      <Button size="sm" onClick={() => handleAddSparePart(selectedActionForSparePart)}>
                        Add Spare Part
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setSelectedActionForSparePart(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {}
      {}

      {}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full mx-4">
            {workOrder?.status === 'completion_requested' ? (
              <>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Review Completion Request</h2>
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-blue-800 text-sm">
                    <strong>Requested by:</strong> {workOrder.completion_requested_by_name || 'N/A'}<br />
                    <strong>Requested on:</strong> {workOrder.completion_requested_at ? new Date(workOrder.completion_requested_at).toLocaleDateString('en-GB') : 'N/A'}<br />
                    <strong>Completion date:</strong> {workOrder.work_completed_date ? new Date(workOrder.work_completed_date).toLocaleDateString('en-GB') : 'N/A'}
                  </p>
                </div>
                <div className="flex space-x-3 mt-6">
                  <Button 
                    variant="primary" 
                    onClick={handleApproveCompletion}
                    className="flex-1"
                  >
                    ✅ Approve Completion
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowCompleteModal(false)}
                    className="flex-1"
                  >
                    ❌ Reject Completion
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Request Work Order Completion</h2>
            <p className="text-gray-600 mb-4">Please select the completion date for this work order.</p>
            <Input
              label="Completion Date"
              type="date"
              value={completionDate}
              onChange={(e) => setCompletionDate(e.target.value)}
            />
            <div className="flex space-x-3 mt-6">
              <Button onClick={handleCompleteWorkConfirm}>
                    Submit Completion Request
              </Button>
              <Button variant="outline" onClick={() => setShowCompleteModal(false)}>
                Cancel
              </Button>
            </div>
              </>
            )}
          </div>
        </div>
      )}

      {}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Reject Work Order</h2>
            <p className="text-gray-600 mb-4">Please provide a reason for rejecting this work order.</p>
            <Input
              label="Rejection Reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
            />
            <div className="flex space-x-3 mt-6">
              <Button variant="outline" onClick={handleRejectWorkOrder}>
                ❌ Reject Work Order
              </Button>
              <Button variant="outline" onClick={() => {
                setShowRejectModal(false);
                setRejectionReason('');
              }}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {}
      {showReferenceImageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {workOrder?.reference_document ? 'Update Reference Document' : 'Upload Reference Document'}
            </h2>
            {workOrder?.reference_document && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-yellow-800 text-sm">
                  <strong>⚠️ Note:</strong> Uploading a new file will replace the existing reference document.
                  <span className="block mt-1">The current document will be deleted.</span>
                </p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select File
              </label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleReferenceImageChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="text-xs text-gray-500 mt-1">
                Supported formats: JPG, PNG, GIF, WebP, PDF. Max size: 5MB
              </p>
            </div>

            {referenceImageFile && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-blue-800 text-sm">
                  <strong>Selected file:</strong> {referenceImageFile.name}
                  <br />
                  <strong>Size:</strong> {(referenceImageFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            )}

            <div className="flex space-x-3 mt-6">
              <Button
                onClick={handleUploadReferenceImage}
                disabled={!referenceImageFile || isUploadingReferenceImage}
                className="flex-1"
              >
                {isUploadingReferenceImage ? '⏳ Uploading...' : '📁 Upload Document'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowReferenceImageModal(false);
                  setReferenceImageFile(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {}
      {showStartAgainModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Start Again - Add New Date</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Input
                label="Action Date"
                type="date"
                value={startAgainData.action_date}
                onChange={(e) => setStartAgainData(prev => ({ ...prev, action_date: e.target.value }))}
              />
              <Input
                label="Start Time"
                type="time"
                value={startAgainData.start_time}
                onChange={(e) => setStartAgainData(prev => ({ ...prev, start_time: e.target.value }))}
              />
              <Input
                label="End Time (optional)"
                type="time"
                value={startAgainData.end_time}
                onChange={(e) => setStartAgainData(prev => ({ ...prev, end_time: e.target.value }))}
              />
              <div className="text-xs text-gray-500 col-span-1 md:col-span-2 -mt-2">
                From time is required; To time is optional. To time becomes required when requesting completion approval.
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Assign Technicians</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-auto">
                {technicians.map(t => {
                  const checked = startAgainData.technician_ids.includes(t.id);
                  return (
                    <label key={t.id} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setStartAgainData(prev => ({
                            ...prev,
                            technician_ids: isChecked 
                              ? [...prev.technician_ids, t.id] 
                              : prev.technician_ids.filter(id => id !== t.id)
                          }));
                        }}
                      />
                      <span className="text-sm text-gray-800">{t.name} ({t.staff_id})</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <Button
                onClick={handleStartAgain}
                disabled={!startAgainData.action_date || !startAgainData.start_time}
                className="flex-1"
              >
                Add Date
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowStartAgainModal(false);
                  setSelectedActionForStartAgain(null);
                  setStartAgainData({
                    action_date: new Date().toISOString().split('T')[0],
                    start_time: '',
                    end_time: '',
                    technician_ids: []
                  });
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {}
      <ConfirmationModal
        isOpen={showDeleteFindingModal}
        title="Delete Finding"
        message="Are you sure you want to delete this finding? This will also delete all associated actions and spare parts."
        confirmText="Delete Finding"
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmDeleteFinding}
        onCancel={() => {
          setShowDeleteFindingModal(false);
          setItemToDelete(null);
        }}
      />

      <ConfirmationModal
        isOpen={showCompletionIssuesModal}
        title="Cannot Request Completion"
        message={completionIssuesMessage}
        confirmText="OK"
        cancelText="Close"
        variant="warning"
        onConfirm={() => setShowCompletionIssuesModal(false)}
        onCancel={() => setShowCompletionIssuesModal(false)}
      />

      {}

      <ConfirmationModal
        isOpen={showDeleteActionModal}
        title="Delete Action"
        message="Are you sure you want to delete this action? This will also delete all associated spare parts."
        confirmText="Delete Action"
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmDeleteAction}
        onCancel={() => {
          setShowDeleteActionModal(false);
          setItemToDelete(null);
        }}
      />

      <ConfirmationModal
        isOpen={showDeleteSparePartModal}
        title="Delete Spare Part"
        message="Are you sure you want to delete this spare part?"
        confirmText="Delete Spare Part"
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmDeleteSparePart}
        onCancel={() => {
          setShowDeleteSparePartModal(false);
          setItemToDelete(null);
        }}
      />
    </div>
  );
} 