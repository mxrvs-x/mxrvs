package com.mxrvs.steptracker

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

internal object SleepWidgetStore {
  private const val OWNER = "owner"

  private fun preferences(context: Context) =
    context.getSharedPreferences("mxrvs_sleep_widget", Context.MODE_PRIVATE)

  private fun key(owner: String) = "recording:$owner"

  @Synchronized
  fun setOwner(context: Context, owner: String?, legacy: String?) {
    val prefs = preferences(context)
    val update = prefs.edit().putString(OWNER, owner)
    if (owner != null && legacy != null && !prefs.contains(key(owner))) {
      update.putString(key(owner), legacy)
    }
    check(update.commit())
  }

  @Synchronized
  fun read(context: Context, owner: String): String? =
    preferences(context).getString(key(owner), null)

  @Synchronized
  fun widgetState(context: Context): Pair<Boolean, JSONObject?> {
    val owner = preferences(context).getString(OWNER, null) ?: return false to null
    return true to read(context, owner)?.let(::JSONObject)
  }

  @Synchronized
  fun replace(context: Context, owner: String, expected: String?, next: String?): Boolean {
    val prefs = preferences(context)
    if (prefs.getString(OWNER, null) != owner || read(context, owner) != expected) return false
    return prefs.edit().putString(key(owner), next).commit()
  }

  @Synchronized
  fun record(context: Context, action: String, now: Long = System.currentTimeMillis()) {
    val owner = preferences(context).getString(OWNER, null) ?: return
    val raw = read(context, owner)
    val recording = raw?.let(::JSONObject)
    val at = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.ROOT).apply {
      timeZone = TimeZone.getTimeZone("UTC")
    }.format(Date(now))

    val next = if (recording == null) {
      if (action != "start") return
      JSONObject().apply {
        put("startedAt", at)
        put("zone", TimeZone.getDefault().id)
        put("awakenings", JSONArray())
        put("awakeSince", JSONObject.NULL)
        put("finishedAt", JSONObject.NULL)
      }
    } else {
      if (!recording.isNull("finishedAt")) return
      val awakeSince = if (recording.isNull("awakeSince")) null else recording.getString("awakeSince")
      val awakenings = recording.getJSONArray("awakenings")
      val lastResumed = awakenings.optJSONObject(awakenings.length() - 1)?.getString("resumedAt")
      if (at <= (awakeSince ?: lastResumed ?: recording.getString("startedAt"))) return
      when (action) {
        "wake" -> if (awakeSince == null) recording.put("awakeSince", at) else return
        "resume" -> {
          if (awakeSince == null) return
          awakenings.put(JSONObject().put("wokeAt", awakeSince).put("resumedAt", at))
          recording.put("awakeSince", JSONObject.NULL)
        }
        "finish" -> recording.put("finishedAt", awakeSince ?: at)
        else -> return
      }
    }
    replace(context, owner, raw, next.toString())
  }
}
