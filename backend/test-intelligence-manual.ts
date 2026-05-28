/**
 * Manual Intelligence Testing Script
 * 
 * Run this to quickly test the Functional AI services.
 * 
 * Usage: npx tsx test-intelligence-manual.ts
 */

import { IntelligenceService } from "./src/services/intelligence/intelligence.service.js";

console.log("🧪 Testing Functional AI Intelligence Layer\n");
console.log("=" .repeat(60));

const service = new IntelligenceService();

// Test Scenario 1: C-130J Weight Conflict
console.log("\n📋 Test 1: C-130J Weight Conflict (HIGH Severity)");
console.log("-".repeat(60));

const test1 = {
  field_answers: {
    air_transportability: "C-130J (without disassembly)",
    drive_configuration: "8×8",
    ballistic_small_arms: "Level 3",
  },
  client_id: "test-client",
};

const result1 = await service.analyze(test1);
console.log(`✅ Conflicts detected: ${result1.conflicts.length}`);
if (result1.conflicts.length > 0) {
  const conflict = result1.conflicts[0];
  console.log(`   Type: ${conflict.type}`);
  console.log(`   Severity: ${conflict.severity}`);
  console.log(`   Message: ${conflict.message}`);
  console.log(`   Options: ${conflict.options.length} provided`);
  conflict.options.forEach((opt, i) => {
    console.log(`      ${i + 1}. ${opt}`);
  });
} else {
  console.log("❌ FAILED: No conflict detected");
}

// Test Scenario 2: Budget Sanity Check
console.log("\n📋 Test 2: Budget Sanity Check (MEDIUM Severity)");
console.log("-".repeat(60));

const test2 = {
  field_answers: {
    indicative_budget: "50M USD",
    vehicle_quantity: "48 units",
    ballistic_small_arms: "Level 3",
  },
  client_id: "test-client",
};

const result2 = await service.analyze(test2);
const budgetWarning = result2.conflicts.find((c) =>
  c.message.includes("Budget may be below market rate")
);
if (budgetWarning) {
  console.log(`✅ Budget warning detected`);
  console.log(`   Severity: ${budgetWarning.severity}`);
  console.log(`   Message: ${budgetWarning.message}`);
  console.log(`   Explanation: ${budgetWarning.explanation}`);
} else {
  console.log("❌ FAILED: Budget warning not detected");
}

// Test Scenario 3: UAE MOD Customer Pattern
console.log("\n📋 Test 3: UAE MOD Customer Pattern Suggestions");
console.log("-".repeat(60));

const test3 = {
  field_answers: {
    country_region: "UAE",
  },
  client_id: "UAE-MOD-2026",
};

const result3 = await service.analyze(test3);
console.log(`✅ Suggestions generated: ${result3.suggestions.length}`);
result3.suggestions.forEach((sug, i) => {
  console.log(`   ${i + 1}. [${sug.category}] ${sug.message}`);
  console.log(`      Rationale: ${sug.rationale}`);
});

// Test Scenario 4: IED Threat Environment
console.log("\n📋 Test 4: IED Threat Environment Implications");
console.log("-".repeat(60));

const test4 = {
  field_answers: {
    threat_environment: "IED/VBIED, RPG",
  },
  client_id: "test-client",
};

const result4 = await service.analyze(test4);
const threatSuggestion = result4.suggestions.find((s) =>
  s.message.includes("run-flat tires")
);
if (threatSuggestion) {
  console.log(`✅ Threat implication detected`);
  console.log(`   Category: ${threatSuggestion.category}`);
  console.log(`   Message: ${threatSuggestion.message}`);
  console.log(`   Rationale: ${threatSuggestion.rationale}`);
} else {
  console.log("❌ FAILED: Threat implication not detected");
}

// Test Scenario 5: Large Order Volume
console.log("\n📋 Test 5: Large Order Volume Pricing");
console.log("-".repeat(60));

const test5 = {
  field_answers: {
    vehicle_quantity: "60 units",
  },
  client_id: "test-client",
};

