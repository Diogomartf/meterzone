import ExpoModulesCore
import GameKit

public class GameServicesModule: Module {
  /// Promises waiting on the first authentication verdict. GameKit calls the
  /// handler again whenever the player signs in or out, so later calls only
  /// refresh state.
  private var pendingAuth: [Promise] = []
  private var authStarted = false
  private var authResolved = false
  private var signInSheetShown = false
  private static let authTimeout: TimeInterval = 10

  public func definition() -> ModuleDefinition {
    Name("GameServices")

    Function("isAuthenticated") { () -> Bool in
      return GKLocalPlayer.local.isAuthenticated
    }

    AsyncFunction("authenticateAsync") { (interactive: Bool, promise: Promise) in
      if GKLocalPlayer.local.isAuthenticated {
        promise.resolve(true)
        return
      }
      // The silent attempt at launch already got its verdict. Only a tap on the
      // sign-in button asks GameKit again — it may still decline to show its
      // sheet (it stops after repeated cancels), leaving Settings as the way in.
      if self.authResolved {
        guard interactive else {
          promise.resolve(false)
          return
        }
        self.authResolved = false
        self.authStarted = false
      }
      self.pendingAuth.append(promise)
      // GameKit may never call back on a retry (it gives up after repeated
      // cancels, and simulators can't show its sheet). Unless the sheet is up,
      // give up after a while so the caller isn't left waiting forever.
      DispatchQueue.main.asyncAfter(deadline: .now() + Self.authTimeout) { [weak self] in
        guard let self, !self.signInSheetShown, !self.pendingAuth.isEmpty else { return }
        self.finishAuth(signedIn: GKLocalPlayer.local.isAuthenticated)
      }
      guard !self.authStarted else { return }
      self.authStarted = true
      // Setting the handler is what starts sign-in; GameKit keeps it and
      // reports later sign-in changes through it.
      GKLocalPlayer.local.authenticateHandler = { [weak self] viewController, _ in
        guard let self else { return }
        if let viewController {
          // Sign-in sheet. The handler fires again once it closes.
          self.signInSheetShown = true
          self.topViewController()?.present(viewController, animated: true)
          return
        }
        self.signInSheetShown = false
        self.finishAuth(signedIn: GKLocalPlayer.local.isAuthenticated)
      }
    }.runOnQueue(.main)

    AsyncFunction("submitScoreAsync") { (score: Int, leaderboardIds: [String]) async throws in
      guard GKLocalPlayer.local.isAuthenticated else { return }
      try await GKLeaderboard.submitScore(
        score,
        context: 0,
        player: GKLocalPlayer.local,
        leaderboardIDs: leaderboardIds
      )
    }

    /**
     * The top of the board, the player's own entry, and the entry just above
     * theirs (for "N points to #2"). Recurring boards return their current
     * occurrence.
     */
    // `daily` only matters on Android; the iOS daily board is a recurring
    // leaderboard that already returns just today's occurrence.
    AsyncFunction("loadLeaderboardAsync") { (leaderboardId: String, count: Int, _: Bool) async throws -> [String: Any] in
      guard GKLocalPlayer.local.isAuthenticated else { throw NotSignedInException() }
      guard let board = try await GKLeaderboard.loadLeaderboards(IDs: [leaderboardId]).first else {
        throw LeaderboardNotFoundException(leaderboardId)
      }
      let (you, top, _) = try await board.loadEntries(
        for: .global, timeScope: .allTime, range: NSRange(location: 1, length: count))

      var above: GKLeaderboard.Entry?
      if let you, you.rank > 1 {
        above = top.first { $0.rank == you.rank - 1 }
        if above == nil {
          above = try await board.loadEntries(
            for: .global, timeScope: .allTime,
            range: NSRange(location: you.rank - 1, length: 1)
          ).1.first
        }
      }

      var result: [String: Any] = ["top": top.map(Self.serialize)]
      if let you { result["you"] = Self.serialize(you) }
      if let above { result["above"] = Self.serialize(above) }
      return result
    }

    // GKGameCenterViewController is deprecated from iOS 26; the access point
    // opens the same leaderboards (in the Games app overlay on iOS 26+).
    AsyncFunction("showLeaderboardsAsync") { (promise: Promise) in
      GKAccessPoint.shared.trigger(state: .leaderboards) {
        promise.resolve(nil)
      }
    }.runOnQueue(.main)
  }

  private func finishAuth(signedIn: Bool) {
    authResolved = true
    let waiting = pendingAuth
    pendingAuth = []
    waiting.forEach { $0.resolve(signedIn) }
  }

  private static func serialize(_ entry: GKLeaderboard.Entry) -> [String: Any] {
    return [
      "rank": entry.rank,
      "name": entry.player.displayName,
      "alias": entry.player.alias,
      "score": entry.score,
      "isYou": entry.player.gamePlayerID == GKLocalPlayer.local.gamePlayerID,
    ]
  }

  private func topViewController() -> UIViewController? {
    var top = appContext?.utilities?.currentViewController()
    while let presented = top?.presentedViewController {
      top = presented
    }
    return top
  }
}

private final class NotSignedInException: Exception, @unchecked Sendable {
  override var reason: String { "The player is not signed in to Game Center" }
}

private final class LeaderboardNotFoundException: GenericException<String>, @unchecked Sendable {
  override var reason: String { "Leaderboard '\(param)' was not found" }
}
