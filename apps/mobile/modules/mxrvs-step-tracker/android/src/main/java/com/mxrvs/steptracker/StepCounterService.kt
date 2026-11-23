package com.mxrvs.steptracker

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

class StepCounterService : Service(), SensorEventListener {
  private lateinit var sensorManager: SensorManager
  private var stepSensor: Sensor? = null

  override fun onCreate() {
    super.onCreate()
    sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
    stepSensor =
      sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
        ?: sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR)
    createNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (!hasActivityPermission(this) || stepSensor == null) {
      stopSelf()
      return START_NOT_STICKY
    }

    StepTrackerStore.setEnabled(this, true)
    startInForeground()
    VehicleActivityTracker.register(this)
    sensorManager.registerListener(
      this,
      stepSensor,
      SensorManager.SENSOR_DELAY_NORMAL,
      SENSOR_BATCH_LATENCY_US
    )
    ActivityWidgetProvider.updateAll(this)
    return START_STICKY
  }

  override fun onSensorChanged(event: SensorEvent) {
    val elapsedSinceEventMs =
      ((SystemClock.elapsedRealtimeNanos() - event.timestamp) / 1_000_000L)
        .coerceAtLeast(0L)
    val eventWallTimeMs = System.currentTimeMillis() - elapsedSinceEventMs
    val countSteps = !StepTrackerStore.isInVehicle(this)
    val delta =
      when (event.sensor.type) {
        Sensor.TYPE_STEP_COUNTER ->
          StepTrackerStore.recordSensorTotal(
            this,
            event.values[0].toInt(),
            eventWallTimeMs,
            countSteps
          )
        Sensor.TYPE_STEP_DETECTOR ->
          StepTrackerStore.recordDetectedSteps(
            this,
            event.values[0].toInt().coerceAtLeast(1),
            eventWallTimeMs,
            countSteps
          )
        else -> 0
      }
    if (delta <= 0) return

    val steps = StepTrackerStore.getSteps(this)
    val now = System.currentTimeMillis()
    if (StepTrackerStore.shouldRefreshWidget(this, steps, now)) {
      ActivityWidgetProvider.updateAll(this)
    }
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

  override fun onDestroy() {
    sensorManager.unregisterListener(this)
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun startInForeground() {
    val notification = buildNotification()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
          android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH
        } else {
          0
        }
      )
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun buildNotification(): android.app.Notification {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    val pendingIntent =
      launchIntent?.let {
        PendingIntent.getActivity(
          this,
          0,
          it,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
      }

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_menu_directions)
      .setContentTitle("mxrvs daily activity")
      .setContentText("Daily activity tracking is active")
      .setContentIntent(pendingIntent)
      .setOnlyAlertOnce(true)
      .setOngoing(true)
      .setSound(null)
      .setPriority(NotificationCompat.PRIORITY_MIN)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .build()
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

    val channel = NotificationChannel(
      CHANNEL_ID,
      "Daily step tracking",
      NotificationManager.IMPORTANCE_MIN
    ).apply {
      description = "Keeps the low-power device pedometer active."
      setSound(null, null)
      enableVibration(false)
      setShowBadge(false)
    }
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.createNotificationChannel(channel)
  }

  companion object {
    // A new channel is required because Android does not let apps lower an
    // existing channel's importance after the user has installed it.
    private const val CHANNEL_ID = "mxrvs_daily_steps_v2"
    private const val NOTIFICATION_ID = 7312
    // Keep active cardio feedback responsive while still allowing the hardware
    // pedometer to batch events briefly for power efficiency.
    private const val SENSOR_BATCH_LATENCY_US = 1_000_000

    fun hasActivityPermission(context: Context): Boolean =
      Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
        ContextCompat.checkSelfPermission(
          context,
          Manifest.permission.ACTIVITY_RECOGNITION
        ) == PackageManager.PERMISSION_GRANTED

    fun isSensorAvailable(context: Context): Boolean {
      val manager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
      return manager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null ||
        manager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR) != null
    }

    fun start(context: Context) {
      if (!hasActivityPermission(context) || !isSensorAvailable(context)) return
      StepTrackerStore.setEnabled(context, true)
      try {
        ContextCompat.startForegroundService(
          context,
          Intent(context, StepCounterService::class.java)
        )
      } catch (error: RuntimeException) {
        StepTrackerStore.setEnabled(context, false)
        throw error
      }
    }

    fun startIfPermitted(context: Context) {
      if (StepTrackerStore.isEnabled(context) && hasActivityPermission(context)) {
        start(context)
      }
    }

    fun stop(context: Context) {
      StepTrackerStore.setEnabled(context, false)
      VehicleActivityTracker.unregister(context)
      context.stopService(Intent(context, StepCounterService::class.java))
      ActivityWidgetProvider.updateAll(context)
    }
  }
}
