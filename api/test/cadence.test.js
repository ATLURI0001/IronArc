import test from 'node:test';
import assert from 'node:assert/strict';
import { isDue } from '../coach/cadence.js';

test('isDue handles empty and off cadence', () => {
  assert.equal(isDue(null, {}, null), false);
  assert.equal(isDue({}, {}, null), false);
  assert.equal(isDue({ cadence: 'off' }, {}, null), false);
});

test('isDue guards invalid/NaN lastReview.at date without throwing', () => {
  const coach = {
    cadence: { everyWorkouts: 2 },
    lastReview: { at: NaN }
  };
  const S = {
    workouts: [{ d: '2026-11-13', end: 1731500000 }]
  };
  assert.doesNotThrow(() => {
    assert.equal(isDue(coach, S, null), false);
  });

  // When count meets requirement
  S.workouts.push({ d: '2026-11-13', end: 1731500001 });
  assert.equal(isDue(coach, S, null), true);
});

test('isDue rejects boolean or non-finite everyWorkouts', () => {
  const coach = {
    cadence: { everyWorkouts: true }
  };
  const S = {
    workouts: [{ d: '2026-11-13', end: 1731500000 }]
  };
  assert.equal(isDue(coach, S, null), false);
});

test('isDue checks weekly schedule and prevents duplicate same-day reviews', () => {
  const coach = {
    cadence: { weekly: { day: 5, time: '18:00' } },
    lastReview: { at: Date.parse('2026-11-06T18:00:00Z') }
  };
  const S = {
    workouts: [{ d: '2026-11-13', end: Date.parse('2026-11-13T10:00:00Z') }]
  };

  const nowMatching = { weekday: 5, hhmm: '18:00', date: '2026-11-13' };
  assert.equal(isDue(coach, S, nowMatching), true);

  // If already reviewed today
  const coachReviewedToday = {
    ...coach,
    lastReview: { at: Date.parse('2026-11-13T09:00:00Z') }
  };
  assert.equal(isDue(coachReviewedToday, S, nowMatching), false);
});
