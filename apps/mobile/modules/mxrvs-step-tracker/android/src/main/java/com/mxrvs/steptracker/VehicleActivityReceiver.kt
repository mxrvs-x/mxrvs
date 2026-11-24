package com.mxrvs.steptracker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import com.google.android.gms.location.ActivityRecognitionResult
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionResult
import com.google.android.gms.location.DetectedActivity

class VehicleActivityReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (ActivityTransitionResult.hasResult(intent)) {
      handleTransitionResult(context, intent)
      return
    }

    if (ActivityRecognitionResult.hasResult(intent)) {
      handleCurrentActivityResult(context, intent)
    }
  }

  private fun handleTransitionResult(context: Context, intent: Intent) {

    val result = ActivityTransitionResult.extractResult(intent) ?: return

    result.transitionEvents
      .filter { it.activityType == DetectedActivity.IN_VEHICLE }
      .forEach { event ->
        val elapsedSinceEventMs =
          ((SystemClock.elapsedRealtimeNanos() - event.elapsedRealTimeNanos) / 1_000_000L)
            .coerceAtLeast(0L)
        val eventWallTimeMs = System.currentTimeMillis() - elapsedSinceEventMs
        val inVehicle =
          event.transitionType == ActivityTransition.ACTIVITY_TRANSITION_ENTER

        StepTrackerStore.setInVehicle(context, inVehicle, eventWallTimeMs)
      }
  }

  private fun handleCurrentActivityResult(context: Context, intent: Intent) {
    val result = ActivityRecognitionResult.extractResult(intent) ?: return
    val activity = result.mostProbableActivity
    if (activity.confidence < MIN_CONFIDENCE) return

    when (activity.type) {
      DetectedActivity.IN_VEHICLE ->
        StepTrackerStore.setInVehicle(context, true, result.time)
      DetectedActivity.ON_FOOT,
      DetectedActivity.WALKING,
      DetectedActivity.RUNNING,
      DetectedActivity.ON_BICYCLE ->
        StepTrackerStore.setInVehicle(context, false, result.time)
    }
  }

  companion object {
    private const val MIN_CONFIDENCE = 60
  }
}
