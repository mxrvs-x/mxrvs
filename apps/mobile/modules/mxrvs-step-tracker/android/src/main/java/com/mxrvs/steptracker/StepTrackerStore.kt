package com.mxrvs.steptracker

import android.content.Context
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

  private const val DEFAULT_STRIDE_METERS = 0.762
  private const val STRIDE_HEIGHT_RATIO = 0.415
  private const val STEPS_PER_MOVING_MINUTE = 100.0
  private const val WALKING_KCAL_PER_KG_KM = 0.5

  private fun prefs(context: Context) =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun todayKey(): String =
    SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

  fun isEnabled(context: Context): Boolean =
    prefs(context).getBoolean(KEY_ENABLED, false)

  fun setEnabled(context: Context, enabled: Boolean) {
    prefs(context).edit().putBoolean(KEY_ENABLED, enabled).apply()
  }

  @Synchronized
  fun recordSensorTotal(context: Context, sensorTotal: Int): Int {
    val storage = prefs(context)
    val today = todayKey()
    val storedDate = storage.getString(KEY_DATE, null)
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
    }
    if (heightCm != null && heightCm > 0) {
      editor.putFloat(KEY_HEIGHT_CM, heightCm.toFloat())
    }

    editor.apply()
  }

  fun getSteps(context: Context): Int {
    val storage = prefs(context)
    return if (storage.getString(KEY_DATE, null) == todayKey()) {
      max(0, storage.getInt(KEY_STEPS, 0))
    } else {
      0
    }
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
      "trackingEnabled" to isEnabled(context)
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
