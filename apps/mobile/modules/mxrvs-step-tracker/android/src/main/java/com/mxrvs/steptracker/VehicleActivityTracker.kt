package com.mxrvs.steptracker

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionRequest
import com.google.android.gms.location.DetectedActivity

internal object VehicleActivityTracker {
  private const val TRANSITION_REQUEST_CODE = 7313
  private const val CURRENT_ACTIVITY_REQUEST_CODE = 7314
  private const val ACTIVITY_UPDATE_INTERVAL_MS = 15_000L

  fun register(context: Context) {
    if (!hasPermission(context)) return

    val transitions = listOf(
      ActivityTransition.Builder()
        .setActivityType(DetectedActivity.IN_VEHICLE)
        .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER)
        .build(),
      ActivityTransition.Builder()
        .setActivityType(DetectedActivity.IN_VEHICLE)
        .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_EXIT)
        .build()
    )

    ActivityRecognition.getClient(context)
      .requestActivityTransitionUpdates(
        ActivityTransitionRequest(transitions),
        transitionPendingIntent(context)
      )
      .addOnFailureListener { error ->
        Log.w("MxrvsStepTracker", "Could not register vehicle transitions", error)
      }

    // Recover the current state when an EXIT transition was missed while the
    // process or activity-recognition provider was asleep.
    ActivityRecognition.getClient(context)
      .requestActivityUpdates(
        ACTIVITY_UPDATE_INTERVAL_MS,
        currentActivityPendingIntent(context)
      )
      .addOnFailureListener { error ->
        Log.w("MxrvsStepTracker", "Could not register current activity updates", error)
      }
  }

  fun unregister(context: Context) {
    StepTrackerStore.setInVehicle(context, false, System.currentTimeMillis())
    ActivityRecognition.getClient(context)
      .removeActivityTransitionUpdates(transitionPendingIntent(context))
    ActivityRecognition.getClient(context)
      .removeActivityUpdates(currentActivityPendingIntent(context))
  }

  private fun transitionPendingIntent(context: Context): PendingIntent =
    pendingIntent(context, TRANSITION_REQUEST_CODE, ACTION_TRANSITION)

  private fun currentActivityPendingIntent(context: Context): PendingIntent =
    pendingIntent(context, CURRENT_ACTIVITY_REQUEST_CODE, ACTION_CURRENT_ACTIVITY)

  private fun pendingIntent(
    context: Context,
    requestCode: Int,
    action: String
  ): PendingIntent {
    val mutabilityFlag =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        PendingIntent.FLAG_MUTABLE
      } else {
        0
      }
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or mutabilityFlag

    return PendingIntent.getBroadcast(
      context,
      requestCode,
      Intent(context, VehicleActivityReceiver::class.java).setAction(action),
      flags
    )
  }

  private fun hasPermission(context: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
      ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.ACTIVITY_RECOGNITION
      ) == PackageManager.PERMISSION_GRANTED

  private const val ACTION_TRANSITION =
    "com.mxrvs.steptracker.action.VEHICLE_TRANSITION"
  private const val ACTION_CURRENT_ACTIVITY =
    "com.mxrvs.steptracker.action.CURRENT_ACTIVITY"
}
