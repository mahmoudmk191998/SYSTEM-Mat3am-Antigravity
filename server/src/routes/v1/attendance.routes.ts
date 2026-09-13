import { Router } from 'express';
import {
  getPublicAttendanceInfo,
  recordPublicClock,
  manualCorrectAttendance,
  rotateAttendanceToken,
  deleteAttendanceRecord,
} from '../../controllers/attendance.controller.js';
import { authenticateApiKey } from '../../middleware/auth.middleware.js';
import { validateRequest } from '../../middleware/validator.middleware.js';
import {
  publicClockSchema,
  manualAttendanceCorrectionSchema,
} from '../../validators/attendance.validator.js';

export const attendanceRouter = Router();

// Public routes for QR Attendance screen
attendanceRouter.get('/attendance/public/info', getPublicAttendanceInfo);
attendanceRouter.post(
  '/attendance/public/clock',
  validateRequest({ body: publicClockSchema }),
  recordPublicClock
);

// Authenticated Admin routes
attendanceRouter.post(
  '/attendance/manual-correction',
  authenticateApiKey,
  validateRequest({ body: manualAttendanceCorrectionSchema }),
  manualCorrectAttendance
);

attendanceRouter.post(
  '/attendance/rotate-qr-token',
  authenticateApiKey,
  rotateAttendanceToken
);

attendanceRouter.delete(
  '/attendance/:attendanceId',
  authenticateApiKey,
  deleteAttendanceRecord
);
