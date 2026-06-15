import { describe, it, expect } from 'vitest';
import {
  buildOrgIdClause,
  isOpenBreak,
  buildTodayAttendanceQuery,
  buildLiveStatus,
  recordWorkedHoursForRow,
  getCalendarWeekRange,
  calendarWeekKey,
  sumHoursFromAttendanceRows,
} from '../utils/attendanceQueryHelpers.js';

describe('buildOrgIdClause', () => {
  it('uses single orgId when JWT and employee org match', () => {
    expect(buildOrgIdClause('org_abc', 'org_abc')).toEqual({ orgId: 'org_abc' });
  });

  it('uses $in when JWT orgId differs from employee orgId', () => {
    expect(buildOrgIdClause('org_employee', 'org_jwt')).toEqual({
      orgId: { $in: ['org_employee', 'org_jwt'] },
    });
  });

  it('deduplicates identical ids after string coercion', () => {
    expect(buildOrgIdClause(123, '123')).toEqual({ orgId: '123' });
  });

  it('filters empty org ids', () => {
    expect(buildOrgIdClause('', 'org_only')).toEqual({ orgId: 'org_only' });
  });
});

describe('isOpenBreak', () => {
  it('returns true when break has startTime and no endTime', () => {
    expect(isOpenBreak({ startTime: new Date(), endTime: null })).toBe(true);
    expect(isOpenBreak({ startTime: new Date(), endTime: undefined })).toBe(true);
    expect(isOpenBreak({ startTime: new Date(), endTime: '' })).toBe(true);
  });

  it('returns false when break is completed', () => {
    expect(
      isOpenBreak({ startTime: new Date('2026-05-15T10:00:00Z'), endTime: new Date('2026-05-15T10:15:00Z') })
    ).toBe(false);
  });

  it('returns false without startTime', () => {
    expect(isOpenBreak({ endTime: null })).toBe(false);
    expect(isOpenBreak(null)).toBe(false);
  });
});

describe('buildTodayAttendanceQuery', () => {
  const fixedNow = new Date('2026-05-15T14:30:00+05:30');

  it('scopes employee by userId and flexible orgId', () => {
    const q = buildTodayAttendanceQuery(
      'employee',
      'user_1',
      'emp_1',
      'org_employee',
      'org_jwt',
      fixedNow
    );

    expect(q.userId).toBe('user_1');
    expect(q.orgId).toEqual({ $in: ['org_employee', 'org_jwt'] });
    expect(q.date.$gte.getHours()).toBe(0);
    expect(q.date.$lt.getDate()).toBe(q.date.$gte.getDate() + 1);
    expect(q.employeeId).toBeUndefined();
  });

  it('scopes admin path by employeeId', () => {
    const q = buildTodayAttendanceQuery(
      'admin',
      'user_1',
      'emp_1',
      'org_a',
      'org_a',
      fixedNow
    );

    expect(q.employeeId).toBe('emp_1');
    expect(q.orgId).toBe('org_a');
    expect(q.userId).toBeUndefined();
  });
});

describe('buildLiveStatus', () => {
  it('returns not_checked_in when no attendance', () => {
    expect(buildLiveStatus(null).status).toBe('not_checked_in');
    expect(buildLiveStatus({}).status).toBe('not_checked_in');
  });

  it('returns checked_in when checked in without checkout', () => {
    const status = buildLiveStatus({
      checkIn: new Date(Date.now() - 60 * 60 * 1000),
      breaks: [],
    });
    expect(status.status).toBe('checked_in');
    expect(status.isOnBreak).toBe(false);
  });

  it('returns on_break for open break with empty string endTime', () => {
    const status = buildLiveStatus({
      checkIn: new Date(Date.now() - 2 * 60 * 60 * 1000),
      breaks: [{ startTime: new Date(Date.now() - 30 * 60 * 1000), endTime: '', breakType: 'lunch' }],
    });
    expect(status.status).toBe('on_break');
    expect(status.isOnBreak).toBe(true);
    expect(status.breakType).toBe('lunch');
  });

  it('returns checked_out when checkout exists', () => {
    const checkIn = new Date('2026-05-15T09:00:00Z');
    const checkOut = new Date('2026-05-15T18:00:00Z');
    const status = buildLiveStatus({ checkIn, checkOut, breaks: [] });
    expect(status.status).toBe('checked_out');
    expect(status.isOnBreak).toBe(false);
    expect(status.currentHours).toBe(9);
  });
});

describe('recordWorkedHoursForRow', () => {
  it('uses stored hoursWorked when checkout present', () => {
    expect(
      recordWorkedHoursForRow({
        checkIn: new Date('2026-05-15T09:00:00Z'),
        checkOut: new Date('2026-05-15T18:00:00Z'),
        hoursWorked: 7.5,
      })
    ).toBe(7.5);
  });

  it('returns live hours for open shift minus open break', () => {
    const checkIn = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const breakStart = new Date(Date.now() - 30 * 60 * 1000);
    const hours = recordWorkedHoursForRow({
      checkIn,
      breaks: [{ startTime: breakStart, endTime: null }],
    });
    expect(hours).toBeGreaterThan(2.4);
    expect(hours).toBeLessThan(2.6);
  });
});

describe('calendar week', () => {
  it('weekKey resets on a new Monday week', () => {
    const monday = new Date('2026-05-11T12:00:00');
    const nextMonday = new Date('2026-05-18T12:00:00');
    expect(calendarWeekKey(monday)).not.toBe(calendarWeekKey(nextMonday));
  });

  it('sumHoursFromAttendanceRows totals completed and open days', () => {
    const rows = [
      {
        checkIn: new Date('2026-05-12T09:00:00Z'),
        checkOut: new Date('2026-05-12T17:00:00Z'),
        hoursWorked: 7.5,
        breaks: [],
      },
    ];
    expect(sumHoursFromAttendanceRows(rows)).toBe(7.5);
    const { weekStart, weekEnd } = getCalendarWeekRange(new Date('2026-05-12T12:00:00Z'));
    expect(weekEnd.getTime() - weekStart.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
