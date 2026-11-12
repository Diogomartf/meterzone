package expo.modules.gameservices

import android.content.Context
import android.content.pm.PackageManager
import com.google.android.gms.games.PlayGames
import com.google.android.gms.games.PlayGamesSdk
import com.google.android.gms.games.leaderboard.LeaderboardScore
import com.google.android.gms.games.leaderboard.LeaderboardVariant
import com.google.android.gms.tasks.Tasks
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val APP_ID_KEY = "com.google.android.gms.games.APP_ID"
private const val LEADERBOARDS_REQUEST = 9004
private const val COLLECTION = LeaderboardVariant.COLLECTION_PUBLIC
/** The most entries Play Games returns in one page. */
private const val MAX_PAGE = 25

class GameServicesModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private var authenticated = false

  override fun definition() = ModuleDefinition {
    Name("GameServices")

    Events("onSignInChange")

    OnCreate {
      if (hasAppId()) PlayGamesSdk.initialize(context)
    }

    /** False until the Play Games project ID is in the manifest (see app.plugin.js). */
    Function("isAvailable") { hasAppId() }

    Function("isAuthenticated") { authenticated }

    /**
     * Play Games signs players in automatically at launch, so the silent path
     * only asks for the verdict. `interactive` shows Google's sign-in prompt —
     * used when the player taps Ranking after declining earlier.
     */
    AsyncFunction("authenticateAsync") { interactive: Boolean, promise: Promise ->
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      val client = PlayGames.getGamesSignInClient(activity)
      val task = if (interactive) client.signIn() else client.isAuthenticated
      task.addOnCompleteListener {
        val signedIn = it.isSuccessful && it.result.isAuthenticated
        val changed = signedIn != authenticated
        authenticated = signedIn
        promise.resolve(signedIn)
        if (changed) sendEvent("onSignInChange", mapOf("signedIn" to signedIn))
      }
    }

    /** Play Games keeps each player's best, so lower scores are ignored. */
    AsyncFunction("submitScoreAsync") { score: Long, leaderboardIds: List<String>, context: Long ->
      if (!authenticated) return@AsyncFunction
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      val client = PlayGames.getLeaderboardsClient(activity)
      // Play Games has no numeric context; its score tag carries the same code.
      leaderboardIds.forEach { client.submitScore(it, score, context.toString()) }
    }

    /**
     * The top of the board, the player's own entry, and the entry just above
     * theirs (for "N points to #2"). Runs off the main thread, so the Play
     * Games tasks can be awaited in order. Play Games has no daily-reset
     * boards, so `daily` reads today's slice of the leaderboard instead.
     *
     * That slice resets at midnight UTC-7, but the daily sequence changes at
     * 00:00 UTC (`todayKey`). For the 7 hours in between, the slice still
     * holds scores from yesterday's sequence, so they're dropped and the
     * ranks closed up. Only the first page is checked, so a rank further down
     * can be a few places high in that window.
     */
    AsyncFunction("loadLeaderboardAsync") { leaderboardId: String, count: Int, daily: Boolean, _avatarLeaderboardId: String ->
      val span = if (daily) LeaderboardVariant.TIME_SPAN_DAILY else LeaderboardVariant.TIME_SPAN_ALL_TIME
      val since = if (daily) utcMidnight() else Long.MIN_VALUE
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      val client = PlayGames.getLeaderboardsClient(activity)

      val yourScore = Tasks.await(
        client.loadCurrentPlayerLeaderboardScore(leaderboardId, span, COLLECTION)
      ).get()
      val youId = yourScore?.scoreHolder?.playerId

      val topScores = Tasks.await(
        client.loadTopScores(leaderboardId, span, COLLECTION, if (daily) MAX_PAGE else count)
      ).get()
      val loaded = topScores?.scores?.map { serialize(it, youId) } ?: emptyList()
      topScores?.release()

      // Ranks of yesterday's entries, to close up the ranks below them.
      val stale = loaded.filter { it.timestamp < since }.map { it.rank }
      fun fresh(entry: Map<String, Any?>): Map<String, Any?> {
        val rank = entry.rank
        return if (rank <= 0) entry else entry + ("rank" to rank - stale.count { it < rank })
      }

      val top = loaded.filter { it.timestamp >= since }.map(::fresh).take(count)
      val you = yourScore
        ?.takeIf { it.timestampMillis >= since }
        ?.let { fresh(serialize(it, youId)) }

      val youRank = you?.rank ?: 0L
      var above = top.firstOrNull { it.rank == youRank - 1 }
      if (above == null && youRank > 1) {
        val around = Tasks.await(
          client.loadPlayerCenteredScores(leaderboardId, span, COLLECTION, 5)
        ).get()
        above = around?.scores
          ?.map { serialize(it, youId) }
          ?.filter { it.timestamp >= since }
          ?.map(::fresh)
          ?.firstOrNull { it.rank == youRank - 1 }
        around?.release()
      }

      buildMap {
        put("top", top)
        you?.let { put("you", it) }
        above?.let { put("above", it) }
      }
    }

    AsyncFunction("showLeaderboardsAsync") { promise: Promise ->
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      PlayGames.getLeaderboardsClient(activity).allLeaderboardsIntent
        .addOnSuccessListener { intent ->
          activity.startActivityForResult(intent, LEADERBOARDS_REQUEST)
          promise.resolve(null)
        }
        .addOnFailureListener { promise.reject("ERR_LEADERBOARDS", it.message, it) }
    }
  }

  private fun serialize(score: LeaderboardScore, youId: String?): Map<String, Any?> {
    val playerId = score.scoreHolder?.playerId
    return mapOf(
      "rank" to score.rank,
      "name" to score.scoreHolderDisplayName,
      "score" to score.rawScore,
      "context" to (score.scoreTag?.toLongOrNull() ?: 0L),
      "playerId" to playerId,
      "isYou" to (playerId != null && playerId == youId),
      "timestamp" to score.timestampMillis,
    )
  }

  private val Map<String, Any?>.rank: Long get() = this["rank"] as Long
  private val Map<String, Any?>.timestamp: Long get() = this["timestamp"] as Long

  /** Today's 00:00 UTC in ms, when the daily sequence changes. */
  private fun utcMidnight(): Long {
    val day = 24 * 60 * 60 * 1000L
    return System.currentTimeMillis() / day * day
  }

  private fun hasAppId(): Boolean {
    val info = context.packageManager.getApplicationInfo(
      context.packageName,
      PackageManager.GET_META_DATA,
    )
    return !info.metaData?.getString(APP_ID_KEY).isNullOrBlank()
  }
}
