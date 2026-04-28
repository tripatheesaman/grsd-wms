'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/app/components/AuthProvider';
import { apiClient } from '@/app/utils/api';
import { useToast } from '@/app/components/ToastContext';
import { Card } from '@/app/components/Card';
import { Input } from '@/app/components/Input';
import { Button } from '@/app/components/Button';

interface EmailSettingsForm {
  smtp_enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_password: string;
  from_email: string;
  from_name: string;
  completion_request_recipients: string;
  reminder_recipients: string;
  reminder_days: number;
  reminder_enabled: boolean;
}

const DEFAULT_FORM: EmailSettingsForm = {
  smtp_enabled: false,
  smtp_host: '',
  smtp_port: 587,
  smtp_secure: false,
  smtp_user: '',
  smtp_password: '',
  from_email: '',
  from_name: 'WMS Notifications',
  completion_request_recipients: '',
  reminder_recipients: '',
  reminder_days: 2,
  reminder_enabled: true,
};

export default function EmailSettingsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState<EmailSettingsForm>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [triggeringReminder, setTriggeringReminder] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await apiClient.get<EmailSettingsForm>('/email-settings');
      if (response.success && response.data) {
        setForm({
          ...response.data,
          smtp_port: Number(response.data.smtp_port) || 587,
          reminder_days: Number(response.data.reminder_days) || 0,
        });
      } else {
        toast.showError('Error', response.error || 'Failed to load email settings');
      }
    } catch {
      toast.showError('Error', 'Failed to load email settings');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user?.role === 'superadmin') {
      fetchSettings();
    } else {
      setLoading(false);
    }
  }, [user, fetchSettings]);

  const saveSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await apiClient.put<EmailSettingsForm>('/email-settings', form);
      if (response.success) {
        toast.showSuccess('Saved', 'Email settings updated successfully');
      } else {
        toast.showError('Error', response.error || 'Failed to save email settings');
      }
    } catch {
      toast.showError('Error', 'Failed to save email settings');
    } finally {
      setSaving(false);
    }
  };

  const triggerReminder = async () => {
    setTriggeringReminder(true);
    try {
      const response = await apiClient.post<{ sent: boolean; reason?: string; count?: number }>(
        '/email-settings/reminders/trigger',
        {},
      );
      if (response.success) {
        const message = response.data?.sent
          ? `Reminder email sent for ${response.data.count || 0} request(s).`
          : response.data?.reason || response.message || 'No reminder email sent.';
        toast.showSuccess('Reminder check complete', message);
      } else {
        toast.showError('Error', response.error || 'Failed to trigger reminders');
      }
    } catch {
      toast.showError('Error', 'Failed to trigger reminders');
    } finally {
      setTriggeringReminder(false);
    }
  };

  if (!user || user.role !== 'superadmin') {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Access Denied</h2>
        <p className="text-gray-600">Only superadmins can access email settings.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#08398F]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Email Settings</h1>
        <p className="text-gray-600">
          Configure SMTP, completion request recipients, and overdue reminder settings.
        </p>
      </div>

      <Card>
        <form onSubmit={saveSettings} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <input
                id="smtp_enabled"
                type="checkbox"
                checked={form.smtp_enabled}
                onChange={(e) => setForm((prev) => ({ ...prev, smtp_enabled: e.target.checked }))}
              />
              <label htmlFor="smtp_enabled" className="text-sm font-medium text-gray-700">
                Enable SMTP Email Sending
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                id="smtp_secure"
                type="checkbox"
                checked={form.smtp_secure}
                onChange={(e) => setForm((prev) => ({ ...prev, smtp_secure: e.target.checked }))}
              />
              <label htmlFor="smtp_secure" className="text-sm font-medium text-gray-700">
                Use Secure SMTP (SSL/TLS)
              </label>
            </div>
            <Input
              label="SMTP Host"
              value={form.smtp_host}
              onChange={(e) => setForm((prev) => ({ ...prev, smtp_host: e.target.value }))}
              placeholder="smtp.example.com"
            />
            <Input
              label="SMTP Port"
              type="number"
              value={String(form.smtp_port)}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, smtp_port: Number(e.target.value) || 0 }))
              }
              placeholder="587"
            />
            <Input
              label="SMTP Username"
              value={form.smtp_user}
              onChange={(e) => setForm((prev) => ({ ...prev, smtp_user: e.target.value }))}
              placeholder="notifications@example.com"
            />
            <Input
              label="SMTP Password"
              type="password"
              value={form.smtp_password}
              onChange={(e) => setForm((prev) => ({ ...prev, smtp_password: e.target.value }))}
              placeholder="Enter SMTP password"
            />
            <Input
              label="From Email"
              value={form.from_email}
              onChange={(e) => setForm((prev) => ({ ...prev, from_email: e.target.value }))}
              placeholder="notifications@example.com"
            />
            <Input
              label="From Name"
              value={form.from_name}
              onChange={(e) => setForm((prev) => ({ ...prev, from_name: e.target.value }))}
              placeholder="WMS Notifications"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Completion Request Recipients
              </label>
              <textarea
                value={form.completion_request_recipients}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, completion_request_recipients: e.target.value }))
                }
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#08398F] focus:border-[#08398F]"
                placeholder="email1@example.com, email2@example.com"
              />
              <p className="text-xs text-gray-500">Separate emails with comma, semicolon, or newline.</p>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Reminder Recipients
              </label>
              <textarea
                value={form.reminder_recipients}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, reminder_recipients: e.target.value }))
                }
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#08398F] focus:border-[#08398F]"
                placeholder="email1@example.com, email2@example.com"
              />
              <p className="text-xs text-gray-500">Separate emails with comma, semicolon, or newline.</p>
            </div>

            <Input
              label="Reminder Threshold (Days)"
              type="number"
              value={String(form.reminder_days)}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, reminder_days: Math.max(0, Number(e.target.value) || 0) }))
              }
              placeholder="2"
            />
            <div className="flex items-center space-x-2 pt-7">
              <input
                id="reminder_enabled"
                type="checkbox"
                checked={form.reminder_enabled}
                onChange={(e) => setForm((prev) => ({ ...prev, reminder_enabled: e.target.checked }))}
              />
              <label htmlFor="reminder_enabled" className="text-sm font-medium text-gray-700">
                Enable Pending Completion Reminders
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={saving}>
              Save Email Settings
            </Button>
            <Button type="button" variant="outline" loading={triggeringReminder} onClick={triggerReminder}>
              Trigger Reminder Check
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
