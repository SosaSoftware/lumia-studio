import { useApp } from './app-context.ts';
import { WorkspaceStore } from '../features/workspace/workspace-store.ts';
import { LumiSession } from '../features/lumi/lumi-session.ts';

let workspace: WorkspaceStore | null = null;
let lumi: LumiSession | null = null;

/** The workspace of the signed-in person; created on first use. */
export function useWorkspace(): WorkspaceStore {
  if (workspace === null) {
    const app = useApp();
    workspace = new WorkspaceStore(app.studio);
  }
  return workspace;
}

/** Lumi's conversation lives as long as the session, so closing its panel does not stop it. */
export function useLumi(): LumiSession {
  if (lumi === null) {
    const app = useApp();
    lumi = new LumiSession(useWorkspace(), {
      url: app.config.lumiUrl,
      getToken: () => app.auth.getToken(),
      getUser: () => {
        const user = app.user.value;
        return user === null ? null : { sub: user.sub, name: user.name, role: user.role };
      },
    });
    lumi.init(app.user.value?.sub ?? 'anonymous');
  }
  return lumi;
}

/** Drops the workspace and Lumi's conversation, e.g. on sign-out, so the next person starts clean. */
export function resetWorkspace(): void {
  lumi?.abortRun();
  lumi = null;
  workspace = null;
}
