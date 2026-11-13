/* Scheduled reviews (Epic E).
 *
 * A separate tick from the workout reminder's, because the two want different things: the
 * reminder has to land on the minute someone chose, this only has to happen on the right
 * evening. Sixty seconds is plenty, and it keeps a loop that reads every user's state file
 * off the ten-second path.
 *
 * Skips are silent and logged, never pushed (FR-36/E4). Somebody whose provider is down, or
 * who trained nothing this week, should hear nothing at all — a notification that exists to
 * report the absence of news is how people turn notifications off.
 */
const TICK_MS = 60000;

/** Weekly cadence fires within the minute; everyWorkouts fires as soon as the count is met. */
export function isDue(coach, S, now) {
  if (!coach) return false;
  const cadence = coach.cadence;
  if (!cadence || cadence === 'off') return false;
  const rawLastAt = coach.lastReview?.at;
  const lastAt = typeof rawLastAt === 'number' && Number.isFinite(rawLastAt) && rawLastAt > 0 ? rawLastAt : 0;
  const lastAtDateStr = lastAt > 0 && !Number.isNaN(new Date(lastAt).getTime())
    ? new Date(lastAt).toISOString().slice(0, 10)
    : '';

  // Nothing new to read is the most common reason not to run, and it applies to both modes.
  const workouts = Array.isArray(S?.workouts) ? S.workouts : [];
  const since = workouts.filter(w => {
    if (!w) return false;
    if (!lastAt) return true;
    if (typeof w.end === 'number' && Number.isFinite(w.end) && w.end > lastAt) return true;
    if (typeof w.d === 'string' && lastAtDateStr && w.d > lastAtDateStr) return true;
    return false;
  });
  if (!since.length) return false;

  if (typeof cadence.everyWorkouts === 'number' && Number.isFinite(cadence.everyWorkouts) && cadence.everyWorkouts > 0) {
    return since.length >= Math.max(1, Math.min(20, Math.floor(cadence.everyWorkouts)));
  }
  if (cadence.weekly && typeof cadence.weekly === 'object') {
    if (!now) return false;
    const wantDay = cadence.weekly.day ?? 0;
    const wantTime = cadence.weekly.time || '18:00';
    if (now.weekday !== wantDay || now.hhmm !== wantTime) return false;
    // One per day, even if the tick sees the same minute twice.
    return lastAtDateStr !== now.date;
  }
  return false;
}

/**
 * @param {object} deps  { users(): [{id}], userNow(tz): {date,hhmm,weekday} }
 */
export function startCadence(deps) {
  let jobsModule;
  let cfgStoreModule;

  const timer = setInterval(async () => {
    try {
      if (!jobsModule) jobsModule = await import('./jobs.js');
      if (!cfgStoreModule) cfgStoreModule = await import('./config.js');
    } catch (err) {
      console.error('coach cadence import error:', err);
      return;
    }
    if (!cfgStoreModule.isEnabled() || !cfgStoreModule.isConnected()) return;
    for (const user of deps.users()) {
      try {
        const S = jobsModule.readState(user.id);
        const coach = S?.coach;
        if (!coach?.consent?.agreedAt) continue;         // consent revoked ⇒ cadence stops
        const tz = coach.cadence?.weekly ? (S.reminder?.tz || 'UTC') : null;
        const now = tz ? deps.userNow(tz) : null;
        if (!isDue(coach, S, now)) continue;
        jobsModule.enqueue(user.id, { kind: 'review', trigger: 'scheduled' });
        console.log('coach: scheduled review queued for', user.id);
      } catch (e) {
        // Caps, an in-flight job, a provider that just went down: all ordinary, all silent.
        if (!(e instanceof jobsModule.CoachError)) console.error('coach cadence', user.id, e);
      }
    }
  }, TICK_MS);
  timer.unref();
  return timer;
}
