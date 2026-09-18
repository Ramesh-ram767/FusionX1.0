import { calculateHaversineDistance, isWithinRadius } from './src/services/geospatial.service.js';
import { checkDuplicateReports } from './src/services/duplicate.service.js';
import { store } from './src/services/store.service.js';

console.log('====================================================');
console.log('FUSIONX PHASE 2: GPS RADIUS + DINOv2 DUPLICATE TESTS');
console.log('====================================================\n');

async function runTests() {
  // --- UNIT TEST: Geospatial Service ---
  console.log('[1] Geospatial Distance Verification (Haversine)');
  const distSame = calculateHaversineDistance(13.6288, 79.4192, 13.6288, 79.4192);
  console.log(`  Distance to self: ${distSame} m (Expected: 0 m)`);

  const distNearby = calculateHaversineDistance(13.6288, 79.4192, 13.6291, 79.4194);
  console.log(`  Distance to nearby point: ${distNearby} m (Expected: ~40 m)`);

  const distFar = calculateHaversineDistance(13.6288, 79.4192, 13.0827, 80.2707);
  console.log(`  Distance to Chennai: ${distFar} m (Expected: ~115 km)`);

  console.log('\n----------------------------------------------------');

  // Existing test problems in store:
  // Problem #101: Garbage dump, lat: 13.6288, lon: 79.4192, image: garbbage.webp
  const existing = store.getAll();
  console.log(`Store initialized with ${existing.length} baseline problems:`);
  existing.forEach((p) => console.log(`  #${p.id}: [${p.category}] ${p.title} (${p.latitude}, ${p.longitude})`));

  console.log('\n----------------------------------------------------');

  // --- TEST A: Similar image + Nearby GPS (< 100m) ---
  console.log('[TEST A] Same/Similar Incident (Nearby GPS + High DINOv2 Visual Similarity)');
  const resA = await checkDuplicateReports({
    latitude: 13.6291,
    longitude: 79.4194, // ~40m from Problem #101
    image_path: 'C:/Users/rames/civic-ai-engine/garbbage_cropped.webp',
  });

  console.log(`  Potential Match Decision: ${resA.potential_match ? 'YES (Flagged as Potential Duplicate)' : 'NO'}`);
  const topMatchA = resA.matches[0];
  console.log(`  Top Match: Problem #${topMatchA?.problem_id} ("${topMatchA?.title}")`);
  console.log(`  Distance: ${topMatchA?.distance_meters} m (Within 100m radius: ${topMatchA?.is_within_radius})`);
  console.log(`  DINOv2 Similarity: ${topMatchA?.image_similarity} (${topMatchA?.similarity_percentage}%)`);
  console.log(`  Flagged as Potential Duplicate: ${topMatchA?.is_potential_duplicate}`);

  if (resA.potential_match && topMatchA?.is_potential_duplicate) {
    console.log('  >>> TEST A PASSED: Properly flagged as potential match!\n');
  } else {
    console.error('  >>> TEST A FAILED!\n');
  }

  // --- TEST B: Different image + Nearby GPS (< 100m) ---
  console.log('[TEST B] Different Incident Category (Nearby GPS + Low Visual Similarity)');
  const resB = await checkDuplicateReports({
    latitude: 13.6291,
    longitude: 79.4194, // ~40m from Problem #101 (Garbage), but water leakage image
    image_path: 'C:/Users/rames/civic-ai-engine/waterleakage.webp',
  });

  console.log(`  Potential Match Decision: ${resB.potential_match ? 'YES (Potential Duplicate)' : 'NO (Independent Issue)'}`);
  const topMatchB = resB.matches.find((m) => m.problem_id === '101');
  console.log(`  Candidate Problem #101 Distance: ${topMatchB?.distance_meters} m`);
  console.log(`  DINOv2 Similarity: ${topMatchB?.image_similarity} (${topMatchB?.similarity_percentage}%)`);
  console.log(`  Flagged as Potential Duplicate: ${topMatchB?.is_potential_duplicate}`);

  if (!resB.potential_match && !topMatchB?.is_potential_duplicate) {
    console.log('  >>> TEST B PASSED: GPS is nearby but visual dissimilarity prevented false duplicate flag!\n');
  } else {
    console.error('  >>> TEST B FAILED!\n');
  }

  // --- TEST C: Same Image + Far-Away GPS (> 100m) ---
  console.log('[TEST C] Fraud/Reused Image Defense (High Visual Similarity + Far-Away GPS)');
  const resC = await checkDuplicateReports({
    latitude: 13.0827, // Chennai (~115 km away from Tirupati #101)
    longitude: 80.2707,
    image_path: 'C:/Users/rames/civic-ai-engine/garbbage.webp', // identical image!
  });

  console.log(`  Potential Match Decision: ${resC.potential_match ? 'YES (Potential Duplicate)' : 'NO (Outside Radius)'}`);
  const matchC = resC.matches.find((m) => m.problem_id === '101');
  console.log(`  Problem #101 Distance: ${matchC?.distance_meters} m (${Math.round(matchC?.distance_meters / 1000)} km)`);
  console.log(`  Within 100m Radius: ${matchC?.is_within_radius}`);
  console.log(`  DINOv2 Similarity: ${matchC?.image_similarity} (${matchC?.similarity_percentage}%)`);
  console.log(`  Flagged as Potential Duplicate: ${matchC?.is_potential_duplicate}`);

  if (!resC.potential_match && !matchC?.is_potential_duplicate) {
    console.log('  >>> TEST C PASSED: High image similarity (1.0) alone did NOT trigger duplicate because GPS is far away!\n');
  } else {
    console.error('  >>> TEST C FAILED!\n');
  }

  // --- TEST D: Different Image + Nearby GPS (Geographic Candidate Distinction) ---
  console.log('[TEST D] Geographic Neighbor (Nearby GPS + Distinct Incident Type)');
  const resD = await checkDuplicateReports({
    latitude: 13.6289,
    longitude: 79.4193, // ~15.5m from Problem #101 (Garbage)
    image_path: 'C:/Users/rames/civic-ai-engine/brlit.jpg',
    existingProblems: [existing.find((p) => p.id === '101')],
  });

  console.log(`  Potential Match Decision: ${resD.potential_match ? 'YES' : 'NO'}`);
  const matchD101 = resD.matches.find((m) => m.problem_id === '101');
  console.log(`  Problem #101 Distance: ${matchD101?.distance_meters} m (Within 100m radius: ${matchD101?.is_within_radius})`);
  console.log(`  DINOv2 Similarity: ${matchD101?.image_similarity} (${matchD101?.similarity_percentage}%)`);
  console.log(`  Flagged as Potential Duplicate: ${matchD101?.is_potential_duplicate}`);

  if (!resD.potential_match && matchD101?.is_within_radius && !matchD101?.is_potential_duplicate) {
    console.log('  >>> TEST D PASSED: Neighboring issue within radius returned as geographic candidate, but visual distinction prevented auto-merge!\n');
  } else {
    console.error('  >>> TEST D FAILED!\n');
  }

  console.log('====================================================');
  console.log('ALL PHASE 2 DUPLICATE DETECTION TESTS COMPLETED!');
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('Test run error:', err);
  process.exit(1);
});
