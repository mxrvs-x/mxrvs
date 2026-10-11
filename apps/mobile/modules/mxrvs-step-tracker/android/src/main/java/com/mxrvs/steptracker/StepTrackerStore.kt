package com.mxrvs.steptracker

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.os.UserManager
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.max
import kotlin.math.roundToInt

internal object StepTrackerStore {
  private const val PREFS = "mxrvs_native_step_tracker"
  private const val KEY_ENABLED = "tracking_enabled"
  private const val KEY_DATE = "activity_date"
  private const val KEY_STEPS = "daily_steps"
  private const val KEY_SENSOR_TOTAL = "last_sensor_total"
  private const val KEY_WEIGHT_KG = "weight_kg"
  private const val KEY_HEIGHT_CM = "height_cm"
  private const val KEY_LAST_WIDGET_STEPS = "last_widget_steps"
  private const val KEY_LAST_WIDGET_UPDATE = "last_widget_update"
  private const val KEY_IN_VEHICLE = "in_vehicle"
  private const val KEY_VEHICLE_UPDATED_AT = "vehicle_updated_at"
  private const val KEY_ARCHIVED_ACTIVITIES = "archived_activities"

  private const val DEFAULT_STRIDE_METERS = 0.762
  private const val STRIDE_HEIGHT_RATIO = 0.415
  private const val STEPS_PER_MOVING_MINUTE = 100.0
  private const val WALKING_KCAL_PER_KG_KM = 0.5

  private fun prefs(context: Context) =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      val deviceContext = context.createDeviceProtectedStorageContext()
      val userManager = context.getSystemService(UserManager::class.java)

      if (!context.isDeviceProtectedStorage && userManager?.isUserUnlocked == true) {
        deviceContext.moveSharedPreferencesFrom(context, PREFS)
      }

      deviceContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    } else {
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    }

  fun todayKey(date: Date = Date()): String =
    SimpleDateFormat("yyyy-MM-dd", Locale.US).format(date)

  fun isEnabled(context: Context): Boolean =
    prefs(context).getBoolean(KEY_ENABLED, false)

  fun setEnabled(context: Context, enabled: Boolean) {
    prefs(context).edit().putBoolean(KEY_ENABLED, enabled).apply()
  }

  @Synchronized
  fun recordSensorTotal(
    context: Context,
    sensorTotal: Int,
    eventTimeMs: Long = System.currentTimeMillis(),
    countSteps: Boolean = true
  ): Int {
    val storage = prefs(context)
    val today = todayKey()
    val eventDate = todayKey(Date(eventTimeMs))
    val storedDate = storage.getString(KEY_DATE, null)
    if (storedDate != null && storedDate != today) {
      archiveStoredActivity(storage, storedDate)
    }
    val previousSensorTotal = storage.getInt(KEY_SENSOR_TOTAL, -1)
    val previousSteps =
      if (storedDate == today) storage.getInt(KEY_STEPS, 0) else 0

    if (previousSensorTotal < 0) {
      storage.edit()
        .putString(KEY_DATE, today)
        .putInt(KEY_STEPS, previousSteps)
        .putInt(KEY_SENSOR_TOTAL, sensorTotal)
        .apply()
      return 0
    }

    // A delayed sensor event from before midnight establishes the new baseline
    // but must not be added to the new day's total.
    if (eventDate != today) {
      storage.edit()
        .putString(KEY_DATE, today)
        .putInt(KEY_STEPS, previousSteps)
        .putInt(KEY_SENSOR_TOTAL, sensorTotal)
        .apply()
      return 0
    }

    if (!countSteps) {
      storage.edit()
        .putString(KEY_DATE, today)
        .putInt(KEY_STEPS, previousSteps)
        .putInt(KEY_SENSOR_TOTAL, sensorTotal)
        .apply()
      return 0
    }

    val delta =
      if (sensorTotal >= previousSensorTotal) sensorTotal - previousSensorTotal
      else 0 // The hardware counter reset after a phone reboot.
    val nextSteps = max(0, previousSteps + delta)

    storage.edit()
      .putString(KEY_DATE, today)
      .putInt(KEY_STEPS, nextSteps)
      .putInt(KEY_SENSOR_TOTAL, sensorTotal)
      .apply()

    return delta
  }

  fun setBodyMetrics(context: Context, weightKg: Double?, heightCm: Double?) {
    val editor = prefs(context).edit()

    if (weightKg != null && weightKg > 0) {
      editor.putFloat(KEY_WEIGHT_KG, weightKg.toFloat())
    } else {
      editor.remove(KEY_WEIGHT_KG)
    }
    if (heightCm != null && heightCm > 0) {
      editor.putFloat(KEY_HEIGHT_CM, heightCm.toFloat())
    } else {
      editor.remove(KEY_HEIGHT_CM)
    }

    editor.apply()
  }

  fun isInVehicle(context: Context): Boolean =
    prefs(context).getBoolean(KEY_IN_VEHICLE, false)

  fun setInVehicle(context: Context, inVehicle: Boolean, updatedAt: Long) {
    prefs(context).edit()
      .putBoolean(KEY_IN_VEHICLE, inVehicle)
      .putLong(KEY_VEHICLE_UPDATED_AT, updatedAt)
      .apply()
  }

  @Synchronized
  fun getSteps(context: Context): Int {
    val storage = prefs(context)
    val storedDate = storage.getString(KEY_DATE, null)
    if (storedDate != null && storedDate != todayKey()) {
      archiveStoredActivity(storage, storedDate)
      storage.edit()
        .putString(KEY_DATE, todayKey())
        .putInt(KEY_STEPS, 0)
        .apply()
      return 0
    }

    return if (storedDate == todayKey()) {
      max(0, storage.getInt(KEY_STEPS, 0))
    } else {
      0
    }
  }

  @Synchronized
  fun archiveCurrentActivity(context: Context) {
    val storage = prefs(context)
    val storedDate = storage.getString(KEY_DATE, null) ?: return
    archiveStoredActivity(storage, storedDate)
  }

  @Synchronized
  fun getArchivedActivities(context: Context): List<Map<String, Any>> {
    val stored = prefs(context).getString(KEY_ARCHIVED_ACTIVITIES, "[]") ?: "[]"
    val array = runCatching { JSONArray(stored) }.getOrElse { JSONArray() }

    return (0 until array.length()).mapNotNull { index ->
      val item = array.optJSONObject(index) ?: return@mapNotNull null
      val date = item.optString("activityDate")
      if (date.isBlank()) return@mapNotNull null

      mapOf(
        "activityDate" to date,
        "steps" to item.optInt("steps", 0),
        "durationSeconds" to item.optInt("durationSeconds", 0),
        "caloriesBurned" to item.optDouble("caloriesBurned", 0.0)
      )
    }
  }

  @Synchronized
  fun removeArchivedActivity(context: Context, activityDate: String, syncedSteps: Int) {
    val storage = prefs(context)
    val stored = storage.getString(KEY_ARCHIVED_ACTIVITIES, "[]") ?: "[]"
    val source = runCatching { JSONArray(stored) }.getOrElse { JSONArray() }
    val next = JSONArray()

    for (index in 0 until source.length()) {
      val item = source.optJSONObject(index) ?: continue
      if (
        item.optString("activityDate") != activityDate ||
        item.optInt("steps", 0) > syncedSteps
      ) {
        next.put(item)
      }
    }

    storage.edit().putString(KEY_ARCHIVED_ACTIVITIES, next.toString()).apply()
  }

  private fun archiveStoredActivity(storage: SharedPreferences, activityDate: String) {
    val steps = max(0, storage.getInt(KEY_STEPS, 0))
    val heightCm = storage.getFloat(KEY_HEIGHT_CM, 0f).toDouble().takeIf { it > 0 }
    val weightKg = storage.getFloat(KEY_WEIGHT_KG, 0f).toDouble().takeIf { it > 0 }
    val strideMeters =
      if (heightCm != null) (heightCm / 100.0) * STRIDE_HEIGHT_RATIO
      else DEFAULT_STRIDE_METERS
    val distanceKm = steps * strideMeters / 1000.0
    val durationSeconds = (steps / STEPS_PER_MOVING_MINUTE * 60.0).roundToInt()
    val calories =
      if (weightKg != null) weightKg * distanceKm * WALKING_KCAL_PER_KG_KM
      else 0.0
    val storedQueue = storage.getString(KEY_ARCHIVED_ACTIVITIES, "[]") ?: "[]"
    val source = runCatching { JSONArray(storedQueue) }.getOrElse { JSONArray() }
    val next = JSONArray()

    // Re-archiving the same day replaces its earlier checkpoint with the
    // final counter value observed at rollover.
    for (index in 0 until source.length()) {
      val item = source.optJSONObject(index) ?: continue
      if (item.optString("activityDate") != activityDate) next.put(item)
    }

    next.put(
      JSONObject()
        .put("activityDate", activityDate)
        .put("steps", steps)
        .put("durationSeconds", durationSeconds)
        .put("caloriesBurned", calories)
    )
    storage.edit().putString(KEY_ARCHIVED_ACTIVITIES, next.toString()).apply()
  }

  fun snapshot(context: Context): Map<String, Any?> {
    val storage = prefs(context)
    val steps = getSteps(context)
    val weightKg = storage.getFloat(KEY_WEIGHT_KG, 0f).toDouble()
      .takeIf { it > 0 }
    val heightCm = storage.getFloat(KEY_HEIGHT_CM, 0f).toDouble()
      .takeIf { it > 0 }
    val strideMeters =
      if (heightCm != null) (heightCm / 100.0) * STRIDE_HEIGHT_RATIO
      else DEFAULT_STRIDE_METERS
    val distanceKm = steps * strideMeters / 1000.0
    val movingSeconds = (steps / STEPS_PER_MOVING_MINUTE * 60.0).roundToInt()
    val calories =
      if (weightKg != null) (weightKg * distanceKm * WALKING_KCAL_PER_KG_KM).roundToInt()
      else 0

    return mapOf(
      "date" to todayKey(),
      "steps" to steps,
      "movingSeconds" to movingSeconds,
      "distanceKm" to distanceKm,
      "caloriesBurned" to calories,
      "weightKg" to weightKg,
      "heightCm" to heightCm,
      "trackingEnabled" to isEnabled(context),
      "inVehicle" to isInVehicle(context),
      "vehicleActivityUpdatedAt" to storage.getLong(KEY_VEHICLE_UPDATED_AT, 0L)
    )
  }

  fun shouldRefreshWidget(context: Context, steps: Int, nowMs: Long): Boolean {
    val storage = prefs(context)
    val lastSteps = storage.getInt(KEY_LAST_WIDGET_STEPS, -1)
    val lastUpdate = storage.getLong(KEY_LAST_WIDGET_UPDATE, 0L)
    return lastSteps < 0 || steps - lastSteps >= 5 || nowMs - lastUpdate >= 30_000L
  }

  fun markWidgetRefreshed(context: Context, steps: Int, nowMs: Long) {
    prefs(context).edit()
      .putInt(KEY_LAST_WIDGET_STEPS, steps)
      .putLong(KEY_LAST_WIDGET_UPDATE, nowMs)
      .apply()
  }
}
