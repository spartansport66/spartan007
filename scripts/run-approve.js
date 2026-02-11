// If approve-proposal.js is in the project root
import approveProposal from '../approve-proposal.js';


try {
  const result = approveProposal();
  console.log("RESULT:", result);
} catch (e) {
  console.error("ERROR:", e.message);
  process.exit(1);
}
