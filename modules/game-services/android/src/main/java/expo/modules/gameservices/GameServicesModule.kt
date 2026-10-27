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

class GameServicesModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private var authenticated = false

  override fun definition() = ModuleDefinition {
    Name("GameServices")

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
        authenticated = it.isSuccessful && it.result.isAuthenticated
        promise.resolve(authenticated)
      }
    }

    /** Play Games keeps each player's best, so lower scores are ignored. */
    AsyncFunction("submitScoreAsync") { score: Long, leaderboardIds: List<String> ->
      if (!authenticated) return@AsyncFunction
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      val client = PlayGames.getLeaderboardsClient(activity)
      leaderboardIds.forEach { client.submitScore(it, score) }
    }

    /**
     * The top of the board, the player's own entry, and the entry just above
     * theirs (for "N points to #2"). Runs off the main thread, so the Play
     * Games tasks can be awaited in order. Play Games has no daily-reset
     * boards, so `daily` reads today's slice of the leaderboard instead.
     */
    AsyncFunction("loadLeaderboardAsync") { leaderboardId: String, count: Int, daily: Boolean ->
      val span = if (daily) LeaderboardVariant.TIME_SPAN_DAILY else LeaderboardVariant.TIME_SPAN_ALL_TIME
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      val client = PlayGames.getLeaderboardsClient(activity)

      val you = Tasks.await(
        client.loadCurrentPlayerLeaderboardScore(leaderboardId, span, COLLECTION)
      ).get()?.let { serialize(it, it.scoreHolder?.playerId) }
      val youId = you?.get("playerId") as String?

      val topScores = Tasks.await(
        client.loadTopScores(leaderboardId, span, COLLECTION, count)
      ).get()
      val top = topScores?.scores?.map { serialize(it, youId) } ?: emptyList()
      topScores?.release()

      val youRank = (you?.get("rank") as Long?) ?: 0L
      var above = top.firstOrNull { it["rank"] == youRank - 1 }
      if (above == null && youRank > 1) {
        val around = Tasks.await(
          client.loadPlayerCenteredScores(leaderboardId, span, COLLECTION, 5)
        ).get()
        above = around?.scores
          ?.firstOrNull { it.rank == youRank - 1 }
          ?.let { serialize(it, youId) }
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
      "playerId" to playerId,
      "isYou" to (playerId != null && playerId == youId),
    )
  }

  private fun hasAppId(): Boolean {
    val info = context.packageManager.getApplicationInfo(
      context.packageName,
      PackageManager.GET_META_DATA,
    )
    return !info.metaData?.getString(APP_ID_KEY).isNullOrBlank()
  }
}
