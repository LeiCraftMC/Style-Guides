/**
 * Shared formatting helpers for timestamps, durations, and status badges.
 */

export function formatDate(ts: number | null | undefined): string {
    if (!ts) return '-';
    return new Date(ts).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function formatDateISO(ts: number | null | undefined): string {
    if (!ts) return '';
    const d = new Date(ts);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
}

export function parseDateISO(value: string): number {
    if (!value) return 0;
    return new Date(value).getTime();
}

export function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
}

export function getStatusColor(status: string | null | undefined): 'success' | 'error' | 'warning' | 'neutral' {
    switch (status) {
        case 'up':
            return 'success';
        case 'down':
            return 'error';
        case 'degraded':
            return 'warning';
        default:
            return 'neutral';
    }
}

export function getStatusIcon(status: string | null | undefined): string {
    switch (status) {
        case 'up':
            return 'i-lucide-check-circle';
        case 'down':
            return 'i-lucide-x-circle';
        case 'degraded':
            return 'i-lucide-alert-triangle';
        default:
            return 'i-lucide-help-circle';
    }
}

export function getSeverityColor(severity: string | null | undefined): 'error' | 'warning' | 'primary' | 'neutral' {
    switch (severity) {
        case 'critical':
            return 'error';
        case 'major':
            return 'warning';
        case 'minor':
            return 'primary';
        default:
            return 'neutral';
    }
}

export function getIncidentStatusColor(status: string | null | undefined): 'error' | 'warning' | 'primary' | 'success' | 'neutral' {
    switch (status) {
        case 'investigating':
            return 'error';
        case 'identified':
            return 'warning';
        case 'monitoring':
            return 'primary';
        case 'resolved':
            return 'success';
        default:
            return 'neutral';
    }
}

export function getMaintenanceStatusColor(status: string | null | undefined): 'warning' | 'primary' | 'success' | 'error' | 'neutral' {
    switch (status) {
        case 'scheduled':
            return 'warning';
        case 'in_progress':
            return 'primary';
        case 'completed':
            return 'success';
        case 'cancelled':
            return 'error';
        default:
            return 'neutral';
    }
}
