package com.mxrvs.steptracker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionResult
import com.google.android.gms.location.DetectedActivity

class VehicleActivityReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (!ActivityTransitionResult.hasResult(intent)) return

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
}
