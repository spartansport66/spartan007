import { execSync } from "child_process";

export default function approveProposal() {
  try {
    process.chdir("C:/users/admin/dyad-apps/spartan");

    execSync("git add -A");

    const status = execSync("git status --porcelain", { encoding: "utf8" });

    if (!status.trim()) {
      return { success: true, committed: false };
    }

    execSync('git commit -m "Approve proposal"');
    return { success: true, committed: true };
  } catch (err) {
    if (err.message.includes("nothing to commit")) {
      return { success: true, committed: false };
    }
    throw err;
  }
}
