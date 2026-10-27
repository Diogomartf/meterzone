import { NativeModule, requireOptionalNativeModule } from 'expo';

export type NativeRankEntry = {
  rank: number;
  name: string;
  /** The nickname the player picked (iOS); `name` can come back blank. */
  alias?: string;
  score: number;
  isYou: boolean;
};

declare class GameServicesModule extends NativeModule {
  /** Android only — false until the Play Games project ID is configured. */
  isAvailable?(): boolean;
  isAuthenticated(): boolean;
  /**
   * Signs the player in with the account already on the device — Game Center
   * on iOS, Play Games on Android. No email or password. Resolves false if they
   * decline. `interactive` shows Google's prompt on Android and asks GameKit
   * again on iOS, which may still refuse after the player cancels repeatedly.
   */
  authenticateAsync(interactive: boolean): Promise<boolean>;
  /** The platform keeps each player's best, so lower scores are ignored. */
  submitScoreAsync(score: number, leaderboardIds: string[]): Promise<void>;
  /**
   * The top `count` entries, plus the player's own entry and the one just
   * above it when the player is on the board. `daily` reads today's slice on
   * Android; iOS daily boards reset on their own. Throws when signed out.
   */
  loadLeaderboardAsync(
    leaderboardId: string,
    count: number,
    daily: boolean,
  ): Promise<{
    top: NativeRankEntry[];
    you?: NativeRankEntry;
    above?: NativeRankEntry;
  }>;
  /** Opens the platform's leaderboards screen over the app. */
  showLeaderboardsAsync(): Promise<void>;
}

/** Null on web, and on builds predating it. */
export default requireOptionalNativeModule<GameServicesModule>('GameServices');
