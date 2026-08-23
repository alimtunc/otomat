import {
  isDesktopUpdateInstallable,
  type DesktopUpdateRelease,
  type DesktopUpdateSnapshot,
  type DesktopUpdateState,
} from "@otomat/domain";

import { cooldownElapsed, readLastCheck, writeLastCheck } from "./cooldown.js";
import { feedOf, replaces } from "./feed.js";
import type { UpdateGate } from "./gate.js";
import { RELEASES_URL, type Installability } from "./installability.js";

/** The updater mechanism, injected so the state machine is testable without Electron or a network. */
export interface UpdaterPort {
  /** The release this build would move to, or null when the feed offers none. */
  check(): Promise<DesktopUpdateRelease | null>;
  /** Resolves once the artifact is downloaded and verified against the published metadata. */
  download(): Promise<void>;
  /** Replaces the installed app with the downloaded one and relaunches; it does not return. */
  quitAndInstall(): void;
  onProgress(listener: (percent: number) => void): void;
}

export interface DesktopUpdaterOptions {
  currentVersion: string;
  installability: Installability;
  dataDir: string;
  /** Only the three questions the updater asks; a stub answering them is a legitimate gate. */
  gate: Pick<UpdateGate, "arm" | "observe" | "release">;
  port: UpdaterPort;
  onChange(snapshot: DesktopUpdateSnapshot): void;
  log(message: string): void;
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class DesktopUpdater {
  private state: DesktopUpdateState;
  private release: DesktopUpdateRelease | null = null;
  private progress: number | null = null;
  private detail: string | null;
  private checkedAt: string | null;
  private working = false;

  constructor(private readonly options: DesktopUpdaterOptions) {
    const { installability } = options;
    this.state = installability.installable ? "up_to_date" : "manual_only";
    this.detail = installability.installable ? null : installability.reason;
    this.checkedAt = readLastCheck(options.dataDir, options.log);
    options.port.onProgress((percent) => this.trackProgress(percent));
  }

  snapshot(): DesktopUpdateSnapshot {
    return {
      state: this.state,
      current_version: this.options.currentVersion,
      feed: feedOf(this.options.currentVersion),
      release: this.release,
      progress: this.progress,
      checked_at: this.checkedAt,
      detail: this.detail,
      manual_url: this.options.installability.installable ? null : RELEASES_URL,
    };
  }

  /** The startup check: it honours the cooldown, so a restart loop never becomes a poll. */
  start(): void {
    if (!cooldownElapsed(this.checkedAt, Date.now())) return;
    void this.check();
  }

  /** The manual check: the operator asked now, so the cooldown does not apply. */
  async check(): Promise<void> {
    if (!this.options.installability.installable || this.working) return;
    this.working = true;
    this.publish("checking", null);
    try {
      const found = await this.options.port.check();
      this.recordCheck();
      if (found === null || !replaces(this.options.currentVersion, found.version)) {
        this.release = null;
        this.publish("up_to_date", this.otherFeed(found));
        return;
      }
      this.release = found;
      this.publish("available", null);
      await this.downloadRelease();
    } catch (error) {
      this.fail(error);
    } finally {
      this.working = false;
    }
  }

  /** Holds every host before looking again, so a launch started while the notes were open still blocks. */
  async install(): Promise<void> {
    if (!isDesktopUpdateInstallable(this.state) || this.working) return;
    this.working = true;
    try {
      const verdict = await this.options.gate.arm();
      if (!verdict.clear) {
        await this.options.gate.release();
        this.publish("waiting_for_runs", verdict.reason);
        return;
      }
      this.options.port.quitAndInstall();
    } catch (error) {
      await this.options.gate.release();
      this.fail(error);
    } finally {
      this.working = false;
    }
  }

  /** A release this build may not move to is named rather than hidden behind "up to date". */
  private otherFeed(found: DesktopUpdateRelease | null): string | null {
    const feed = feedOf(this.options.currentVersion);
    if (found === null || feedOf(found.version) === feed) return null;
    return `Otomat ${found.version} is on the ${feedOf(found.version)} channel; this build follows ${feed}.`;
  }

  private async downloadRelease(): Promise<void> {
    this.progress = 0;
    this.publish("downloading", null);
    await this.options.port.download();
    this.progress = null;
    await this.settleReady();
  }

  /** A downloaded release still names what is in its way, so the operator sees it before clicking. */
  private async settleReady(): Promise<void> {
    const verdict = await this.options.gate.observe();
    if (verdict.clear) this.publish("ready", null);
    else this.publish("waiting_for_runs", verdict.reason);
  }

  private trackProgress(percent: number): void {
    if (this.state !== "downloading") return;
    const whole = Math.max(0, Math.min(100, Math.round(percent)));
    if (whole === this.progress) return;
    this.progress = whole;
    this.options.onChange(this.snapshot());
  }

  private recordCheck(): void {
    this.checkedAt = new Date().toISOString();
    writeLastCheck(this.options.dataDir, this.checkedAt, this.options.log);
  }

  /** Nothing was replaced: the running app and its data are exactly as they were. */
  private fail(error: unknown): void {
    const message = reason(error);
    this.options.log(`Desktop update stopped: ${message}`);
    this.progress = null;
    this.publish("failed", message);
  }

  private publish(state: DesktopUpdateState, detail: string | null): void {
    this.state = state;
    this.detail = detail;
    this.options.onChange(this.snapshot());
  }
}
