/**
 * Git guardrail — installed globally, so it applies to every project.
 *
 * Git is READ-ONLY unless the user explicitly asks otherwise. This hook blocks
 * any git invocation that is not provably read-only. It is DEFAULT-DENY: an
 * allowlist of mutating verbs would need updating every time git grows one, and
 * a stale list fails open ("the agent committed without permission"). An
 * allowlist of safe verbs fails closed.
 *
 * Override, if the user ever wants one: delete this file.
 */

import type { HookAPI } from "@oh-my-pi/pi-coding-agent/extensibility/hooks";

/** git subcommands that only read. Anything absent from this table is blocked. */
const READ_ONLY: Record<string, true> = {
  annotate: true,
  blame: true,
  "cat-file": true,
  "check-attr": true,
  "check-ignore": true,
  cherry: true,
  "count-objects": true,
  describe: true,
  diff: true,
  "diff-files": true,
  "diff-index": true,
  "diff-tree": true,
  "for-each-ref": true,
  grep: true,
  help: true,
  log: true,
  "ls-files": true,
  "ls-remote": true,
  "ls-tree": true,
  "merge-base": true,
  "name-rev": true,
  "range-diff": true,
  "rev-list": true,
  "rev-parse": true,
  shortlog: true,
  show: true,
  "show-branch": true,
  "show-ref": true,
  status: true,
  "symbolic-ref": true,
  var: true,
  "verify-commit": true,
  "verify-tag": true,
  version: true,
  whatchanged: true,
};

/** Flags that make an otherwise-mutating subcommand read-only. */
const LIST_FLAGS: Record<string, true> = {
  "-l": true,
  "--list": true,
  "-a": true,
  "--all": true,
  "-r": true,
  "--remote": true,
  "-v": true,
  "--verbose": true,
  "--contains": true,
  "--merged": true,
  "--no-merged": true,
  "--points-at": true,
  "--sort": true,
};

/** Subcommands that are read-only only with the right argument. */
const READ_ONLY_WITH_ARGS: Record<
  string,
  { allow: Record<string, true>; deny?: Record<string, true> }
> = {
  branch: {
    allow: LIST_FLAGS,
    deny: {
      "-d": true,
      "-D": true,
      "-m": true,
      "-M": true,
      "-f": true,
      "--delete": true,
      "--force": true,
      "--unset-upstream": true,
      "--set-upstream-to": true,
      "-u": true,
    },
  },
  tag: {
    allow: {
      "-l": true,
      "--list": true,
      "-n": true,
      "--contains": true,
      "--points-at": true,
      "--sort": true,
      "-v": true,
      "--format": true,
    },
    deny: {
      "-d": true,
      "-a": true,
      "-s": true,
      "-f": true,
      "-m": true,
      "-u": true,
      "--delete": true,
      "--force": true,
      "--sign": true,
    },
  },
  remote: {
    allow: {
      "-v": true,
      "--verbose": true,
      show: true,
      "get-url": true,
    },
  },
  config: {
    allow: {
      "--get": true,
      "--get-all": true,
      "--get-regexp": true,
      "--list": true,
      "-l": true,
      "--show-origin": true,
      "--show-scope": true,
    },
  },
  stash: { allow: { list: true } },
  worktree: { allow: { list: true } },
  reflog: { allow: { show: true, exists: true } },
  submodule: { allow: { status: true } },
  notes: { allow: { list: true, show: true } },
};

/** Leading tokens that are not the command itself. */
const WRAPPERS: Record<string, true> = {
  sudo: true,
  doas: true,
  env: true,
  nohup: true,
  time: true,
  nice: true,
  ionice: true,
  setsid: true,
  command: true,
  exec: true,
  builtin: true,
  then: true,
  else: true,
  do: true,
  "!": true,
};

/** git global flags that consume the following token as a value. */
const VALUE_FLAGS: Record<string, true> = {
  "-C": true,
  "-c": true,
  "--git-dir": true,
  "--work-tree": true,
  "--namespace": true,
  "--exec-path": true,
  "--config-env": true,
};

/** Split a shell command into segments on control operators. */
function segments(command: string): string[] {
  return command
    .split(/\|\||&&|[;|&\n]|\$\(|`|\$\{/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

interface Invocation {
  sub: string;
  args: string[];
}

function gitInvocation(segment: string): Invocation | null {
  const tokens = segment.split(/\s+/).filter(Boolean);
  let i = 0;

  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t) || WRAPPERS[t] === true) {
      i++;
      continue;
    }
    break;
  }

  const exe = tokens[i];
  if (!exe || exe.split("/").pop() !== "git") return null;
  i++;

  while (i < tokens.length && tokens[i].startsWith("-")) {
    i += VALUE_FLAGS[tokens[i]] === true ? 2 : 1;
  }

  const sub = tokens[i];
  // bare `git`, `git --version`, `git --help` — nothing to mutate
  if (!sub || sub.startsWith("-")) return { sub: "version", args: [] };
  return { sub, args: tokens.slice(i + 1) };
}

function isReadOnly(inv: Invocation): boolean {
  if (READ_ONLY[inv.sub] === true) return true;

  const rule = READ_ONLY_WITH_ARGS[inv.sub];
  if (!rule) return false;

  if (rule.deny && inv.args.some((a) => rule.deny?.[a] === true)) return false;
  return inv.args.some((a) => rule.allow[a] === true);
}

export default function gitGuardrail(pi: HookAPI): void {
  pi.on("tool_call", async (event) => {
    if (event.toolName !== "bash") return;

    for (const segment of segments(String(event.input.command ?? ""))) {
      const inv = gitInvocation(segment);
      if (!inv || isReadOnly(inv)) continue;

      return {
        block: true,
        reason:
          `BLOCKED by git guardrail: \`git ${inv.sub}\` may alter repository state.\n\n` +
          `Git is read-only unless the user explicitly asks for a specific mutating ` +
          `action. Do not run it, and do not ask for permission to — committing is a ` +
          `decision about the user's history, not one an agent may propose.\n\n` +
          `Read-only git (status, log, diff, show, blame, rev-parse, …) runs unprompted.\n` +
          `If the user does want this, they can delete ~/.omp/agent/hooks/pre/git-guardrail.ts`,
      };
    }

    return undefined;
  });
}
