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
  private const val REQUEST_CODE = 7313

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
        pendingIntent(context)
      )
      .addOnFailureListener { error ->
        Log.w("MxrvsStepTracker", "Could not register vehicle transitions", error)
      }
  }

  fun unregister(context: Context) {
    ActivityRecognition.getClient(context)
      .removeActivityTransitionUpdates(pendingIntent(context))
      .addOnCompleteListener {
        StepTrackerStore.setInVehicle(context, false, System.currentTimeMillis())
      }
  }

  private fun pendingIntent(context: Context): PendingIntent {
    val mutabilityFlag =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        PendingIntent.FLAG_MUTABLE
      } else {
        0
      }
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or mutabilityFlag

    return PendingIntent.getBroadcast(
      context,
      REQUEST_CODE,
      Intent(context, VehicleActivityReceiver::class.java),
      flags
    )
  }

  private fun hasPermission(context: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
      ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.ACTIVITY_RECOGNITION
      ) == PackageManager.PERMISSION_GRANTED
}
