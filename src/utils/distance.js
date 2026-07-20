function normalizeLocationValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function calculateZoneMatchDistance({
  targetZoneId,
  targetCity,
  targetState,
  riderZone
}) {
  if (!riderZone) {
    return Number.POSITIVE_INFINITY;
  }

  if (
    targetZoneId !== null
    && targetZoneId !== undefined
    && Number(riderZone.id) === Number(targetZoneId)
  ) {
    return 0;
  }

  const normalizedTargetCity = normalizeLocationValue(targetCity);
  const normalizedTargetState = normalizeLocationValue(targetState);
  const normalizedRiderCity = normalizeLocationValue(riderZone.city);
  const normalizedRiderState = normalizeLocationValue(riderZone.state);

  if (
    normalizedTargetCity
    && normalizedTargetState
    && normalizedTargetCity === normalizedRiderCity
    && normalizedTargetState === normalizedRiderState
  ) {
    return 1;
  }

  if (
    normalizedTargetState
    && normalizedTargetState === normalizedRiderState
  ) {
    return 2;
  }

  return Number.POSITIVE_INFINITY;
}

module.exports = {
  calculateZoneMatchDistance
};
