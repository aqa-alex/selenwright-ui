import type { ArtifactPageModel } from "./artifacts/artifactsPage";
import type { OperationsPageModel } from "./operations/operationsPage";
import type { SessionDetailPageModel } from "./session-detail/sessionDetail";
import type { SessionsPageModel } from "./sessions/sessionTable";

export interface ShellQuickJumpResult {
  kind: string;
  meta: string;
  path: string;
  title: string;
}

export interface ShellPreferences {
  artifactPaneWidths?: Record<string, number>;
  density: string;
  detailPanel?: string;
  themeMode: string;
  timeFormat?: string;
  timezone?: string;
}

export interface ShellSnapshot {
  artifactPage: ArtifactPageModel | null;
  notice: string;
  operationsPage: OperationsPageModel | null;
  pageTitle: string;
  preferences: ShellPreferences;
  quickJumpQuery: string;
  quickJumpResults: ShellQuickJumpResult[];
  routeName: string;
  sessionDetailPage: SessionDetailPageModel | null;
  sessionsPage: SessionsPageModel | null;
}
