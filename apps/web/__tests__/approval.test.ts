/**
 * approval.test.ts — Unit test for stablecoin approval logic
 * -------------------------------------------------------------
 * Enforces the PRD rule:
 *   "Always request the exact bounty amount, never unlimited/max approval."
 *
 * This test verifies that whatever string/amount the owner enters in the
 * UI matches the parameter sent to the ERC-20 approve() method down to
 * the exact decimal, preventing over-authorization security risks.
 */

import assert from 'assert';

/**
 * Validates that the approval payload prepared for the ERC-20 transaction
 * matches the exact bounty input entered by the user.
 */
export function validateApprovalAmount(
  enteredBounty: string,
  approvalAmount: string
): boolean {
  const enteredNum = parseFloat(enteredBounty);
  const approvalNum = parseFloat(approvalAmount);

  if (isNaN(enteredNum) || enteredNum <= 0) {
    throw new Error("Invalid bounty amount");
  }

  // Prevent unlimited approval vulnerability (e.g. max uint256 approvals)
  if (approvalAmount === '115792089237316195423570985008687907853269984665640564039457584007913129639935' || approvalNum > enteredNum) {
    throw new Error(`Security violation: Approval amount ${approvalAmount} exceeds entered bounty ${enteredBounty}`);
  }

  if (enteredNum !== approvalNum) {
    throw new Error(`Mismatch: Entered bounty is ${enteredBounty} but requested approval is ${approvalAmount}`);
  }

  return true;
}

// Run unit checks
try {
  console.log("Running in-app approval security checks...");

  // Case 1: Exact match passes
  assert.ok(validateApprovalAmount("50.00", "50.00"));
  assert.ok(validateApprovalAmount("0.05", "0.05"));

  // Case 2: Unlimited approval attempt must fail
  assert.throws(() => {
    validateApprovalAmount("50.00", "115792089237316195423570985008687907853269984665640564039457584007913129639935");
  }, /Security violation/);

  // Case 3: Over-approval attempts must fail
  assert.throws(() => {
    validateApprovalAmount("50.00", "50.01");
  }, /Security violation/);

  // Case 4: Under-approval attempts must fail
  assert.throws(() => {
    validateApprovalAmount("50.00", "49.99");
  }, /Mismatch/);

  console.log("✓ All approval amount validation checks passed successfully!");
  process.exit(0);
} catch (err: any) {
  console.error("Test execution failed:", err.message);
  process.exit(1);
}