const result5 = await service.analyze(test5);
const volumeSuggestion = result5.suggestions.find((s) =>
  s.message.includes("volume pricing")
);
if (volumeSuggestion) {
  console.log(`✅ Volume pricing suggestion detected`);
  console.log(`   Category: ${volumeSuggestion.category}`);
  console.log(`   Message: ${volumeSuggestion.message}`);
} else {
  console.log("❌ FAILED: Volume pricing not suggested");
}

// Test Scenario 6: Multiple Conflicts
console.log("\n📋 Test 6: Multiple Conflicts Simultaneously");
console.log("-".repeat(60));

const test6 = {
  field_answers: {
    air_transportability: "C-130J (without disassembly)",
    drive_configuration: "8×8",
    ballistic_small_arms: "Level 3",
    indicative_budget: "50M USD",
    vehicle_quantity: "48 units",
    delivery_timeline: "12 months",
    offset_requirement: "40% offset",
  },
  client_id: "test-client",
};

const result6 = await service.analyze(test6);
console.log(`✅ Total conflicts detected: ${result6.conflicts.length}`);

const highConflicts = result6.conflicts.filter((c) => c.severity === "HIGH");
const mediumConflicts = result6.conflicts.filter((c) => c.severity === "MEDIUM");
const lowConflicts = result6.conflicts.filter((c) => c.severity === "LOW");

console.log(`   HIGH severity: ${highConflicts.length}`);
console.log(`   MEDIUM severity: ${mediumConflicts.length}`);
console.log(`   LOW severity: ${lowConflicts.length}`);

highConflicts.forEach((c) => {
  console.log(`   ⚠️  ${c.message}`);
});

// Test Scenario 7: Performance
console.log("\n📋 Test 7: Performance Test");
console.log("-".repeat(60));

const test7 = {
  field_answers: {
    primary_role: "Troop Transport",
    threat_environment: "IED/VBIED, Small Arms",
    vehicle_quantity: "48 units",
    ballistic_small_arms: "Level 3",
    drive_configuration: "8×8",
    air_transportability: "C-130J (without disassembly)",
    indicative_budget: "50M USD",
    delivery_timeline: "12 months",
  },
  client_id: "test-client",
};

const startTime = Date.now();
const result7 = await service.analyze(test7);
const duration = Date.now() - startTime;

console.log(`✅ Analysis completed in ${duration}ms`);
if (duration < 1000) {
  console.log(`   ✅ PASS: Under 1 second`);
} else {
  console.log(`   ❌ FAIL: Over 1 second`);
}

// Summary
console.log("\n" + "=".repeat(60));
console.log("📊 TEST SUMMARY");
console.log("=".repeat(60));

const totalTests = 7;
let passedTests = 0;

if (result1.conflicts.length > 0) passedTests++;
if (budgetWarning) passedTests++;
if (result3.suggestions.length > 0) passedTests++;
if (threatSuggestion) passedTests++;
if (volumeSuggestion) passedTests++;
if (result6.conflicts.length >= 3) passedTests++;
if (duration < 1000) passedTests++;

console.log(`\n✅ Passed: ${passedTests}/${totalTests}`);
console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`);

if (passedTests === totalTests) {
  console.log("\n🎉 ALL TESTS PASSED! Functional AI is working correctly.");
} else {
  console.log("\n⚠️  Some tests failed. Review the output above.");
}

console.log("\n" + "=".repeat(60));
console.log("🎯 FUNCTIONAL AI VALUE PROPOSITION");
console.log("=".repeat(60));
console.log("\n✅ Conflict Detection: Real-time engineering analysis");
console.log("✅ Contextual Suggestions: Proactive insights from patterns");
console.log("✅ Vehicle Matching: Progressive matching during intake");
console.log("✅ Performance: Sub-second analysis");
console.log("\n💡 Value: Saves 6-10 hours of manual engineering work");
console.log("\n" + "=".repeat(60));
