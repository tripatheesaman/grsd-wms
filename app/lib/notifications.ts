import pool from './database';
export interface NotificationData {
  userId: number;
  relatedEntityId: number;
  type: 'approval' | 'rejection' | 'completion';
  title: string;
  message: string;
}
export async function createNotification(data: NotificationData) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO notifications (user_id, related_entity_id, related_entity_type, type, title, message)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [data.userId, data.relatedEntityId, 'work_order', data.type, data.title, data.message]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  } finally {
    client.release();
  }
}
export async function createWorkOrderApprovalNotification(workOrderId: number, approverId: number) {
  const client = await pool.connect();
  try {
    const workOrderResult = await client.query(
      'SELECT work_order_no, equipment_number, requested_by_id FROM work_orders WHERE id = $1',
      [workOrderId]
    );
    if (workOrderResult.rows.length === 0) {
      throw new Error('Work order not found');
    }
    const workOrder = workOrderResult.rows[0];
    const approverResult = await client.query(
      'SELECT username FROM users WHERE id = $1',
      [approverId]
    );
    const approverName = approverResult.rows[0]?.username || 'Admin';
    if (workOrder.requested_by_id) {
      await createNotification({
        userId: workOrder.requested_by_id,
        relatedEntityId: workOrderId,
        type: 'approval',
        title: 'Work Order Approved',
        message: `Your work order ${workOrder.work_order_no} for equipment ${workOrder.equipment_number} has been approved by ${approverName}.`
      });
    }
  } catch (error) {
    console.error('Error creating approval notification:', error);
  } finally {
    client.release();
  }
}
export async function createWorkOrderRejectionNotification(workOrderId: number, rejectorId: number, reason: string) {
  const client = await pool.connect();
  try {
    const workOrderResult = await client.query(
      'SELECT work_order_no, equipment_number, requested_by_id FROM work_orders WHERE id = $1',
      [workOrderId]
    );
    if (workOrderResult.rows.length === 0) {
      throw new Error('Work order not found');
    }
    const workOrder = workOrderResult.rows[0];
    const rejectorResult = await client.query(
      'SELECT username FROM users WHERE id = $1',
      [rejectorId]
    );
    const rejectorName = rejectorResult.rows[0]?.username || 'Admin';
    if (workOrder.requested_by_id) {
      await createNotification({
        userId: workOrder.requested_by_id,
        relatedEntityId: workOrderId,
        type: 'rejection',
        title: 'Work Order Rejected',
        message: `Your work order ${workOrder.work_order_no} for equipment ${workOrder.equipment_number} has been rejected by ${rejectorName}. Reason: ${reason || 'No reason provided'}.`
      });
    }
  } catch (error) {
    console.error('Error creating rejection notification:', error);
  } finally {
    client.release();
  }
}
