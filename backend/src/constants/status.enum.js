export const PROCESSING = 'PROCESSING';
export const COMPLETED = 'COMPLETED';
export const FAILED = 'FAILED';
export const SUCCESS = 'SUCCESS';
export const STARTED = 'STARTED';
export const RECEIVED = 'RECEIVED';
export const FAILURE = 'FAILURE';
export const PENDING_JOB = 'PENDING_JOB';

export const STATUS = {
    PROCESSING,
    COMPLETED,
    FAILED,
    SUCCESS,
    STARTED,
    RECEIVED,
    FAILURE,
    PENDING_JOB
};

export const TERMINAL_STATUSES = [COMPLETED, FAILED, SUCCESS];

export const normalizeStatus = (value) => String(value || '').toUpperCase();
